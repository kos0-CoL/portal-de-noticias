/**
 * Contrato comun de los proveedores de almacenamiento externo.
 * Hoy solo Supabase Storage; Google Drive se sumara mas adelante.
 */

export type StorageProviderId = 'supabase';

export interface StorageUploadOptions {
  /** Ruta destino dentro del proveedor, con extension. Ej: portadas/2026-11/abc.webp */
  nombre: string;
  contentType: string;
}

export interface StorageUploadResult {
  /** URL publica con la que se muestra la imagen. */
  url: string;
  /** Ruta interna del objeto dentro del proveedor. */
  path: string;
}

export interface StorageProvider {
  id: StorageProviderId;
  nombre: string;
  /** true si el proveedor tiene credenciales suficientes para operar. */
  disponible(): Promise<boolean>;
  subir(buffer: Buffer, opts: StorageUploadOptions): Promise<StorageUploadResult>;
}
