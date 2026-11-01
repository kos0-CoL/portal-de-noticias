import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { SITE } from '@/lib/constants';
import { getSession } from '@/lib/auth';
import { hasPremiumAccess } from '@/lib/paywall/access';
import {
  absoluteUrl,
  articleUrl,
  buildKeywords,
  buildMetaDescription,
  buildMetaTitle,
  categoryUrl,
  newsArticleJsonLd,
  tagUrl,
  twitterCardType
} from '@/lib/seo';
import { formatFecha, sanitizeHtml, stripHtml } from '@/lib/utils';
import { SiteHeader } from '@/components/public/SiteHeader';
import { SiteFooter } from '@/components/public/SiteFooter';
import { CategoryBadge } from '@/components/public/CategoryBadge';
import { ArticleCard } from '@/components/public/ArticleCard';
import { SectionTitle } from '@/components/public/SectionTitle';
import { ReadAloudButton } from '@/components/public/ReadAloudButton';
import { ShareButtons } from '@/components/public/ShareButtons';
import { BannerZone } from '@/components/public/BannerZone';
import ComentariosNota from '@/components/public/ComentariosNota';

interface Props {
  params: { slug: string };
}

/** Parte el HTML del cuerpo a la mitad para insertar el banner dentro de la nota. */
function dividirCuerpo(html: string): [string, string] {
  const bloques = html
    .split(/(?<=<\/p>|<\/h2>|<\/h3>|<\/ul>|<\/ol>|<\/blockquote>|<\/figure>)/)
    .filter((b) => b.trim().length > 0);
  if (bloques.length < 2) return [html, ''];
  const mitad = Math.ceil(bloques.length / 2);
  return [bloques.slice(0, mitad).join(''), bloques.slice(mitad).join('')];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const articulo = await prisma.article.findFirst({
    where: { slug: params.slug, status: 'PUBLISHED' },
    include: { category: true, tags: true }
  });
  if (!articulo) {
    return { title: { absolute: `Nota no encontrada — ${SITE.name}` } };
  }

  const entrada = {
    title: articulo.title,
    summary: articulo.summary,
    content: articulo.content,
    coverImage: articulo.coverImage,
    slug: articulo.slug,
    publishedAt: articulo.publishedAt,
    updatedAt: articulo.updatedAt,
    categoryName: articulo.category.name,
    tags: articulo.tags.map((t) => t.name)
  };

  const metaTitle = buildMetaTitle({ title: articulo.title, metaTitle: articulo.metaTitle });
  const metaDescription = buildMetaDescription({ ...entrada, metaDescription: articulo.metaDescription });
  const keywords = buildKeywords(entrada.tags, articulo.category.name);
  const imagen = articulo.coverImage ? absoluteUrl(articulo.coverImage) : undefined;

  return {
    title: metaTitle,
    description: metaDescription,
    keywords,
    alternates: { canonical: articleUrl(articulo.slug) },
    openGraph: {
      type: 'article',
      title: metaTitle,
      description: metaDescription,
      url: absoluteUrl(articleUrl(articulo.slug)),
      siteName: SITE.name,
      locale: 'es_AR',
      images: imagen ? [{ url: imagen, alt: articulo.coverImageAlt ?? articulo.title }] : undefined,
      publishedTime: articulo.publishedAt?.toISOString(),
      section: articulo.category.name,
      tags: entrada.tags
    },
    twitter: {
      card: twitterCardType(articulo.coverImage),
      title: metaTitle,
      description: metaDescription,
      images: imagen ? [imagen] : undefined
    }
  };
}

export default async function NotaPage({ params }: Props) {
  const articulo = await prisma.article.findFirst({
    where: { slug: params.slug, status: 'PUBLISHED' },
    include: { category: true, tags: true, author: true }
  });

  if (!articulo) notFound();

  const session = await getSession();
  const usuarioId = session?.sub ?? null;

  const tieneAcceso = await hasPremiumAccess(usuarioId, articulo.id);
  const esPremium = articulo.isPremium;

  if (esPremium && !tieneAcceso) {
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
            <Link href={categoryUrl(articulo.category.slug)} className="hover:text-brand-700">
              {articulo.category.name}
            </Link>
          </nav>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
            <article className="min-w-0">
              <header>
                <div className="flex flex-wrap items-center gap-2">
                  <CategoryBadge name={articulo.category.name} slug={articulo.category.slug} color={articulo.category.color} />
                  {articulo.priority === 'URGENTE' || articulo.isBreaking ? (
                    <span className="badge bg-accent-500 text-white">Último momento</span>
                  ) : articulo.priority === 'ALTA' ? (
                    <span className="badge-amber">Prioridad alta</span>
                  ) : null}
                </div>

                <h1 className="headline-xl mt-3 text-balance">{articulo.title}</h1>

                {articulo.summary ? (
                  <p className="mt-3 font-editorial text-lg leading-relaxed text-news-600 sm:text-xl">{articulo.summary}</p>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-news-200 py-3 text-sm text-news-500">
                  <span className="font-semibold text-news-700">{articulo.author?.name ?? 'Redacción'}</span>
                  {articulo.publishedAt ? (
                    <time dateTime={new Date(articulo.publishedAt).toISOString()}>{formatFecha(articulo.publishedAt, true)}</time>
                  ) : null}
                  <span>{articulo.readingTime} min de lectura</span>
                </div>
              </header>

              <div className="mt-6 rounded-lg border border-news-200 bg-news-50 p-8 text-center">
                <h2 className="mb-3 font-editorial text-lg font-bold text-brand-900">Nota exclusiva para suscriptores</h2>
                <p className="mb-6 text-news-600">
                  Esta nota es de contenido premium. Para leerla completa, necesitas una suscripción activa.
                </p>
                <a href="/suscripciones" className="inline-flex items-center gap-2 rounded-md bg-brand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition">
                  Ver planes de suscripción
                  <span aria-hidden="true"> →</span>
                </a>
              </div>
            </article>

            <aside className="space-y-6">
              <BannerZone zone="SIDEBAR" />
            </aside>
          </div>
        </main>

        <SiteFooter />
      </>
    );
  }

  // Incremento de vistas: nunca debe romper el render.
  await prisma.article
    .update({ where: { id: articulo.id }, data: { views: { increment: 1 } } })
    .catch(() => {});

  const [relacionadas, masLeidas, comentariosAprobados] = await Promise.all([
    prisma.article.findMany({
      where: {
        status: 'PUBLISHED',
        publishedAt: { lte: new Date() },
        categoryId: articulo.categoryId,
        id: { not: articulo.id }
      },
      orderBy: { publishedAt: 'desc' },
      take: 4,
      include: { category: true, tags: true }
    }),
    prisma.article.findMany({
      where: { status: 'PUBLISHED', publishedAt: { lte: new Date() }, id: { not: articulo.id } },
      orderBy: { views: 'desc' },
      take: 5,
      include: { category: true }
    }),
    prisma.comment.findMany({
      where: { articleId: articulo.id, status: 'APPROVED' },
      orderBy: { createdAt: 'asc' }
    })
  ]);

  const comentariosAprobadosMapeados = comentariosAprobados.map((c) => ({
    id: c.id,
    authorName: c.authorName,
    content: c.content,
    status: c.status,
    createdAt: c.createdAt,
    replies: []
  }));

  const contenidoLimpio = sanitizeHtml(articulo.content);
  const [primeraMitad, segundaMitad] = dividirCuerpo(contenidoLimpio);
  const textoPlano = stripHtml(articulo.content);
  const urlAbsoluta = absoluteUrl(articleUrl(articulo.slug));
  const jsonLd = newsArticleJsonLd({
    title: articulo.title,
    summary: articulo.summary,
    content: articulo.content,
    coverImage: articulo.coverImage,
    slug: articulo.slug,
    publishedAt: articulo.publishedAt,
    updatedAt: articulo.updatedAt,
    categoryName: articulo.category.name,
    tags: articulo.tags.map((t) => t.name)
  });

  return (
    <>
      <SiteHeader />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <main className="container-news py-6">
        <nav aria-label="Migas de pan" className="mb-4 text-xs text-news-500">
          <Link href="/" className="hover:text-brand-700">
            Inicio
          </Link>
          <span className="mx-1.5" aria-hidden="true">
            /
          </span>
          <Link href={categoryUrl(articulo.category.slug)} className="hover:text-brand-700">
            {articulo.category.name}
          </Link>
        </nav>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <article className="min-w-0">
            <header>
              <div className="flex flex-wrap items-center gap-2">
                <CategoryBadge name={articulo.category.name} slug={articulo.category.slug} color={articulo.category.color} />
                {articulo.priority === 'URGENTE' || articulo.isBreaking ? (
                  <span className="badge bg-accent-500 text-white">Último momento</span>
                ) : articulo.priority === 'ALTA' ? (
                  <span className="badge-amber">Prioridad alta</span>
                ) : null}
              </div>

              <h1 className="headline-xl mt-3 text-balance">{articulo.title}</h1>

              {articulo.summary ? (
                <p className="mt-3 font-editorial text-lg leading-relaxed text-news-600 sm:text-xl">{articulo.summary}</p>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-news-200 py-3 text-sm text-news-500">
                <span className="font-semibold text-news-700">{articulo.author?.name ?? 'Redacción'}</span>
                {articulo.publishedAt ? (
                  <time dateTime={new Date(articulo.publishedAt).toISOString()}>{formatFecha(articulo.publishedAt, true)}</time>
                ) : null}
                <span>{articulo.readingTime} min de lectura</span>
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <ReadAloudButton title={articulo.title} text={textoPlano} />
                <ShareButtons url={urlAbsoluta} title={articulo.title} />
              </div>
            </header>

            {articulo.coverImage ? (
              <figure className="mt-6">
                <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg bg-news-200">
                  <Image
                    src={articulo.coverImage}
                    alt={articulo.coverImageAlt || articulo.title}
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 800px"
                    className="object-cover"
                  />
                </div>
                <figcaption className="mt-2 text-xs text-news-500">
                  {articulo.coverImageAlt || articulo.title}
                  {articulo.sourceName ? ` · Imagen: ${articulo.sourceName}` : ''}
                </figcaption>
              </figure>
            ) : null}

            <div className="mt-6">
              <div className="article-body drop-cap" dangerouslySetInnerHTML={{ __html: primeraMitad }} />

              {segundaMitad ? (
                <>
                  <div className="my-8">
                    <BannerZone zone="INLINE_ARTICLE" />
                  </div>
                  <div className="article-body" dangerouslySetInnerHTML={{ __html: segundaMitad }} />
                </>
              ) : null}
            </div>

            {articulo.sourceName ? (
              <aside className="mt-8 rounded-lg border border-news-200 bg-news-50 p-4 text-sm text-news-600">
                <p>
                  Esta nota fue elaborada a partir de información publicada por{' '}
                  <strong className="text-news-800">{articulo.sourceName}</strong>.
                  {articulo.sourceUrl ? (
                    <>
                      {' '}
                      <a
                        href={articulo.sourceUrl}
                        target="_blank"
                        rel="nofollow noopener"
                        className="font-medium text-brand-600 underline decoration-brand-300 underline-offset-2 hover:text-brand-800"
                      >
                        Ver la fuente original
                      </a>
                      .
                    </>
                  ) : null}
                </p>
              </aside>
            ) : null}

            {articulo.tags.length > 0 ? (
              <div className="mt-6">
                <h2 className="kicker mb-2 text-news-500">Etiquetas</h2>
                <ul className="flex flex-wrap gap-2">
                  {articulo.tags.map((tag) => (
                    <li key={tag.id}>
                      <Link
                        href={tagUrl(tag.name)}
                        className="inline-flex rounded-full border border-news-200 bg-white px-3 py-1 text-xs font-medium text-news-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
                      >
                        #{tag.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {relacionadas.length > 0 ? (
              <section className="mt-10">
                <SectionTitle title={`Más de ${articulo.category.name}`} href={categoryUrl(articulo.category.slug)} />
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  {relacionadas.map((nota) => (
                    <ArticleCard key={nota.id} article={nota} variant="standard" />
                  ))}
                </div>
              </section>
            ) : null}

            <ComentariosNota articleId={articulo.id} initialComentarios={comentariosAprobadosMapeados} />
          </article>

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

            {relacionadas.length > 0 ? (
              <div className="rounded-lg border border-news-200 bg-white p-4">
                <h2 className="mb-3 font-editorial text-lg font-bold text-brand-900">Notas relacionadas</h2>
                <ul className="space-y-3">
                  {relacionadas.map((nota) => (
                    <li key={nota.id}>
                      <Link href={`/nota/${nota.slug}`} className="link-underline text-sm font-semibold leading-snug text-brand-900">
                        {nota.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <BannerZone zone="SIDEBAR" />
          </aside>
        </div>
      </main>

      <SiteFooter />
      <BannerZone zone="MOBILE_STICKY" />
    </>
  );
}
