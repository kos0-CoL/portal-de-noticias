import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { UnauthorizedError, requireApiSession } from '@/lib/auth';
import { shareArticle } from '@/lib/social/share';

/**
 * POST /api/noticias/[id]/publicar
 * Entrada: { unpublish?: boolean, share?: boolean, shareTo?: string[] }
 *   - Sin unpublish: pasa la nota a PUBLISHED y completa publishedAt si faltaba.
 *   - Con unpublish: la vuelve a borrador.
 *   - Con share/shareTo: además dispara la difusión en redes (shareArticle).
 * Salida: { ok: true, article: { id, slug, status, publishedAt }, shares? }
 *
 * Requiere sesión.
 */

interface PublicarBody {
  unpublish?: boolean;
  share?: boolean;
  shareTo?: string[];
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireApiSession();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
    }
    throw error;
  }

  const body = (await request.json().catch(() => ({}))) as PublicarBody;

  const existing = await prisma.article.findUnique({
    where: { id: params.id },
    select: { id: true, publishedAt: true }
  });
  if (!existing) {
    return NextResponse.json({ ok: false, error: 'Nota no encontrada' }, { status: 404 });
  }

  const unpublish = body.unpublish === true;

  const article = await prisma.article.update({
    where: { id: params.id },
    data: unpublish
      ? { status: 'DRAFT' }
      : {
          status: 'PUBLISHED',
          publishedAt: existing.publishedAt ?? new Date()
        },
    select: { id: true, slug: true, status: true, publishedAt: true }
  });

  // Difusión opcional: nunca debe romper la publicación.
  const wantsShare = !unpublish && (body.share === true || (Array.isArray(body.shareTo) && body.shareTo.length > 0));
  let shares: { channel: string; network: string; status: string; error?: string }[] | undefined;

  if (wantsShare) {
    try {
      shares = await shareArticle(params.id, body.shareTo);
    } catch (error) {
      shares = [
        {
          channel: 'difusion',
          network: 'GENERAL',
          status: 'ERROR',
          error: error instanceof Error ? error.message : 'Error al difundir'
        }
      ];
    }
  }

  return NextResponse.json({ ok: true, article, shares });
}
