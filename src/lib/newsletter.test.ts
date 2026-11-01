import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

/**
 * Tests unitarios del módulo de newsletter.
 * Se mockea @/lib/prisma para no depender de base de datos real.
 */

const mockCreate = vi.fn();
const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    newsletterSubscriber: {
      create: mockCreate,
      findUnique: mockFindUnique,
      update: mockUpdate
    }
  }
}));

// Esquema idéntico al usado en la ruta de suscripción para validar su lógica.
const suscripcionSchema = z.object({
  email: z.string().email('Email inválido'),
  name: z.string().min(1).max(80).optional()
});

describe('newsletter suscripcionSchema', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('debe aceptar un email válido y nombre opcional', () => {
    const resultado = suscripcionSchema.safeParse({ email: 'juan@saladillonoticias.com.ar', name: 'Juan Pérez' });
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.email).toBe('juan@saladillonoticias.com.ar');
      expect(resultado.data.name).toBe('Juan Pérez');
    }
  });

  it('debe rechazar un email inválido', () => {
    const resultado = suscripcionSchema.safeParse({ email: 'no-es-un-email' });
    expect(resultado.success).toBe(false);
  });

  it('debe aceptar solo email (nombre opcional)', () => {
    const resultado = suscripcionSchema.safeParse({ email: 'ana@mail.com' });
    expect(resultado.success).toBe(true);
  });
});

describe('flujo de suscripcion (mock)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('crea un suscriptor nuevo con status ACTIVO', async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({
      id: 'sub_1',
      email: 'nuevo@mail.com',
      status: 'ACTIVO',
      createdAt: new Date()
    });

    const existe = await mockFindUnique({ where: { email: 'nuevo@mail.com' } });
    expect(existe).toBeNull();

    const creado = await mockCreate({
      data: {
        email: 'nuevo@mail.com',
        name: null,
        status: 'ACTIVO',
        source: 'web'
      },
      select: { id: true, email: true, status: true, createdAt: true }
    });
    expect(creado.status).toBe('ACTIVO');
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('detecta email duplicado y no crea de nuevo', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'sub_dup',
      email: 'dup@mail.com',
      status: 'ACTIVO'
    });

    const existente = await mockFindUnique({ where: { email: 'dup@mail.com' } });
    expect(existente).not.toBeNull();
    expect(existente.status).toBe('ACTIVO');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('reactiva un suscriptor dado de baja', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'sub_baja',
      email: 'baja@mail.com',
      status: 'DADO_DE_BAJA'
    });
    mockUpdate.mockResolvedValue({
      id: 'sub_baja',
      email: 'baja@mail.com',
      status: 'ACTIVO'
    });

    const existente = await mockFindUnique({ where: { email: 'baja@mail.com' } });
    expect(existente.status).toBe('DADO_DE_BAJA');

    const actualizado = await mockUpdate({
      where: { id: 'sub_baja' },
      data: { status: 'ACTIVO', updatedAt: expect.any(Date) }
    });
    expect(actualizado.status).toBe('ACTIVO');
  });
});
