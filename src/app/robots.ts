import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';
import { SITE } from '@/lib/constants';

/** robots.txt dinámico: usa la directiva `robots` de SiteSeo si existe, con fallback seguro. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = SITE.url.replace(/\/$/, '');
  const seo = await prisma.siteSeo.findFirst();
  const policy = (seo?.robots ?? 'index, follow').split(',').map((s) => s.trim());

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api']
      }
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base
  };
}
