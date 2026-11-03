import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hoyEnSaladillo, isoDeFecha, sumarDias } from '@/lib/pharmacy/schedule';

export const revalidate = 900;

const MS_POR_DIA = 86_400_000;
/** Tope del historial: un año. */
const MAX_DIAS = 366;

/** "YYYY-MM-DD" válido → medianoche UTC; si falta o no es válido, null. */
function parseFecha(input: string | null): Date | null {
  if (input && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, d] = input.split('-').map(Number);
    const fecha = new Date(Date.UTC(y, m - 1, d));
    if (!Number.isNaN(fecha.getTime())) return fecha;
  }
  return null;
}

/**
 * Turnos de farmacias.
 *
 * - `?desde=YYYY-MM-DD&hasta=YYYY-MM-DD`: historial o proyección, acotado a un año.
 *   Si falta uno de los dos extremos, se completa desde el otro (o desde hoy).
 * - `?date=YYYY-MM-DD`: turno de ese día más los 14 siguientes.
 * - Sin parámetros: hoy.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const desde = parseFecha(searchParams.get('desde'));
  const hasta = parseFecha(searchParams.get('hasta'));

  // Modo rango: alcanza con uno de los dos extremos.
  if (desde || hasta) {
    const inicio = desde ?? hoyEnSaladillo();
    const fin = hasta ?? sumarDias(inicio, 13);

    if (fin < inicio) {
      return NextResponse.json(
        { ok: false, error: 'La fecha de fin no puede ser anterior a la de inicio.' },
        { status: 400 }
      );
    }

    const dias = Math.round((fin.getTime() - inicio.getTime()) / MS_POR_DIA) + 1;
    if (dias > MAX_DIAS) {
      return NextResponse.json(
        { ok: false, error: `El rango no puede superar los ${MAX_DIAS} días.` },
        { status: 400 }
      );
    }

    try {
      const turnos = await prisma.pharmacyShift.findMany({
        where: { date: { gte: inicio, lte: fin } },
        include: { pharmacy: true },
        orderBy: { date: 'asc' }
      });

      return NextResponse.json(
        { desde: isoDeFecha(inicio), hasta: isoDeFecha(fin), turnos },
        { headers: { 'Cache-Control': 'public, s-maxage=900' } }
      );
    } catch {
      return NextResponse.json(
        { ok: false, error: 'No se pudieron obtener las farmacias de turno.' },
        { status: 500 }
      );
    }
  }

  const fecha = parseFecha(searchParams.get('date')) ?? hoyEnSaladillo();
  const fin = sumarDias(fecha, 13);

  try {
    const [turno, proximos] = await Promise.all([
      prisma.pharmacyShift.findFirst({
        where: { date: fecha },
        include: { pharmacy: true }
      }),
      prisma.pharmacyShift.findMany({
        where: { date: { gte: fecha, lte: fin } },
        include: { pharmacy: true },
        orderBy: { date: 'asc' }
      })
    ]);

    return NextResponse.json(
      { date: isoDeFecha(fecha), turno, proximos },
      { headers: { 'Cache-Control': 'public, s-maxage=900' } }
    );
  } catch {
    return NextResponse.json({ ok: false, error: 'No se pudieron obtener las farmacias de turno.' }, { status: 500 });
  }
}
