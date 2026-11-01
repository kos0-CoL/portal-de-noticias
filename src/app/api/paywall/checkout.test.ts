import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

/**
 * Tests unitarios del schema de validación del checkout de paywall.
 */

const checkoutSchema = z.object({
  planId: z.string().min(1, 'planId es requerido'),
});

describe('checkout schema', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('acepta un planId válido', () => {
    const resultado = checkoutSchema.safeParse({ planId: 'plan_1' });
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.planId).toBe('plan_1');
    }
  });

  it('rechaza planId vacío', () => {
    const resultado = checkoutSchema.safeParse({ planId: '' });
    expect(resultado.success).toBe(false);
  });

  it('rechaza body sin planId', () => {
    const resultado = checkoutSchema.safeParse({});
    expect(resultado.success).toBe(false);
  });
});
