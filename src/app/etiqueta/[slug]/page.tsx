import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { SITE } from '@/lib/constants';
import { tagUrl } from '@/lib/seo';
import { SiteHeader } from '@/components/public/SiteHeader';
import { SiteFooter } from '@/components/public/SiteFooter';
import { ArticleCard } from '@/components/public/ArticleCard';
import { Pagination } from '@/components/public/Pagination';
import { BannerZone } from '@/components/public/BannerZone';

export const revalidate = 60;

const POR_PAGINA = 12;

type SearchParams = { [key: string]: string | string[] | undefined };

interface Props {
  params: { slug: string };
  searchParams?: SearchParams;
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const etiqueta = await prisma.tag.findUnique({ where: { slug: params.slug } });
  if (!etiqueta) {
    return { title: { absolute: `Etiqueta no encontrada — ${SITE.name}` } };
  }
  const descripcion = `Notas etiquetadas con ${etiqueta.name} en ${SITE.city}, ${SITE.province}.`;
  return {
    title: { absolute: `${etiqueta.name} — ${SITE.name}` },
    description: descripcion,
    alternates: { canonical: tagUrl(etiqueta.name) },
    openGraph: { title: `${etiqueta.name} — ${SITE.name}`, description: descripcion, type: 'website' }
  };
}

export default async function EtiquetaPage({ params, searchParams }: Props) {
  const pageRaw = searchParams?.page;
  const pageParam = Array.isArray(pageRaw) ? pageRaw[0] : pageRaw;
  const page = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1);

  const etiqueta = await prisma.tag.findUnique({ where: { slug: params.slug } });
  if (!etiqueta) notFound();

  const baseWhere = {
    status: 'PUBLISHED' as const,
    publishedAt: { lte: new Date() },
    tags: { some: { id: etiqueta.id } }
  };

  const [notas, total, masLeidas] = await Promise.all([
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
    })
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
          <span className="text-news-700">Etiqueta: {etiqueta.name}</span>
        </nav>

        <header className="border-b border-news-200 pb-4">
          <span className="kicker text-brand-600">Etiqueta</span>
          <h1 className="headline-xl mt-1">#{etiqueta.name}</h1>
          <p className="mt-2 text-xs text-news-500">{total} notas relacionadas</p>
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
                Todavía no hay notas con esta etiqueta.
              </p>
            )}

            <Pagination currentPage={page} totalPages={totalPaginas} basePath={tagUrl(etiqueta.name)} />
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
          </aside>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
