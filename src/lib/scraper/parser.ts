import { load, type Cheerio } from 'cheerio';
import { countWords, sanitizeHtml, stripHtml, truncate } from '@/lib/utils';

/**
 * Parser del scraper: extrae links de una portada/sección y el contenido de una
 * nota concreta. Todo con `cheerio` (HTML estático) para mantenerlo liviano.
 */

export interface DiscoveredLink {
  url: string;
  title: string;
}

/** Pistas de path que sugieren que un link apunta a una nota. */
const PISTAS_NOTA = [
  '/nota/',
  '/notas/',
  '/noticia',
  '/noticias/',
  '/policial',
  '/politica',
  '/deportes',
  '/locales',
  '/local/',
  '/general',
  '/interes',
  '/actualidad',
  '/municipal',
  '/sociedad',
  '/sucesos',
  '/opinion',
  '/saladillo'
];

/** Extensiones de archivo que nunca son notas. */
const EXTENSIONES_ARCHIVO = /\.(pdf|jpe?g|png|gif|webp|svg|zip|rar|mp4|mp3|docx?|xlsx?|pptx?)$/i;

/**
 * Descubre los links a notas dentro de un listado.
 * Estrategia por capas para InfoSaladillo:
 *  1) <h2> y <h3> que contengan un <a> (títulos destacados y del listado).
 *  2) Cualquier <a> cuyo href sea un slug de nota (path con guiones, 1 o más segmentos).
 * Si `selector` está definido, se lo usa como contenedor del listado.
 */
export async function discoverArticleLinks(
  html: string,
  pageUrl: string,
  selector?: string | null
): Promise<DiscoveredLink[]> {
  const $ = load(html);

  let host: string;
  try {
    host = new URL(pageUrl).hostname;
  } catch {
    host = '';
  }

  const links: DiscoveredLink[] = [];
  const vistos = new Set<string>();

  /**
   * Valida y agrega un link candidato si pasa los filtros de URL y texto.
   * Relajado para InfoSaladillo: acepta paths de un solo segmento si son slugs
   * (contienen guiones) o coinciden con pistas de nota.
   */
  function agregarLink(href: string, texto: string): void {
    if (!href || href.startsWith('#')) return;
    if (/^(mailto:|tel:|javascript:|data:)/i.test(href)) return;
    if (EXTENSIONES_ARCHIVO.test(href)) return;

    let absoluta: URL;
    try {
      absoluta = new URL(href, pageUrl);
    } catch {
      return;
    }
    if (absoluta.protocol !== 'http:' && absoluta.protocol !== 'https:') return;
    if (host && absoluta.hostname !== host) return;

    const path = absoluta.pathname || '';
    if (!path || path === '/') return;

    const segmentos = path.split('/').filter(Boolean);
    const tienePista = PISTAS_NOTA.some((pista) => path.toLowerCase().includes(pista));

    // InfoSaladillo usa slugs con guiones (ej: /registro-de-lluvias-en-saladillo/).
    // Aceptamos paths de 1+ segmento si tienen pista de nota O parecen slug (guiones).
    const esSlugInfoSaladillo = /-[a-z0-9]+-?[a-z0-9]*/i.test(segmentos[segmentos.length - 1] ?? '');
    if (!tienePista && !esSlugInfoSaladillo && segmentos.length < 2) return;

    const titulo = texto.replace(/\s+/g, ' ').trim();
    if (titulo.length <= 25) return;

    const url = absoluta.toString().split('#')[0];
    if (vistos.has(url)) return;
    vistos.add(url);
    links.push({ url, title: titulo });
  }

  // Capa 1: <h2> y <h3> que contengan un <a> (títulos destacados y del listado).
  $('h2, h3').each((_, el) => {
    if (links.length >= 60) return false;
    const $h = $(el);
    const $a = $h.find('a').first();
    if ($a.length === 0) return;
    const href = ($a.attr('href') ?? '').trim();
    const texto = $h.text().replace(/\s+/g, ' ').trim();
    agregarLink(href, texto);
  });

  // Capa 2: si aún no hay links, buscar <a> que envuelvan imágenes con alt (común en portadas).
  if (links.length === 0 && !selector) {
    $('a > img[alt]').each((_, el) => {
      if (links.length >= 60) return false;
      const $img = $(el);
      const $a = $img.parent('a');
      if ($a.length === 0) return;
      const href = ($a.attr('href') ?? '').trim();
      const texto = ($img.attr('alt') ?? '').replace(/\s+/g, ' ').trim();
      agregarLink(href, texto);
    });
  }

  // Capa 3: fallback a <a> directos con texto significativo si aún nada.
  if (links.length === 0) {
    const anclas = selector
      ? $(selector).find('a').toArray().concat($(selector).filter('a').toArray())
      : $('a').toArray();
    for (const el of anclas) {
      if (links.length >= 60) break;
      const $a = $(el);
      const href = ($a.attr('href') ?? '').trim();
      const texto = $a.text().replace(/\s+/g, ' ').trim();
      agregarLink(href, texto);
    }
  }

  return links.slice(0, 60);
}

export interface ParsedArticle {
  title: string;
  content: string;
  contentHtml: string;
  images: string[];
  excerpt: string;
  publishedAt: Date | null;
}

export interface ParseOptions {
  articleSelector?: string | null;
  titleSelector?: string | null;
  imageSelector?: string | null;
}

/** Frases de bloque que delatan navegación, publicidad o contenido relacionado. */
const FRASES_DESCARTE = [
  'también te puede interesar',
  'tambien te puede interesar',
  'leé también',
  'lee tambien',
  'publicidad',
  'seguí leyendo',
  'seguir leyendo',
  'compartir en',
  'suscribite',
  'dejanos tu comentario'
];

/** Zonas que nunca forman parte del cuerpo de la nota. */
const CONTENEDORES_DESCARTE = 'nav, footer, header, aside, form, script, style, iframe, noscript, .comentarios, .related, .relacionadas, .publicidad, .ad';

function limpiarTitulo(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim();
}

/**
 * Extrae título, cuerpo, imágenes, extracto y fecha de una nota.
 * Lanza un error claro en español si el contenido no parece ser una nota.
 */
export async function parseArticle(
  html: string,
  url: string,
  opts: ParseOptions = {}
): Promise<ParsedArticle> {
  const $ = load(html);

  // ---- Título ----
  let title = '';
  if (opts.titleSelector) title = limpiarTitulo($(opts.titleSelector).first().text());
  if (!title) title = limpiarTitulo($('h1').first().text());
  if (!title) title = limpiarTitulo($('meta[property="og:title"]').attr('content') ?? '');
  if (!title) title = limpiarTitulo($('title').text());

  // ---- Contenedor del cuerpo ----
  let container: Cheerio<any> | null = null;
  if (opts.articleSelector) {
    container = $(opts.articleSelector).first();
  }

  // Si no hay selector explícito, probamos contenedores típicos de WordPress
  // (InfoSaladillo usa este tipo de estructura) y caemos al mejor <div>/<article>.
  if (!container || container.length === 0) {
    const selectoresCuerpo = [
      '.entry-content', '.post-content', '.article-content', '.content',
      '.single-content', '.note-content', '.nota-contenido', '.entry',
      'article', 'main'
    ];
    let encontrado = $();
    for (const sel of selectoresCuerpo) {
      const cand = $(sel).first();
      if (cand.length > 0 && cand.find('p').length > 0) {
        encontrado = cand;
        break;
      }
    }
    if (encontrado.length > 0) {
      container = encontrado;
    } else {
      const candidatos = $('article, div');
      let mejorIndice = -1;
      let mejorCantidad = 0;
      candidatos.each((i, el) => {
        const cantidad = $(el as any).find('p').length;
        if (cantidad > mejorCantidad) {
          mejorCantidad = cantidad;
          mejorIndice = i;
        }
      });
      container = mejorIndice >= 0 ? candidatos.eq(mejorIndice) : $('body');
    }
  }

  const contenedor = container ?? $('body');
  contenedor.find(CONTENEDORES_DESCARTE).remove();

  // ---- Párrafos ----
  const holder = $('<div></div>');
  contenedor.find('p').each((_, el) => {
    const $p = $(el);
    const texto = $p.text().replace(/\s+/g, ' ').trim();
    if (texto.length < 40) return;
    const minus = texto.toLowerCase();
    if (FRASES_DESCARTE.some((frase) => minus.includes(frase))) return;
    holder.append($p.clone());
  });

  const rawHtml = holder.html() ?? '';
  const contentHtml = sanitizeHtml(rawHtml);
  const content = stripHtml(contentHtml);

  // ---- Imágenes ----
  const images: string[] = [];
  const nodosImagen = opts.imageSelector ? $(opts.imageSelector) : contenedor.find('img');
  nodosImagen.each((_, el) => {
    if (images.length >= 6) return;
    const $img = $(el);
    const raw =
      $img.attr('src') ||
      $img.attr('data-src') ||
      $img.attr('data-lazy-src') ||
      $img.attr('data-original') ||
      '';
    if (!raw || raw.startsWith('data:')) return;

    let absoluta: string;
    try {
      absoluta = new URL(raw, url).toString();
    } catch {
      return;
    }
    const lower = absoluta.toLowerCase();
    const ancho = Number($img.attr('width') ?? 0);
    if (Number.isFinite(ancho) && ancho > 0 && ancho < 300) return;
    if (/(logo|avatar|icon|sprite|-150x150)/.test(lower)) return;
    if (!images.includes(absoluta)) images.push(absoluta);
  });

  // ---- Extracto ----
  const ogDescription = limpiarTitulo($('meta[property="og:description"]').attr('content') ?? '');
  const primerParrafo = limpiarTitulo(container.find('p').first().text());
  const excerpt = ogDescription || truncate(primerParrafo, 200);

  // ---- Fecha de publicación ----
  let publishedAt: Date | null = null;
  const fechaMeta =
    $('meta[property="article:published_time"]').attr('content') ??
    $('meta[name="article:published_time"]').attr('content') ??
    $('time[datetime]').first().attr('datetime') ??
    '';
  if (fechaMeta) {
    const parsed = new Date(fechaMeta);
    if (!Number.isNaN(parsed.getTime())) publishedAt = parsed;
  }

  // ---- Validaciones ----
  if (!title) {
    throw new Error('No se pudo extraer el título de la nota. Probá definiendo un selector de título en la fuente.');
  }
  // Umbral bajo a propósito: InfoSaladillo publica boletines muy breves
  // (avisos, agradecimientos, cortes de energía) que rondan las 49-118 palabras.
  const palabras = countWords(contentHtml);
  if (palabras < 40) {
    throw new Error(
      `El cuerpo de la nota tiene muy poco texto (${palabras} palabras): probablemente no sea una nota o el selector del cuerpo esté mal configurado.`
    );
  }

  return {
    title,
    content,
    contentHtml,
    images: images.slice(0, 6),
    excerpt,
    publishedAt
  };
}
