import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { SITE } from '@/lib/constants';
import { categoryUrl } from '@/lib/seo';
import { SiteHeader } from '@/components/public/SiteHeader';
import { SiteFooter } from '@/components/public/SiteFooter';
import { ArticleCard } from '@/components/public/ArticleCard';
import { Pagination } from '@/components/public/Pagination';
import { CategoryBadge } from '@/components/public/CategoryBadge';
import { BannerZone } from '@/components/public/BannerZone';

export const revalidate = 60;

const POR_PAGINA = 12;

type SearchParams = { [key: string]: string | string[] | undefined };

interface Props {
  params: { slug: string };
  searchParams?: SearchParams;
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const categoria = await prisma.category.findUnique({ where: { slug: params.slug } });
  if (!categoria) {
    return { title: { absolute: `Categoría no encontrada — ${SITE.name}` } };
  }
  const descripcion = categoria.description ?? `Últimas noticias de ${categoria.name} en ${SITE.city}, ${SITE.province}.`;
  return {
    title: { absolute: `${categoria.name} — ${SITE.name}` },
    description: descripcion,
    alternates: { canonical: categoryUrl(categoria.slug) },
    openGraph: {
      title: `${categoria.name} — ${SITE.name}`,
      description: descripcion,
      type: 'website'
    }
  };
}

export default async function CategoriaPage({ params, searchParams }: Props) {
  const pageRaw = searchParams?.page;
  const pageParam = Array.isArray(pageRaw) ? pageRaw[0] : pageRaw;
  const page = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1);

  const categoria = await prisma.category.findUnique({ where: { slug: params.slug } });
  if (!categoria) notFound();

  const baseWhere = {
    status: 'PUBLISHED' as const,
    publishedAt: { lte: new Date() },
    categoryId: categoria.id
  };

  const [notas, total, masLeidas, etiquetas] = await Promise.all([
    prisma.article.findMany({
      where: baseWhere,
      orderBy: { publishedAt: 'desc' },
      skip: (page - 1) * POR_PAGINA,
      take: POR_PAGINA,
      include: { category: true, tags: true }
    }),
    prisma.article.count({ where: baseWhere }),
    prisma.article.findMany({
      where: { status: 'PUBLISHED', publishedAt: { lte: new Date() } },
      orderBy: { views: 'desc' },
      take: 5,
      include: { category: true }
    }),
    prisma.tag.findMany({ take: 18, orderBy: { name: 'asc' } })
  ]);

  const totalPaginas = Math.ceil(total / POR_PAGINA);

  return (
    <>
      <SiteHeader />

      <main className="container-news py-6">
        <nav aria-label="Migas de pan" className="mb-4 text-xs text-news-500">
          <Link href="/" className="hover:text-brand-700">
            Inicio
          </Link>
          <span className="mx-1.5" aria-hidden="true">
            /
          </span>
          <span className="text-news-700">{categoria.name}</span>
        </nav>

        <header className="border-b border-news-200 pb-4">
          <CategoryBadge name={categoria.name} slug={categoria.slug} color={categoria.color} asLink={false} className="mb-2" />
          <h1 className="headline-xl">{categoria.name}</h1>
          {categoria.description ? <p className="mt-2 max-w-3xl text-news-600">{categoria.description}</p> : null}
          <p className="mt-2 text-xs text-news-500">{total} notas publicadas</p>
        </header>

        <div className="mt-6">
          <BannerZone zone="HOME_TOP" />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            {notas.length > 0 ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {notas.map((nota) => (
                  <ArticleCard key={nota.id} article={nota} variant="standard" />
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-news-200 bg-white p-6 text-center text-news-500">
                Todavía no hay notas publicadas en esta categoría.
              </p>
            )}

            <Pagination currentPage={page} totalPages={totalPaginas} basePath={categoryUrl(categoria.slug)} />
          </div>

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

            <BannerZone zone="SIDEBAR" />

            <div className="rounded-lg border border-news-200 bg-white p-4">
              <h2 className="mb-3 font-editorial text-lg font-bold text-brand-900">Temas</h2>
              <ul className="flex flex-wrap gap-2">
                {etiquetas.map((tag) => (
                  <li key={tag.id}>
                    <Link
                      href={`/etiqueta/${tag.slug}`}
                      className="inline-flex rounded-full border border-news-200 bg-news-50 px-3 py-1 text-xs font-medium text-news-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
                    >
                      {tag.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
