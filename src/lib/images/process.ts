import { prisma } from '@/lib/prisma';

async function fsPromises() {
  return import('fs/promises');
}

async function cryptoModule() {
  return import('crypto');
}

async function pathModule() {
  return import('path');
}
import { getSetting, getWatermarkSettings, SETTING_KEYS, type WatermarkSettings } from '@/lib/settings';

/**
 * Procesamiento de imagenes con sharp: descarga, redimensiona, aplica marca de
 * agua y guarda en WebP dentro de /public/uploads/<yyyy-mm>.
 *
 * Robustez: si sharp no esta disponible o falla en runtime, todas las funciones
 * caen a un "modo degradado" que devuelve la URL original sin procesar en lugar
 * de romper el pipeline del scraper.
 */

type SharpFactory = typeof import('sharp');

interface Overlay {
  buf: Buffer;
  width: number;
  height: number;
}

export interface ProcessedImage {
  url: string;
  originalUrl: string;
  width: number;
  height: number;
  bytes: number;
  format: string;
}

export interface ProcessImageOptions {
  watermark?: WatermarkSettings;
  maxWidth?: number;
  quality?: number;
  prefix?: string;
}

const MAX_BYTES = 12 * 1024 * 1024; // Limite de 12 MB por imagen
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

let sharpFactory: SharpFactory | null = null;
let sharpResolved = false;

/** Carga sharp de forma perezosa; devuelve null si no esta disponible. */
async function getSharp(): Promise<SharpFactory | null> {
  if (sharpResolved) return sharpFactory;
  sharpResolved = true;
  try {
    const mod = (await import('sharp')) as unknown as { default?: SharpFactory };
    const candidato = mod.default ?? (mod as unknown as SharpFactory);
    if (typeof candidato !== 'function') {
      throw new Error('El módulo sharp no exporta una función utilizable.');
    }
    sharpFactory = candidato;
  } catch (error) {
    console.warn(
      '[imágenes] sharp no está disponible: se usará el modo degradado (las imágenes se guardan sin procesar).',
      error
    );
    sharpFactory = null;
  }
  return sharpFactory;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function uploadsRoot(): string {
  const pathMod = require('path');
  return pathMod.join(process.cwd(), 'public', 'uploads');
}

/** Guarda un buffer en /public/uploads/<yyyy-mm>/<hash>.<ext> y devuelve la url. */
async function saveBuffer(buffer: Buffer, ext: string): Promise<string> {
  const { mkdir, readFile, writeFile } = await fsPromises();
  const { createHash } = await cryptoModule();
  const pathMod = await pathModule();
  const now = new Date();
  const folder = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const dir = pathMod.join(uploadsRoot(), folder);
  await mkdir(dir, { recursive: true });
  const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 24);
  const fileName = `${hash}.${ext}`;
  await writeFile(pathMod.join(dir, fileName), buffer);
  return `/uploads/${folder}/${fileName}`;
}

/** Lee el logo de la marca de agua desde una URL remota o una ruta local. */
async function loadLogoBuffer(logoUrl: string): Promise<Buffer | null> {
  try {
    if (/^https?:\/\//i.test(logoUrl)) {
      const response = await fetch(logoUrl, { headers: { 'User-Agent': USER_AGENT } });
      if (!response.ok) return null;
      return Buffer.from(await response.arrayBuffer());
    }
    if (logoUrl.startsWith('/')) {
      const { join } = await import('path');
      const { readFile } = await import('fs/promises');
      const localPath = join(process.cwd(), 'public', logoUrl.replace(/^\//, ''));
      return await readFile(localPath);
    }
  } catch (error) {
    console.warn('[imágenes] No se pudo cargar el logo de la marca de agua.', error);
  }
  return null;
}

/** Genera el SVG de la marca de agua de texto (blanco con sombra oscura). */
function buildTextSvg(text: string, opacity: number, fontSize: number): Buffer {
  const padding = 14;
  const height = fontSize + padding * 2;
  const width = Math.max(220, Math.round(text.length * fontSize * 0.62) + padding * 2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <text x="${padding}" y="${fontSize + padding}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="700"
      fill="#ffffff" fill-opacity="${opacity}" stroke="#000000" stroke-opacity="${clamp(opacity + 0.2, 0, 0.85)}" stroke-width="2" paint-order="stroke">${escapeXml(
    text
  )}</text>
  </svg>`;
  return Buffer.from(svg);
}

/** Construye la capa de la marca de agua (logo o texto) ya con la opacidad aplicada. */
async function buildOverlay(
  sharp: SharpFactory,
  watermark: WatermarkSettings | undefined,
  targetWidth: number
): Promise<Overlay | null> {
  if (!watermark?.enabled) return null;
  const opacity = clamp(watermark.opacity || 0.35, 0.05, 1);

  if (watermark.logoUrl) {
    const logoBuffer = await loadLogoBuffer(watermark.logoUrl);
    if (logoBuffer) {
      try {
        const logoWidth = Math.max(40, Math.round(targetWidth * 0.25));
        const resizedLogo = await sharp(logoBuffer).resize({ width: logoWidth, withoutEnlargement: true }).ensureAlpha().png().toBuffer();
        // Se aplica la opacidad multiplicando el canal alfa con un tapiz uniforme.
        const withOpacity = await sharp(resizedLogo)
          .composite([
            {
              input: Buffer.from([255, 255, 255, Math.round(opacity * 255)]),
              raw: { width: 1, height: 1, channels: 4 },
              tile: true,
              blend: 'dest-in'
            }
          ])
          .png()
          .toBuffer();
        const meta = await sharp(withOpacity).metadata();
        return { buf: withOpacity, width: meta.width ?? logoWidth, height: meta.height ?? logoWidth };
      } catch (error) {
        console.warn('[imágenes] Falló la composición del logo de marca de agua; se usa el texto.', error);
      }
    }
  }

  const fontSize = Math.max(18, Math.round(targetWidth * 0.045));
  const svg = buildTextSvg(watermark.text || 'Saladillo Noticias', opacity, fontSize);
  const meta = await sharp(svg).metadata();
  return { buf: svg, width: meta.width ?? 0, height: meta.height ?? 0 };
}

/** Calcula la posicion (left/top) de la marca de agua segun la zona elegida. */
function computePosition(
  position: WatermarkSettings['position'],
  imageWidth: number,
  imageHeight: number,
  overlayWidth: number,
  overlayHeight: number
): { left: number; top: number } {
  const margin = 24;
  const maxLeft = Math.max(0, imageWidth - overlayWidth);
  const maxTop = Math.max(0, imageHeight - overlayHeight);

  switch (position) {
    case 'southwest':
      return { left: margin, top: Math.max(0, maxTop - margin) };
    case 'northeast':
      return { left: Math.max(0, maxLeft - margin), top: margin };
    case 'northwest':
      return { left: margin, top: margin };
    case 'center':
      return { left: Math.round(maxLeft / 2), top: Math.round(maxTop / 2) };
    case 'southeast':
    default:
      return { left: Math.max(0, maxLeft - margin), top: Math.max(0, maxTop - margin) };
  }
}

/** Resuelve maxWidth / quality / marca de agua: opciones explicitas o configuracion. */
async function resolveOptions(opts?: ProcessImageOptions): Promise<Required<Pick<ProcessImageOptions, 'maxWidth' | 'quality'>> & { watermark: WatermarkSettings }> {
  const [settingWidth, settingQuality, settingWatermark] = await Promise.all([
    getSetting<number>(SETTING_KEYS.imageMaxWidth),
    getSetting<number>(SETTING_KEYS.imageQuality),
    getWatermarkSettings()
  ]);
  return {
    maxWidth: opts?.maxWidth ?? (typeof settingWidth === 'number' ? settingWidth : 1600),
    quality: opts?.quality ?? (typeof settingQuality === 'number' ? settingQuality : 82),
    watermark: opts?.watermark ?? settingWatermark
  };
}

/** Nucleo de procesamiento con sharp: rotate -> resize -> overlay -> webp. */
async function processWithSharp(
  sharp: SharpFactory,
  input: Buffer,
  maxWidth: number,
  quality: number,
  watermark: WatermarkSettings
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const { data: resizedBuffer, info } = await sharp(input)
    .rotate()
    .resize({ width: maxWidth, withoutEnlargement: true })
    .toBuffer({ resolveWithObject: true });

  let workingBuffer = resizedBuffer;
  const overlay = await buildOverlay(sharp, watermark, info.width);
  if (overlay) {
    const position = computePosition(watermark.position, info.width, info.height, overlay.width, overlay.height);
    workingBuffer = await sharp(resizedBuffer)
      .composite([{ input: overlay.buf, left: position.left, top: position.top }])
      .toBuffer();
  }

  const webpBuffer = await sharp(workingBuffer).webp({ quality }).toBuffer();
  const meta = await sharp(webpBuffer).metadata();

  return {
    buffer: webpBuffer,
    width: meta.width ?? info.width,
    height: meta.height ?? info.height
  };
}

/**
 * Descarga una imagen remota, la procesa con sharp y la guarda en /public/uploads.
 * Si sharp no esta disponible, devuelve la URL original sin procesar.
 */
export async function processRemoteImage(src: string, opts?: ProcessImageOptions): Promise<ProcessedImage> {
  const { maxWidth, quality, watermark } = await resolveOptions(opts);

  const response = await fetch(src, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'image/avif,image/webp,image/*,*/*;q=0.8',
      ...((): Record<string, string> => {
        try {
          return { Referer: new URL(src).origin };
        } catch {
          return {};
        }
      })()
    }
  });

  if (!response.ok) {
    throw new Error(`No se pudo descargar la imagen (HTTP ${response.status}).`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('image/')) {
    throw new Error('El recurso remoto no es una imagen válida.');
  }

  const declaredSize = Number(response.headers.get('content-length') ?? 0);
  if (declaredSize > MAX_BYTES) {
    throw new Error('La imagen supera el límite de 12 MB permitido.');
  }

  const original = Buffer.from(await response.arrayBuffer());
  if (original.byteLength > MAX_BYTES) {
    throw new Error('La imagen supera el límite de 12 MB permitido.');
  }

  const sharp = await getSharp();
  if (!sharp) {
    // Modo degradado: se devuelve la URL original sin procesar.
    return { url: src, originalUrl: src, width: 0, height: 0, bytes: original.byteLength, format: 'original' };
  }

  try {
    const processed = await processWithSharp(sharp, original, maxWidth, quality, watermark);
    const url = await saveBuffer(processed.buffer, 'webp');
    return {
      url,
      originalUrl: src,
      width: processed.width,
      height: processed.height,
      bytes: processed.buffer.byteLength,
      format: 'webp'
    };
  } catch (error) {
    console.warn(`[imágenes] No se pudo procesar la imagen ${src}; se usa el original.`, error);
    return { url: src, originalUrl: src, width: 0, height: 0, bytes: original.byteLength, format: 'original' };
  }
}

/**
 * Procesa una imagen subida a mano desde el panel.
 * En modo degradado guarda el archivo tal cual y devuelve su url.
 */
export async function processUploadedImage(buffer: Buffer, originalName: string, opts?: ProcessImageOptions): Promise<ProcessedImage> {
  const { maxWidth, quality, watermark } = await resolveOptions(opts);
  const { extname } = await import('path');
  const ext = (extname(originalName).replace('.', '') || 'bin').toLowerCase();

  const sharp = await getSharp();
  if (!sharp) {
    const url = await saveBuffer(buffer, ext);
    return { url, originalUrl: originalName, width: 0, height: 0, bytes: buffer.byteLength, format: ext };
  }

  try {
    const processed = await processWithSharp(sharp, buffer, maxWidth, quality, watermark);
    const url = await saveBuffer(processed.buffer, 'webp');
    return {
      url,
      originalUrl: originalName,
      width: processed.width,
      height: processed.height,
      bytes: processed.buffer.byteLength,
      format: 'webp'
    };
  } catch (error) {
    console.warn('[imágenes] Falló el procesamiento de la imagen subida; se guarda el original.', error);
    const url = await saveBuffer(buffer, ext);
    return { url, originalUrl: originalName, width: 0, height: 0, bytes: buffer.byteLength, format: ext };
  }
}

/**
 * Procesa en serie las imagenes de una nota traida por el scraper, aplica la
 * marca de agua configurada y guarda los registros ArticleImage.
 * Cada imagen se maneja de forma aislada: si falla, se saltea sin abortar.
 */
export async function replaceArticleImages(articleId: string, remoteUrls: string[]): Promise<ProcessedImage[]> {
  const { watermark } = await resolveOptions();
  const procesadas: ProcessedImage[] = [];

  for (let index = 0; index < remoteUrls.length; index++) {
    const remoteUrl = remoteUrls[index];
    try {
      const processed = await processRemoteImage(remoteUrl, { watermark });
      procesadas.push(processed);

      await prisma.articleImage.create({
        data: {
          articleId,
          url: processed.url,
          originalUrl: processed.originalUrl,
          width: processed.width || null,
          height: processed.height || null,
          bytes: processed.bytes || null,
          position: index,
          isCover: index === 0
        }
      });

      if (index === 0) {
        const article = await prisma.article.findUnique({ where: { id: articleId }, select: { coverImage: true } });
        if (article && !article.coverImage) {
          await prisma.article.update({ where: { id: articleId }, data: { coverImage: processed.url } });
        }
      }
    } catch (error) {
      console.warn(`[imágenes] Se salteó la imagen ${remoteUrl} de la nota ${articleId}.`, error);
    }

    // Pequeño delay entre descargas para no golpear los servidores de origen.
    if (index < remoteUrls.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  return procesadas;
}
