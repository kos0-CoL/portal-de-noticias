import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { SITE } from '@/lib/constants';
import { SiteHeader } from '@/components/public/SiteHeader';
import { SiteFooter } from '@/components/public/SiteFooter';
import { SearchBar } from '@/components/public/SearchBar';
import { ArticleCard } from '@/components/public/ArticleCard';

export const metadata: Metadata = {
  title: 'Buscar',
  description: `Buscá notas y temas en ${SITE.name}.`,
  robots: { index: false, follow: true }
};

const LIMITE = 30;

type SearchParams = { [key: string]: string | string[] | undefined };

interface Props {
  searchParams?: SearchParams;
}

export default async function BuscarPage({ searchParams }: Props) {
  const qRaw = searchParams?.q;
  const q = (Array.isArray(qRaw) ? qRaw[0] : qRaw ?? '').trim();

  const resultados = q
    ? await prisma.article.findMany({
        where: {
          status: 'PUBLISHED',
          publishedAt: { lte: new Date() },
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { summary: { contains: q, mode: 'insensitive' } },
            { content: { contains: q, mode: 'insensitive' } }
          ]
        },
        orderBy: { publishedAt: 'desc' },
        take: LIMITE,
        include: { category: true, tags: true }
      })
    : [];

  return (
    <>
      <SiteHeader />

      <main className="container-news py-6">
        <header className="border-b border-news-200 pb-4">
          <h1 className="headline-lg">Buscar en el portal</h1>
          <p className="mt-1 text-sm text-news-500">Notas, temas y localidades de Saladillo y la zona.</p>
          <div className="mt-4 max-w-xl">
            <SearchBar defaultValue={q} autoFocus={false} />
          </div>
        </header>

        <div className="mt-6">
          {!q ? (
            <p className="rounded-lg border border-news-200 bg-white p-6 text-center text-news-500">
              Escribí un término para encontrar notas.
            </p>
          ) : resultados.length === 0 ? (
            <div className="rounded-lg border border-news-200 bg-white p-8 text-center">
              <p className="font-editorial text-lg font-bold text-brand-900">Sin resultados</p>
              <p className="mt-1 text-sm text-news-500">
                No encontramos notas para <strong>“{q}”</strong>. Probá con otra palabra o revisá la ortografía.
              </p>
            </div>
          ) : (
            <>
              <p className="mb-4 text-sm text-news-600">
                {resultados.length} {resultados.length === 1 ? 'resultado' : 'resultados'} para{' '}
                <strong className="text-brand-900">“{q}”</strong>
              </p>
              <div className="flex flex-col gap-4">
                {resultados.map((nota) => (
                  <ArticleCard key={nota.id} article={nota} variant="list" />
                ))}
              </div>
            </>
          )}
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
