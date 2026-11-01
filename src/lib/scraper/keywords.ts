import { prisma } from '@/lib/prisma';
import { LOCALIDADES, TERMINOS_INSTITUCIONALES } from '@/lib/constants';
import { escapeHtml } from '@/lib/utils';

/**
 * Filtro de palabras clave locales.
 *
 * Cuando una noticia traída por el scraper menciona Saladillo, Del Carril, Cazón,
 * Polvaredas o términos institucionales fuertes, se marca como prioridad alta
 * para que el editor la revise primero.
 */

export interface KeywordDefinition {
  word: string;
  weight: number;
  type: string;
}

export interface KeywordMatch {
  matches: string[];
  score: number;
  priority: 'NORMAL' | 'ALTA' | 'URGENTE';
}

/** Normaliza el texto: sin acentos, en minúsculas, para comparar parejo. */
function normalizeForMatch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Busca las palabras clave en el texto (con límites de palabra, soportando
 * frases de varias palabras como "Hospital Posadas") y calcula la prioridad.
 *
 * Reglas de prioridad:
 *  - URGENTE: score total >= 25 o 3 o más coincidencias distintas.
 *  - ALTA: score >= 10 o al menos una coincidencia con peso >= 9.
 *  - NORMAL: el resto.
 */
export function matchLocalKeywords(
  text: string,
  keywords: { word: string; weight: number }[]
): KeywordMatch {
  const normalizado = normalizeForMatch(text ?? '');
  const matches: string[] = [];
  let score = 0;
  let distintas = 0;
  let tieneFuerte = false;

  for (const kw of keywords) {
    const original = (kw.word ?? '').trim();
    if (!original) continue;

    const objetivo = normalizeForMatch(original).trim();
    if (!objetivo) continue;

    // Armamos el patrón: escapamos especiales y permitimos cualquier espacio
    // entre las palabras de una frase de varias palabras.
    const patron = escapeRegex(objetivo).replace(/\s+/g, '\\s+');
    let regex: RegExp;
    try {
      regex = new RegExp(`(?<![\\p{L}\\p{N}])${patron}(?![\\p{L}\\p{N}])`, 'giu');
    } catch {
      continue;
    }

    const encontradas = normalizado.match(regex);
    if (encontradas && encontradas.length > 0) {
      matches.push(original);
      distintas += 1;
      score += kw.weight * encontradas.length;
      if (kw.weight >= 9) tieneFuerte = true;
    }
  }

  let priority: KeywordMatch['priority'] = 'NORMAL';
  if (score >= 25 || distintas >= 3) {
    priority = 'URGENTE';
  } else if (score >= 10 || tieneFuerte) {
    priority = 'ALTA';
  }

  return { matches, score, priority };
}

/** Lista por defecto cuando la tabla `keywords` está vacía o inaccesible. */
function defaultKeywords(): KeywordDefinition[] {
  const localidades: KeywordDefinition[] = LOCALIDADES.map((word) => ({
    word,
    weight: 10,
    type: 'LOCALIDAD'
  }));
  const institucionales: KeywordDefinition[] = TERMINOS_INSTITUCIONALES.map((word) => ({
    word,
    weight: 9,
    type: 'FUNCIONARIO'
  }));
  return [...localidades, ...institucionales];
}

/**
 * Carga las palabras clave activas desde la base. Si la tabla está vacía
 * (o falla la consulta) devuelve la lista por defecto, para que el filtro local
 * nunca quede inactivo.
 */
export async function loadLocalKeywords(): Promise<KeywordDefinition[]> {
  try {
    const rows = await prisma.keyword.findMany({
      where: { isActive: true },
      orderBy: [{ weight: 'desc' }, { word: 'asc' }]
    });
    if (rows.length > 0) {
      return rows.map((row) => ({ word: row.word, weight: row.weight, type: row.type }));
    }
  } catch {
    // Sin base disponible: usamos los valores por defecto.
  }
  return defaultKeywords();
}

/** Variantes con acentos de cada letra, para resaltar sin importar la tilde. */
const ACCENT_MAP: Record<string, string> = {
  a: 'aáàâäã',
  e: 'eéèêë',
  i: 'iíìîï',
  o: 'oóòôöõ',
  u: 'uúùûü',
  n: 'nñ',
  c: 'cç',
  y: 'yýÿ',
  s: 'sś',
  g: 'gğ'
};

/** Construye un patrón insensible a acentos para una palabra o frase. */
function accentInsensitivePattern(word: string): string {
  const pattern = word
    .split('')
    .map((ch) => {
      const variantes = ACCENT_MAP[ch.toLowerCase()];
      if (!variantes) return escapeRegex(ch);
      const clases = `${variantes}${variantes.toUpperCase()}`;
      return `[${clases}]`;
    })
    .join('');
  return pattern.replace(/\s+/g, '\\s+');
}

/**
 * Devuelve el texto con las coincidencias envueltas en `<mark>`.
 * Se usa en la vista previa del panel. El texto se escapa para evitar XSS.
 */
export function highlightMatches(text: string, matches: string[]): string {
  if (!text) return '';
  const limpias = Array.from(new Set(matches.map((m) => (m ?? '').trim()).filter(Boolean)));
  if (limpias.length === 0) return escapeHtml(text);

  const alternativas = limpias
    .sort((a, b) => b.length - a.length)
    .map(accentInsensitivePattern)
    .join('|');

  let regex: RegExp;
  try {
    regex = new RegExp(`(${alternativas})`, 'giu');
  } catch {
    return escapeHtml(text);
  }

  const partes = text.split(regex);
  return partes
    .map((parte, indice) =>
      indice % 2 === 1
        ? `<mark class="rounded bg-amber-200 px-0.5 text-brand-900">${escapeHtml(parte)}</mark>`
        : escapeHtml(parte)
    )
    .join('');
}
