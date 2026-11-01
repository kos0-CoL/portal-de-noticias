import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireApiSession, UnauthorizedError } from '@/lib/auth';
import { shareArticle } from '@/lib/social/share';

/**
 * Publicación manual de una nota en redes sociales.
 * Body: { articleId, channelIds? }
 */

const bodySchema = z.object({
  articleId: z.string().trim().min(1, 'Falta el id de la nota.'),
  channelIds: z.array(z.string()).optional()
});

export async function POST(request: NextRequest) {
  try {
    await requireApiSession();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: 'Error de autenticación.' }, { status: 500 });
  }

  try {
    const body = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' },
        { status: 400 }
      );
    }

    const results = await shareArticle(parsed.data.articleId, parsed.data.channelIds);
    return NextResponse.json({ ok: true, results });
  } catch (error) {
    console.error('[api/difusion/publicar] Error al publicar la nota.', error);
    const mensaje = error instanceof Error ? error.message : 'No se pudo difundir la nota.';
    return NextResponse.json({ ok: false, error: mensaje }, { status: 500 });
  }
}
