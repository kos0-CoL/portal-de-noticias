import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireApiSession, UnauthorizedError } from '@/lib/auth';
import { retrySocialPost } from '@/lib/social/share';

/**
 * Reintento de una publicación fallida desde la cola del panel.
 * Body: { postId }
 */

const bodySchema = z.object({
  postId: z.string().trim().min(1, 'Falta el id de la publicación.')
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

    const result = await retrySocialPost(parsed.data.postId);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error('[api/difusion/reintentar] Error al reintentar la publicación.', error);
    const mensaje = error instanceof Error ? error.message : 'No se pudo reintentar la publicación.';
    return NextResponse.json({ ok: false, error: mensaje }, { status: 500 });
  }
}
