import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { UnauthorizedError, requireApiSession } from '@/lib/auth';
import {
  farmaciaCreateSchema,
  normalizarAlias,
  primerError,
  primerSlugLibre
} from '@/lib/pharmacy/validation';

/**
 * GET  /api/admin/farmacias — todas las farmacias con su cantidad de turnos.
 * POST /api/admin/farmacias — da de alta una farmacia.
 *
 * Vive bajo /admin a propósito: `GET /api/farmacias` es público y está
 * documentado en el README, así que no se toca.
 */

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
}

export async function GET() {
  try {
    await requireApiSession();
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }

  const pharmacies = await prisma.pharmacy.findMany({
    orderBy: [{ position: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { shifts: true } } }
  });

  return NextResponse.json({ ok: true, pharmacies });
}

export async function POST(request: Request) {
  try {
    await requireApiSession();
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }

  const body = await request.json().catch(() => null);
  const parsed = farmaciaCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: primerError(parsed.error) }, { status: 400 });
  }
  const data = parsed.data;

  const repetida = await prisma.pharmacy.findFirst({
    where: { name: { equals: data.name, mode: 'insensitive' } },
    select: { id: true }
  });
  if (repetida) {
    return NextResponse.json({ ok: false, error: 'Ya existe una farmacia con ese nombre' }, { status: 409 });
  }

  const usados = await prisma.pharmacy.findMany({ select: { slug: true } });

  const pharmacy = await prisma.pharmacy.create({
    data: {
      slug: primerSlugLibre(data.slug || data.name, usados.map((fila) => fila.slug)),
      name: data.name,
      alias: normalizarAlias(data.alias),
      address: data.address,
      zone: data.zone ?? null,
      phone: data.phone ?? null,
      whatsapp: data.whatsapp ?? null,
      email: data.email ?? null,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      notes: data.notes ?? null,
      position: data.position ?? 0,
      isActive: data.isActive ?? true
    }
  });

  return NextResponse.json({ ok: true, pharmacy }, { status: 201 });
}
