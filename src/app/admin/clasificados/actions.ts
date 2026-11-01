'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { MAX_FOTOS_CLASIFICADO } from '@/lib/constants';
import { vencimientoAviso } from '@/lib/classifieds';
import { FotoInvalidaError, esArchivo, filasDeFotos, procesarFotosClasificado } from '@/lib/classifieds-photos';

/**
 * Server Actions de la edición de clasificados en el panel.
 *
 * No devuelven datos: validan, guardan y vuelven a la misma pantalla con un
 * parámetro `ok` o `error` en la query (así el formulario funciona sin JS).
 */

function texto(formData: FormData, clave: string): string {
  const valor = formData.get(clave);
  return typeof valor === 'string' ? valor.trim() : '';
}

const edicionSchema = z.object({
  title: z.string().trim().min(3, 'El título debe tener al menos 3 caracteres').max(120, 'El título es demasiado largo'),
  description: z
    .string()
    .trim()
    .min(10, 'La descripción debe tener al menos 10 caracteres')
    .max(2000, 'La descripción es demasiado larga'),
  section: z.string().trim().min(1, 'Elegí una sección').max(60),
  contactName: z.string().trim().min(2, 'Ingresá el nombre de contacto').max(80),
  contactPhone: z.string().trim().min(6, 'Ingresá un teléfono de contacto').max(30),
  contactEmail: z.union([z.string().trim().email('El correo no es válido').max(120), z.literal('')]).optional(),
  price: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v),
    z.coerce.number().nonnegative('El precio no puede ser negativo').optional()
  ),
  locality: z.string().trim().min(1, 'Elegí una localidad').max(80),
  estado: z.enum(['PENDING', 'PUBLISHED', 'REJECTED', 'EXPIRED']),
  expiresAt: z.string().trim().optional()
});

/** Invalida el caché del panel y del sitio público para el aviso editado. */
function revalidar(id: string) {
  revalidatePath('/admin/clasificados');
  revalidatePath(`/admin/clasificados/${id}`);
  revalidatePath('/clasificados');
  revalidatePath(`/clasificados/${id}`);
}

/** Vuelve a la pantalla de edición con el resultado en la query. */
function volverCon(id: string, tipo: 'ok' | 'error', mensaje: string): never {
  redirect(`/admin/clasificados/${id}?${tipo}=${encodeURIComponent(mensaje)}`);
}

/** Convierte el valor de un <input type="date"> a un Date de fin de día local. */
function fechaDesdeInput(valor: string): Date {
  return new Date(`${valor}T23:59:59`);
}

/** Guarda los campos del aviso, su estado y su vigencia. */
export async function actualizarClasificado(formData: FormData) {
  const id = texto(formData, 'id');
  if (!id) redirect('/admin/clasificados');

  const resultado = edicionSchema.safeParse({
    title: texto(formData, 'title'),
    description: texto(formData, 'description'),
    section: texto(formData, 'section'),
    contactName: texto(formData, 'contactName'),
    contactPhone: texto(formData, 'contactPhone'),
    contactEmail: texto(formData, 'contactEmail'),
    price: texto(formData, 'price'),
    locality: texto(formData, 'locality'),
    estado: texto(formData, 'estado'),
    expiresAt: texto(formData, 'expiresAt')
  });

  if (!resultado.success) {
    volverCon(id, 'error', resultado.error.issues[0]?.message ?? 'Datos inválidos.');
  }

  const datos = resultado.data;
  const actual = await prisma.classified.findUnique({ where: { id }, select: { expiresAt: true } });
  if (!actual) redirect('/admin/clasificados');

  // Al publicar sin fecha explícita se conserva la vigencia o se aplican 30 días.
  const expiresAt = datos.expiresAt
    ? fechaDesdeInput(datos.expiresAt)
    : datos.estado === 'PUBLISHED'
      ? (actual.expiresAt ?? vencimientoAviso())
      : datos.estado === 'EXPIRED'
        ? actual.expiresAt
        : null;

  await prisma.classified.update({
    where: { id },
    data: {
      title: datos.title,
      description: datos.description,
      section: datos.section,
      contactName: datos.contactName,
      contactPhone: datos.contactPhone,
      contactEmail: datos.contactEmail ? datos.contactEmail : null,
      price: datos.price ?? null,
      locality: datos.locality,
      status: datos.estado,
      expiresAt
    }
  });

  revalidar(id);
  volverCon(id, 'ok', 'Aviso actualizado.');
}

/** Agrega hasta completar el máximo de fotos del aviso. */
export async function agregarFotosClasificado(formData: FormData) {
  const id = texto(formData, 'id');
  if (!id) redirect('/admin/clasificados');

  const aviso = await prisma.classified.findUnique({
    where: { id },
    select: { id: true, imageUrl: true, images: { select: { position: true } } }
  });
  if (!aviso) redirect('/admin/clasificados');

  const archivos = formData.getAll('photos').filter(esArchivo);
  if (archivos.length === 0) volverCon(id, 'error', 'Elegí al menos una foto.');

  if (aviso.images.length + archivos.length > MAX_FOTOS_CLASIFICADO) {
    volverCon(
      id,
      'error',
      `El aviso ya tiene ${aviso.images.length} foto(s) y el máximo es ${MAX_FOTOS_CLASIFICADO}.`
    );
  }

  let fotos;
  try {
    fotos = await procesarFotosClasificado(archivos);
  } catch (error) {
    if (error instanceof FotoInvalidaError) volverCon(id, 'error', error.message);
    throw error;
  }

  const siguiente = aviso.images.length > 0 ? Math.max(...aviso.images.map((foto) => foto.position)) + 1 : 0;

  await prisma.classified.update({
    where: { id },
    data: {
      images: { create: filasDeFotos(fotos).map((fila, indice) => ({ ...fila, position: siguiente + indice })) },
      ...(aviso.imageUrl ? {} : { imageUrl: fotos[0]?.url ?? null })
    }
  });

  revalidar(id);
  volverCon(id, 'ok', `${fotos.length} foto(s) agregada(s).`);
}

/** Quita una foto de la galería, renumera el orden y sincroniza la portada. */
export async function eliminarFotoClasificado(formData: FormData) {
  const id = texto(formData, 'id');
  const imageId = texto(formData, 'imageId');
  if (!id || !imageId) redirect('/admin/clasificados');

  await prisma.classifiedImage.deleteMany({ where: { id: imageId, classifiedId: id } });

  const restantes = await prisma.classifiedImage.findMany({
    where: { classifiedId: id },
    orderBy: { position: 'asc' },
    select: { id: true, url: true }
  });

  await prisma.$transaction([
    ...restantes.map((foto, indice) =>
      prisma.classifiedImage.update({ where: { id: foto.id }, data: { position: indice } })
    ),
    prisma.classified.update({ where: { id }, data: { imageUrl: restantes[0]?.url ?? null } })
  ]);

  revalidar(id);
  volverCon(id, 'ok', 'Foto eliminada.');
}
