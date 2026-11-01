import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { sanitizeHtml } from '@/lib/utils';
import { rateLimit, getRateLimitKey } from '@/lib/rate-limit';

const comentarioSchema = z.object({
  articleId: z.string().min(1, 'ID de nota requerido'),
  authorName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(80),
  authorEmail: z.string().email().optional().or(z.literal('')),
  content: z.string().min(5, 'El comentario debe tener al menos 5 caracteres').max(2000),
  parentId: z.string().optional(),
});

export async function POST(request: Request) {
  // Rate limiting: 10 comentarios por hora por IP+endpoint
  const key = getRateLimitKey(request, 'comentarios:crear');
  const limit = rateLimit(key, { limit: 10, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Demasiados comentarios. Intentá nuevamente más tarde.' },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const datos = comentarioSchema.parse(body);

    // Verificar que la nota exista y esté publicada.
    const articulo = await prisma.article.findUnique({
      where: { id: datos.articleId },
      select: { id: true, status: true },
    });
    if (!articulo || articulo.status !== 'PUBLISHED') {
      return NextResponse.json({ error: 'Nota no encontrada' }, { status: 404 });
    }

    // Si hay parentId, verificar que exista y pertenezca a la misma nota.
    if (datos.parentId) {
      const padre = await prisma.comment.findUnique({
        where: { id: datos.parentId },
        select: { id: true, articleId: true },
      });
      if (!padre || padre.articleId !== datos.articleId) {
        return NextResponse.json({ error: 'Comentario padre inválido' }, { status: 400 });
      }
    }

    const comentario = await prisma.comment.create({
      data: {
        articleId: datos.articleId,
        authorName: datos.authorName.trim(),
        authorEmail: datos.authorEmail?.trim() || null,
        content: sanitizeHtml(datos.content),
        status: 'PENDING',
        parentId: datos.parentId || null,
      },
    });

    return NextResponse.json(
      { id: comentario.id, status: comentario.status },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
