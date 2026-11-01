import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { MAX_FOTOS_CLASIFICADO } from '@/lib/constants';
import { FotoInvalidaError, esArchivo, filasDeFotos, procesarFotosClasificado } from '@/lib/classifieds-photos';

// sharp y el sistema de archivos requieren el runtime de Node.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** El precio llega como string desde el formulario; vacio => undefined. */
const precioSchema = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : v),
  z.coerce.number().nonnegative('El precio no puede ser negativo').optional()
);

const clasificadoSchema = z.object({
  title: z.string().trim().min(3, 'El título debe tener al menos 3 caracteres').max(120, 'El título es demasiado largo'),
  description: z
    .string()
    .trim()
    .min(10, 'La descripción debe tener al menos 10 caracteres')
    .max(2000, 'La descripción es demasiado larga'),
  section: z.string().trim().min(1, 'Elegí una sección').max(60),
  contactName: z.string().trim().min(2, 'Ingresá tu nombre').max(80),
  contactPhone: z.string().trim().min(6, 'Ingresá un teléfono de contacto').max(30),
  contactEmail: z.union([z.string().trim().email('El correo no es válido').max(120), z.literal('')]).optional(),
  price: precioSchema,
  locality: z.string().trim().min(1, 'Elegí una localidad').max(80)
});

/**
 * Alta de un aviso clasificado desde el formulario publico.
 * Recibe multipart/form-data con los campos de texto y hasta 3 fotos en "photos".
 * El aviso queda en PENDING (en revisión) y las fotos se convierten a WebP.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: 'Datos inválidos.' }, { status: 400 });
  }

  const texto = (clave: string): string => {
    const valor = form.get(clave);
    return typeof valor === 'string' ? valor.trim() : '';
  };

  const resultado = clasificadoSchema.safeParse({
    title: texto('title'),
    description: texto('description'),
    section: texto('section'),
    contactName: texto('contactName'),
    contactPhone: texto('contactPhone'),
    contactEmail: texto('contactEmail'),
    price: texto('price'),
    locality: texto('locality') || 'Saladillo'
  });

  if (!resultado.success) {
    return NextResponse.json(
      { ok: false, error: resultado.error.issues[0]?.message ?? 'Datos inválidos.' },
      { status: 400 }
    );
  }

  // Si llegan más fotos de las permitidas se devuelve el error en vez de recortar
  // en silencio, así el vecino sabe que tiene que sacar alguna.
  const archivos = form.getAll('photos').filter(esArchivo).slice(0, MAX_FOTOS_CLASIFICADO + 1);

  let fotos;
  try {
    fotos = await procesarFotosClasificado(archivos);
  } catch (error) {
    if (error instanceof FotoInvalidaError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    throw error;
  }

  const datos = resultado.data;

  try {
    const aviso = await prisma.classified.create({
      data: {
        title: datos.title,
        description: datos.description,
        section: datos.section,
        contactName: datos.contactName,
        contactPhone: datos.contactPhone,
        contactEmail: datos.contactEmail ? datos.contactEmail : null,
        price: datos.price ?? null,
        locality: datos.locality,
        currency: 'ARS',
        status: 'PENDING',
        imageUrl: fotos[0]?.url ?? null,
        images: { create: filasDeFotos(fotos) }
      },
      select: { id: true }
    });

    return NextResponse.json({ ok: true, id: aviso.id }, { status: 201 });
  } catch {
    return NextResponse.json({ ok: false, error: 'No pudimos guardar el aviso. Intentá más tarde.' }, { status: 500 });
  }
}
