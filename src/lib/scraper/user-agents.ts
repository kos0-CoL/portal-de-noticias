/**
 * Rotación de identidades para el motor de scraping.
 *
 * Por qué existe esto: muchos medios bloquean pedidos repetidos que llegan con
 * el mismo User-Agent y sin cabeceras de navegador. Rotar entre navegadores
 * reales y mandar cabeceras coherentes hace que un pedido se parezca a una
 * visita humana normal. No es para "esquivar" protecciones legítimas: además
 * respetamos robots.txt y metemos delays entre pedidos (ver `fetcher.ts`).
 */

/** User-Agents reales y actuales (Chrome, Firefox, Safari y Edge). */
export const USER_AGENTS: string[] = [
  // Chrome sobre Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  // Chrome sobre macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  // Chrome sobre Linux
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  // Edge sobre Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0',
  // Firefox sobre Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
  // Firefox sobre Linux
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0',
  // Safari sobre macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  // Safari / Chrome móvil sobre iOS
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1',
  // Chrome sobre Android
  'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'
];

/** Referers creíbles: buscadores y redes. El string vacío simula navegación directa. */
export const REFERERS: string[] = [
  'https://www.google.com/',
  'https://www.bing.com/',
  'https://www.facebook.com/',
  'https://t.co/',
  ''
];

/**
 * Devuelve un User-Agent de la lista.
 * Si se pasa `seed`, es determinístico (útil para reproducir un pedido puntual);
 * si no, elige uno al azar para no repetir el mismo navegador en cada request.
 */
export function pickUserAgent(seed?: number): string {
  if (typeof seed === 'number' && Number.isFinite(seed)) {
    const index = Math.abs(Math.trunc(seed)) % USER_AGENTS.length;
    return USER_AGENTS[index];
  }
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Cabeceras de navegador coherentes para pedir una URL.
 * Incluye `Sec-Fetch-*` para que el pedido se parezca a una navegación real.
 */
export function buildBrowserHeaders(url: string, ua?: string): Record<string, string> {
  const agent = ua && ua.trim() ? ua : pickUserAgent();
  const referer = REFERERS[Math.floor(Math.random() * REFERERS.length)];

  // Sec-Fetch-Site coherente con el Referer: sin Referer es una visita directa.
  let site = 'none';
  if (referer) {
    try {
      const destino = new URL(url);
      site = destino.origin === new URL(referer).origin ? 'same-origin' : 'cross-site';
    } catch {
      site = 'none';
    }
  }

  const headers: Record<string, string> = {
    'User-Agent': agent,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    DNT: '1',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': site,
    'Sec-Fetch-User': '?1'
  };

  if (referer) headers.Referer = referer;
  return headers;
}

/**
 * Agrega un ±40% aleatorio a un delay base para que el patrón de pedidos no sea
 * robótico. Nunca devuelve un valor negativo.
 */
export function jitter(baseMs: number): number {
  if (!Number.isFinite(baseMs) || baseMs <= 0) return 0;
  const factor = 1 + (Math.random() * 0.8 - 0.4); // entre 0.6x y 1.4x
  return Math.max(0, Math.round(baseMs * factor));
}
