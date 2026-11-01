import type { Metadata } from 'next';
import { Phone, MapPin } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { SITE } from '@/lib/constants';
import { formatFecha } from '@/lib/utils';
import { SiteHeader } from '@/components/public/SiteHeader';
import { SiteFooter } from '@/components/public/SiteFooter';
import { SectionTitle } from '@/components/public/SectionTitle';
import { BannerZone } from '@/components/public/BannerZone';

export const revalidate = 900;

export const metadata: Metadata = {
  title: 'Farmacias de turno',
  description: `Farmacias de turno y listado completo de farmacias en ${SITE.city}, ${SITE.province}.`,
  alternates: { canonical: '/farmacias' }
};

/** Medianoche UTC del dia en curso en Saladillo. */
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

export default async function FarmaciasPage() {
  const hoy = hoyEnSaladillo();
  const hasta = new Date(hoy);
  hasta.setUTCDate(hoy.getUTCDate() + 13);

  const [farmacias, turnos] = await Promise.all([
    prisma.pharmacy.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.pharmacyShift.findMany({
      where: { date: { gte: hoy, lte: hasta } },
      include: { pharmacy: true },
      orderBy: { date: 'asc' }
    })
  ]);

  return (
    <>
      <SiteHeader />

      <main className="container-news py-6">
        <header className="border-b border-news-200 pb-4">
          <span className="kicker text-brand-600">Servicios</span>
          <h1 className="headline-xl mt-1">Farmacias de turno</h1>
          <p className="mt-2 max-w-3xl text-news-600">
            Turnos de guardia de las próximas dos semanas y listado de farmacias de {SITE.city} y la zona.
          </p>
        </header>

        <div className="mt-5">
          <BannerZone zone="HOME_TOP" />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <SectionTitle title="Próximos 14 días" />
            {turnos.length > 0 ? (
              <div className="overflow-hidden rounded-lg border border-news-200 bg-white">
                <table className="table-admin">
                  <thead>
                    <tr>
                      <th scope="col">Fecha</th>
                      <th scope="col">Farmacia</th>
                      <th scope="col">Dirección</th>
                      <th scope="col">Teléfono</th>
                    </tr>
                  </thead>
                  <tbody>
                    {turnos.map((turno) => (
                      <tr key={turno.id}>
                        <td className="whitespace-nowrap font-medium text-news-800">{formatFecha(turno.date, false)}</td>
                        <td className="font-semibold text-brand-900">
                          {turno.pharmacy.name}
                          {turno.note ? <span className="ml-2 text-xs font-normal text-news-500">({turno.note})</span> : null}
                        </td>
                        <td>{turno.pharmacy.address}</td>
                        <td>
                          {turno.pharmacy.phone ? (
                            <a
                              href={`tel:${turno.pharmacy.phone.replace(/[^\d+]/g, '')}`}
                              className="font-medium text-brand-600 hover:text-brand-800"
                            >
                              {turno.pharmacy.phone}
                            </a>
                          ) : (
                            <span className="text-news-400">–</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rounded-lg border border-news-200 bg-white p-6 text-center text-news-500">
                Sin datos de turno cargados.
              </p>
            )}

            <section className="mt-10">
              <SectionTitle title="Todas las farmacias" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {farmacias.map((farmacia) => (
                  <article key={farmacia.id} className="news-card news-card-body">
                    <h3 className="headline-sm">{farmacia.name}</h3>
                    <p className="flex items-center gap-1.5 text-sm text-news-600">
                      <MapPin className="h-4 w-4 shrink-0 text-news-400" aria-hidden="true" /> {farmacia.address}
                    </p>
                    {farmacia.phone ? (
                      <a
                        href={`tel:${farmacia.phone.replace(/[^\d+]/g, '')}`}
                        className="mt-auto flex items-center gap-1.5 pt-1 text-sm font-medium text-brand-600 hover:text-brand-800"
                      >
                        <Phone className="h-4 w-4" aria-hidden="true" /> {farmacia.phone}
                      </a>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <div className="rounded-lg border border-news-200 bg-white p-4 text-sm text-news-600">
              <h2 className="mb-2 font-editorial text-lg font-bold text-brand-900">A tener en cuenta</h2>
              <p>
                Los turnos pueden sufrir cambios de último momento. Ante una urgencia, comunicate directamente con la
                farmacia o llamá al servicio de emergencias.
              </p>
            </div>
            <BannerZone zone="SIDEBAR" />
          </aside>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
