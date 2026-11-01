import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { SITE } from '@/lib/constants';
import { SiteHeader } from '@/components/public/SiteHeader';
import { SiteFooter } from '@/components/public/SiteFooter';

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await prisma.legalPage.findUnique({
    where: { slug: params.slug, isActive: true }
  });
  if (!page) {
    return { title: { absolute: `Página no encontrada — ${SITE.name}` } };
  }

  return {
    title: page.metaTitle ?? `${page.title} — ${SITE.name}`,
    description: page.metaDescription ?? undefined,
    alternates: { canonical: `/legales/${page.slug}` },
    openGraph: {
      type: 'website',
      title: page.title,
      description: page.metaDescription ?? undefined,
      url: `${SITE.url}/legales/${page.slug}`,
      siteName: SITE.name,
      locale: 'es_AR'
    }
  };
}

export default async function LegalPage({ params }: Props) {
  const page = await prisma.legalPage.findUnique({
    where: { slug: params.slug, isActive: true }
  });

  if (!page) notFound();

  return (
    <>
      <SiteHeader />

      <main className="container-news py-10">
        <nav aria-label="Migas de pan" className="mb-6 text-xs text-news-500">
          <a href="/" className="hover:text-brand-700">
            Inicio
          </a>
          <span className="mx-1.5" aria-hidden="true">/</span>
          <span className="text-news-700">{page.title}</span>
        </nav>

        <article className="max-w-3xl mx-auto">
          <header className="mb-8">
            <h1 className="headline-xl text-balance text-brand-900">{page.title}</h1>
            <time
              dateTime={page.updatedAt.toISOString()}
              className="mt-2 text-sm text-news-500"
            >
              Última actualización: {page.updatedAt.toLocaleDateString('es-AR')}
            </time>
          </header>

          <div
            className="prose prose-sm md:prose-base lg:prose-lg text-news-700 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: page.content }}
          />
        </article>

        <div className="mt-12 pt-8 border-t border-news-200 text-center text-xs text-news-400">
          {SITE.name} · {SITE.city}, {SITE.province} · © {new Date().getFullYear()}
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
