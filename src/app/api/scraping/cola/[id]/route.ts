import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireApiSession, UnauthorizedError } from '@/lib/auth';
import { discardScrapedItem, reprocessScrapedItem } from '@/lib/scraper/pipeline';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  status: z.enum(['PENDING', 'PROCESSED', 'DISCARDED', 'ERROR']).optional(),
  reprocess: z.boolean().optional()
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

/** GET: detalle del item con el contenido crudo completo (para la vista previa). */
export async function GET(_request: NextRequest, { params }: Params) {
  const rechazo = await sesionValida();
  if (rechazo) return rechazo;

  const item = await prisma.scrapedItem.findUnique({
    where: { id: params.id },
    include: { source: true, article: true, job: true }
  });

  if (!item) {
    return NextResponse.json({ ok: false, error: 'El item no existe.' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, item });
}

/** PATCH: cambia el estado o reprocesa el item. */
export async function PATCH(request: NextRequest, { params }: Params) {
  const rechazo = await sesionValida();
  if (rechazo) return rechazo;

  try {
    const datos = patchSchema.parse(await request.json());

    if (datos.reprocess) {
      await reprocessScrapedItem(params.id);
    } else if (datos.status === 'DISCARDED') {
      await discardScrapedItem(params.id);
    } else if (datos.status) {
      await prisma.scrapedItem.update({ where: { id: params.id }, data: { status: datos.status } });
    } else {
      return NextResponse.json(
        { ok: false, error: 'Indicá un status o reprocess: true.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: error.errors[0]?.message ?? 'Datos inválidos.' },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: false, error: 'No se pudo actualizar el item.' }, { status: 500 });
  }
}

/** DELETE: elimina el item de la cola. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const rechazo = await sesionValida();
  if (rechazo) return rechazo;

  try {
    await prisma.scrapedItem.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'No se pudo eliminar el item.' }, { status: 500 });
  }
}
