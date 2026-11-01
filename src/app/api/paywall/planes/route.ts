import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth';
import { getActivePlans } from '@/lib/paywall/access';

/**
 * GET /api/paywall/planes
 * Lista los planes de suscripción activos (requiere autenticación).
 */
export async function GET() {
  try {
    await requireApiSession();

    const planes = await getActivePlans();

    return NextResponse.json({
      planes: planes.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        descripcion: p.descripcion,
        precio: Number(p.precio),
        moneda: 'ARS',
        intervalo: p.intervalo,
        diasDuracion: p.diasDuracion,
        caracteristicas: p.caracteristicas as string[],
        esPopular: p.esPopular,
      })),
    });
  } catch (error) {
    if ((error as { name?: string }).name === 'UnauthorizedError') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
