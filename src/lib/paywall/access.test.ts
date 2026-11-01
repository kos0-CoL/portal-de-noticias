import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests unitarios del módulo de paywall / suscripciones premium.
 * Se mockea @/lib/prisma para no depender de base de datos real.
 */

const mocks = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockFindFirst: vi.fn(),
  mockFindMany: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    article: {
      findUnique: mocks.mockFindUnique,
    },
    userSubscription: {
      findFirst: mocks.mockFindFirst,
    },
    subscriptionPlan: {
      findMany: mocks.mockFindMany,
    },
  },
}));

import { hasPremiumAccess, getActiveSubscription, userHasActiveSubscription, getActivePlans } from '@/lib/paywall/access';

describe('hasPremiumAccess', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('devuelve true si el artículo no es premium', async () => {
    mocks.mockFindUnique.mockResolvedValue({ isPremium: false });

    const acceso = await hasPremiumAccess('user_1', 'art_1');
    expect(acceso).toBe(true);
    expect(mocks.mockFindUnique).toHaveBeenCalledWith({
      where: { id: 'art_1' },
      select: { isPremium: true },
    });
  });

  it('devuelve false si el artículo no existe', async () => {
    mocks.mockFindUnique.mockResolvedValue(null);

    const acceso = await hasPremiumAccess('user_1', 'art_inexistente');
    expect(acceso).toBe(false);
  });

  it('devuelve false si el artículo es premium y no hay usuario autenticado', async () => {
    mocks.mockFindUnique.mockResolvedValue({ isPremium: true });

    const acceso = await hasPremiumAccess(null, 'art_1');
    expect(acceso).toBe(false);
  });

  it('devuelve true si el artículo es premium y el usuario tiene suscripción ACTIVA vigente', async () => {
    mocks.mockFindUnique.mockResolvedValue({ isPremium: true });
    mocks.mockFindFirst.mockResolvedValue({
      id: 'sub_1',
      userId: 'user_1',
      status: 'ACTIVA',
      expiresAt: new Date(Date.now() + 86400000),
    });

    const acceso = await hasPremiumAccess('user_1', 'art_1');
    expect(acceso).toBe(true);
    expect(mocks.mockFindFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user_1',
        status: 'ACTIVA',
        expiresAt: { gt: expect.any(Date) },
      },
    });
  });

  it('devuelve false si el artículo es premium y el usuario no tiene suscripción activa', async () => {
    mocks.mockFindUnique.mockResolvedValue({ isPremium: true });
    mocks.mockFindFirst.mockResolvedValue(null);

    const acceso = await hasPremiumAccess('user_1', 'art_1');
    expect(acceso).toBe(false);
  });

  it('devuelve false si el artículo es premium y la suscripción está expirada', async () => {
    mocks.mockFindUnique.mockResolvedValue({ isPremium: true });
    mocks.mockFindFirst.mockResolvedValue(null);

    const acceso = await hasPremiumAccess('user_1', 'art_1');
    expect(acceso).toBe(false);
  });
});

describe('getActiveSubscription', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('retorna la suscripción activa si existe', async () => {
    mocks.mockFindFirst.mockResolvedValue({
      id: 'sub_1',
      userId: 'user_1',
      status: 'ACTIVA',
      plan: { id: 'plan_1', nombre: 'Mensual' },
    });

    const sub = await getActiveSubscription('user_1');
    expect(sub).not.toBeNull();
    expect(sub?.status).toBe('ACTIVA');
    expect(mocks.mockFindFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user_1',
        status: 'ACTIVA',
        expiresAt: { gt: expect.any(Date) },
      },
      include: { plan: true },
    });
  });

  it('retorna null si no hay suscripción activa', async () => {
    mocks.mockFindFirst.mockResolvedValue(null);

    const sub = await getActiveSubscription('user_1');
    expect(sub).toBeNull();
  });
});

describe('userHasActiveSubscription', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('retorna true si el usuario tiene suscripción activa', async () => {
    vi.mocked(mocks.mockFindFirst).mockResolvedValue({
      id: 'sub_1',
      userId: 'user_1',
      status: 'ACTIVA',
    });

    const resultado = await userHasActiveSubscription('user_1');
    expect(resultado).toBe(true);
  });

  it('retorna false si el usuario no tiene suscripción activa', async () => {
    vi.mocked(mocks.mockFindFirst).mockResolvedValue(null);

    const resultado = await userHasActiveSubscription('user_1');
    expect(resultado).toBe(false);
  });
});

describe('getActivePlans', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('retorna los planes activos ordenados por precio', async () => {
    mocks.mockFindMany.mockResolvedValue([
      { id: 'plan_1', nombre: 'Mensual', precio: 1000, activo: true },
    ]);

    const planes = await getActivePlans();
    expect(planes.length).toBe(1);
    expect(mocks.mockFindMany).toHaveBeenCalledWith({
      where: { activo: true },
      orderBy: { precio: 'asc' },
    });
  });
});
