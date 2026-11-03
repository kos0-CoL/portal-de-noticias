import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { UnauthorizedError, requireApiSession } from '@/lib/auth';
import {
  farmaciaUpdateSchema,
  normalizarAlias,
  primerError,
  primerSlugLibre
} from '@/lib/pharmacy/validation';

/**
 * PATCH  /api/admin/farmacias/[id] — actualiza una farmacia.
 * DELETE /api/admin/farmacias/[id] — baja lógica si tiene turnos cargados;
 *   borrado real sólo si no tiene ninguno (si no, se perdería el historial).
 */

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireApiSession();
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }

  const body = await request.json().catch(() => null);
  const parsed = farmaciaUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: primerError(parsed.error) }, { status: 400 });
  }
  const data = parsed.data;

  const existing = await prisma.pharmacy.findUnique({
    where: { id: params.id },
    select: { id: true, name: true }
  });
  if (!existing) {
    return NextResponse.json({ ok: false, error: 'Farmacia no encontrada' }, { status: 404 });
  }

  if (data.name && data.name.toLowerCase() !== existing.name.toLowerCase()) {
    const repetida = await prisma.pharmacy.findFirst({
      where: { name: { equals: data.name, mode: 'insensitive' }, NOT: { id: params.id } },
      select: { id: true }
    });
    if (repetida) {
      return NextResponse.json({ ok: false, error: 'Ya existe otra farmacia con ese nombre' }, { status: 409 });
    }
  }

  let slug: string | undefined;
  if (data.slug) {
    const usados = await prisma.pharmacy.findMany({
      where: { NOT: { id: params.id } },
      select: { slug: true }
    });
    slug = primerSlugLibre(data.slug, usados.map((fila) => fila.slug));
  }

  const pharmacy = await prisma.pharmacy.update({
    where: { id: params.id },
    data: {
      slug,
      name: data.name,
      alias: data.alias !== undefined ? normalizarAlias(data.alias) : undefined,
      address: data.address,
      zone: data.zone,
      phone: data.phone,
      whatsapp: data.whatsapp,
      email: data.email,
      latitude: data.latitude,
      longitude: data.longitude,
      notes: data.notes,
      position: data.position,
      isActive: data.isActive
    }
  });

  return NextResponse.json({ ok: true, pharmacy });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    await requireApiSession();
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }

  const pharmacy = await prisma.pharmacy.findUnique({
    where: { id: params.id },
    include: { _count: { select: { shifts: true } } }
  });
  if (!pharmacy) {
    return NextResponse.json({ ok: false, error: 'Farmacia no encontrada' }, { status: 404 });
  }

  if (pharmacy._count.shifts > 0) {
    const actualizada = await prisma.pharmacy.update({
      where: { id: params.id },
      data: { isActive: false }
    });
    return NextResponse.json({
      ok: true,
      bajaLogica: true,
      pharmacy: actualizada,
      mensaje: `La farmacia quedó inactiva: tiene ${pharmacy._count.shifts} turno(s) que conviene conservar.`
    });
  }

  await prisma.pharmacy.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true, bajaLogica: false });
}
