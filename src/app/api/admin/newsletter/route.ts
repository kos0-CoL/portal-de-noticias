import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireApiSession } from '@/lib/auth';

const listSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(25),
  status: z.enum(['ACTIVO', 'DADO_DE_BAJA']).optional(),
  q: z.string().optional()
});

/**
 * GET /api/admin/newsletter
 * Listado paginado de suscriptores del boletín (requiere sesión de admin).
 */
export async function GET(request: Request) {
  try {
    await requireApiSession();

    const { searchParams } = new URL(request.url);
    const datos = listSchema.parse({
      page: searchParams.get('page') ?? '1',
      pageSize: searchParams.get('pageSize') ?? '25',
      status: searchParams.get('status') ?? undefined,
      q: searchParams.get('q') ?? undefined
    });

    const where: Record<string, unknown> = {};
    if (datos.status) where.status = datos.status;
    if (datos.q) {
      where.email = { contains: datos.q, mode: 'insensitive' };
    }

    const [items, total] = await Promise.all([
      prisma.newsletterSubscriber.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (datos.page - 1) * datos.pageSize,
        take: datos.pageSize
      }),
      prisma.newsletterSubscriber.count({ where })
    ]);

    return NextResponse.json({
      items,
      total,
      page: datos.page,
      pageSize: datos.pageSize,
      totalPages: Math.ceil(total / datos.pageSize)
    });
  } catch (error) {
    if ((error as { name?: string }).name === 'UnauthorizedError') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
