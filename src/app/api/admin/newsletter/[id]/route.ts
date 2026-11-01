import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApiSession } from '@/lib/auth';

/**
 * DELETE /api/admin/newsletter/[id]
 * Elimina un suscriptor del boletín (requiere sesión de admin).
 */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    await requireApiSession();

    const suscriptor = await prisma.newsletterSubscriber.findUnique({
      where: { id: params.id }
    });
    if (!suscriptor) {
      return NextResponse.json({ error: 'Suscriptor no encontrado' }, { status: 404 });
    }

    await prisma.newsletterSubscriber.delete({ where: { id: params.id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if ((error as { name?: string }).name === 'UnauthorizedError') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
