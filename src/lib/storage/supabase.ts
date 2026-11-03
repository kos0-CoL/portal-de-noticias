import { getStorageSettings } from '@/lib/settings';
import type { StorageProvider, StorageUploadResult } from './types';

/**
 * Proveedor de almacenamiento sobre Supabase Storage.
 * Usa la API REST con `fetch` (sin SDK) para no sumar dependencias.
 * El bucket debe ser publico: las URLs resultantes se sirven sin token.
 */

function sinBarraFinal(url: string): string {
  return url.replace(/\/+$/, '');
}

/** Normaliza la ruta destino y evita salir del bucket con "..". */
function sanitizarRuta(nombre: string): string {
  const limpio = nombre.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/{2,}/g, '/');
  if (!limpio || limpio.includes('..')) {
    throw new Error('El nombre del archivo para el storage no es válido.');
  }
  return limpio;
}

export async function subirASupabase(
  buffer: Buffer,
  opts: { nombre: string; contentType: string }
): Promise<StorageUploadResult> {
  const { supabaseUrl, supabaseBucket, supabaseServiceKey } = await getStorageSettings();
  if (!supabaseUrl || !supabaseBucket || !supabaseServiceKey) {
    throw new Error('Supabase Storage no está configurado (URL, bucket o service role key).');
  }

  const base = sinBarraFinal(supabaseUrl);
  const ruta = sanitizarRuta(opts.nombre);

  const respuesta = await fetch(`${base}/storage/v1/object/${supabaseBucket}/${ruta}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${supabaseServiceKey}`,
      'Content-Type': opts.contentType,
      'x-upsert': 'true'
    },
    body: new Uint8Array(buffer)
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => '');
    throw new Error(
      `Supabase Storage devolvió HTTP ${respuesta.status}${detalle ? `: ${detalle.slice(0, 200)}` : '.'}`
    );
  }

  return { url: `${base}/storage/v1/object/public/${supabaseBucket}/${ruta}`, path: ruta };
}

export const supabaseProvider: StorageProvider = {
  id: 'supabase',
  nombre: 'Supabase Storage',
  async disponible() {
    const { supabaseUrl, supabaseBucket, supabaseServiceKey } = await getStorageSettings();
    return Boolean(supabaseUrl && supabaseBucket && supabaseServiceKey);
  },
  subir: subirASupabase
};
