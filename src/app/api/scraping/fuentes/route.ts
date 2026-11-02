import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireApiSession, UnauthorizedError } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** Esquema de validación para crear/editar una fuente de scraping. */
const sourceSchema = z.object({
  name: z.string().min(2, 'El nombre es obligatorio.').max(120),
  baseUrl: z.string().url('La URL base no es válida.'),
  isActive: z.boolean().optional(),
  rotateUserAgent: z.boolean().optional(),
  requestDelayMs: z.coerce.number().int().min(0).max(60_000).optional(),
  maxItemsPerRun: z.coerce.number().int().min(1).max(200).optional(),
  respectRobots: z.boolean().optional(),
  usePuppeteer: z.boolean().optional(),
  useAiExtraction: z.boolean().optional(),
  crawlSelector: z.string().max(300).nullish(),
  articleSelector: z.string().max(300).nullish(),
  titleSelector: z.string().max(300).nullish(),
  imageSelector: z.string().max(300).nullish(),
  scheduleCron: z.string().max(120).nullish()
});

/** GET: lista de fuentes con sus mapeos y contadores. */
export async function GET() {
  try {
    await requireApiSession();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
    }
    throw error;
  }

  const fuentes = await prisma.source.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      mappings: { include: { localCategory: true } },
      _count: { select: { items: true, jobs: true } }
    }
  });

  return NextResponse.json({ ok: true, fuentes });
}

/** POST: crea una fuente nueva. */
export async function POST(request: NextRequest) {
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
    const datos = sourceSchema.parse(body);

    const fuente = await prisma.source.create({
      data: {
        name: datos.name,
        baseUrl: datos.baseUrl,
        isActive: datos.isActive ?? true,
        rotateUserAgent: datos.rotateUserAgent ?? true,
        requestDelayMs: datos.requestDelayMs ?? 1500,
        maxItemsPerRun: datos.maxItemsPerRun ?? 20,
        respectRobots: datos.respectRobots ?? true,
        usePuppeteer: datos.usePuppeteer ?? false,
        useAiExtraction: datos.useAiExtraction ?? false,
        crawlSelector: datos.crawlSelector ?? null,
        articleSelector: datos.articleSelector ?? null,
        titleSelector: datos.titleSelector ?? null,
        imageSelector: datos.imageSelector ?? null,
        scheduleCron: datos.scheduleCron ?? null
      }
    });

    return NextResponse.json({ ok: true, fuente }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: error.errors[0]?.message ?? 'Datos inválidos.' },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: false, error: 'No se pudo crear la fuente.' }, { status: 500 });
  }
}
