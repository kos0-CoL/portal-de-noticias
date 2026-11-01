import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { formatPrecio, tiempoRelativo } from '@/lib/utils';
import { categoryUrl, tagUrl } from '@/lib/seo';
import { SITE } from '@/lib/constants';
import { SiteHeader } from '@/components/public/SiteHeader';
import { SiteFooter } from '@/components/public/SiteFooter';
import { NewsTicker } from '@/components/public/NewsTicker';
import { ArticleCard } from '@/components/public/ArticleCard';
import { SectionTitle } from '@/components/public/SectionTitle';
import { Pagination } from '@/components/public/Pagination';
import { PharmacyWidget } from '@/components/public/PharmacyWidget';
import { BannerZone } from '@/components/public/BannerZone';

export const revalidate = 60;

const POR_PAGINA = 8;

const SECCIONES_HOME = [
  { title: 'Policiales', slug: 'policiales' },
  { title: 'Política', slug: 'politica' },
  { title: 'Deportes', slug: 'deportes' },
  { title: 'Interés General', slug: 'interes-general' }
];

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function HomePage({ searchParams }: { searchParams?: SearchParams }) {
  const pageRaw = searchParams?.page;
  const pageParam = Array.isArray(pageRaw) ? pageRaw[0] : pageRaw;
  const page = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1);
  const baseWhere = { status: 'PUBLISHED' as const, publishedAt: { lte: new Date() } };
  const conRelaciones = { category: true, tags: true } as const;

  const [
    breaking,
    featured,
    topNews,
    ultimas,
    totalPublicadas,
    masLeidas,
    etiquetas,
    seccion1,
    seccion2,
    seccion3,
    seccion4,
    clasificados
  ] = await Promise.all([
    prisma.article.findMany({
      where: { ...baseWhere, isBreaking: true },
      orderBy: { publishedAt: 'desc' },
      take: 6,
      select: { title: true, slug: true }
    }),
    prisma.article.findFirst({
      where: { ...baseWhere, isFeatured: true },
      orderBy: { publishedAt: 'desc' },
      include: conRelaciones
    }),
    prisma.article.findMany({
      where: baseWhere,
      orderBy: { publishedAt: 'desc' },
      take: 7,
      include: conRelaciones
    }),
    prisma.article.findMany({
      where: baseWhere,
      orderBy: { publishedAt: 'desc' },
      skip: (page - 1) * POR_PAGINA,
      take: POR_PAGINA,
      include: conRelaciones
    }),
    prisma.article.count({ where: baseWhere }),
    prisma.article.findMany({
      where: baseWhere,
      orderBy: { views: 'desc' },
      take: 5,
      include: conRelaciones
    }),
    prisma.tag.findMany({
      take: 24,
      orderBy: { name: 'asc' },
      include: { _count: { select: { articles: true } } }
    }),
    prisma.article.findMany({ where: { ...baseWhere, category: { slug: 'policiales' } }, orderBy: { publishedAt: 'desc' }, take: 4, include: conRelaciones }),
    prisma.article.findMany({ where: { ...baseWhere, category: { slug: 'politica' } }, orderBy: { publishedAt: 'desc' }, take: 4, include: conRelaciones }),
    prisma.article.findMany({ where: { ...baseWhere, category: { slug: 'deportes' } }, orderBy: { publishedAt: 'desc' }, take: 4, include: conRelaciones }),
    prisma.article.findMany({ where: { ...baseWhere, category: { slug: 'interes-general' } }, orderBy: { publishedAt: 'desc' }, take: 4, include: conRelaciones }),
    prisma.classified.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { createdAt: 'desc' },
      take: 4
    })
  ]);

  const secciones = [seccion1, seccion2, seccion3, seccion4];

  const principal = featured ?? topNews[0] ?? null;
  const restoTop = topNews.filter((a) => a.id !== principal?.id);
  const secundarias = restoTop.slice(0, 2);
  const titulosCortos = restoTop.slice(2, 7);
  const totalPaginas = Math.ceil(totalPublicadas / POR_PAGINA);

  return (
    <>
      <SiteHeader />

      <NewsTicker items={breaking} />

      <main className="container-news py-6">
        <BannerZone zone="HEADER" />

        {/* Bloque destacado */}
        <section aria-label="Noticia principal" className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {principal ? (
            <ArticleCard article={principal} variant="hero" className="md:col-span-2" />
          ) : (
            <p className="text-news-500 md:col-span-2">Todavía no hay notas publicadas.</p>
          )}

          <div className="flex flex-col gap-5">
            {secundarias.map((nota) => (
              <ArticleCard key={nota.id} article={nota} variant="compact" />
            ))}

            {titulosCortos.length > 0 ? (
              <div className="rounded-lg border border-news-200 bg-white p-4">
                <h2 className="kicker mb-3 text-brand-700">En breve</h2>
                <ul className="space-y-2.5 divide-y divide-news-100">
                  {titulosCortos.map((nota) => (
                    <li key={nota.id} className="pt-2.5 first:pt-0">
                      <Link href={`/nota/${nota.slug}`} className="headline-sm link-underline inline">
                        {nota.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>

        <div className="mt-8">
          <BannerZone zone="HOME_TOP" />
        </div>

        {/* Contenido principal + sidebar */}
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <SectionTitle title="Últimas noticias" />
            {ultimas.length > 0 ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {ultimas.map((nota) => (
                  <ArticleCard key={nota.id} article={nota} variant="standard" />
                ))}
              </div>
            ) : (
              <p className="text-news-500">Sin notas por ahora.</p>
            )}
            <Pagination currentPage={page} totalPages={totalPaginas} basePath="/" />

            {/* Franjas por categoría */}
            {SECCIONES_HOME.map((seccion, i) => (
              <section key={seccion.slug} className="mt-10">
                <SectionTitle title={seccion.title} href={categoryUrl(seccion.slug)} />
                {secciones[i].length > 0 ? (
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    {secciones[i].map((nota) => (
                      <ArticleCard key={nota.id} article={nota} variant="standard" />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-news-500">Todavía no hay notas en esta sección.</p>
                )}
              </section>
            ))}

            {/* Clasificados */}
            <section className="mt-10">
              <SectionTitle title="Clasificados de la comunidad" href="/clasificados" />
              {clasificados.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {clasificados.map((aviso) => (
                    <Link
                      key={aviso.id}
                      href="/clasificados"
                      className="news-card news-card-body"
                    >
                      <span className="kicker text-brand-600">{aviso.section}</span>
                      <h3 className="headline-sm">{aviso.title}</h3>
                      <p className="line-clamp-2-custom text-sm text-news-600">{aviso.description}</p>
                      <span className="mt-auto flex items-center justify-between pt-1 text-xs text-news-500">
                        <span>{aviso.locality}</span>
                        <span className="font-semibold text-brand-800">
                          {aviso.price ? formatPrecio(Number(aviso.price)) : 'A convenir'}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-news-500">No hay avisos publicados todavía.</p>
              )}
            </section>
          </div>

          {/* Barra lateral */}
          <aside className="space-y-6">
            <div className="rounded-lg border border-news-200 bg-white p-4">
              <h2 className="mb-3 flex items-center gap-2 font-editorial text-lg font-bold text-brand-900">
                <span className="inline-block h-5 w-1.5 rounded-full bg-brand-800" aria-hidden="true" />
                Lo más leído
              </h2>
              <ol className="space-y-3">
                {masLeidas.map((nota, i) => (
                  <li key={nota.id} className="flex gap-3">
                    <span className="font-editorial text-xl font-bold leading-none text-brand-300">{i + 1}</span>
                    <Link href={`/nota/${nota.slug}`} className="link-underline text-sm font-semibold leading-snug text-brand-900">
                      {nota.title}
                    </Link>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-lg border border-news-200 bg-white p-4">
              <h2 className="mb-3 font-editorial text-lg font-bold text-brand-900">Farmacias de turno</h2>
              <PharmacyWidget />
            </div>

            <BannerZone zone="SIDEBAR" />

            <div className="rounded-lg border border-news-200 bg-white p-4">
              <h2 className="mb-3 font-editorial text-lg font-bold text-brand-900">Temas</h2>
              <ul className="flex flex-wrap gap-2">
                {etiquetas.map((tag) => (
                  <li key={tag.id}>
                    <Link
                      href={tagUrl(tag.name)}
                      className="inline-flex items-center gap-1 rounded-full border border-news-200 bg-news-50 px-3 py-1 text-xs font-medium text-news-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
                    >
                      {tag.name}
                      <span className="text-[10px] text-news-400">{tag._count.articles}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>

        <div className="mt-10">
          <BannerZone zone="FOOTER" />
        </div>

        <p className="mt-6 text-center text-xs text-news-500">
          {SITE.name} — {SITE.tagline}. Última actualización: {tiempoRelativo(new Date())}.
        </p>
      </main>

      <SiteFooter />
      <BannerZone zone="MOBILE_STICKY" />
    </>
  );
}
