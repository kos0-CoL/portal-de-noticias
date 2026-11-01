import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { UnauthorizedError, requireApiSession } from '@/lib/auth';
import { slugify } from '@/lib/utils';

/**
 * PATCH  /api/categorias/[id] — actualiza una categoría.
 * DELETE /api/categorias/[id] — elimina solo si no tiene notas asociadas (si no, 409).
 */

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().optional(),
  description: z.string().nullable().optional(),
  color: z.string().optional(),
  position: z.number().int().optional(),
  isMenu: z.boolean().optional(),
  isActive: z.boolean().optional()
});

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
}

async function uniqueCategorySlug(base: string, excludeId: string): Promise<string> {
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

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireApiSession();
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const existing = await prisma.category.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ ok: false, error: 'Categoría no encontrada' }, { status: 404 });
  }

  const category = await prisma.category.update({
    where: { id: params.id },
    data: {
      name: data.name?.trim(),
      slug: data.slug ? await uniqueCategorySlug(data.slug, params.id) : undefined,
      description: data.description,
      color: data.color,
      position: data.position,
      isMenu: data.isMenu,
      isActive: data.isActive
    }
  });

  return NextResponse.json({ ok: true, category });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    await requireApiSession();
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }

  const category = await prisma.category.findUnique({
    where: { id: params.id },
    include: { _count: { select: { articles: true } } }
  });
  if (!category) {
    return NextResponse.json({ ok: false, error: 'Categoría no encontrada' }, { status: 404 });
  }
  if (category._count.articles > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: `No se puede eliminar: la categoría tiene ${category._count.articles} nota(s) asociada(s).`
      },
      { status: 409 }
    );
  }

  await prisma.category.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
