import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireApiSession, UnauthorizedError } from '@/lib/auth';
import { discardScrapedItem, reprocessScrapedItem } from '@/lib/scraper/pipeline';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  id: z.string().min(1, 'Falta el id del item.'),
  status: z.enum(['PENDING', 'PROCESSED', 'DISCARDED', 'ERROR']).optional(),
  reprocess: z.boolean().optional()
});

/** GET: cola de items extraídos, filtrable y paginada. */
export async function GET(request: NextRequest) {
  try {
    await requireApiSession();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
    }
    throw error;
  }

  const sp = request.nextUrl.searchParams;
  const status = sp.get('status');
  const priority = sp.get('priority');
  const sourceId = sp.get('sourceId');
  const page = Math.max(1, Number(sp.get('page') ?? 1) || 1);
  const perPage = Math.min(100, Math.max(1, Number(sp.get('perPage') ?? 20) || 20));

  const where = {
    ...(status ? { status: status as 'PENDING' | 'PROCESSED' | 'DISCARDED' | 'ERROR' } : {}),
    ...(priority ? { priority: priority as 'NORMAL' | 'ALTA' | 'URGENTE' } : {}),
    ...(sourceId ? { sourceId } : {})
  };

  const [items, total] = await Promise.all([
    prisma.scrapedItem.findMany({
      where,
      include: { source: true, article: true },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * perPage,
      take: perPage
    }),
    prisma.scrapedItem.count({ where })
  ]);

  return NextResponse.json({
    ok: true,
    items,
    paginacion: { page, perPage, total, totalPaginas: Math.ceil(total / perPage) }
  });
}

/** PATCH: cambia el estado de un item (por ejemplo descartarlo) o lo reprocesa. */
export async function PATCH(request: NextRequest) {
  try {
    await requireApiSession();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
    }
    throw error;
  }

  try {
    const datos = patchSchema.parse(await request.json());

    if (datos.reprocess) {
      await reprocessScrapedItem(datos.id);
    } else if (datos.status === 'DISCARDED') {
      await discardScrapedItem(datos.id);
    } else if (datos.status) {
      await prisma.scrapedItem.update({ where: { id: datos.id }, data: { status: datos.status } });
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
