import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarDays, ChevronRight, Mail, MapPin, MessageCircle, Phone, User } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { DIAS_VIGENCIA_CLASIFICADO, SITE } from '@/lib/constants';
import { avisoVigenteWhere, fotosDelAviso } from '@/lib/classifieds';
import { absoluteUrl } from '@/lib/seo';
import { formatFecha, formatFechaCorta, formatPrecio, stripHtml, truncate } from '@/lib/utils';
import { SiteHeader } from '@/components/public/SiteHeader';
import { SiteFooter } from '@/components/public/SiteFooter';
import { SectionTitle } from '@/components/public/SectionTitle';
import { ClassifiedGallery } from '@/components/public/ClassifiedGallery';
import { ShareButtons } from '@/components/public/ShareButtons';
import { BannerZone } from '@/components/public/BannerZone';

export const revalidate = 60;

interface Props {
  params: { id: string };
}

/** Arma un numero de WhatsApp internacional a partir del telefono local. */
function numeroWhatsApp(telefono: string): string {
  const digitos = telefono.replace(/\D/g, '');
  return digitos.startsWith('54') ? digitos : `54${digitos}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const aviso = await prisma.classified.findFirst({
    where: { id: params.id, ...avisoVigenteWhere() },
    include: { images: { orderBy: { position: 'asc' }, take: 1 } }
  });

  if (!aviso) {
    return { title: { absolute: `Aviso no encontrado — ${SITE.name}` } };
  }

  const descripcion = truncate(stripHtml(aviso.description), 158);
  const portada = fotosDelAviso({ images: aviso.images, imageUrl: aviso.imageUrl })[0];

  return {
    title: aviso.title,
    description: descripcion,
    keywords: [`clasificados ${SITE.city}`, aviso.section, aviso.locality, 'avisos'],
    alternates: { canonical: `/clasificados/${aviso.id}` },
    openGraph: {
      type: 'website',
      title: aviso.title,
      description: descripcion,
      url: absoluteUrl(`/clasificados/${aviso.id}`),
      siteName: SITE.name,
      locale: 'es_AR',
      images: portada ? [{ url: absoluteUrl(portada), alt: aviso.title }] : undefined
    },
    twitter: {
      card: portada ? 'summary_large_image' : 'summary',
      title: aviso.title,
      description: descripcion,
      images: portada ? [absoluteUrl(portada)] : undefined
    }
  };
}

export default async function AvisoClasificadoPage({ params }: Props) {
  const aviso = await prisma.classified.findFirst({
    where: { id: params.id, ...avisoVigenteWhere() },
    include: { images: { orderBy: { position: 'asc' } } }
  });

  if (!aviso) notFound();

  const fotos = fotosDelAviso(aviso);
  const url = absoluteUrl(`/clasificados/${aviso.id}`);

  const similares = await prisma.classified.findMany({
    where: { AND: [avisoVigenteWhere(), { section: aviso.section }, { id: { not: aviso.id } }] },
    orderBy: { createdAt: 'desc' },
    take: 4,
    include: { images: { orderBy: { position: 'asc' }, take: 1 } }
  });

  // Clasificado como Product para que Google pueda leer título, precio y zona.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: aviso.title,
    description: truncate(stripHtml(aviso.description), 500),
    image: fotos.map((foto) => absoluteUrl(foto)),
    category: aviso.section,
    url,
    offers: aviso.price
      ? {
          '@type': 'Offer',
          price: Number(aviso.price),
          priceCurrency: aviso.currency,
          availability: 'https://schema.org/InStock',
          areaServed: aviso.locality
        }
      : undefined
  };

  return (
    <>
      <SiteHeader />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <main className="container-news py-6">
        <nav aria-label="Miga de pan" className="mb-4 flex flex-wrap items-center gap-1 text-xs text-news-500">
          <Link href="/" className="transition hover:text-brand-700">
            Inicio
          </Link>
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
          <Link href="/clasificados" className="transition hover:text-brand-700">
            Clasificados
          </Link>
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
          <span className="truncate text-news-600">{aviso.title}</span>
        </nav>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <article className="min-w-0">
            <ClassifiedGallery images={fotos} alt={aviso.title} />

            <div className="mt-5">
              <Link
                href={`/clasificados?seccion=${encodeURIComponent(aviso.section)}`}
                className="kicker text-brand-600 transition hover:text-brand-800"
              >
                {aviso.section}
              </Link>

              <h1 className="headline-lg mt-1">{aviso.title}</h1>

              <p className="mt-3 font-editorial text-2xl font-bold text-brand-800">
                {aviso.price ? formatPrecio(Number(aviso.price)) : 'A convenir'}
              </p>

              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-news-500">
                <li className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> {aviso.locality}
                </li>
                <li className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> Publicado el {formatFecha(aviso.createdAt, false)}
                </li>
                {aviso.expiresAt ? (
                  <li className="flex items-center gap-1.5">
                    Vence el {formatFechaCorta(aviso.expiresAt)} ({DIAS_VIGENCIA_CLASIFICADO} días de vigencia)
                  </li>
                ) : null}
              </ul>

              <div className="mt-6 whitespace-pre-line text-[15px] leading-relaxed text-news-700">{aviso.description}</div>

              <div className="mt-6 border-t border-news-200 pt-4">
                <ShareButtons url={url} title={aviso.title} />
              </div>

              <div className="mt-6">
                <BannerZone zone="INLINE_ARTICLE" />
              </div>
            </div>

            {similares.length > 0 ? (
              <section className="mt-10">
                <SectionTitle title={`Más avisos de ${aviso.section}`} href={`/clasificados?seccion=${encodeURIComponent(aviso.section)}`} />
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {similares.map((similar) => {
                    const portada = similar.images[0]?.url ?? similar.imageUrl;
                    return (
                      <li key={similar.id}>
                        <Link
                          href={`/clasificados/${similar.id}`}
                          className="news-card flex-row items-center gap-3 p-3 transition hover:border-brand-200"
                        >
                          <span className="relative h-16 w-20 shrink-0 overflow-hidden rounded-md bg-news-100">
                            {portada ? (
                              <Image src={portada} alt={similar.title} fill sizes="80px" className="object-cover" />
                            ) : null}
                          </span>
                          <span className="min-w-0">
                            <span className="line-clamp-2-custom block text-sm font-semibold text-brand-900">{similar.title}</span>
                            <span className="mt-0.5 block text-xs font-bold text-brand-700">
                              {similar.price ? formatPrecio(Number(similar.price)) : 'A convenir'}
                            </span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}
          </article>

          <aside className="space-y-6">
            <div className="rounded-lg border border-news-200 bg-white p-5 lg:sticky lg:top-40">
              <h2 className="font-editorial text-xl font-bold text-brand-900">Contactar al avisante</h2>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-news-600">
                <User className="h-4 w-4" aria-hidden="true" /> {aviso.contactName}
              </p>

              <div className="mt-4 space-y-2">
                <a
                  href={`https://wa.me/${numeroWhatsApp(aviso.contactPhone)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary w-full"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  Escribir por WhatsApp
                </a>
                <a href={`tel:${aviso.contactPhone.replace(/[^\d+]/g, '')}`} className="btn-secondary w-full">
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  {aviso.contactPhone}
                </a>
                {aviso.contactEmail ? (
                  <a href={`mailto:${aviso.contactEmail}?subject=${encodeURIComponent(aviso.title)}`} className="btn-ghost w-full">
                    <Mail className="h-4 w-4" aria-hidden="true" />
                    Enviar un correo
                  </a>
                ) : null}
              </div>

              <p className="mt-4 border-t border-news-200 pt-3 text-xs text-news-500">
                Saladillo Noticias no interviene en la operación. Tomá las precauciones habituales antes de transferir dinero
                o entregar datos personales.
              </p>
            </div>

            <BannerZone zone="SIDEBAR" />

            <div className="rounded-lg border border-news-200 bg-news-50 p-5">
              <h2 className="font-editorial text-lg font-bold text-brand-900">¿Tenés algo para vender?</h2>
              <p className="mt-1 text-sm text-news-600">Publicá tu aviso gratis y queda visible {DIAS_VIGENCIA_CLASIFICADO} días.</p>
              <Link href="/clasificados" className="btn-primary btn-sm mt-3">
                Publicar un aviso
              </Link>
            </div>
          </aside>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
