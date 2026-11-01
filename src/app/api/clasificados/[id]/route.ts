import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { vencimientoAviso } from '@/lib/classifieds';
import { UnauthorizedError, requireApiSession } from '@/lib/auth';

/**
 * PATCH  /api/clasificados/[id] — cambia el estado del aviso (moderación).
 * DELETE /api/clasificados/[id] — elimina el aviso (y su galería, por cascada).
 * Requieren sesión (el alta pública vive en POST /api/clasificados).
 *
 * Al aprobar (PUBLISHED) se fija la vigencia estándar del módulo.
 */

const updateSchema = z.object({
  status: z.enum(['PENDING', 'PUBLISHED', 'REJECTED', 'EXPIRED']).optional(),
  expiresAt: z.string().nullable().optional()
});

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
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

  const existing = await prisma.classified.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ ok: false, error: 'Clasificado no encontrado' }, { status: 404 });
  }

  const data = parsed.data;
  const expiresAt =
    data.status === 'PUBLISHED'
      ? vencimientoAviso()
      : data.expiresAt
        ? new Date(data.expiresAt)
        : undefined;

  const classified = await prisma.classified.update({
    where: { id: params.id },
    data: {
      status: data.status,
      expiresAt
    }
  });

  return NextResponse.json({ ok: true, classified });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    await requireApiSession();
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }

  const existing = await prisma.classified.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ ok: false, error: 'Clasificado no encontrado' }, { status: 404 });
  }

  await prisma.classified.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
