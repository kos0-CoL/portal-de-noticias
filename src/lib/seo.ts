import { SITE } from '@/lib/constants';
import { stripHtml, truncate, slugify } from '@/lib/utils';

/**
 * Generacion de metadatos SEO.
 * La IA produce el metaTitle/metaDescription/socialSummary, pero si todavia no
 * corrio la reescritura estos helpers dan un fallback decente con el contenido
 * crudo para que la nota nunca se publique sin metadatos.
 */

export interface SeoInput {
  title: string;
  summary?: string | null;
  content: string;
  coverImage?: string | null;
  slug?: string;
  publishedAt?: Date | string | null;
  updatedAt?: Date | string | null;
  categoryName?: string | null;
  tags?: string[];
}

export function buildMetaTitle(input: { title: string; metaTitle?: string | null }): string {
  const base = input.metaTitle?.trim() || input.title.trim();
  // Google corta alrededor de los 60 caracteres.
  if (base.length <= 60) return base;
  return truncate(base, 60);
}

export function buildMetaDescription(input: SeoInput & { metaDescription?: string | null }): string {
  if (input.metaDescription?.trim()) return truncate(input.metaDescription.trim(), 158);
  if (input.summary?.trim()) return truncate(stripHtml(input.summary), 158);
  return truncate(stripHtml(input.content), 158);
}

export function buildKeywords(tags: string[] | undefined, categoryName?: string | null): string[] {
  const base = ['Saladillo', 'noticias de Saladillo', 'Saladillo Buenos Aires'];
  if (categoryName) base.push(categoryName);
  return Array.from(new Set([...base, ...(tags ?? [])]));
}

export function twitterCardType(coverImage?: string | null) {
  return coverImage ? 'summary_large_image' : 'summary';
}

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE.url.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

export function newsArticleJsonLd(input: SeoInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: truncate(input.title, 110),
    description: buildMetaDescription(input),
    image: input.coverImage ? [absoluteUrl(input.coverImage)] : undefined,
    datePublished: input.publishedAt ? new Date(input.publishedAt).toISOString() : undefined,
    dateModified: input.updatedAt ? new Date(input.updatedAt).toISOString() : undefined,
    inLanguage: 'es-AR',
    author: { '@type': 'Organization', name: SITE.name },
    publisher: {
      '@type': 'Organization',
      name: SITE.name,
      logo: { '@type': 'ImageObject', url: absoluteUrl('/logo.png') }
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': absoluteUrl(`/nota/${input.slug ?? ''}`)
    },
    articleSection: input.categoryName ?? undefined,
    keywords: buildKeywords(input.tags, input.categoryName).join(', ')
  };
}

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsMediaOrganization',
    name: SITE.name,
    url: SITE.url,
    slogan: SITE.tagline,
    email: SITE.email,
    address: {
      '@type': 'PostalAddress',
      addressLocality: SITE.city,
      addressRegion: SITE.province,
      addressCountry: 'AR'
    }
  };
}

/** URL canonica de una nota. Con el slug ya alcanza y es mas legible. */
export function articleUrl(slug: string): string {
  return `/nota/${slug}`; 
}

export function categoryUrl(slug: string): string {
  return `/categoria/${slug}`;
}

export function tagUrl(name: string): string {
  return `/etiqueta/${slugify(name)}`;
}
