import { buildBrowserHeaders, jitter, pickUserAgent } from '@/lib/scraper/user-agents';

/**
 * Capa de acceso HTTP del scraper.
 *
 * Reglas de convivencia con los sitios de origen:
 *  - Siempre esperamos un `delayMs` (con jitter) antes de cada pedido.
 *  - Todo pedido va con timeout y try/catch: un sitio caído nunca debe tumbar
 *    el proceso ni al resto de las fuentes.
 *  - Los mensajes de error van en español y son claros para el administrador.
 */

export interface FetchOptions {
  rotateUserAgent?: boolean;
  delayMs?: number;
  usePuppeteer?: boolean;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_BINARY_BYTES = 12 * 1024 * 1024; // 12 MB

/** Tipos mínimos de Puppeteer para no depender de sus tipos (es dependencia opcional). */
interface HeadlessPage {
  setUserAgent(userAgent: string): Promise<void>;
  goto(url: string, options?: Record<string, unknown>): Promise<unknown>;
  content(): Promise<string>;
}
interface HeadlessBrowser {
  newPage(): Promise<HeadlessPage>;
  close(): Promise<void>;
}
interface PuppeteerModule {
  launch(options?: Record<string, unknown>): Promise<HeadlessBrowser>;
}

/** Espera respetando el delay configurado (más el jitter anti-patrón). */
async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Renderiza la página con un navegador headless (necesario en sitios con JS).
 * Si Puppeteer no está instalado o falla, devuelve `null` en silencio para que
 * el llamador caiga al fetch normal.
 */
async function renderWithPuppeteer(url: string, userAgent: string, timeoutMs: number): Promise<string | null> {
  try {
    // Especificador dinámico: evita que el bundler exija el módulo en build time
    // (Puppeteer es una dependencia OPCIONAL).
    const specifier = 'puppeteer';
    const mod = (await import(/* webpackIgnore: true */ specifier)) as unknown as
      | PuppeteerModule
      | { default: PuppeteerModule };
    const puppeteer: PuppeteerModule =
      'launch' in mod ? mod : (mod as { default: PuppeteerModule }).default;
    if (!puppeteer || typeof puppeteer.launch !== 'function') return null;

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    try {
      const page = await browser.newPage();
      await page.setUserAgent(userAgent);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: timeoutMs });
      const html = await page.content();
      return html && html.length > 200 ? html : null;
    } finally {
      await browser.close().catch(() => undefined);
    }
  } catch {
    // Puppeteer ausente o roto: seguimos con el fetch clásico.
    return null;
  }
}

/**
 * Descarga el HTML de una URL con cabeceras de navegador, timeout y delay previo.
 * Lanza un error claro en español si el status no es 2xx.
 */
export async function fetchHtml(url: string, opts: FetchOptions = {}): Promise<string> {
  const {
    rotateUserAgent = true,
    delayMs = 0,
    usePuppeteer = false,
    timeoutMs = DEFAULT_TIMEOUT_MS
  } = opts;

  // Nunca golpeamos el servidor sin esperar: respetamos el delay pedido.
  await sleep(jitter(delayMs));

  const userAgent = rotateUserAgent ? pickUserAgent() : USER_AGENT_FALLBACK;

  if (usePuppeteer) {
    const rendered = await renderWithPuppeteer(url, userAgent, timeoutMs);
    if (rendered) return rendered;
    // Si no se pudo renderizar, seguimos con el fetch normal (silencioso).
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: buildBrowserHeaders(url, userAgent),
      redirect: 'follow',
      signal: controller.signal,
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`El sitio respondió con estado ${response.status} ${response.statusText} para ${url}.`);
    }
    return await response.text();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Se agotó el tiempo de espera (${Math.round(timeoutMs / 1000)}s) al pedir ${url}.`);
    }
    if (error instanceof Error) {
      throw new Error(`No se pudo descargar ${url}: ${error.message}`);
    }
    throw new Error(`No se pudo descargar ${url}.`);
  } finally {
    clearTimeout(timer);
  }
}

/** User-Agent estable cuando no se rota identidad (siempre el mismo navegador). */
const USER_AGENT_FALLBACK = pickUserAgent(0);

/**
 * Descarga un recurso binario (imagen, PDF pequeño, etc.).
 * Usa como `Referer` el propio origen del archivo: muchos servidores tienen
 * "hotlink protection" y rechazan pedidos sin ese Referer.
 */
export async function fetchBinary(
  url: string,
  opts: FetchOptions = {}
): Promise<{ buffer: Buffer; contentType: string }> {
  const { rotateUserAgent = true, delayMs = 0, timeoutMs = DEFAULT_TIMEOUT_MS } = opts;
  await sleep(jitter(delayMs));

  const userAgent = rotateUserAgent ? pickUserAgent() : USER_AGENT_FALLBACK;
  const headers = buildBrowserHeaders(url, userAgent);
  try {
    const origin = new URL(url).origin;
    headers.Referer = `${origin}/`;
  } catch {
    /* URL inválida: seguimos sin Referer propio */
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
      redirect: 'follow',
      signal: controller.signal,
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`El archivo ${url} respondió con estado ${response.status}.`);
    }

    const lengthHeader = Number(response.headers.get('content-length') ?? 0);
    if (lengthHeader && lengthHeader > MAX_BINARY_BYTES) {
      throw new Error(`El archivo supera el límite de 12 MB (${url}).`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > MAX_BINARY_BYTES) {
      throw new Error(`El archivo supera el límite de 12 MB (${url}).`);
    }

    return {
      buffer,
      contentType: response.headers.get('content-type') ?? 'application/octet-stream'
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Se agotó el tiempo de espera al descargar el archivo ${url}.`);
    }
    throw error instanceof Error ? error : new Error(`No se pudo descargar el archivo ${url}.`);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Lee y parsea el `robots.txt` del sitio (solo el bloque `User-agent: *`).
 * Un parseo simple alcanza para no molestar a los sitios de noticias locales.
 */
export async function fetchRobotsTxt(baseUrl: string): Promise<{ allowed: string[]; disallowed: string[] }> {
  const allowed: string[] = [];
  const disallowed: string[] = [];
  let origin: string;
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    return { allowed, disallowed };
  }

  try {
    const res = await fetch(`${origin}/robots.txt`, {
      headers: buildBrowserHeaders(`${origin}/robots.txt`),
      redirect: 'follow',
      cache: 'no-store'
    });
    if (!res.ok) return { allowed, disallowed };

    const text = await res.text();
    let enGrupoGeneral = false;
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.split('#')[0].trim();
      if (!line) continue;
      const [rawKey, ...rest] = line.split(':');
      const key = rawKey.trim().toLowerCase();
      const value = rest.join(':').trim();

      if (key === 'user-agent') {
        enGrupoGeneral = value === '*';
        continue;
      }
      if (!enGrupoGeneral) continue;
      if (key === 'allow' && value) allowed.push(normalizarPathRobots(value));
      if (key === 'disallow' && value) disallowed.push(normalizarPathRobots(value));
    }
  } catch {
    // Si no se puede leer, devolvemos listas vacías (equivale a permitir).
  }

  return { allowed, disallowed };
}

function normalizarPathRobots(value: string): string {
  return value.replace(/\*+$/, '').trim();
}

/** Caché en memoria por host para no pedir robots.txt en cada nota. */
const robotsCache = new Map<string, { allowed: string[]; disallowed: string[] }>();

/**
 * Decide si una URL está permitida por el `robots.txt`.
 * Devuelve `true` si no se puede leer el archivo o si el path no está en Disallow.
 * La regla de precedencia es la habitual: gana la coincidencia más específica
 * (el path más largo).
 */
export async function isAllowedByRobots(url: string, baseUrl: string): Promise<boolean> {
  let host: string;
  let path: string;
  try {
    const parsed = new URL(url);
    host = parsed.host;
    path = parsed.pathname || '/';
  } catch {
    return true; // URL rara: no bloqueamos por las dudas
  }

  let robots = robotsCache.get(host);
  if (!robots) {
    robots = await fetchRobotsTxt(baseUrl || url);
    robotsCache.set(host, robots);
  }

  const { allowed, disallowed } = robots;
  const coincide = (patron: string) => patron && path.startsWith(patron);

  const mejorPermitido = allowed.filter(coincide).sort((a, b) => b.length - a.length)[0];
  const mejorProhibido = disallowed.filter(coincide).sort((a, b) => b.length - a.length)[0];

  if (!mejorProhibido) return true;
  if (mejorPermitido && mejorPermitido.length >= mejorProhibido.length) return true;
  return false;
}

/** Limpia la caché de robots.txt (útil para tests o ejecuciones manuales). */
export function clearRobotsCache(): void {
  robotsCache.clear();
}
