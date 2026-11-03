import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireApiSession, pharmacy } = vi.hoisted(() => ({
  requireApiSession: vi.fn(async () => ({ id: 'u1' })),
  pharmacy: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }
}));

vi.mock('@/lib/auth', () => ({
  requireApiSession,
  UnauthorizedError: class UnauthorizedError extends Error {}
}));

vi.mock('@/lib/prisma', () => ({ prisma: { pharmacy } }));

import { GET, POST } from './route';
import { DELETE, PATCH } from './[id]/route';

const alta = { name: 'Farmacia Central', address: 'Belgrano 1120, Saladillo' };

function pedir(body: unknown) {
  return POST(
    new Request('http://localhost/api/admin/farmacias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }) as never
  );
}

function pedirId(metodo: 'PATCH' | 'DELETE', id: string, body?: unknown) {
  const request = new Request(`http://localhost/api/admin/farmacias/${id}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  }) as never;
  return metodo === 'PATCH' ? PATCH(request, { params: { id } }) : DELETE(request, { params: { id } });
}

beforeEach(() => {
  vi.clearAllMocks();
  requireApiSession.mockResolvedValue({ id: 'u1' });
  pharmacy.findMany.mockResolvedValue([]);
  pharmacy.findFirst.mockResolvedValue(null);
  pharmacy.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'n1', ...data }));
  pharmacy.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'n1', ...data }));
});

describe('POST /api/admin/farmacias', () => {
  it('rechaza el alta sin dirección', async () => {
    const res = await pedir({ name: 'Farmacia Central' });
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ ok: false, error: 'La dirección es obligatoria' });
    expect(pharmacy.create).not.toHaveBeenCalled();
  });

  it('rechaza coordenadas fuera de rango', async () => {
    const res = await pedir({ ...alta, latitude: 200 });
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ ok: false, error: expect.stringContaining('latitud') });
  });

  it('rechaza un nombre repetido', async () => {
    pharmacy.findFirst.mockResolvedValue({ id: 'otra' });
    const res = await pedir(alta);
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({ ok: false, error: expect.stringContaining('Ya existe') });
  });

  it('deriva el slug del nombre y guarda los alias en mayúsculas', async () => {
    const res = await pedir({ ...alta, alias: 'oridanda' });
    expect(res.status).toBe(201);
    const enviado = pharmacy.create.mock.calls[0][0].data;
    expect(enviado.slug).toBe('farmacia-central');
    expect(enviado.alias).toEqual(['ORIDANDA']);
    expect(enviado.position).toBe(0);
    expect(enviado.isActive).toBe(true);
  });

  it('agrega un sufijo si el slug ya está tomado', async () => {
    pharmacy.findMany.mockResolvedValue([{ slug: 'farmacia-central' }, { slug: 'farmacia-central-2' }]);
    await pedir(alta);
    expect(pharmacy.create.mock.calls[0][0].data.slug).toBe('farmacia-central-3');
  });
});

describe('PATCH /api/admin/farmacias/[id]', () => {
  it('devuelve 404 si la farmacia no existe', async () => {
    pharmacy.findUnique.mockResolvedValue(null);
    const res = await pedirId('PATCH', 'inexistente', { isActive: false });
    expect(res.status).toBe(404);
  });

  it('permite desactivar sin tocar el resto de los campos', async () => {
    pharmacy.findUnique.mockResolvedValue({ id: 'n1', name: 'Farmacia Central' });
    const res = await pedirId('PATCH', 'n1', { isActive: false });
    expect(res.status).toBe(200);
    const enviado = pharmacy.update.mock.calls[0][0].data;
    expect(enviado.isActive).toBe(false);
    expect(enviado.name).toBeUndefined();
    expect(enviado.slug).toBeUndefined();
  });

  it('recalcula el slug consultando los slugs de las demás farmacias', async () => {
    pharmacy.findUnique.mockResolvedValue({ id: 'n1', name: 'Farmacia Central' });
    pharmacy.findMany.mockResolvedValue([{ slug: 'farmacia-del-pueblo' }]);
    await pedirId('PATCH', 'n1', { slug: 'Farmacia Central' });
    expect(pharmacy.findMany).toHaveBeenCalledWith({
      where: { NOT: { id: 'n1' } },
      select: { slug: true }
    });
    expect(pharmacy.update.mock.calls[0][0].data.slug).toBe('farmacia-central');
  });

  it('no cambia el slug si no se envía', async () => {
    pharmacy.findUnique.mockResolvedValue({ id: 'n1', name: 'Farmacia Central' });
    await pedirId('PATCH', 'n1', { name: 'Farmacia Central de Saladillo' });
    expect(pharmacy.findMany).not.toHaveBeenCalled();
    expect(pharmacy.update.mock.calls[0][0].data.slug).toBeUndefined();
  });

  it('acepta teléfonos y coordenadas válidas', async () => {
    pharmacy.findUnique.mockResolvedValue({ id: 'n1', name: 'Farmacia Central' });
    const res = await pedirId('PATCH', 'n1', { phone: '02344-452240', latitude: -35.6386, longitude: -59.7789 });
    expect(res.status).toBe(200);
  });
});

describe('DELETE /api/admin/farmacias/[id]', () => {
  it('devuelve 404 si la farmacia no existe', async () => {
    pharmacy.findUnique.mockResolvedValue(null);
    const res = await pedirId('DELETE', 'inexistente');
    expect(res.status).toBe(404);
  });

  it('hace baja lógica cuando tiene turnos cargados', async () => {
    pharmacy.findUnique.mockResolvedValue({ id: 'n1', name: 'Farmacia Central', _count: { shifts: 3 } });
    const res = await pedirId('DELETE', 'n1');

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, bajaLogica: true });
    expect(pharmacy.update).toHaveBeenCalledWith({ where: { id: 'n1' }, data: { isActive: false } });
    expect(pharmacy.delete).not.toHaveBeenCalled();
  });

  it('borra de verdad cuando no tiene ningún turno', async () => {
    pharmacy.findUnique.mockResolvedValue({ id: 'n1', name: 'Farmacia Central', _count: { shifts: 0 } });
    const res = await pedirId('DELETE', 'n1');

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, bajaLogica: false });
    expect(pharmacy.delete).toHaveBeenCalledWith({ where: { id: 'n1' } });
    expect(pharmacy.update).not.toHaveBeenCalled();
  });
});

describe('autenticación', () => {
  it('devuelve 401 sin sesión en lugar de filtrar datos', async () => {
    const { UnauthorizedError } = await import('@/lib/auth');
    requireApiSession.mockRejectedValue(new UnauthorizedError());

    expect((await GET()).status).toBe(401);
    expect((await pedir(alta)).status).toBe(401);
    expect(pharmacy.create).not.toHaveBeenCalled();
  });
});
