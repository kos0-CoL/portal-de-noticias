import { getStorageSettings } from '@/lib/settings';
import { supabaseProvider } from './supabase';
import type { StorageProvider, StorageProviderId } from './types';

/**
 * Registro de proveedores de almacenamiento externo.
 * `esUrlDeProveedor` permite reconocer por la URL si una portada ya esta alojada
 * (no se guarda ningun dato nuevo en la base).
 */

export type { StorageProvider, StorageProviderId, StorageUploadOptions, StorageUploadResult } from './types';
export { supabaseProvider } from './supabase';

export const PROVIDERS: Record<StorageProviderId, StorageProvider> = {
  supabase: supabaseProvider
};

export const LISTA_PROVEEDORES: StorageProvider[] = Object.values(PROVIDERS);

export function getProvider(id: string | null | undefined): StorageProvider | null {
  if (!id) return null;
  return (PROVIDERS as Record<string, StorageProvider>)[id] ?? null;
}

/** Proveedor elegido como predeterminado en /admin/almacenamiento (o null). */
export async function proveedorPorDefecto(): Promise<StorageProvider | null> {
  const { defaultProvider } = await getStorageSettings();
  return getProvider(defaultProvider);
}

/** Proveedores con credenciales completas, listos para usar. */
export async function proveedoresDisponibles(): Promise<StorageProvider[]> {
  const resultados = await Promise.all(
    LISTA_PROVEEDORES.map(async (proveedor) => ((await proveedor.disponible()) ? proveedor : null))
  );
  return resultados.filter((proveedor): proveedor is StorageProvider => proveedor !== null);
}

/** Devuelve el id del proveedor si la URL ya apunta a un objeto publico suyo. */
export function esUrlDeProveedor(url: string): StorageProviderId | null {
  if (!/\.supabase\.(co|in)\//i.test(url)) return null;
  return /\/storage\/v1\/object\/public\//i.test(url) ? 'supabase' : null;
}
