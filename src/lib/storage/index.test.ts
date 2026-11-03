import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getStorageSettings } = vi.hoisted(() => ({ getStorageSettings: vi.fn() }));

vi.mock('@/lib/settings', () => ({ getStorageSettings }));

import { esUrlDeProveedor, getProvider, proveedorPorDefecto, proveedoresDisponibles } from './index';

const CONFIG_COMPLETA = {
  defaultProvider: 'supabase',
  supabaseUrl: 'https://proyecto.supabase.co',
  supabaseBucket: 'portadas',
  supabaseServiceKey: 'service-role-key',
  supabaseServiceKeyMasked: 'serv••••••••-key',
  hasSupabaseServiceKey: true
};

beforeEach(() => {
  vi.clearAllMocks();
  getStorageSettings.mockResolvedValue(CONFIG_COMPLETA);
});

describe('getProvider', () => {
  it('devuelve el proveedor por id', () => {
    expect(getProvider('supabase')?.id).toBe('supabase');
  });

  it('devuelve null para un id desconocido o vacío', () => {
    expect(getProvider('dropbox')).toBeNull();
    expect(getProvider('')).toBeNull();
    expect(getProvider(null)).toBeNull();
  });
});

describe('proveedorPorDefecto', () => {
  it('devuelve el proveedor configurado', async () => {
    await expect(proveedorPorDefecto()).resolves.toMatchObject({ id: 'supabase' });
  });

  it('devuelve null si no hay proveedor por defecto', async () => {
    getStorageSettings.mockResolvedValue({ ...CONFIG_COMPLETA, defaultProvider: '' });
    await expect(proveedorPorDefecto()).resolves.toBeNull();
  });
});

describe('proveedoresDisponibles', () => {
  it('incluye los que tienen credenciales completas', async () => {
    const disponibles = await proveedoresDisponibles();
    expect(disponibles.map((p) => p.id)).toEqual(['supabase']);
  });

  it('excluye los que no están configurados', async () => {
    getStorageSettings.mockResolvedValue({ ...CONFIG_COMPLETA, supabaseServiceKey: '' });
    await expect(proveedoresDisponibles()).resolves.toEqual([]);
  });
});

describe('esUrlDeProveedor', () => {
  it('reconoce una URL pública de Supabase Storage', () => {
    expect(
      esUrlDeProveedor('https://proyecto.supabase.co/storage/v1/object/public/portadas/2026-11/abc.webp')
    ).toBe('supabase');
  });

  it('ignora URLs firmadas (no públicas)', () => {
    expect(esUrlDeProveedor('https://proyecto.supabase.co/storage/v1/object/sign/portadas/abc.webp')).toBeNull();
  });

  it('ignora URLs de otros orígenes', () => {
    expect(esUrlDeProveedor('https://infosaladillo.com.ar/foto.jpg')).toBeNull();
    expect(esUrlDeProveedor('/uploads/2026-11/abc.webp')).toBeNull();
  });
});
