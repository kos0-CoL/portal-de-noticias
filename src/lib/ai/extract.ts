import { load } from 'cheerio';
import { z } from 'zod';
import { countWords, extractImageUrls, sanitizeHtml, stripHtml, truncate } from '@/lib/utils';
import { getAiSettings, resolveExtractModel } from '@/lib/settings';
import { chatComplete, type ChatMessage } from '@/lib/ai/provider';
import { extractJsonObject } from '@/lib/ai/json';
import { CONTENEDORES_DESCARTE, type ParsedArticle } from '@/lib/scraper/parser';

/**
 * Extracción del cuerpo de una nota con IA.
 *
 * Alternativa a `parseArticle` para fuentes cuyo HTML no se deja leer con
 * selectores. Se le pasa al modelo el HTML de la nota ya reducido (sin
 * navegación, scripts ni publicidad) y devuelve exactamente el mismo
 * `ParsedArticle` que el parser por selectores, para que el pipeline no
 * tenga que distinguir de dónde salió la nota.
 */

/** Tope de caracteres del HTML que se le manda al modelo (controla el costo en tokens). */
const LIMITE_HTML = 40_000;

/** Atributos que sí se conservan al limpiar el HTML. */
const ATRIBUTOS_UTILES = new Set(['src', 'href', 'alt']);

/** Etiquetas que nunca aportan al contenido de la nota. */
const ETIQUETAS_INUTILES =
  'script, style, link, svg, iframe, video, audio, canvas, button, input, select, textarea, template, noscript';

/** Esquema de lo que tiene que devolver el modelo. */
const articuloSchema = z.object({
  title: z.string().min(1, 'La IA no devolvió el título de la nota.'),
  content: z.string().min(1, 'La IA no devolvió el cuerpo de la nota.'),
  summary: z.string().catch(''),
  images: z.array(z.string()).catch([]),
  publishedAt: z.string().nullable().catch(null)
});

const SISTEMA = `Sos un extractor de notas periodísticas. Recibís el HTML de una nota ya bajada de un sitio de noticias y devolvés su contenido en JSON.

Reglas inquebrantables:
1. TRANSCRIBÍ el contenido tal como está en el HTML. NO resumas, NO reescribas, NO agregues contexto ni opiniones, NO inventes datos, nombres ni fechas.
2. Descartá todo lo que no sea la nota: menús, publicidad, notas relacionadas, comentarios, formularios, pies de página y suscripciones.
3. Devolvé ÚNICAMENTE un objeto JSON válido, sin texto antes ni después y sin bloques de código.
4. El cuerpo va en HTML con etiquetas editoriales: <p>, <h2>, <h3>, <blockquote>, <ul>, <ol>, <li>, <strong>, <em>. PROHIBIDO markdown, <html>, <body>, <script>, <style> e <img>.
5. No repitas el título dentro del cuerpo.
6. Si un dato no está en el HTML, no lo inventes: usá "" o null.`;

const FORMATO = `Devolvé exactamente este JSON:

{
  "title": "Titular de la nota, tal como figura en el HTML",
  "content": "<p>Primer párrafo...</p><p>Segundo párrafo...</p>",
  "summary": "Copete o bajada de la nota (40 a 60 palabras). Si no hay, resumí el primer párrafo.",
  "images": ["https://.../foto.jpg"],
  "publishedAt": "2026-11-01T09:40:00-03:00"
}

- "images": solo las fotos de la nota, en orden de aparición, sin repetir, sin logos ni íconos. Si son rutas relativas, devolvelas tal cual aparecen.
- "publishedAt": fecha de publicación en formato ISO 8601. Si no la encontrás, null.`;

export interface ExtractAiOptions {
  /** Sobrescribe el modelo configurado. */
  model?: string;
}

/**
 * Reduce el HTML de la nota a lo mínimo que el modelo necesita leer: saca
 * navegación, scripts y publicidad, borra los atributos que no aportan y
 * recorta el largo para acotar el consumo de tokens.
 */
export function reducirHtml(html: string): string {
  const $ = load(html);

  $(CONTENEDORES_DESCARTE).remove();
  $(ETIQUETAS_INUTILES).remove();

  $('*').each((_, el) => {
    const nodo = el as unknown as { attribs?: Record<string, string> };
    if (!nodo.attribs) return;
    for (const nombre of Object.keys(nodo.attribs)) {
      if (!ATRIBUTOS_UTILES.has(nombre)) delete nodo.attribs[nombre];
    }
  });

  const texto = $.html()
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();

  return texto.length > LIMITE_HTML ? texto.slice(0, LIMITE_HTML) : texto;
}

/** Normaliza las URLs de las imágenes contra la URL de la nota. */
function resolverImagenes(urls: string[], url: string): string[] {
  const imagenes: string[] = [];
  for (const raw of urls) {
    const limpia = raw.trim().replace(/^["']|["']$/g, '');
    if (!limpia || limpia.startsWith('data:')) continue;

    let absoluta: string;
    try {
      absoluta = new URL(limpia, url).toString();
    } catch {
      continue;
    }
    const lower = absoluta.toLowerCase();
    if (/(logo|avatar|icon|sprite|-150x150)/.test(lower)) continue;
    if (!imagenes.includes(absoluta)) imagenes.push(absoluta);
  }
  return imagenes.slice(0, 6);
}

/**
 * Extrae título, cuerpo, imágenes, extracto y fecha de una nota usando IA.
 * Lanza un Error en español si el modelo no devuelve algo usable.
 */
export async function extractArticleWithAi(
  html: string,
  url: string,
  opts: ExtractAiOptions = {}
): Promise<ParsedArticle> {
  const settings = await getAiSettings();
  if (!settings.hasApiKey) {
    throw new Error('No hay una API Key de IA configurada. Cargala en /admin/ia para usar la extracción por IA.');
  }

  const reducido = reducirHtml(html);
  if (reducido.length < 200) {
    throw new Error('El HTML de la nota quedó vacío o casi vacío después de limpiarlo: no hay nada que extraer.');
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: SISTEMA },
    { role: 'user', content: `URL de la nota: ${url}\n\n--- HTML DE LA NOTA ---\n${reducido}\n\n--- FIN DEL HTML ---\n\n${FORMATO}` }
  ];

  const raw = await chatComplete(messages, {
    json: true,
    model: opts.model?.trim() || resolveExtractModel(settings),
    temperature: 0,
    maxTokens: 8000
  });

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(extractJsonObject(raw, 'Volvé a intentar la extracción.'));
  } catch (error) {
    throw new Error(
      error instanceof Error && error.message.includes('JSON')
        ? error.message
        : 'No se pudo interpretar la respuesta de la IA. Volvé a intentar la extracción.'
    );
  }

  const validacion = articuloSchema.safeParse(parsedJson);
  if (!validacion.success) {
    const detalle = validacion.error.issues.map((i) => i.path.join('.') + ': ' + i.message).join('; ');
    throw new Error(`La IA devolvió una extracción incompleta (${detalle}).`);
  }

  const data = validacion.data;
  const title = data.title.replace(/\s+/g, ' ').trim();
  const contentHtml = sanitizeHtml(data.content.replace(/```html|```/gi, '').trim());
  const content = stripHtml(contentHtml);
  const palabras = countWords(contentHtml);

  if (!contentHtml) {
    throw new Error('La IA no devolvió un cuerpo de nota usable.');
  }
  if (palabras < 40) {
    throw new Error(
      `El cuerpo de la nota tiene muy poco texto (${palabras} palabras): probablemente la IA no encontró la nota o el HTML no la contiene.`
    );
  }

  // Sumamos las imágenes que el modelo listó y las que quedaron dentro del cuerpo.
  const imagenes = resolverImagenes([...data.images, ...extractImageUrls(contentHtml)], url);

  const primerParrafo = String(contentHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? '');
  const excerpt = truncate(data.summary.trim() || stripHtml(primerParrafo), 200);

  let publishedAt: Date | null = null;
  if (data.publishedAt) {
    const fecha = new Date(data.publishedAt);
    if (!Number.isNaN(fecha.getTime())) publishedAt = fecha;
  }

  return { title, content, contentHtml, images: imagenes, excerpt, publishedAt };
}
