import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireApiSession, UnauthorizedError } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  name: z.string().min(2, 'El nombre es obligatorio.').max(120).optional(),
  baseUrl: z.string().url('La URL base no es válida.').optional(),
  isActive: z.boolean().optional(),
  rotateUserAgent: z.boolean().optional(),
  requestDelayMs: z.coerce.number().int().min(0).max(60_000).optional(),
  maxItemsPerRun: z.coerce.number().int().min(1).max(200).optional(),
  respectRobots: z.boolean().optional(),
  usePuppeteer: z.boolean().optional(),
  crawlSelector: z.string().max(300).nullish(),
  articleSelector: z.string().max(300).nullish(),
  titleSelector: z.string().max(300).nullish(),
  imageSelector: z.string().max(300).nullish(),
  scheduleCron: z.string().max(120).nullish()
});

interface Params {
  params: { id: string };
}

/** GET: detalle de una fuente con sus mapeos y los últimos jobs. */
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requireApiSession();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
    }
    throw error;
  }

  const fuente = await prisma.source.findUnique({
    where: { id: params.id },
    include: {
      mappings: { include: { localCategory: true } },
      jobs: { orderBy: { startedAt: 'desc' }, take: 10 }
    }
  });

  if (!fuente) {
    return NextResponse.json({ ok: false, error: 'La fuente no existe.' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, fuente });
}

/** PATCH: edita una fuente (incluye activar/desactivar y config de selectores). */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await requireApiSession();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
    }
    throw error;
  }

  try {
    const body = await request.json();
    const datos = patchSchema.parse(body);

    const fuente = await prisma.source.update({
      where: { id: params.id },
      data: {
        ...(datos.name !== undefined ? { name: datos.name } : {}),
        ...(datos.baseUrl !== undefined ? { baseUrl: datos.baseUrl } : {}),
        ...(datos.isActive !== undefined ? { isActive: datos.isActive } : {}),
        ...(datos.rotateUserAgent !== undefined ? { rotateUserAgent: datos.rotateUserAgent } : {}),
        ...(datos.requestDelayMs !== undefined ? { requestDelayMs: datos.requestDelayMs } : {}),
        ...(datos.maxItemsPerRun !== undefined ? { maxItemsPerRun: datos.maxItemsPerRun } : {}),
        ...(datos.respectRobots !== undefined ? { respectRobots: datos.respectRobots } : {}),
        ...(datos.usePuppeteer !== undefined ? { usePuppeteer: datos.usePuppeteer } : {}),
        ...(datos.crawlSelector !== undefined ? { crawlSelector: datos.crawlSelector } : {}),
        ...(datos.articleSelector !== undefined ? { articleSelector: datos.articleSelector } : {}),
        ...(datos.titleSelector !== undefined ? { titleSelector: datos.titleSelector } : {}),
        ...(datos.imageSelector !== undefined ? { imageSelector: datos.imageSelector } : {}),
        ...(datos.scheduleCron !== undefined ? { scheduleCron: datos.scheduleCron } : {})
      }
    });

    return NextResponse.json({ ok: true, fuente });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: error.errors[0]?.message ?? 'Datos inválidos.' },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: false, error: 'No se pudo actualizar la fuente.' }, { status: 500 });
  }
}

/** DELETE: elimina una fuente (y en cascada sus mapeos y jobs). */
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    await requireApiSession();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
    }
    throw error;
  }

  try {
    await prisma.source.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'No se pudo eliminar la fuente.' }, { status: 500 });
  }
}
