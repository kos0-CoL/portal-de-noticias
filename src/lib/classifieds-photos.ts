import { MAX_FOTOS_CLASIFICADO } from '@/lib/constants';
import { processUploadedImage, type ProcessedImage } from '@/lib/images/process';

/** Tipos de imagen aceptados en las fotos que sube la comunidad. */
const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES_FOTO = 6 * 1024 * 1024;

/** Error de validación de las fotos; el mensaje es apto para mostrar al usuario. */
export class FotoInvalidaError extends Error {}

/** Detecta las entradas de FormData que son archivos y no campos de texto. */
export function esArchivo(valor: FormDataEntryValue | null): valor is File {
  return typeof valor === 'object' && valor !== null && 'arrayBuffer' in valor;
}

/**
 * Valida y procesa las fotos de un aviso: las redimensiona y las convierte a
 * WebP con sharp (con el modo degradado de `processUploadedImage` si sharp no
 * está disponible).
 *
 * A diferencia de las imágenes del scraper, las fotos de los avisos no llevan
 * marca de agua: son del vecino que publica, no del medio.
 */
export async function procesarFotosClasificado(archivos: File[]): Promise<ProcessedImage[]> {
  const fotos = archivos.filter((archivo) => archivo.size > 0);
  if (fotos.length === 0) return [];

  if (fotos.length > MAX_FOTOS_CLASIFICADO) {
    throw new FotoInvalidaError(`Podés subir hasta ${MAX_FOTOS_CLASIFICADO} fotos por aviso.`);
  }

  const procesadas: ProcessedImage[] = [];
  for (const foto of fotos) {
    if (!TIPOS_PERMITIDOS.includes(foto.type)) {
      throw new FotoInvalidaError('Las fotos deben ser JPG, PNG o WebP.');
    }
    if (foto.size > MAX_BYTES_FOTO) {
      throw new FotoInvalidaError('Cada foto puede pesar hasta 6 MB.');
    }

    const buffer = Buffer.from(await foto.arrayBuffer());
    procesadas.push(
      await processUploadedImage(buffer, foto.name || 'foto.jpg', {
        maxWidth: 1280,
        quality: 80,
        watermark: { enabled: false, text: '', opacity: 0, position: 'southeast', logoUrl: null }
      })
    );
  }

  return procesadas;
}

/** Arma los registros de la galería a partir de las fotos ya procesadas. */
export function filasDeFotos(fotos: ProcessedImage[]) {
  return fotos.map((foto, indice) => ({
    url: foto.url,
    width: foto.width || null,
    height: foto.height || null,
    bytes: foto.bytes || null,
    position: indice
  }));
}
