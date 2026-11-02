import { buildBrowserHeaders, delayHumanoMs, jitter, pickUserAgent } from '@/lib/scraper/user-agents';

/**
 * Capa de acceso HTTP del scraper.
 *
 * Reglas de evasión de bloqueos:
 *  - IGNORA por completo robots.txt (no se consulta ni se respeta).
 *  - Headers de navegador de escritorio real (User-Agent, Sec-Ch-Ua, etc.).
 *  - Rotación de User-Agent entre navegadores modernos.
 *  - Retardo aleatorio de 2-5 segundos entre peticiones (delay humano).
 *  - Reintentos exponenciales ante fallos de red o HTTP 429/5xx.
 *  - Timeout y try/catch: un sitio caído nunca debe tumbar el proceso.
 *  - Mensajes de error en español para el administrador.
 */

export interface FetchOptions {
  rotateUserAgent?: boolean;
  delayMs?: number;
  usePuppeteer?: boolean;
  timeoutMs?: number;
  maxRetries?: number;
}

const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_BINARY_BYTES = 12 * 1024 * 1024; // 12 MB
const MAX_RETRIES = 3;

/** Códigos de estado que merecen reintento. */
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

/** Tipos mínimos de Puppeteer para no depender de sus tipos (es dependencia opcional). */
interface HeadlessPage {
  setUserAgent(userAgent: string): Promise<void>;
  setViewport(viewport: { width: number; height: number }): Promise<void>;
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
interface PuppeteerExtraModule {
  launch(options?: Record<string, unknown>): Promise<HeadlessBrowser>;
  use?: (plugin: unknown) => void;
}

/** Espera respetando el delay configurado (más el jitter anti-patrón). */
async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/** Renderiza la página con un navegador headless (necesario en sitios con JS).
 * Usa puppeteer-extra con el plugin stealth para evadir detección de automatización. */
async function renderWithPuppeteer(url: string, userAgent: string, timeoutMs: number): Promise<string | null> {
  try {
    // Importamos puppeteer-extra (wrapper que permite usar plugins).
    const puppeteerExtraMod = (await import(/* webpackIgnore: true */ 'puppeteer-extra')) as unknown as {
      default: PuppeteerExtraModule;
      use?: (plugin: unknown) => void;
    };
    const puppeteerExtra = puppeteerExtraMod.default || puppeteerExtraMod;
    if (!puppeteerExtra || typeof puppeteerExtra.launch !== 'function') return null;

    // Importamos el plugin stealth y lo aplicamos.
    try {
      const stealthMod = (await import(/* webpackIgnore: true */ 'puppeteer-extra-plugin-stealth')) as unknown as {
        default: unknown;
      };
      const stealthPlugin = stealthMod.default || stealthMod;
      if (stealthPlugin && typeof puppeteerExtra.use === 'function') {
        puppeteerExtra.use(stealthPlugin);
      }
    } catch {
      // Si el plugin no está disponible, seguimos sin él (el scraping igual funciona).
    }

    const browser = await puppeteerExtra.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--window-size=1366,768'
      ]
    });
    try {
      const page = await browser.newPage();
      await page.setUserAgent(userAgent);
      await page.setViewport({ width: 1366, height: 768 });
      await page.goto(url, { waitUntil: 'networkidle2', timeout: timeoutMs });
      const html = await page.content();
      return html && html.length > 200 ? html : null;
    } finally {
      await browser.close().catch(() => undefined);
    }
  } catch {
    return null;
  }
}

/**
 * Ejecuta una petición fetch con reintentos exponenciales.
 * Devuelve el texto HTML o lanza Error con mensaje claro en español.
 */
async function fetchWithRetries(
  url: string,
  headers: Record<string, string>,
  opts: { timeoutMs: number; maxRetries: number }
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  let ultimoError: unknown;

  for (let intento = 0; intento <= opts.maxRetries; intento++) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        redirect: 'follow',
        signal: controller.signal,
        cache: 'no-store'
      });

      if (response.ok) {
        return await response.text();
      }

      // Si es un código retryable y aún tenemos intentos, esperamos y reintentamos.
      if (RETRYABLE_STATUS.has(response.status) && intento < opts.maxRetries) {
        const texto = await response.text().catch(() => '');
        ultimoError = new Error(
          `El sitio respondió con estado ${response.status} ${response.statusText} para ${url}. Cuerpo: ${truncate(texto, 200)}.`
        );
        const espera = Math.pow(2, intento) * 1000 + Math.floor(Math.random() * 1000);
        await sleep(espera);
        continue;
      }

      throw new Error(`El sitio respondió con estado ${response.status} ${response.statusText} para ${url}.`);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Se agotó el tiempo de espera (${Math.round(opts.timeoutMs / 1000)}s) al pedir ${url}.`);
      }
      ultimoError = error;
      if (intento < opts.maxRetries) {
        const espera = Math.pow(2, intento) * 1000 + Math.floor(Math.random() * 1000);
        await sleep(espera);
        continue;
      }
      throw error instanceof Error ? error : new Error(`No se pudo descargar ${url}.`);
    } finally {
      clearTimeout(timer);
    }
  }

  throw ultimoError instanceof Error ? ultimoError : new Error(`No se pudo descargar ${url}.`);
}

function truncate(texto: string, max: number): string {
  if (!texto) return '';
  return texto.length > max ? texto.slice(0, max) + '…' : texto;
}

/**
 * Descarga el HTML de una URL con cabeceras de navegador, timeout y delay previo.
 * Lanza un error claro en español si el status no es 2xx.
 *
 * robots.txt NO se consulta ni se respeta en ningún caso.
 */
export async function fetchHtml(url: string, opts: FetchOptions = {}): Promise<string> {
  const {
    rotateUserAgent = true,
    delayMs = 0,
    usePuppeteer = false,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxRetries = MAX_RETRIES
  } = opts;

  // Delay humano mínimo (2-5 s) si no se especificó uno propio, para evitar patrones regulares.
  const delay = delayMs > 0 ? jitter(delayMs) : delayHumanoMs();
  await sleep(delay);

  const userAgent = rotateUserAgent ? pickUserAgent() : pickUserAgent(0);

  if (usePuppeteer) {
    const rendered = await renderWithPuppeteer(url, userAgent, timeoutMs);
    if (rendered) return rendered;
  }

  const headers = buildBrowserHeaders(url, userAgent);
  return await fetchWithRetries(url, headers, { timeoutMs, maxRetries });
}

/**
 * Descarga un recurso binario (imagen, PDF pequeño, etc.).
 * Usa como `Referer` el propio origen del archivo: muchos servidores tienen
 * "hotlink protection" y rechazan pedidos sin ese Referer.
 *
 * robots.txt NO se consulta ni se respeta en ningún caso.
 */
export async function fetchBinary(
  url: string,
  opts: FetchOptions = {}
): Promise<{ buffer: Buffer; contentType: string }> {
  const { rotateUserAgent = true, delayMs = 0, timeoutMs = DEFAULT_TIMEOUT_MS, maxRetries = MAX_RETRIES } = opts;
  const delay = delayMs > 0 ? jitter(delayMs) : delayHumanoMs();
  await sleep(delay);

  const userAgent = rotateUserAgent ? pickUserAgent() : pickUserAgent(0);
  const headers = buildBrowserHeaders(url, userAgent);
  try {
    const origin = new URL(url).origin;
    headers.Referer = `${origin}/`;
  } catch {
    /* URL inválida: seguimos sin Referer propio */
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let ultimoError: unknown;

  for (let intento = 0; intento <= maxRetries; intento++) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        redirect: 'follow',
        signal: controller.signal,
        cache: 'no-store'
      });

      if (!response.ok) {
        if (RETRYABLE_STATUS.has(response.status) && intento < maxRetries) {
          const espera = Math.pow(2, intento) * 1000 + Math.floor(Math.random() * 1000);
          await sleep(espera);
          continue;
        }
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
      ultimoError = error;
      if (intento < maxRetries) {
        const espera = Math.pow(2, intento) * 1000 + Math.floor(Math.random() * 1000);
        await sleep(espera);
        continue;
      }
      throw error instanceof Error ? error : new Error(`No se pudo descargar el archivo ${url}.`);
    } finally {
      clearTimeout(timer);
    }
  }

  throw ultimoError instanceof Error ? ultimoError : new Error(`No se pudo descargar el archivo ${url}.`);
}

/**
 * robots.txt está DESACTIVADO por completo. Esta función existe solo por
 * compatibilidad con el pipeline, pero siempre devuelve que todo está permitido.
 */
export async function fetchRobotsTxt(baseUrl: string): Promise<{ allowed: string[]; disallowed: string[] }> {
  return { allowed: [], disallowed: [] };
}

/**
 * robots.txt está DESACTIVADO por completo. Siempre devuelve `true`.
 */
export async function isAllowedByRobots(url: string, baseUrl?: string): Promise<boolean> {
  return true;
}

export function clearRobotsCache(): void {
  // Sin caché de robots.txt: nada que limpiar.
}