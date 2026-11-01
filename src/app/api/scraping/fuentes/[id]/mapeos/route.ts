import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireApiSession, UnauthorizedError } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const mapeoSchema = z.object({
  externalCategoryName: z.string().min(1, 'El nombre de la sección es obligatorio.').max(120),
  externalCategoryUrl: z.string().url('La URL de la sección externa no es válida.'),
  localCategoryId: z.string().min(1, 'Elegí una categoría local.'),
  isActive: z.boolean().optional()
});

interface Params {
  params: { id: string };
}

async function sesionValida() {
  try {
    await requireApiSession();
    return null;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
    }
    throw error;
  }
}

/** GET: mapeos de la fuente. */
export async function GET(_request: NextRequest, { params }: Params) {
  const rechazo = await sesionValida();
  if (rechazo) return rechazo;

  const mapeos = await prisma.sourceCategoryMapping.findMany({
    where: { sourceId: params.id },
    include: { localCategory: true },
    orderBy: { externalCategoryName: 'asc' }
  });

  return NextResponse.json({ ok: true, mapeos });
}

/** POST: crea o actualiza un mapeo (upsert por sourceId + URL externa). */
export async function POST(request: NextRequest, { params }: Params) {
  const rechazo = await sesionValida();
  if (rechazo) return rechazo;

  try {
    const body = await request.json();
    const datos = mapeoSchema.parse(body);

    const mapeo = await prisma.sourceCategoryMapping.upsert({
      where: {
        sourceId_externalCategoryUrl: {
          sourceId: params.id,
          externalCategoryUrl: datos.externalCategoryUrl
        }
      },
      create: {
        sourceId: params.id,
        externalCategoryName: datos.externalCategoryName,
        externalCategoryUrl: datos.externalCategoryUrl,
        localCategoryId: datos.localCategoryId,
        isActive: datos.isActive ?? true
      },
      update: {
        externalCategoryName: datos.externalCategoryName,
        localCategoryId: datos.localCategoryId,
        isActive: datos.isActive ?? true
      },
      include: { localCategory: true }
    });

    return NextResponse.json({ ok: true, mapeo }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: error.errors[0]?.message ?? 'Datos inválidos.' },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: false, error: 'No se pudo guardar el mapeo.' }, { status: 500 });
  }
}

/** DELETE: elimina un mapeo por ?mappingId=. */
export async function DELETE(request: NextRequest, { params }: Params) {
  const rechazo = await sesionValida();
  if (rechazo) return rechazo;

  const mappingId = request.nextUrl.searchParams.get('mappingId');
  if (!mappingId) {
    return NextResponse.json({ ok: false, error: 'Falta el parámetro mappingId.' }, { status: 400 });
  }

  try {
    await prisma.sourceCategoryMapping.deleteMany({
      where: { id: mappingId, sourceId: params.id }
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'No se pudo eliminar el mapeo.' }, { status: 500 });
  }
}
