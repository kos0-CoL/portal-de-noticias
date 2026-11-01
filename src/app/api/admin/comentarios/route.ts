import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

const filtroSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'SPAM']).optional(),
  articleId: z.string().optional(),
  take: z.coerce.number().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const datos = filtroSchema.parse({
      status: searchParams.get('status') || undefined,
      articleId: searchParams.get('articleId') || undefined,
      take: searchParams.get('take') || '50',
      cursor: searchParams.get('cursor') || undefined,
    });

    const [comentarios, total] = await Promise.all([
      prisma.comment.findMany({
        where: {
          ...(datos.status ? { status: datos.status } : {}),
          ...(datos.articleId ? { articleId: datos.articleId } : {}),
        },
        include: {
          article: { select: { id: true, title: true, slug: true } },
          parent: { select: { id: true, authorName: true } },
          replies: { select: { id: true, authorName: true, status: true, createdAt: true }, take: 3 },
        },
        orderBy: { createdAt: 'desc' },
        take: datos.take,
        ...(datos.cursor ? { cursor: { id: datos.cursor }, skip: 1 } : {}),
      }),
      prisma.comment.count({
        where: {
          ...(datos.status ? { status: datos.status } : {}),
          ...(datos.articleId ? { articleId: datos.articleId } : {}),
        },
      }),
    ]);

    return NextResponse.json({ comentarios, total, nextCursor: comentarios[comentarios.length - 1]?.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
