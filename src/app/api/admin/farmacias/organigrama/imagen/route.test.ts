import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireApiSession, pharmacyShift, proveedorPorDefecto, getPharmacySettings } = vi.hoisted(() => ({
  requireApiSession: vi.fn(async () => ({ id: 'u1' })),
  pharmacyShift: { findMany: vi.fn() },
  proveedorPorDefecto: vi.fn(),
  getPharmacySettings: vi.fn(async () => ({
    rotationOrder: [] as string[],
    rotationAnchorDate: null as string | null,
    shiftStart: '08:00',
    shiftEnd: '08:00'
  }))
}));

vi.mock('@/lib/auth', () => ({
  requireApiSession,
  UnauthorizedError: class UnauthorizedError extends Error {}
}));
vi.mock('@/lib/prisma', () => ({ prisma: { pharmacyShift } }));
vi.mock('@/lib/storage', () => ({ proveedorPorDefecto }));
vi.mock('@/lib/settings', () => ({ getPharmacySettings }));
// Se usa la implementación real (sharp); el spy sólo permite forzar un fallo.
vi.mock('@/lib/pharmacy/schedule-image', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/pharmacy/schedule-image')>();
  return { ...actual, renderOrganigramaPng: vi.fn(actual.renderOrganigramaPng) };
});

import { renderOrganigramaPng } from '@/lib/pharmacy/schedule-image';
import { POST } from './route';

/** Tres días cargados de octubre de 2026. */
function turnosDePrueba() {
  return [
    { date: new Date('2026-10-01T00:00:00.000Z'), pharmacy: { name: 'Orianda' } },
    { date: new Date('2026-10-02T00:00:00.000Z'), pharmacy: { name: 'Marcos' } },
    { date: new Date('2026-10-03T00:00:00.000Z'), pharmacy: { name: 'Libertad' } }
  ];
}

function pedir(body: unknown) {
  return POST(
    new Request('http://localhost/api/admin/farmacias/organigrama/imagen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }) as never
  );
}

const proveedorOk = {
  id: 'supabase',
  nombre: 'Supabase Storage',
  disponible: async () => true,
  subir: async () => ({ url: 'https://cdn.example/organigrama/2026-10-historia.png', path: 'organigrama/x.png' })
};

beforeEach(() => {
  vi.clearAllMocks();
  requireApiSession.mockResolvedValue({ id: 'u1' });
  pharmacyShift.findMany.mockResolvedValue(turnosDePrueba());
  proveedorPorDefecto.mockResolvedValue(null);
});

describe('POST /api/admin/farmacias/organigrama/imagen', () => {
  it('rechaza el pedido sin turnos cargados', async () => {
    pharmacyShift.findMany.mockResolvedValue([]);

    const res = await pedir({ mes: '2026-10', formato: 'historia' });
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ ok: false, error: expect.stringContaining('No hay turnos cargados') });
  });

  it('rechaza un mes inválido', async () => {
    const res = await pedir({ mes: '2026-13' });
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ ok: false, error: 'Mes inválido' });
  });

  it('rechaza un formato desconocido', async () => {
    const res = await pedir({ mes: '2026-10', formato: 'cuadrado' });
    expect(res.status).toBe(400);
    expect(renderOrganigramaPng).not.toHaveBeenCalled();
  });

  it('informa las dimensiones del formato pedido', async () => {
    const res = await pedir({ mes: '2026-10', formato: 'post' });
    await expect(res.json()).resolves.toMatchObject({ width: 1080, height: 1080 });
  });

  it('sube el PNG y devuelve la URL cuando hay proveedor', async () => {
    proveedorPorDefecto.mockResolvedValue(proveedorOk);

    const res = await pedir({ mes: '2026-10', formato: 'historia' });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      url: 'https://cdn.example/organigrama/2026-10-historia.png',
      base64: null,
      filename: '2026-10-historia.png'
    });
  });

  it('devuelve un PNG válido en base64 si no hay proveedor configurado', async () => {
    const res = await pedir({ mes: '2026-10', formato: 'post' });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.url).toBeNull();

    const png = Buffer.from(body.base64, 'base64');
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(png.readUInt32BE(16)).toBe(1080);
    expect(png.readUInt32BE(20)).toBe(1080);
  });

  it('devuelve 502 si falla la generación', async () => {
    vi.mocked(renderOrganigramaPng).mockRejectedValueOnce(new Error('sharp no está disponible'));

    const res = await pedir({ mes: '2026-10', formato: 'historia' });
    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toMatchObject({ ok: false, error: 'sharp no está disponible' });
  });

  it('devuelve el PNG igual si la subida falla', async () => {
    proveedorPorDefecto.mockResolvedValue({
      ...proveedorOk,
      subir: async () => {
        throw new Error('bucket caído');
      }
    });

    const res = await pedir({ mes: '2026-10', formato: 'historia' });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, url: null });
  });
});
