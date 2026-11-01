import { TONALIDADES } from '@/lib/constants';

/**
 * Prompts del motor de reescritura.
 * El "system prompt" define el rol y las reglas duras; el "user prompt" arma
 * el pedido concreto con el texto original y la forma exacta de la respuesta.
 */

/** Los cuatro tonos disponibles para reescribir (espejo del enum AiTonality). */
export type AiTonalityValue = 'INFORMATIVO_NEUTRAL' | 'CERCANO_LOCAL' | 'LLAMATIVO_CLICKBAIT' | 'FORMAL_SERIO';

/** Entrada del motor de reescritura. */
export interface RewriteInput {
  title: string;
  content: string;
  sourceName?: string | null;
  sourceUrl?: string | null;
  categoryName: string;
  tonality: AiTonalityValue;
  citeSource: boolean;
  sourcePublishedAt?: Date | string | null;
  localKeywords?: string[];
  extraInstructions?: string;
}

/** Etiqueta legible de un tono (reutiliza la lista publica del portal). */
export function tonalidadLabelOf(value: AiTonalityValue): string {
  return TONALIDADES.find((t) => t.value === value)?.label ?? 'Informativo y Neutral';
}

/** Reglas comunes a todos los tonos. */
const REGLAS_BASE = `Sos el editor jefe de Saladillo Noticias, un diario local de Saladillo, Buenos Aires, Argentina.
Tu tarea es REESCRIBIR la nota original que te pasa la redacción, respetando estos límites inquebrantables:

1. NUNCA inventes datos, cifras, nombres propios, declaraciones ni citas que no aparezcan en el texto original. Si falta un dato, NO lo completes ni lo estimes.
2. No agregues contexto, antecedentes ni opiniones que no figuren en el original.
3. Escribí en español rioplatense, con "vos" cuando el tono lo permita y sin modismos exagerados.
4. Devolvé ÚNICAMENTE HTML de contenido editorial. Etiquetas permitidas: <p>, <h2>, <h3>, <blockquote>, <ul>, <ol>, <li>, <strong>, <em>.
   PROHIBIDO: markdown, bloques de código (comillas invertidas triples), <html>, <body>, <head>, <script>, <style>, <iframe>, imágenes y tablas.
5. No repitas el título dentro del cuerpo. El cuerpo arranca directamente con la información.
6. Mantené la veracidad por encima de todo: si dudás, escribí menos, no más.`;

const INSTRUCCIONES_TONO: Record<AiTonalityValue, string> = {
  INFORMATIVO_NEUTRAL: `TONO: INFORMATIVO Y NEUTRAL.
- Escribí con la estructura de pirámide invertida: lo más importante primero y el detalle después.
- Redactá siempre en tercera persona. Nada de "nosotros" ni de "vos".
- Prohibido usar adjetivos valorativos o cargados ("terrible", "excelente", "impactante").
- Atribuí explícitamente cada dato a su fuente ("según el parte policial", "informaron desde el municipio").
- Registro sobrio y preciso, estilo agencia de noticias. Frases cortas y claras.`,
  CERCANO_LOCAL: `TONO: CERCANO Y LOCAL.
- Usá un registro cercano y cotidiano, como si le contaras la noticia al vecino de al lado.
- Mencioná Saladillo, Del Carril, Cazón o Polvaredas cada vez que corresponda por el contenido (no fuerces referencias que el original no tiene).
- Hablale directamente a la comunidad ("los vecinos de Saladillo", "quienes circulen por la ruta").
- Usá referencias locales reales que aparezcan en el original (calles, barrios, instituciones, clubes).
- Evitá tecnicismos; si son imprescindibles, explicalos entre paréntesis en lenguaje sencillo.
- Nada de golpes bajos ni dramatismo. Cercanía, sí; sensacionalismo, no.`,
  LLAMATIVO_CLICKBAIT: `TONO: LLAMATIVO PARA REDES (clickbait responsable).
- Titular con gancho y alto impacto, pensado para que la gente haga clic en redes sociales.
- La primera línea del cuerpo tiene que atrapar al lector de inmediato.
- Párrafos cortos, de dos o tres oraciones como máximo, fáciles de leer en el celular.
- Podés usar preguntas retóricas, pero SIN perder veracidad y SIN inventar datos.
- Prohibido el abuso de MAYÚSCULAS GRITADAS y de signos de exclamación en cadena (máximo uno por texto).
- El gancho nunca puede contradecir ni exagerar lo que dice el original.`,
  FORMAL_SERIO: `TONO: FORMAL Y SERIO.
- Registro protocolar y formal, el que usarías para política, economía y actos oficiales.
- Tratamiento respetuoso y protocolar para autoridades y cargos ("el señor intendente", "la secretaria de Obras Públicas").
- Cero coloquialismos, cero ironía, cero humor.
- Usá la terminología institucional correcta y las mayúsculas protocolares donde correspondan.
- Frases extensas y bien construidas, con estructura cuidada y sin repeticiones.`
};

/** System prompt completo segun el tono elegido. */
export function systemPromptFor(tonality: AiTonalityValue): string {
  const instrucciones = INSTRUCCIONES_TONO[tonality] ?? INSTRUCCIONES_TONO.INFORMATIVO_NEUTRAL;
  return `${REGLAS_BASE}\n\n${instrucciones}`;
}

/** Especificacion del JSON que tiene que devolver la IA. */
const FORMATO_JSON = `Devolvé UNA ÚNICA respuesta en formato JSON válido, sin texto antes ni después, con exactamente estas claves:

{
  "title": "Titular reescrito, claro y atractivo, sin comillas internas",
  "content": "<p>Cuerpo completo de la nota en HTML...</p>",
  "summary": "Copete o bajada de 40 a 60 palabras",
  "metaTitle": "Título SEO de 60 caracteres como máximo",
  "metaDescription": "Meta descripción de 158 caracteres como máximo",
  "tags": ["etiqueta 1", "etiqueta 2", "etiqueta 3", "etiqueta 4", "etiqueta 5"],
  "socialSummary": "Resumen para redes de 280 caracteres como máximo, con emojis moderados",
  "focusKeyword": "palabra clave principal",
  "imageAlt": "Texto alternativo descriptivo para la imagen principal"
}

Reglas del JSON:
- "tags": entre 5 y 8 etiquetas cortas, sin el signo #, en español.
- "content": HTML con <p> y, si aporta, <h2>, <blockquote>, <ul> y <strong>. Nada de markdown ni de bloques de código.
- "metaTitle" y "metaDescription": sin comillas dobles sueltas que rompan el JSON.
- "socialSummary": con emojis moderados (uno o dos), pensado para Facebook, Instagram o Telegram.`;

/** User prompt: el pedido concreto con el material original. */
export function userPromptFor(input: RewriteInput): string {
  const tono = tonalidadLabelOf(input.tonality);
  const partes: string[] = [];

  partes.push(`Reescribí la siguiente nota con el tono "${tono}".`);
  partes.push(`Sección / categoría: ${input.categoryName || 'Interés General'}.`);

  if (input.sourceName) {
    partes.push(`Fuente original: ${input.sourceName}${input.sourceUrl ? ` (${input.sourceUrl})` : ''}.`);
  }
  if (input.sourcePublishedAt) {
    const fecha = input.sourcePublishedAt instanceof Date ? input.sourcePublishedAt : new Date(input.sourcePublishedAt);
    if (!Number.isNaN(fecha.getTime())) {
      partes.push(`Publicada originalmente el ${fecha.toISOString().slice(0, 10)}.`);
    }
  }
  if (input.localKeywords && input.localKeywords.length > 0) {
    partes.push(`Palabras clave locales a tener en cuenta si el texto las menciona: ${input.localKeywords.join(', ')}.`);
  }
  if (input.citeSource) {
    partes.push(
      'IMPORTANTE: cerra el cuerpo de la nota con un párrafo de atribución con esta forma exacta (reemplazá los valores): ' +
        '<p><em>Con información de <a href="URL_DE_LA_FUENTE" target="_blank" rel="nofollow noopener">NOMBRE DE LA FUENTE</a>.</em></p>'
    );
  }
  if (input.extraInstructions?.trim()) {
    partes.push(`Instrucciones adicionales de la redacción (respetalas siempre): ${input.extraInstructions.trim()}`);
  }

  partes.push(FORMATO_JSON);
  partes.push('--- TEXTO ORIGINAL ---');
  partes.push(`TÍTULO ORIGINAL: ${input.title}`);
  partes.push('CUERPO ORIGINAL:');
  partes.push(input.content);

  return partes.join('\n\n');
}

/** Re-export de la lista de tonos para comodidad del panel de administración. */
export const TONALIDADES_UI = TONALIDADES;
