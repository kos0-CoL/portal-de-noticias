import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireApiSession, UnauthorizedError, type SessionPayload } from '@/lib/auth';
import { runAllActiveSources, runSource } from '@/lib/scraper/pipeline';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const bodySchema = z.object({
  sourceId: z.string().optional(),
  all: z.boolean().optional()
});

/** POST: dispara el scraping de una fuente o de todas las activas. */
export async function POST(request: NextRequest) {
  let sesion: SessionPayload;
  try {
    sesion = await requireApiSession();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
    }
    throw error;
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  let datos: z.infer<typeof bodySchema>;
  try {
    datos = bodySchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: 'Datos inválidos.' }, { status: 400 });
    }
    throw error;
  }

  try {
    if (datos.all) {
      const results = await runAllActiveSources({ trigger: 'manual', userId: sesion.sub });
      return NextResponse.json({ ok: true, results });
    }

    if (!datos.sourceId) {
      return NextResponse.json(
        { ok: false, error: 'Indicá una fuente (sourceId) o usá all: true.' },
        { status: 400 }
      );
    }

    const result = await runSource(datos.sourceId, { trigger: 'manual', userId: sesion.sub });
    return NextResponse.json({ ok: true, results: [result] });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: 'Datos inválidos.' }, { status: 400 });
    }
    const mensaje = error instanceof Error ? error.message : 'Error desconocido al ejecutar el scraping.';
    return NextResponse.json({ ok: false, error: mensaje }, { status: 500 });
  }
}
