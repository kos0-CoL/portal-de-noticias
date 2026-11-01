import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireApiSession, UnauthorizedError } from '@/lib/auth';
import { getAiSettings } from '@/lib/settings';
import { MENSAJE_SIN_API_KEY } from '@/lib/ai/provider';
import { rewriteArticleById } from '@/lib/ai/rewrite';

/**
 * Reescritura de una nota con IA desde el panel.
 * Body: { articleId, tonality?, citeSource?, save? }
 */

const TONOS = ['INFORMATIVO_NEUTRAL', 'CERCANO_LOCAL', 'LLAMATIVO_CLICKBAIT', 'FORMAL_SERIO'] as const;

const bodySchema = z.object({
  articleId: z.string().trim().min(1, 'Falta el id de la nota.'),
  tonality: z.enum(TONOS).optional(),
  citeSource: z.boolean().optional(),
  save: z.boolean().optional()
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

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' },
      { status: 400 }
    );
  }

  try {
    const settings = await getAiSettings();
    if (!settings.hasApiKey) {
      return NextResponse.json({ ok: false, error: MENSAJE_SIN_API_KEY }, { status: 400 });
    }

    const result = await rewriteArticleById(parsed.data.articleId, {
      tonality: parsed.data.tonality,
      citeSource: parsed.data.citeSource,
      save: parsed.data.save
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error('[api/ia/reescribir] Error al reescribir la nota.', error);
    const mensaje = error instanceof Error ? error.message : 'La IA no pudo reescribir la nota.';
    return NextResponse.json({ ok: false, error: mensaje }, { status: 502 });
  }
}
