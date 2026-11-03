import { describe, it, expect, vi, beforeEach } from 'vitest';

const { requireApiSession, getProvider, proveedorPorDefecto, processRemoteImageToProvider } = vi.hoisted(() => ({
  requireApiSession: vi.fn(async () => ({ id: 'u1' })),
  getProvider: vi.fn(),
  proveedorPorDefecto: vi.fn(),
  processRemoteImageToProvider: vi.fn()
}));

vi.mock('@/lib/auth', () => ({
  requireApiSession,
  UnauthorizedError: class UnauthorizedError extends Error {}
}));

vi.mock('@/lib/storage', () => ({
  getProvider,
  proveedorPorDefecto,
  esUrlDeProveedor: (url: string) => (/\/object\/public\//.test(url) ? 'supabase' : null)
}));

vi.mock('@/lib/images/process', () => ({
  processRemoteImageToProvider,
  processImageToProvider: vi.fn()
}));

import { POST } from './route';

function pedir(body: unknown) {
  return POST(
    new Request('http://localhost/api/imagenes/alojar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }) as never
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  requireApiSession.mockResolvedValue({ id: 'u1' });
});

describe('POST /api/imagenes/alojar', () => {
  it('rechaza un body sin origen', async () => {
    const res = await pedir({});
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ ok: false });
  });

  it('rechaza un origen que no es http(s) ni /uploads/', async () => {
    const res = await pedir({ origen: 'ftp://servidor/foto.jpg' });
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      ok: false,
      error: expect.stringContaining('http(s)')
    });
    expect(getProvider).not.toHaveBeenCalled();
  });

  it('rechaza un proveedor desconocido', async () => {
    getProvider.mockReturnValue(null);
    const res = await pedir({ origen: 'https://infosaladillo.com.ar/foto.jpg', proveedor: 'dropbox' });
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      ok: false,
      error: expect.stringContaining('No hay proveedor')
    });
  });

  it('devuelve la misma URL si ya está alojada en el proveedor', async () => {
    const url = 'https://proyecto.supabase.co/storage/v1/object/public/portadas/2026-11/abc.webp';
    getProvider.mockReturnValue({ id: 'supabase', nombre: 'Supabase Storage' });

    const res = await pedir({ origen: url, proveedor: 'supabase' });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, url, yaAlojada: true });
    expect(processRemoteImageToProvider).not.toHaveBeenCalled();
  });

  it('sube la imagen y devuelve la URL pública', async () => {
    getProvider.mockReturnValue({ id: 'supabase', nombre: 'Supabase Storage' });
    processRemoteImageToProvider.mockResolvedValue({
      url: 'https://proyecto.supabase.co/storage/v1/object/public/portadas/2026-11/nueva.webp',
      originalUrl: 'https://infosaladillo.com.ar/foto.jpg',
      width: 1200,
      height: 800,
      bytes: 45678,
      format: 'webp'
    });

    const res = await pedir({ origen: 'https://infosaladillo.com.ar/foto.jpg', proveedor: 'supabase' });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      proveedor: 'supabase',
      url: expect.stringContaining('/object/public/portadas/'),
      width: 1200,
      height: 800
    });
  });
});
