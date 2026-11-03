import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireApiSession, pharmacyShift, proveedorPorDefecto, renderScreenshot, getPharmacySettings } = vi.hoisted(() => ({
  requireApiSession: vi.fn(async () => ({ id: 'u1' })),
  pharmacyShift: { findMany: vi.fn() },
  proveedorPorDefecto: vi.fn(),
  renderScreenshot: vi.fn(),
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
vi.mock('@/lib/scraper/screenshot', () => ({ renderScreenshot }));
vi.mock('@/lib/settings', () => ({ getPharmacySettings }));

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
  renderScreenshot.mockResolvedValue(Buffer.from('png-falso'));
});

describe('POST /api/admin/farmacias/organigrama/imagen', () => {
  it('rechaza el pedido sin turnos cargados', async () => {
    pharmacyShift.findMany.mockResolvedValue([]);

    const res = await pedir({ mes: '2026-10', formato: 'historia' });
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ ok: false, error: expect.stringContaining('No hay turnos cargados') });
    expect(renderScreenshot).not.toHaveBeenCalled();
  });

  it('rechaza un mes inválido', async () => {
    const res = await pedir({ mes: '2026-13' });
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ ok: false, error: 'Mes inválido' });
  });

  it('rechaza un formato desconocido', async () => {
    const res = await pedir({ mes: '2026-10', formato: 'cuadrado' });
    expect(res.status).toBe(400);
    expect(renderScreenshot).not.toHaveBeenCalled();
  });

  it('renderiza con las dimensiones del formato pedido', async () => {
    await pedir({ mes: '2026-10', formato: 'post' });

    expect(renderScreenshot).toHaveBeenCalledTimes(1);
    const [, opciones] = renderScreenshot.mock.calls[0];
    expect(opciones).toEqual({ width: 1080, height: 1080 });
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

  it('devuelve base64 para descargar si no hay proveedor configurado', async () => {
    const res = await pedir({ mes: '2026-10', formato: 'post' });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.url).toBeNull();
    expect(typeof body.base64).toBe('string');
    expect(Buffer.from(body.base64, 'base64').toString()).toBe('png-falso');
  });

  it('devuelve 502 si falla la captura', async () => {
    renderScreenshot.mockRejectedValueOnce(new Error('No se pudo generar la imagen: sin Chrome'));

    const res = await pedir({ mes: '2026-10', formato: 'historia' });
    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toMatchObject({ ok: false });
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
