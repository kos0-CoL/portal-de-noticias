import type { Metadata } from 'next';
import { Badge, MapPin, Phone, MessageCircle } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { SITE } from '@/lib/constants';
import { formatFecha } from '@/lib/utils';
import { SiteHeader } from '@/components/public/SiteHeader';
import { SiteFooter } from '@/components/public/SiteFooter';
import { SectionTitle } from '@/components/public/SectionTitle';
import { BannerZone } from '@/components/public/BannerZone';
import { hoyEnSaladillo, turnoVigente } from '@/lib/pharmacy/schedule';
import PharmacyMap from '@/components/public/PharmacyMap';
import PharmacyDirections from '@/components/public/PharmacyDirections';

export const revalidate = 900;

export const metadata: Metadata = {
  title: 'Farmacias de turno',
  description: `Farmacias de turno y listado completo de farmacias en ${SITE.city}, ${SITE.province}.`,
  alternates: { canonical: '/farmacias' }
};

export default async function FarmaciasPage() {
  const ahora = new Date();
  const hoy = hoyEnSaladillo(ahora);
  const vigente = turnoVigente(ahora);
  const hasta = new Date(hoy);
  hasta.setUTCDate(hoy.getUTCDate() + 13);

  const [farmacias, turnos, turnoVigenteHoy] = await Promise.all([
    prisma.pharmacy.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.pharmacyShift.findMany({
      where: { date: { gte: hoy, lte: hasta } },
      include: { pharmacy: true },
      orderBy: { date: 'asc' }
    }),
    prisma.pharmacyShift.findFirst({
      where: { date: vigente.fecha },
      include: { pharmacy: true }
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

        {/* Turno vigente ahora */}
        <section className="mt-8 rounded-lg border border-brand-200 bg-brand-50 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-brand-600 bg-brand-600 text-[10px] font-bold uppercase tracking-wider text-white">
                <Badge size="small" className="bg-brand-400 text-brand-900">De turno ahora</Badge>
                {vigente.inicio} hs
              </span>
              <h2 className="headline-md mt-2 text-brand-900">
                {turnoVigenteHoy?.pharmacy.name ?? 'Sin turno asignado'}
              </h2>
              <p className="mt-1 text-news-600">
                {turnoVigenteHoy ? turnoVigenteHoy.pharmacy.address : 'No hay farmacia de turno asignada para hoy.'}
              </p>
            </div>
            <div className="flex items-center gap-3 text-sm text-news-500">
              <span>Hasta {vigente.fin} hs del {formatFecha(vigente.cambiaEl, false)}</span>
              {turnoVigenteHoy && (
                <PharmacyDirections
                  direccion={turnoVigenteHoy.pharmacy.address}
                  lat={turnoVigenteHoy.pharmacy.latitude ?? null}
                  lng={turnoVigenteHoy.pharmacy.longitude ?? null}
                  telefono={turnoVigenteHoy.pharmacy.phone ?? undefined}
                  whatsapp={turnoVigenteHoy.pharmacy.whatsapp ?? undefined}
                />
              )}
            </div>
          </div>
        </section>

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
                      <th scope="col" className="text-right">Cómo llegar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {turnos.map((turno) => {
                      const esVigente = turnoVigenteHoy && turno.id === turnoVigenteHoy.id;
                      return (
                        <tr key={turno.id} className={esVigente ? 'bg-brand-50' : ''}>
                          <td className="whitespace-nowrap font-medium text-news-800">
                            {formatFecha(turno.date, false)}{esVigente ? ' (hoy)' : ''}
                          </td>
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
                          <td className="text-right">
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                                turno.pharmacy.latitude != null && turno.pharmacy.longitude != null
                                  ? `${turno.pharmacy.latitude},${turno.pharmacy.longitude}`
                                  : turno.pharmacy.address
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border border-news-200 bg-white px-2.5 py-1 text-[11px] font-medium text-news-700 hover:bg-news-50 transition"
                            >
                              <MapPin className="h-3 w-3 shrink-0 text-brand-600" aria-hidden="true" />
                              Cómo llegar
                            </a>
                          </td>
                        </tr>
                      );
                    })}
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
                    <div className="mt-3">
                      <PharmacyMap
                        direccion={farmacia.address}
                        lat={farmacia.latitude ?? null}
                        lng={farmacia.longitude ?? null}
                        titulo={`Mapa de ${farmacia.name}`}
                      />
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {farmacia.phone ? (
                        <a
                          href={`tel:${farmacia.phone.replace(/[^\d+]/g, '')}`}
                          className="flex items-center gap-1.5 rounded-lg border border-news-200 bg-white px-2.5 py-1.5 text-left text-sm font-medium text-brand-600 hover:bg-news-50 transition"
                        >
                          <Phone className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                          Llamar
                        </a>
                      ) : null}
                      {farmacia.whatsapp ? (
                        <a
                          href={`https://wa.me/${farmacia.whatsapp.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 rounded-lg border border-news-200 bg-white px-2.5 py-1.5 text-left text-sm font-medium text-brand-600 hover:bg-news-50 transition"
                        >
                          <MessageCircle className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                          WhatsApp
                        </a>
                      ) : null}
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                          farmacia.latitude != null && farmacia.longitude != null
                            ? `${farmacia.latitude},${farmacia.longitude}`
                            : farmacia.address
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-lg border border-news-200 bg-white px-2.5 py-1.5 text-left text-sm font-medium text-brand-600 hover:bg-news-50 transition"
                      >
                        <MapPin className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                        Cómo llegar
                      </a>
                    </div>
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
