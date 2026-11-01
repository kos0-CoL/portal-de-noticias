import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { UnauthorizedError, requireApiSession } from '@/lib/auth';
import { slugify } from '@/lib/utils';

/**
 * GET  /api/etiquetas — todas las etiquetas con su cantidad de notas.
 * POST /api/etiquetas — crea una etiqueta.
 * Requieren sesión.
 */

const createSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  slug: z.string().optional()
});

export async function GET() {
  try {
    await requireApiSession();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
    }
    throw error;
  }

  const tags = await prisma.tag.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { articles: true } } }
  });
  return NextResponse.json({ ok: true, tags });
}

export async function POST(request: Request) {
  try {
    await requireApiSession();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
    }
    throw error;
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
      { status: 400 }
    );
  }

  const name = parsed.data.name.trim();
  const existing = await prisma.tag.findUnique({ where: { name }, select: { id: true } });
  if (existing) {
    return NextResponse.json({ ok: false, error: 'Ya existe una etiqueta con ese nombre' }, { status: 409 });
  }

  const baseSlug = slugify(parsed.data.slug || name) || name.toLowerCase();
  let slug = baseSlug;
  let counter = 2;
  // Garantiza unicidad del slug sin sobrescribir etiquetas existentes.
  while (await prisma.tag.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${baseSlug}-${counter++}`;
  }

  const tag = await prisma.tag.create({ data: { name, slug } });
  return NextResponse.json({ ok: true, tag }, { status: 201 });
}
