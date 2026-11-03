/**
 * Captura de HTML ya renderizado a PNG con un navegador headless.
 *
 * A diferencia de `renderWithPuppeteer()` en `fetcher.ts`, que navega a una URL
 * externa, acá el HTML viene armado del lado del servidor y se inyecta con
 * `setContent()`. Así no hace falta pasarle ninguna cookie de sesión al
 * navegador ni exponer una URL interna que proteger.
 */

export interface ScreenshotOptions {
  width: number;
  height: number;
  /** Milisegundos de gracia antes de capturar. Por defecto, ninguno. */
  delayMs?: number;
}

/** Tipos mínimos de Puppeteer para no depender de sus tipos (dependencia opcional). */
interface HeadlessPage {
  setViewport(viewport: { width: number; height: number; deviceScaleFactor?: number }): Promise<void>;
  setContent(html: string, options?: Record<string, unknown>): Promise<void>;
  screenshot(options?: Record<string, unknown>): Promise<Uint8Array>;
}
interface HeadlessBrowser {
  newPage(): Promise<HeadlessPage>;
  close(): Promise<void>;
}
interface PuppeteerExtraModule {
  launch(options?: Record<string, unknown>): Promise<HeadlessBrowser>;
  use?: (plugin: unknown) => void;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Abre puppeteer-extra con stealth, igual que el scraper. */
async function launchBrowser(): Promise<HeadlessBrowser> {
  const puppeteerExtraMod = (await import(/* webpackIgnore: true */ 'puppeteer-extra')) as unknown as {
    default: PuppeteerExtraModule;
    use?: (plugin: unknown) => void;
  };
  const puppeteerExtra = puppeteerExtraMod.default || puppeteerExtraMod;
  if (!puppeteerExtra || typeof puppeteerExtra.launch !== 'function') {
    throw new Error('Puppeteer no está disponible en este entorno.');
  }

  try {
    const stealthMod = (await import(/* webpackIgnore: true */ 'puppeteer-extra-plugin-stealth')) as unknown as {
      default: unknown;
    };
    const stealthPlugin = stealthMod.default || stealthMod;
    if (stealthPlugin && typeof puppeteerExtra.use === 'function') {
      puppeteerExtra.use(stealthPlugin);
    }
  } catch {
    // Sin el plugin stealth la captura igual funciona.
  }

  return puppeteerExtra.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      `--window-size=${1920},${1920}`
    ]
  });
}

/**
 * Renderiza el HTML a un PNG del tamaño exacto pedido.
 * Lanza Error con mensaje claro si el navegador no está disponible o falla.
 */
export async function renderScreenshot(html: string, opts: ScreenshotOptions): Promise<Buffer> {
  const { width, height, delayMs = 0 } = opts;
  let browser: HeadlessBrowser | null = null;

  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'load' });

    if (delayMs > 0) await sleep(delayMs);

    const captura = await page.screenshot({
      type: 'png',
      fullPage: false,
      clip: { x: 0, y: 0, width, height }
    });

    return Buffer.from(captura);
  } catch (error) {
    const detalle = error instanceof Error ? error.message : 'error desconocido';
    throw new Error(`No se pudo generar la imagen: ${detalle}`);
  } finally {
    await browser?.close().catch(() => undefined);
  }
}
