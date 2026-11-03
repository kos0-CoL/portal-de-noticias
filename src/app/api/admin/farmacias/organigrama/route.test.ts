import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireApiSession, pharmacy, pharmacyShift, getPharmacySettings, setSetting } = vi.hoisted(() => ({
  requireApiSession: vi.fn(async () => ({ id: 'u1' })),
  pharmacy: { findMany: vi.fn() },
  pharmacyShift: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  getPharmacySettings: vi.fn(),
  setSetting: vi.fn(async (_clave: string, _valor: unknown) => ({}))
}));

vi.mock('@/lib/auth', () => ({
  requireApiSession,
  UnauthorizedError: class UnauthorizedError extends Error {}
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    pharmacy,
    pharmacyShift,
    $transaction: vi.fn(async (operaciones: unknown[]) => operaciones)
  }
}));

vi.mock('@/lib/settings', () => ({
  getPharmacySettings,
  setSetting,
  SETTING_KEYS: { pharmacyRotationOrder: 'pharmacy.rotationOrder', pharmacyRotationAnchorDate: 'pharmacy.rotationAnchorDate' }
}));

import { DELETE, GET, PATCH, POST, PUT } from './route';

const CICLO = { rotationOrder: ['a', 'b', 'c'], rotationAnchorDate: '2026-10-01' };

function pedir(metodo: 'POST' | 'PATCH' | 'PUT', body: unknown) {
  const handler = { POST, PATCH, PUT }[metodo];
  return handler(
    new Request('http://localhost/api/admin/farmacias/organigrama', {
      method: metodo,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }) as never
  );
}

function limpiar(query = '') {
  return DELETE(new Request(`http://localhost/api/admin/farmacias/organigrama${query}`, { method: 'DELETE' }) as never);
}

/** Fechas de los upsert, en ISO, para verificar qué días se tocaron. */
function fechasTocadas(): string[] {
  return pharmacyShift.upsert.mock.calls.map((llamada) =>
    (llamada[0] as { where: { date: Date } }).where.date.toISOString().slice(0, 10)
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  requireApiSession.mockResolvedValue({ id: 'u1' });
  getPharmacySettings.mockResolvedValue({
    importUrl: '',
    rotationOrder: CICLO.rotationOrder,
    rotationAnchorDate: CICLO.rotationAnchorDate,
    shiftStart: '08:00',
    shiftEnd: '08:00'
  });
  pharmacy.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  pharmacyShift.findMany.mockResolvedValue([]);
  pharmacyShift.upsert.mockResolvedValue({});
  pharmacyShift.deleteMany.mockResolvedValue({ count: 0 });
});

describe('POST /api/admin/farmacias/organigrama', () => {
  it('genera el mes completo desde el ciclo', async () => {
    const res = await pedir('POST', { mes: '2026-10' });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, generados: 31, respetados: 0 });
    expect(fechasTocadas()).toHaveLength(31);
    expect(pharmacyShift.upsert.mock.calls[0][0]).toMatchObject({
      create: { pharmacyId: 'a', source: 'ROTACION' }
    });
  });

  it('no pisa un día corregido a mano', async () => {
    pharmacyShift.findMany.mockResolvedValue([{ date: new Date('2026-10-05T00:00:00.000Z'), source: 'MANUAL' }]);

    const res = await pedir('POST', { mes: '2026-10', modo: 'respetar-manual' });

    await expect(res.json()).resolves.toMatchObject({ generados: 30, respetados: 1 });
    expect(fechasTocadas()).not.toContain('2026-10-05');
  });

  it('pisa el día a mano cuando se pide reemplazar todo', async () => {
    pharmacyShift.findMany.mockResolvedValue([{ date: new Date('2026-10-05T00:00:00.000Z'), source: 'MANUAL' }]);

    const res = await pedir('POST', { mes: '2026-10', modo: 'reemplazar-todo' });

    await expect(res.json()).resolves.toMatchObject({ generados: 31, respetados: 0 });
    expect(fechasTocadas()).toContain('2026-10-05');
  });

  it('no borra días que no son MANUAL al respetar lo manual', async () => {
    pharmacyShift.findMany.mockResolvedValue([{ date: new Date('2026-10-05T00:00:00.000Z'), source: 'IMPORT' }]);

    const res = await pedir('POST', { mes: '2026-10' });

    await expect(res.json()).resolves.toMatchObject({ generados: 31, respetados: 0 });
  });

  it('avisa en vez de generar si falta el ciclo', async () => {
    getPharmacySettings.mockResolvedValue({
      importUrl: '',
      rotationOrder: [],
      rotationAnchorDate: null,
      shiftStart: '08:00',
      shiftEnd: '08:00'
    });

    const res = await pedir('POST', { mes: '2026-10' });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ ok: false, error: expect.stringContaining('ciclo de rotación') });
    expect(pharmacyShift.upsert).not.toHaveBeenCalled();
  });

  it('ignora los ids de farmacias que ya no existen', async () => {
    getPharmacySettings.mockResolvedValue({
      importUrl: '',
      rotationOrder: ['a', 'borrada'],
      rotationAnchorDate: '2026-10-01',
      shiftStart: '08:00',
      shiftEnd: '08:00'
    });
    pharmacy.findMany.mockResolvedValue([{ id: 'a' }]);

    await pedir('POST', { mes: '2026-10' });

    expect(pharmacyShift.upsert).toHaveBeenCalledTimes(31);
    expect(pharmacyShift.upsert.mock.calls.every((llamada) => llamada[0].create.pharmacyId === 'a')).toBe(true);
  });

  it('copia el mes anterior día por día', async () => {
    pharmacyShift.findMany.mockResolvedValue([
      { date: new Date('2026-09-30T00:00:00.000Z'), pharmacyId: 'c', note: null },
      { date: new Date('2026-09-02T00:00:00.000Z'), pharmacyId: 'b', note: 'Turno de 24 horas' }
    ]);

    const res = await pedir('POST', { mes: '2026-10', modo: 'copiar-anterior' });

    // Octubre tiene 31 días: el 2 y el 30 tienen equivalente en septiembre, el resto no.
    await expect(res.json()).resolves.toMatchObject({ copiados: 2, sinCopiar: 29 });
    const copiados = pharmacyShift.upsert.mock.calls.map((llamada) => llamada[0]);
    expect(copiados.map((op) => (op.where as { date: Date }).date.toISOString().slice(0, 10))).toEqual([
      '2026-10-02',
      '2026-10-30'
    ]);
    expect(copiados[0].create).toMatchObject({ pharmacyId: 'b', source: 'MANUAL' });
  });
});

describe('PATCH /api/admin/farmacias/organigrama', () => {
  it('asigna días sueltos marcándolos como MANUAL', async () => {
    const res = await pedir('PATCH', { cambios: [{ date: '2026-10-05', pharmacyId: 'b' }] });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, aplicados: 1 });
    expect(pharmacyShift.upsert.mock.calls[0][0]).toMatchObject({
      where: { date: new Date('2026-10-05T00:00:00.000Z') },
      update: { pharmacyId: 'b', source: 'MANUAL' }
    });
  });

  it('quita el turno cuando viene sin farmacia', async () => {
    await pedir('PATCH', { cambios: [{ date: '2026-10-05', pharmacyId: null }] });

    expect(pharmacyShift.deleteMany).toHaveBeenCalledWith({ where: { date: new Date('2026-10-05T00:00:00.000Z') } });
    expect(pharmacyShift.upsert).not.toHaveBeenCalled();
  });

  it('rechaza un día vacío', async () => {
    const res = await pedir('PATCH', { cambios: [] });
    expect(res.status).toBe(400);
  });

  it('rechaza una farmacia inexistente', async () => {
    pharmacy.findMany.mockResolvedValue([]);
    const res = await pedir('PATCH', { cambios: [{ date: '2026-10-05', pharmacyId: 'fantasma' }] });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: expect.stringContaining('ya no existe') });
    expect(pharmacyShift.upsert).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/admin/farmacias/organigrama', () => {
  it('limpia el mes pedido y nada más', async () => {
    pharmacyShift.deleteMany.mockResolvedValue({ count: 30 });

    const res = await limpiar('?mes=2026-10');

    await expect(res.json()).resolves.toMatchObject({ ok: true, mes: '2026-10', borrados: 30 });
    expect(pharmacyShift.deleteMany).toHaveBeenCalledWith({
      where: { date: { gte: new Date('2026-10-01T00:00:00.000Z'), lt: new Date('2026-11-01T00:00:00.000Z') } }
    });
  });

  it('sin parámetro usa el mes en curso', async () => {
    await limpiar();
    const { where } = pharmacyShift.deleteMany.mock.calls[0][0];
    expect(where.date.gte.getUTCDate()).toBe(1);
  });
});

describe('PUT /api/admin/farmacias/organigrama', () => {
  it('guarda el ciclo con repeticiones', async () => {
    pharmacy.findMany.mockResolvedValue([
      { id: 'a', name: 'Orianda', isActive: true },
      { id: 'b', name: 'Marcos', isActive: true }
    ]);

    const res = await pedir('PUT', { orden: ['a', 'b', 'a'], ancla: '2026-10-01' });

    expect(res.status).toBe(200);
    expect(setSetting).toHaveBeenCalledTimes(2);
    expect(setSetting.mock.calls[0][1]).toEqual(['a', 'b', 'a']);
  });

  it('rechaza farmacias inactivas en lugar de limpiarlas en silencio', async () => {
    pharmacy.findMany.mockResolvedValue([{ id: 'a', name: 'Abelenda II', isActive: false }]);

    const res = await pedir('PUT', { orden: ['a'], ancla: '2026-10-01' });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: expect.stringContaining('Abelenda II') });
    expect(setSetting).not.toHaveBeenCalled();
  });

  it('rechaza una fecha de referencia inválida', async () => {
    const res = await pedir('PUT', { orden: ['a'], ancla: '01/10/2026' });
    expect(res.status).toBe(400);
  });
});

describe('autenticación', () => {
  it('devuelve 401 sin sesión en lugar de filtrar datos', async () => {
    const { UnauthorizedError } = await import('@/lib/auth');
    requireApiSession.mockRejectedValue(new UnauthorizedError());

    expect((await GET(new Request('http://localhost/api/admin/farmacias/organigrama') as never)).status).toBe(401);
    expect((await pedir('POST', { mes: '2026-10' })).status).toBe(401);
    expect(pharmacyShift.upsert).not.toHaveBeenCalled();
  });
});
