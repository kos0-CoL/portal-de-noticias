type ClassValue = string | number | null | undefined | false | ClassValue[];

function flatten(items: ClassValue[], out: (string | number | null | undefined | false)[]): void {
  for (const item of items) {
    if (Array.isArray(item)) flatten(item, out);
    else out.push(item);
  }
}

/** Une clases condicionales: cn('p-2', activo && 'bg-brand-800') */
export function cn(...inputs: ClassValue[]): string {
  const flat: (string | number | null | undefined | false)[] = [];
  flatten(inputs, flat);
  const out: string[] = [];
  for (const item of flat) {
    if (typeof item === 'string' && item.trim()) out.push(item);
  }
  return out.join(' ');
}

/** Slug URL-safe, sin acentos y sin caracteres raros. */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 90);
}

/** Cuenta palabras ignorando el markup HTML. */
export function countWords(html: string): number {
  const text = stripHtml(html);
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

/** Tiempo de lectura estimado: 200 palabras por minuto, minimo 1 minuto. */
export function estimateReadingTime(html: string): number {
  const words = countWords(html);
  return Math.max(1, Math.round(words / 200));
}

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extrae los URLs de <img src="..."> de un bloque HTML. */
export function extractImageUrls(html: string, baseUrl?: string): string[] {
  const urls: string[] = [];
  const re = /<img[^>]+src=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const raw = match[1];
    if (raw.startsWith('data:')) continue;
    try {
      urls.push(baseUrl ? new URL(raw, baseUrl).toString() : raw);
    } catch {
      /* URL invalida: se descarta */
    }
  }
  return urls;
}

/** Texto plano -> parrafos HTML, para el contenido que trae el scraper. */
export function textToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join('\n');
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sanitiza el HTML que viene de fuentes externas o de la IA.
 * Lista blanca de etiquetas de contenido editorial, nada de scripts ni iframes.
 */
export function sanitizeHtml(dirty: string): string {
  const allowed = [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'blockquote', 'ul', 'ol', 'li',
    'h2', 'h3', 'h4', 'a', 'figure', 'figcaption', 'img', 'hr'
  ];
  let clean = dirty
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/ on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');

  clean = clean.replace(/<\/?([a-zA-Z0-9]+)([^>]*)>/g, (full, tag: string, attrs: string) => {
    const name = tag.toLowerCase();
    if (!allowed.includes(name)) return '';
    if (name === 'a') {
      const href = /href\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attrs);
      const url = href ? (href[2] ?? href[3] ?? '#') : '#';
      const safe = /^https?:\/\//i.test(url) || url.startsWith('/') ? url : '#';
      return full.startsWith('</')
        ? '</a>'
        : `<a href="${safe}" target="_blank" rel="noopener nofollow">`;
    }
    if (name === 'img') {
      const src = /src\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attrs);
      const alt = /alt\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attrs);
      if (!src) return '';
      const url = src[2] ?? src[3] ?? '';
      if (!url.startsWith('/') && !/^https?:\/\//i.test(url)) return '';
      return `<img src="${url}" alt="${alt ? (alt[2] ?? alt[3] ?? '') : ''}" loading="lazy" />`;
    }
    return full.startsWith('</') ? `</${name}>` : `<${name}>`;
  });

  return clean.trim();
}

/** Fecha en formato editorial argentino: "31 de octubre de 2026, 09:40". */
export function formatFecha(date: Date | string, withTime = true): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const fecha = new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires'
  }).format(d);
  if (!withTime) return fecha;
  const hora = new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Argentina/Buenos_Aires'
  }).format(d);
  return `${fecha}, ${hora} hs`;
}

export function formatFechaCorta(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires'
  }).format(d);
}

/** "Hace 3 horas" / "Hace 2 días" para las tarjetas del portal. */
export function tiempoRelativo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'Ahora mismo';
  if (min < 60) return `Hace ${min} min`;
  const horas = Math.round(min / 60);
  if (horas < 24) return `Hace ${horas} h`;
  const dias = Math.round(horas / 24);
  if (dias < 30) return `Hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
  return formatFechaCorta(d);
}

export function formatPrecio(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined) return 'Consultar';
  const n = typeof valor === 'string' ? Number(valor) : valor;
  if (!Number.isFinite(n)) return 'Consultar';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0
  }).format(n);
}

/** Hash estable sin dependencias, para detectar notas repetidas en el scraper. */
export function stableHash(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (((h2 >>> 0) * 4294967296 + (h1 >>> 0)) >>> 0).toString(36) + (h2 >>> 0).toString(36);
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

/** Similitud por trigramas (0..1). Se usa para el "originalityScore" tras la reescritura. */
export function similarity(a: string, b: string): number {
  const norm = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const A = norm(a);
  const B = norm(b);
  if (!A || !B) return 0;
  const grams = (s: string) => {
    const set = new Map<string, number>();
    for (let i = 0; i < s.length - 2; i++) {
      const g = s.slice(i, i + 3);
      set.set(g, (set.get(g) ?? 0) + 1);
    }
    return set;
  };
  const ga = grams(A);
  const gb = grams(B);
  let shared = 0;
  let total = 0;
  for (const [g, count] of ga) {
    total += count;
    shared += Math.min(count, gb.get(g) ?? 0);
  }
  for (const [, count] of gb) total += count;
  return total === 0 ? 0 : (2 * shared) / total;
}

/** Aleatorio con semilla, para que las "vistas" simuladas sean estables en el render. */
export function seededInt(seed: string, min: number, max: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  const r = Math.abs(h % 1000) / 1000;
  return Math.floor(min + r * (max - min));
}
