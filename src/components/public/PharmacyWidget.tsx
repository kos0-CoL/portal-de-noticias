import Link from 'next/link';
import { MapPin, Phone, Cross } from 'lucide-react';
import { prisma } from '@/lib/prisma';

/** Devuelve la medianoche UTC del dia en curso en Saladillo (para @db.Date). */
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

/** Farmacia de turno del dia. Tarjeta destacada para la home y la cabecera. */
export async function PharmacyWidget({ compacto = false }: { compacto?: boolean }) {
  const turno = await prisma.pharmacyShift
    .findFirst({
      where: { date: hoyEnSaladillo() },
      include: { pharmacy: true },
      orderBy: { date: 'asc' }
    })
    .catch(() => null);

  if (!turno) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-brand-100">
        <Cross className="h-5 w-5 shrink-0 text-brand-200" aria-hidden="true" />
        <p className="text-xs">
          <span className="block text-[10px] font-bold uppercase tracking-widest text-brand-200">
            Farmacias de turno
          </span>
          Sin datos de turno para hoy
        </p>
      </div>
    );
  }

  const { pharmacy, note } = turno;

  return (
    <div
      className="flex items-center gap-3 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-brand-50"
      aria-label={`Farmacia de turno hoy: ${pharmacy.name}`}
    >
      <Cross className="h-5 w-5 shrink-0 text-emerald-300" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <span className="block text-[10px] font-bold uppercase tracking-widest text-brand-200">
          Farmacia de turno
        </span>
        <p className="truncate text-sm font-bold text-white">{pharmacy.name}</p>
        {!compacto ? (
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-brand-200">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" aria-hidden="true" /> {pharmacy.address}
            </span>
            {pharmacy.phone ? (
              <a href={`tel:${pharmacy.phone.replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-1 hover:text-white">
                <Phone className="h-3 w-3" aria-hidden="true" /> {pharmacy.phone}
              </a>
            ) : null}
          </p>
        ) : null}
        {note ? <p className="mt-0.5 text-[11px] italic text-brand-200">{note}</p> : null}
      </div>
      <Link
        href="/farmacias"
        className="hidden shrink-0 text-[11px] font-semibold uppercase tracking-wide text-brand-100 hover:text-white sm:block"
      >
        Ver más
      </Link>
    </div>
  );
}
