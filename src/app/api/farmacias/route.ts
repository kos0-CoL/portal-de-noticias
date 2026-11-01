import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const revalidate = 900;

/** Medianoche UTC del dia en curso en Saladillo (coincide con los campos @db.Date). */
function hoyEnSaladillo(): Date {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
  const [y, m, d] = partes.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Acepta ?date=YYYY-MM-DD; si falta o es invalido, usa hoy. */
function parseFecha(input: string | null): Date {
  if (input && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, d] = input.split('-').map(Number);
    const fecha = new Date(Date.UTC(y, m - 1, d));
    if (!Number.isNaN(fecha.getTime())) return fecha;
  }
  return hoyEnSaladillo();
}

/** Turno del dia indicado (por defecto hoy) mas los proximos 14 dias. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fecha = parseFecha(searchParams.get('date'));

  const hasta = new Date(fecha);
  hasta.setUTCDate(fecha.getUTCDate() + 13);

  try {
    const [turno, proximos] = await Promise.all([
      prisma.pharmacyShift.findFirst({
        where: { date: fecha },
        include: { pharmacy: true }
      }),
      prisma.pharmacyShift.findMany({
        where: { date: { gte: fecha, lte: hasta } },
        include: { pharmacy: true },
        orderBy: { date: 'asc' }
      })
    ]);

    return NextResponse.json(
      { date: fecha.toISOString().slice(0, 10), turno, proximos },
      { headers: { 'Cache-Control': 'public, s-maxage=900' } }
    );
  } catch {
    return NextResponse.json({ ok: false, error: 'No se pudieron obtener las farmacias de turno.' }, { status: 500 });
  }
}
