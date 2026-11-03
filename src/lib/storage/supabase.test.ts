import { describe, it, expect, vi, beforeEach } from 'vitest';

/** La configuracion de storage se mockea: los tests no tocan la base ni la red. */
const { getStorageSettings } = vi.hoisted(() => ({ getStorageSettings: vi.fn() }));

vi.mock('@/lib/settings', () => ({ getStorageSettings }));

import { subirASupabase, supabaseProvider } from './supabase';

const CONFIG_COMPLETA = {
  defaultProvider: 'supabase',
  supabaseUrl: 'https://proyecto.supabase.co',
  supabaseBucket: 'portadas',
  supabaseServiceKey: 'service-role-key',
  supabaseServiceKeyMasked: 'serv••••••••-key',
  hasSupabaseServiceKey: true
};

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  getStorageSettings.mockResolvedValue(CONFIG_COMPLETA);
});

describe('subirASupabase', () => {
  it('sube al endpoint del bucket con los headers correctos y devuelve la URL pública', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => '' });

    const resultado = await subirASupabase(Buffer.from('datos'), {
      nombre: 'portadas/2026-11/abc.webp',
      contentType: 'image/webp'
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opciones] = fetchMock.mock.calls[0];
    expect(url).toBe('https://proyecto.supabase.co/storage/v1/object/portadas/portadas/2026-11/abc.webp');
    expect(opciones.method).toBe('POST');
    expect(opciones.headers).toMatchObject({
      Authorization: 'Bearer service-role-key',
      'Content-Type': 'image/webp',
      'x-upsert': 'true'
    });

    expect(resultado).toEqual({
      url: 'https://proyecto.supabase.co/storage/v1/object/public/portadas/portadas/2026-11/abc.webp',
      path: 'portadas/2026-11/abc.webp'
    });
  });

  it('normaliza la barra final de la URL del proyecto', async () => {
    getStorageSettings.mockResolvedValue({ ...CONFIG_COMPLETA, supabaseUrl: 'https://proyecto.supabase.co///' });
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => '' });

    const resultado = await subirASupabase(Buffer.from('x'), { nombre: 'a.webp', contentType: 'image/webp' });

    expect(fetchMock.mock.calls[0][0]).toBe('https://proyecto.supabase.co/storage/v1/object/portadas/a.webp');
    expect(resultado.url).toBe('https://proyecto.supabase.co/storage/v1/object/public/portadas/a.webp');
  });

  it('lanza un error con el detalle cuando el storage responde con error', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403, text: async () => 'new row violates row-level security' });

    await expect(
      subirASupabase(Buffer.from('x'), { nombre: 'a.webp', contentType: 'image/webp' })
    ).rejects.toThrow(/HTTP 403.*row-level security/);
  });

  it('rechaza rutas que intentan salir del bucket', async () => {
    await expect(
      subirASupabase(Buffer.from('x'), { nombre: '../../etc/passwd', contentType: 'image/webp' })
    ).rejects.toThrow('El nombre del archivo para el storage no es válido.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falla si falta configuración', async () => {
    getStorageSettings.mockResolvedValue({ ...CONFIG_COMPLETA, supabaseServiceKey: '' });

    await expect(
      subirASupabase(Buffer.from('x'), { nombre: 'a.webp', contentType: 'image/webp' })
    ).rejects.toThrow('Supabase Storage no está configurado');
  });
});

describe('supabaseProvider.disponible', () => {
  it('es true con credenciales completas', async () => {
    await expect(supabaseProvider.disponible()).resolves.toBe(true);
  });

  it('es false si falta el bucket', async () => {
    getStorageSettings.mockResolvedValue({ ...CONFIG_COMPLETA, supabaseBucket: '' });
    await expect(supabaseProvider.disponible()).resolves.toBe(false);
  });
});
