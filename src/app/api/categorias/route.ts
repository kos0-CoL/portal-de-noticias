import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { UnauthorizedError, requireApiSession } from '@/lib/auth';
import { slugify } from '@/lib/utils';

/**
 * GET  /api/categorias — todas las categorías con su cantidad de notas.
 * POST /api/categorias — crea una categoría.
 * Requieren sesión.
 */

const createSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  slug: z.string().optional(),
  description: z.string().nullable().optional(),
  color: z.string().optional(),
  position: z.number().int().optional(),
  isMenu: z.boolean().optional(),
  isActive: z.boolean().optional()
});

async function uniqueCategorySlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base) || 'categoria';
  let candidate = root;
  let counter = 2;
  for (let i = 0; i < 50; i++) {
    const existing = await prisma.category.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!existing || existing.id === excludeId) return candidate;
    candidate = `${root}-${counter++}`;
  }
  return `${root}-${Date.now()}`;
}

export async function GET() {
  try {
    await requireApiSession();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
    }
    throw error;
  }

  const categories = await prisma.category.findMany({
    orderBy: [{ position: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { articles: true } } }
  });
  return NextResponse.json({ ok: true, categories });
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
  const data = parsed.data;

  const duplicate = await prisma.category.findUnique({ where: { name: data.name.trim() }, select: { id: true } });
  if (duplicate) {
    return NextResponse.json({ ok: false, error: 'Ya existe una categoría con ese nombre' }, { status: 409 });
  }

  const category = await prisma.category.create({
    data: {
      name: data.name.trim(),
      slug: await uniqueCategorySlug(data.slug || data.name),
      description: data.description ?? null,
      color: data.color ?? '#122A4D',
      position: data.position ?? 0,
      isMenu: data.isMenu ?? true,
      isActive: data.isActive ?? true
    }
  });

  return NextResponse.json({ ok: true, category }, { status: 201 });
}
