import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { CalendarDays, MapPin, MessageCircle, Phone, Search, User } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { DIAS_VIGENCIA_CLASIFICADO, MAX_FOTOS_CLASIFICADO, SECCIONES_CLASIFICADOS, SITE } from '@/lib/constants';
import { avisoVigenteWhere } from '@/lib/classifieds';
import { formatFechaCorta, formatPrecio } from '@/lib/utils';
import { SiteHeader } from '@/components/public/SiteHeader';
import { SiteFooter } from '@/components/public/SiteFooter';
import { SectionTitle } from '@/components/public/SectionTitle';
import { ClassifiedForm } from '@/components/public/ClassifiedForm';
import { Pagination } from '@/components/public/Pagination';
import { BannerZone } from '@/components/public/BannerZone';

export const revalidate = 60;

const POR_PAGINA = 12;

export const metadata: Metadata = {
  title: 'Clasificados',
  description: `Avisos de empleos, inmuebles, vehículos y servicios de la comunidad de ${SITE.city} y la zona.`,
  alternates: { canonical: '/clasificados' }
};

type SearchParams = { [key: string]: string | string[] | undefined };

interface Props {
  searchParams?: SearchParams;
}

function single(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value && value.length > 0 ? value : undefined;
}

/** Arma un numero de WhatsApp internacional a partir del telefono local. */
function numeroWhatsApp(telefono: string): string {
  const digitos = telefono.replace(/\D/g, '');
  return digitos.startsWith('54') ? digitos : `54${digitos}`;
}

export default async function ClasificadosPage({ searchParams }: Props) {
  const seccionParam = single(searchParams?.seccion);
  const seccionActiva = seccionParam && (SECCIONES_CLASIFICADOS as readonly string[]).includes(seccionParam) ? seccionParam : null;
  const busqueda = single(searchParams?.q)?.trim() || null;
  const page = Math.max(1, Number.parseInt(single(searchParams?.page) ?? '1', 10) || 1);

  const where: Prisma.ClassifiedWhereInput = {
    AND: [
      avisoVigenteWhere(),
      ...(seccionActiva ? [{ section: seccionActiva }] : []),
      ...(busqueda
        ? [
            {
              OR: [
                { title: { contains: busqueda, mode: 'insensitive' } },
                { description: { contains: busqueda, mode: 'insensitive' } },
                { locality: { contains: busqueda, mode: 'insensitive' } }
              ]
            }
          ]
        : [])
    ]
  };

  const [total, avisos] = await Promise.all([
    prisma.classified.count({ where }),
    prisma.classified.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * POR_PAGINA,
      take: POR_PAGINA,
      include: { images: { orderBy: { position: 'asc' }, take: 1 } }
    })
  ]);

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  // Link a "Todos" conservando la búsqueda activa.
  const hrefTodos = busqueda ? `/clasificados?q=${encodeURIComponent(busqueda)}` : '/clasificados';

  return (
    <>
      <SiteHeader />

      <main className="container-news py-6">
        <header className="border-b border-news-200 pb-4">
          <span className="kicker text-brand-600">Comunidad</span>
          <h1 className="headline-xl mt-1">Clasificados de Saladillo</h1>
          <p className="mt-2 max-w-3xl text-news-600">
            Avisos de la comunidad: empleos, inmuebles, vehículos y servicios. Publicá el tuyo gratis, con hasta{' '}
            {MAX_FOTOS_CLASIFICADO} fotos, y queda {DIAS_VIGENCIA_CLASIFICADO} días visible.
          </p>
        </header>

        <div className="mt-5">
          <BannerZone zone="HOME_TOP" />
        </div>

        {/* Buscador */}
        <form action="/clasificados" method="get" className="mt-6 flex flex-wrap gap-2" role="search">
          {seccionActiva ? <input type="hidden" name="seccion" value={seccionActiva} /> : null}
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-news-400" aria-hidden="true" />
            <input
              type="search"
              name="q"
              defaultValue={busqueda ?? ''}
              placeholder="Buscar en los clasificados: auto, casa, trabajo…"
              aria-label="Buscar en los clasificados"
              className="input pl-9"
            />
          </div>
          <button type="submit" className="btn-primary">
            Buscar
          </button>
          {busqueda ? (
            <Link href={seccionActiva ? `/clasificados?seccion=${encodeURIComponent(seccionActiva)}` : '/clasificados'} className="btn-ghost">
              Limpiar
            </Link>
          ) : null}
        </form>

        {/* Filtro por sección */}
        <nav aria-label="Filtrar por sección" className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
          <Link
            href={hrefTodos}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
              !seccionActiva
                ? 'border-brand-800 bg-brand-800 text-white'
                : 'border-news-300 bg-white text-brand-800 hover:border-brand-300 hover:bg-brand-50'
            }`}
          >
            Todos
          </Link>
          {SECCIONES_CLASIFICADOS.map((s) => (
            <Link
              key={s}
              href={`/clasificados?seccion=${encodeURIComponent(s)}${busqueda ? `&q=${encodeURIComponent(busqueda)}` : ''}`}
              className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
                seccionActiva === s
                  ? 'border-brand-800 bg-brand-800 text-white'
                  : 'border-news-300 bg-white text-brand-800 hover:border-brand-300 hover:bg-brand-50'
              }`}
            >
              {s}
            </Link>
          ))}
        </nav>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            <SectionTitle
              title={
                busqueda
                  ? `Avisos que coinciden con “${busqueda}”`
                  : seccionActiva
                    ? `Avisos de ${seccionActiva}`
                    : 'Últimos avisos'
              }
            />

            {avisos.length > 0 ? (
              <>
                <p className="mb-3 text-xs text-news-500">
                  {total} aviso(s) {busqueda ? 'encontrados' : 'publicados'}
                </p>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {avisos.map((aviso) => {
                    const portada = aviso.images[0]?.url ?? aviso.imageUrl;
                    return (
                      <article key={aviso.id} className="news-card">
                        <Link
                          href={`/clasificados/${aviso.id}`}
                          className="relative block aspect-[16/10] overflow-hidden bg-news-100"
                          aria-label={`Ver el aviso: ${aviso.title}`}
                        >
                          {portada ? (
                            <Image
                              src={portada}
                              alt={aviso.title}
                              fill
                              sizes="(max-width: 640px) 100vw, 340px"
                              className="object-cover transition duration-300 hover:scale-105"
                            />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-news-400">
                              <CalendarDays className="h-8 w-8" aria-hidden="true" />
                            </span>
                          )}
                        </Link>

                        <div className="news-card-body">
                          <span className="kicker text-brand-600">{aviso.section}</span>
                          <h2 className="headline-sm">
                            <Link href={`/clasificados/${aviso.id}`} className="transition hover:text-brand-600">
                              {aviso.title}
                            </Link>
                          </h2>
                          <p className="line-clamp-3-custom text-sm leading-relaxed text-news-600">{aviso.description}</p>

                          <p className="font-editorial text-lg font-bold text-brand-800">
                            {aviso.price ? formatPrecio(Number(aviso.price)) : 'A convenir'}
                          </p>

                          <ul className="space-y-1 text-xs text-news-500">
                            <li className="flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> {aviso.locality}
                            </li>
                            <li className="flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5" aria-hidden="true" /> {aviso.contactName}
                            </li>
                            <li className="flex items-center gap-1.5">
                              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> Publicado el {formatFechaCorta(aviso.createdAt)}
                            </li>
                          </ul>

                          <div className="mt-auto flex flex-wrap gap-2 pt-2">
                            <a
                              href={`https://wa.me/${numeroWhatsApp(aviso.contactPhone)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-secondary btn-sm"
                              aria-label={`Escribir por WhatsApp a ${aviso.contactName}`}
                            >
                              <MessageCircle className="h-4 w-4" aria-hidden="true" />
                              WhatsApp
                            </a>
                            <a
                              href={`tel:${aviso.contactPhone.replace(/[^\d+]/g, '')}`}
                              className="btn-ghost btn-sm"
                              aria-label={`Llamar a ${aviso.contactName}`}
                            >
                              <Phone className="h-4 w-4" aria-hidden="true" />
                              {aviso.contactPhone}
                            </a>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>

                <Pagination
                  currentPage={page}
                  totalPages={totalPaginas}
                  basePath="/clasificados"
                  params={{ seccion: seccionActiva ?? undefined, q: busqueda ?? undefined }}
                />
              </>
            ) : (
              <p className="rounded-lg border border-news-200 bg-white p-6 text-center text-news-500">
                {busqueda || seccionActiva
                  ? 'No encontramos avisos con esos criterios. Probá con otras palabras o mirá todas las secciones.'
                  : 'No hay avisos publicados por el momento. ¡Publicá el primero!'}
              </p>
            )}
          </div>

          <aside>
            <div className="rounded-lg border border-news-200 bg-white p-5 lg:sticky lg:top-40">
              <h2 className="font-editorial text-xl font-bold text-brand-900">Publicá tu aviso</h2>
              <p className="mb-4 mt-1 text-sm text-news-500">
                Completá el formulario y tu aviso quedará en revisión antes de publicarse.
              </p>
              <ClassifiedForm />
            </div>
          </aside>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
