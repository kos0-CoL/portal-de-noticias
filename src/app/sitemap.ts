import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';
import { SITE } from '@/lib/constants';
import { avisoVigenteWhere } from '@/lib/classifieds';

export const revalidate = 3600;

/** Sitemap del sitio publico: home, categorias, notas publicadas, clasificados vigentes y paginas legales. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE.url.replace(/\/$/, '');
  const ahora = new Date();

  const [categorias, articulos, clasificados, paginasLegales] = await Promise.all([
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { position: 'asc' },
      select: { slug: true, updatedAt: true }
    }),
    prisma.article.findMany({
      where: { status: 'PUBLISHED', publishedAt: { lte: ahora } },
      orderBy: { publishedAt: 'desc' },
      take: 1000,
      select: { slug: true, updatedAt: true, publishedAt: true }
    }),
    prisma.classified.findMany({
      where: avisoVigenteWhere(),
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, updatedAt: true }
    }),
    prisma.legalPage.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true }
    })
  ]);

  const entradas: MetadataRoute.Sitemap = [
    {
      url: `${base}/`,
      lastModified: ahora,
      changeFrequency: 'hourly',
      priority: 1
    },
    {
      url: `${base}/contacto`,
      lastModified: ahora,
      changeFrequency: 'monthly',
      priority: 0.8
    },
    {
      url: `${base}/clasificados`,
      lastModified: ahora,
      changeFrequency: 'daily',
      priority: 0.8
    },
    {
      url: `${base}/farmacias`,
      lastModified: ahora,
      changeFrequency: 'daily',
      priority: 0.5
    },
    {
      url: `${base}/clima`,
      lastModified: ahora,
      changeFrequency: 'hourly',
      priority: 0.5
    },
    ...categorias.map((cat) => ({
      url: `${base}/categoria/${cat.slug}`,
      lastModified: cat.updatedAt,
      changeFrequency: 'daily' as const,
      priority: 0.7
    })),
    ...articulos.map((nota) => ({
      url: `${base}/nota/${nota.slug}`,
      lastModified: nota.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.6
    })),
    ...clasificados.map((aviso) => ({
      url: `${base}/clasificados/${aviso.id}`,
      lastModified: aviso.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.4
    })),
    ...paginasLegales.map((page) => ({
      url: `${base}/legales/${page.slug}`,
      lastModified: page.updatedAt,
      changeFrequency: 'monthly' as const,
      priority: 0.6
    }))
  ];

  return entradas;
}
