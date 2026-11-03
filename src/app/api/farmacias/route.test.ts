import { beforeEach, describe, expect, it, vi } from 'vitest';

const { pharmacyShift } = vi.hoisted(() => ({
  pharmacyShift: { findFirst: vi.fn(), findMany: vi.fn() }
}));

vi.mock('@/lib/prisma', () => ({ prisma: { pharmacyShift } }));

import { GET } from './route';

function pedir(query = '') {
  return GET(new Request(`http://localhost/api/farmacias${query}`) as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  pharmacyShift.findFirst.mockResolvedValue(null);
  pharmacyShift.findMany.mockResolvedValue([]);
});

describe('GET /api/farmacias', () => {
  it('sin parámetros devuelve el turno de hoy y los próximos 14 días', async () => {
    const res = await pedir();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.turno).toBeNull();
    expect(body.proximos).toEqual([]);
    expect(pharmacyShift.findFirst).toHaveBeenCalledTimes(1);
  });

  it('acepta ?date= y mantiene el formato de la respuesta', async () => {
    const res = await pedir('?date=2026-11-15');
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ date: '2026-11-15' });
  });

  it('modo rango: devuelve desde y hasta tal como se pidieron', async () => {
    const res = await pedir('?desde=2026-11-01&hasta=2026-11-30');
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ desde: '2026-11-01', hasta: '2026-11-30' });
    expect(pharmacyShift.findFirst).not.toHaveBeenCalled();
  });

  it('completa el rango cuando sólo se pasa ?desde con 14 días', async () => {
    const res = await pedir('?desde=2026-11-01');
    expect(res.status).toBe(200);
    // 1 de noviembre + 13 días = 14 de noviembre.
    await expect(res.json()).resolves.toMatchObject({ desde: '2026-11-01', hasta: '2026-11-14' });
  });

  it('acota el filtro de Prisma al rango pedido', async () => {
    await pedir('?desde=2026-11-01&hasta=2026-11-30');

    const [args] = pharmacyShift.findMany.mock.calls[0];
    expect(args.where.date.gte.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(args.where.date.lte.toISOString()).toBe('2026-11-30T00:00:00.000Z');
  });

  it('rechaza un rango mayor a un año', async () => {
    const res = await pedir('?desde=2026-01-01&hasta=2027-06-01');
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ ok: false });
    expect(pharmacyShift.findMany).not.toHaveBeenCalled();
  });

  it('rechaza un fin anterior al inicio', async () => {
    const res = await pedir('?desde=2026-11-30&hasta=2026-11-01');
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ ok: false });
  });

  it('ignora una fecha inválida y cae en hoy', async () => {
    const res = await pedir('?date=no-es-fecha');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('devuelve 500 si falla la consulta', async () => {
    pharmacyShift.findMany.mockRejectedValueOnce(new Error('boom'));
    const res = await pedir();
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({ ok: false });
  });
});
