import { describe, expect, it } from 'vitest';
import {
  farmaciaCreateSchema,
  farmaciaUpdateSchema,
  normalizarAlias,
  primerError,
  primerSlugLibre
} from '@/lib/pharmacy/validation';

/** Alta mínima válida; cada test pisa sólo el campo que le interesa. */
const base = {
  name: 'Farmacia Del Pueblo',
  address: 'Av. San Martín 2345, Saladillo'
};

function errorDe(datos: unknown): string {
  const parsed = farmaciaCreateSchema.safeParse(datos);
  if (parsed.success) throw new Error('se esperaba un error de validación');
  return primerError(parsed.error);
}

describe('normalizarAlias', () => {
  it('pasa a mayúsculas, saca espacios de más y descarta repetidos', () => {
    expect(normalizarAlias([' orianda ', 'ABELENDA II', 'ORIANDA', ''])).toEqual(['ORIANDA', 'ABELENDA II']);
  });

  it('acepta un texto separado por comas', () => {
    expect(normalizarAlias('MANZANO,  cartelle')).toEqual(['MANZANO', 'CARTELLE']);
  });

  it('devuelve una lista vacía con null o undefined', () => {
    expect(normalizarAlias(null)).toEqual([]);
    expect(normalizarAlias(undefined)).toEqual([]);
  });
});

describe('primerSlugLibre', () => {
  it('deriva el slug del nombre', () => {
    expect(primerSlugLibre('Farmacia Del Pueblo', [])).toBe('farmacia-del-pueblo');
  });

  it('saca acentos y caracteres raros', () => {
    expect(primerSlugLibre('Farmacia N° 1 — Rivadavia', [])).toBe('farmacia-n-1-rivadavia');
  });

  it('agrega sufijo numérico cuando el slug ya está tomado', () => {
    expect(primerSlugLibre('Farmacia Central', ['farmacia-central'])).toBe('farmacia-central-2');
    expect(primerSlugLibre('Farmacia Central', ['farmacia-central', 'farmacia-central-2'])).toBe(
      'farmacia-central-3'
    );
  });

  it('cae en un slug genérico si el nombre no aporta nada', () => {
    expect(primerSlugLibre('¡¡¡', [])).toBe('farmacia');
  });
});

describe('farmaciaCreateSchema', () => {
  it('acepta un alta mínima', () => {
    const parsed = farmaciaCreateSchema.safeParse(base);
    expect(parsed.success).toBe(true);
  });

  it('exige el nombre y la dirección', () => {
    expect(errorDe({ ...base, name: '' })).toBe('El nombre es obligatorio');
    expect(errorDe({ ...base, address: 'ab' })).toBe('La dirección es obligatoria');
  });

  it('rechaza coordenadas fuera de rango', () => {
    expect(errorDe({ ...base, latitude: 91 })).toContain('latitud');
    expect(errorDe({ ...base, latitude: -91 })).toContain('latitud');
    expect(errorDe({ ...base, longitude: 181 })).toContain('longitud');
    expect(errorDe({ ...base, longitude: -181 })).toContain('longitud');
  });

  it('acepta coordenadas de Saladillo', () => {
    const parsed = farmaciaCreateSchema.safeParse({ ...base, latitude: -35.6386, longitude: -59.7789 });
    expect(parsed.success).toBe(true);
  });

  it('tolera los formatos de teléfono argentinos y descarta lo que no lo es', () => {
    for (const telefono of ['02344-452240', '+54 2344 45-0000', '(2344) 45-0000']) {
      expect(farmaciaCreateSchema.safeParse({ ...base, phone: telefono }).success).toBe(true);
    }
    expect(errorDe({ ...base, phone: '123' })).toBe('Teléfono inválido');
    expect(errorDe({ ...base, phone: 'llamar a la farmacia' })).toBe('Teléfono inválido');
  });

  it('convierte los campos vacíos en null en lugar de guardar cadenas vacías', () => {
    const parsed = farmaciaCreateSchema.parse({ ...base, phone: '', email: '', whatsapp: '02344-452240' });
    expect(parsed.phone).toBeNull();
    expect(parsed.email).toBeNull();
    expect(parsed.whatsapp).toBe('02344-452240');
  });

  it('rechaza un email con formato inválido', () => {
    expect(errorDe({ ...base, email: 'no-es-un-mail' })).toBe('Email inválido');
  });

  it('acepta alias como texto o como arreglo', () => {
    expect(farmaciaCreateSchema.safeParse({ ...base, alias: 'ORIANDA' }).success).toBe(true);
    expect(farmaciaCreateSchema.safeParse({ ...base, alias: ['ORIANDA', 'ABELENDA II'] }).success).toBe(true);
  });
});

describe('farmaciaUpdateSchema', () => {
  it('acepta un cambio parcial, como sólo activar o desactivar', () => {
    expect(farmaciaUpdateSchema.safeParse({ isActive: false }).success).toBe(true);
    expect(farmaciaUpdateSchema.safeParse({}).success).toBe(true);
  });

  it('sigue validando los campos presentes', () => {
    const parsed = farmaciaUpdateSchema.safeParse({ latitude: 120 });
    expect(parsed.success).toBe(false);
  });
});
