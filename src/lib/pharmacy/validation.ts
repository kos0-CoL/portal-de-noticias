import { z } from 'zod';
import { slugify } from '@/lib/utils';

/**
 * Validación y normalización de farmacias.
 *
 * Módulo puro (no toca la base): los esquemas se comparten entre las rutas de
 * alta y de edición, y las funciones de abajo se testean por separado.
 */

/** Formatos argentinos aceptados: "+54 2344 45-0000", "02344-452240", "(2344) 45-0000". */
function telefonoValido(valor: string): boolean {
  if (!/^[+()\d\s.-]{6,40}$/.test(valor)) return false;
  return (valor.match(/\d/g)?.length ?? 0) >= 6;
}

const telefono = z
  .string()
  .trim()
  .max(40, 'El teléfono es demasiado largo')
  .refine((valor) => valor === '' || telefonoValido(valor), 'Teléfono inválido')
  .transform((valor) => (valor === '' ? null : valor))
  .nullable()
  .optional();

/**
 * Normaliza los alias tal como se comparan contra el organigrama del Colegio:
 * en mayúsculas, sin espacios de más y sin repetidos. Acepta un texto separado
 * por comas o un arreglo ya armado.
 */
export function normalizarAlias(valor: string[] | string | null | undefined): string[] {
  const lista = Array.isArray(valor) ? valor : valor ? valor.split(',') : [];
  const salida: string[] = [];
  for (const item of lista) {
    const limpio = String(item).trim().replace(/\s+/g, ' ').toUpperCase();
    if (limpio && !salida.includes(limpio)) salida.push(limpio);
  }
  return salida;
}

/**
 * Primer slug libre a partir de `base`, agregando sufijo -2, -3... si ya está
 * usado. Reemplaza al bucle con consultas que usa `uniqueCategorySlug`: acá se
 * consultan todos los slugs de una sola vez y la parte pura queda testeable.
 */
export function primerSlugLibre(base: string, usados: Iterable<string>): string {
  const root = slugify(base) || 'farmacia';
  const tomados = new Set(usados);
  if (!tomados.has(root)) return root;
  let contador = 2;
  while (tomados.has(`${root}-${contador}`)) contador += 1;
  return `${root}-${contador}`;
}

const camposFarmacia = {
  name: z
    .string({ required_error: 'El nombre es obligatorio' })
    .trim()
    .min(2, 'El nombre es obligatorio')
    .max(120),
  slug: z.string().trim().max(90).optional(),
  alias: z.union([z.array(z.string()), z.string()]).optional(),
  address: z
    .string({ required_error: 'La dirección es obligatoria' })
    .trim()
    .min(3, 'La dirección es obligatoria')
    .max(200),
  zone: z.string().trim().max(80).nullable().optional(),
  phone: telefono,
  whatsapp: telefono,
  email: z
    .string()
    .trim()
    .email('Email inválido')
    .or(z.literal(''))
    .transform((valor) => (valor === '' ? null : valor))
    .nullable()
    .optional(),
  latitude: z
    .number()
    .min(-90, 'La latitud debe estar entre -90 y 90')
    .max(90, 'La latitud debe estar entre -90 y 90')
    .nullable()
    .optional(),
  longitude: z
    .number()
    .min(-180, 'La longitud debe estar entre -180 y 180')
    .max(180, 'La longitud debe estar entre -180 y 180')
    .nullable()
    .optional(),
  notes: z.string().trim().max(1000, 'Las notas son demasiado largas').nullable().optional(),
  position: z.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional()
};

export const farmaciaCreateSchema = z.object(camposFarmacia);

export const farmaciaUpdateSchema = z.object(camposFarmacia).partial();

export type FarmaciaInput = z.infer<typeof farmaciaCreateSchema>;

/** Mensaje del primer error del esquema, para devolverlo tal cual al panel. */
export function primerError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Datos inválidos';
}
