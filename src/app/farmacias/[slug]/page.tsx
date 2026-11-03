import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MapPin, Phone, MessageCircle } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { SITE } from '@/lib/constants';
import { formatFecha } from '@/lib/utils';
import { SiteHeader } from '@/components/public/SiteHeader';
import { SiteFooter } from '@/components/public/SiteFooter';
import { SectionTitle } from '@/components/public/SectionTitle';
import { BannerZone } from '@/components/public/BannerZone';
import { hoyEnSaladillo } from '@/lib/pharmacy/schedule';
import PharmacyMap from '@/components/public/PharmacyMap';
import PharmacyDirections from '@/components/public/PharmacyDirections';

export const revalidate = 900;

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const farmacia = await prisma.pharmacy.findUnique({ where: { slug: params.slug } });

  if (!farmacia) return { title: 'Farmacia no encontrada' };

  return {
    title: `${farmacia.name} - Farmacia de turno`,
    description: `${farmacia.name} en ${farmacia.address}, ${SITE.city}.`,
    alternates: { canonical: `/farmacias/${farmacia.slug}` }
  };
}

export default async function FarmaciaPage({ params }: { params: { slug: string } }) {
  const farmacia = await prisma.pharmacy.findUnique({
    where: { slug: params.slug },
    include: {
      shifts: {
        where: { date: { gte: hoyEnSaladillo() } },
        orderBy: { date: 'asc' },
        take: 5
      }
    }
  });

  if (!farmacia) notFound();

  const proximosTurnos = farmacia.shifts;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Pharmacy',
    name: farmacia.name,
    image: null,
    address: {
      '@type': 'PostalAddress',
      streetAddress: farmacia.address,
      addressLocality: SITE.city,
      addressRegion: SITE.province,
      addressCountry: 'AR'
    },
    telephone: farmacia.phone ?? null,
    ...(farmacia.latitude != null && farmacia.longitude != null
      ? {
          geo: {
            '@type': 'GeoCoordinates',
            latitude: farmacia.latitude,
            longitude: farmacia.longitude
          }
        }
      : {})
  };

  return (
    <>
      <SiteHeader />

      <main className="container-news py-6">
        <header className="border-b border-news-200 pb-4">
          <span className="kicker text-brand-600">Servicios</span>
          <h1 className="headline-xl mt-1">{farmacia.name}</h1>
          <p className="mt-2 text-news-600">
            {farmacia.address}{farmacia.zone ? `, ${farmacia.zone}` : ''} · {SITE.city}
          </p>
        </header>

        <div className="mt-5">
          <BannerZone zone="HOME_TOP" />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            <section className="rounded-lg border border-news-200 bg-white p-6">
              <h2 className="mb-3 font-editorial text-lg font-bold text-brand-900">Dirección y contacto</h2>

              <p className="flex items-center gap-2 text-sm text-news-600 mb-3">
                <MapPin className="h-4 w-4 shrink-0 text-news-400" aria-hidden="true" />
                {farmacia.address}
              </p>

              {farmacia.phone ? (
                <p className="flex items-center gap-2 text-sm text-news-600 mb-3">
                  <Phone className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                  <a href={`tel:${farmacia.phone.replace(/[^\d+]/g, '')}`} className="text-brand-600 hover:text-brand-800">
                    {farmacia.phone}
                  </a>
                </p>
              ) : null}

              {farmacia.whatsapp ? (
                <p className="flex items-center gap-2 text-sm text-news-600 mb-4">
                  <MessageCircle className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                  <a
                    href={`https://wa.me/${farmacia.whatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-600 hover:text-brand-800"
                  >
                    WhatsApp
                  </a>
                </p>
              ) : null}

              <div className="rounded-lg border border-news-200 overflow-hidden">
                <PharmacyMap
                  direccion={farmacia.address}
                  lat={farmacia.latitude ?? null}
                  lng={farmacia.longitude ?? null}
                  titulo={`Mapa de ${farmacia.name}`}
                />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
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
            </section>

            {farmacia.notes && (
              <section className="mt-6 rounded-lg border border-news-200 bg-white p-6">
                <h2 className="mb-3 font-editorial text-lg font-bold text-brand-900">Notas</h2>
                <p className="text-news-700">{farmacia.notes}</p>
              </section>
            )}

            {proximosTurnos.length > 0 && (
              <section className="mt-6 rounded-lg border border-news-200 bg-white p-6">
                <SectionTitle title="Próximos turnos" />
                <table className="table-admin w-full">
                  <thead>
                    <tr>
                      <th scope="col">Fecha</th>
                      <th scope="col">Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proximosTurnos.map((turno) => (
                      <tr key={turno.id}>
                        <td className="whitespace-nowrap font-medium text-news-800">
                          {formatFecha(turno.date, false)}
                        </td>
                        <td className="text-news-600">{turno.note ?? '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
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

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <SiteFooter />
    </>
  );
}
