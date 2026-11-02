/**
 * Rotación de identidades para el motor de scraping.
 *
 * User-Agents de navegadores de escritorio modernos (Chrome 120+, Firefox 120+,
 * Edge 120+, Safari 17+). Incluye cabeceras de cliente hints (Sec-Ch-Ua*) para
 * que el pedido se vea como una navegación real desde un escritorio.
 */

export const USER_AGENTS: string[] = [
  // Chrome sobre Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  // Chrome sobre macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  // Chrome sobre Linux
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  // Edge sobre Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
  // Firefox sobre Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
  // Firefox sobre Linux
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0',
  // Safari sobre macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
];

export const REFERERS: string[] = [
  'https://www.google.com/',
  'https://www.bing.com/',
  'https://duckduckgo.com/',
  'https://www.facebook.com/',
  'https://t.co/',
  'https://www.instagram.com/',
  'https://www.linkedin.com/',
  ''
];

export function pickUserAgent(seed?: number): string {
  if (typeof seed === 'number' && Number.isFinite(seed)) {
    const index = Math.abs(Math.trunc(seed)) % USER_AGENTS.length;
    return USER_AGENTS[index];
  }
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Detecta familia del navegador a partir del User-Agent para construir
 * Sec-Ch-Ua coherente con el navegador fingido.
 */
function detectarFamilia(ua: string): { marca: string; version: string; movil: boolean; plataforma: string } {
  const esMovil = /Android|iPhone|iPad|iPod|Mobile/.test(ua);
  let plataforma = '"Windows"';
  if (ua.includes('Macintosh')) plataforma = '"macOS"';
  else if (ua.includes('X11') || ua.includes('Linux')) plataforma = '"Linux"';
  else if (ua.includes('Android')) plataforma = '"Android"';
  else if (ua.includes('iPhone') || ua.includes('iPad')) plataforma = '"iOS"';

  if (ua.includes('Edg/')) {
    const m = ua.match(/Edg\/(\d+)/);
    return { marca: 'Microsoft Edge', version: m ? m[1] : '124', movil: esMovil, plataforma };
  }
  if (ua.includes('Chrome/')) {
    const m = ua.match(/Chrome\/(\d+)/);
    return { marca: 'Google Chrome', version: m ? m[1] : '124', movil: esMovil, plataforma };
  }
  if (ua.includes('Firefox/')) {
    const m = ua.match(/Firefox\/(\d+)/);
    return { marca: 'Not_A Brand', version: m ? m[1] : '124', movil: esMovil, plataforma };
  }
  if (ua.includes('Safari/')) {
    const m = ua.match(/Version\/(\d+)/);
    return { marca: 'Not_A Brand', version: m ? m[1] : '17', movil: esMovil, plataforma };
  }
  return { marca: 'Not_A Brand', version: '124', movil: esMovil, plataforma };
}

export function buildBrowserHeaders(url: string, ua?: string): Record<string, string> {
  const agent = ua && ua.trim() ? ua : pickUserAgent();
  const referer = REFERERS[Math.floor(Math.random() * REFERERS.length)];

  let site = 'none';
  if (referer) {
    try {
      const destino = new URL(url);
      site = destino.origin === new URL(referer).origin ? 'same-origin' : 'cross-site';
    } catch {
      site = 'none';
    }
  }

  const { marca, version, movil, plataforma } = detectarFamilia(agent);

  const headers: Record<string, string> = {
    'User-Agent': agent,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    DNT: '1',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': site,
    'Sec-Fetch-User': '?1',
    'Sec-Ch-Ua': `"${marca}";v="${version}"`,
    'Sec-Ch-Ua-Mobile': movil ? '?1' : '?0',
    'Sec-Ch-Ua-Platform': plataforma,
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

/**
 * Delay aleatorio entre 2 y 5 segundos, recomendado para evitar bloqueos.
 */
export function delayHumanoMs(): number {
  return 2000 + Math.floor(Math.random() * 3000);
}