import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Registro de impresiones y clics de un banner (endpoint publico).
 * Se usa para calcular el CTR en el reporte del panel.
 */

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = (await request.json().catch(() => null)) as { type?: string } | null;
    const tipo = body?.type;

    if (tipo !== 'impression' && tipo !== 'click') {
      return NextResponse.json({ ok: false, error: 'Tipo de evento inválido.' }, { status: 400 });
    }

    await prisma.banner.update({
      where: { id: params.id },
      data: tipo === 'impression' ? { impressions: { increment: 1 } } : { clicks: { increment: 1 } }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[api/banners/:id/track] Error al registrar la métrica.', error);
    return NextResponse.json({ ok: false, error: 'No se pudo registrar la métrica.' }, { status: 500 });
  }
}
