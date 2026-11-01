import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireApiSession, UnauthorizedError } from '@/lib/auth';
import { fetchHtml } from '@/lib/scraper/fetcher';
import { parseArticle } from '@/lib/scraper/parser';
import { loadLocalKeywords, matchLocalKeywords } from '@/lib/scraper/keywords';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const bodySchema = z.object({
  url: z.string().url('La URL no es válida.'),
  sourceId: z.string().optional()
});

/**
 * POST: prueba una URL y opcionalmente los selectores de una fuente.
 * No guarda nada en la base: es solo una vista previa para el administrador.
 */
export async function POST(request: NextRequest) {
  try {
    await requireApiSession();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
    }
    throw error;
  }

  let datos: z.infer<typeof bodySchema>;
  try {
    datos = bodySchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: error.errors[0]?.message ?? 'Datos inválidos.' },
        { status: 400 }
      );
    }
    throw error;
  }

  try {
    const fuente = datos.sourceId
      ? await prisma.source.findUnique({ where: { id: datos.sourceId } })
      : null;

    const html = await fetchHtml(datos.url, {
      rotateUserAgent: fuente?.rotateUserAgent ?? true,
      delayMs: 0,
      usePuppeteer: fuente?.usePuppeteer ?? false
    });

    const parsed = await parseArticle(html, datos.url, {
      articleSelector: fuente?.articleSelector ?? null,
      titleSelector: fuente?.titleSelector ?? null,
      imageSelector: fuente?.imageSelector ?? null
    });

    const keywords = await loadLocalKeywords();
    const filtro = matchLocalKeywords(`${parsed.title}\n${parsed.content}`, keywords);

    return NextResponse.json({
      ok: true,
      preview: {
        title: parsed.title,
        excerpt: parsed.excerpt,
        content: parsed.content,
        contentHtml: parsed.contentHtml,
        images: parsed.images,
        publishedAt: parsed.publishedAt,
        wordCount: parsed.content.split(/\s+/).filter(Boolean).length
      },
      filtroLocal: {
        matches: filtro.matches,
        score: filtro.score,
        priority: filtro.priority
      }
    });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'No se pudo procesar la URL.';
    return NextResponse.json({ ok: false, error: mensaje }, { status: 422 });
  }
}
