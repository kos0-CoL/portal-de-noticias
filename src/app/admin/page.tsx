import Link from 'next/link';
import {
  Activity,
  Ban,
  Bot,
  CircleCheckBig,
  FilePenLine,
  FilePlus2,
  Images,
  Eye,
  Megaphone,
  Sparkles,
  TriangleAlert
} from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { formatFechaCorta } from '@/lib/utils';
import { PRIORITY_BADGE, StatusBadge } from '@/components/admin/StatusBadge';
import { StatCard } from '@/components/admin/StatCard';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Dashboard | Panel de administración'
};

/** Dashboard del backoffice: métricas, últimas notas, revisión y scraping. */
export default async function AdminDashboardPage() {
  const [
    publishedCount,
    draftsCount,
    pendingReviewCount,
    viewsAggregate,
    pendingClassifieds,
    activeSources,
    activeBanners,
    latestArticles,
    reviewArticles,
    recentJobs
  ] = await Promise.all([
    prisma.article.count({ where: { status: 'PUBLISHED' } }),
    prisma.article.count({ where: { status: 'DRAFT' } }),
    prisma.article.count({ where: { status: 'PENDING_REVIEW' } }),
    prisma.article.aggregate({ _sum: { views: true } }),
    prisma.classified.count({ where: { status: 'PENDING' } }),
    prisma.source.count({ where: { isActive: true } }),
    prisma.banner.count({ where: { isActive: true } }),
    prisma.article.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { category: true }
    }),
    prisma.article.findMany({
      where: { status: 'PENDING_REVIEW' },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      take: 6,
      include: { category: true, scrapedItem: true }
    }),
    prisma.scrapeJob.findMany({
      orderBy: { startedAt: 'desc' },
      take: 5,
      include: { source: true }
    })
  ]);

  const totalViews = viewsAggregate._sum.views ?? 0;

  return (
    <div className="space-y-6">
      {/* Métricas principales */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Notas publicadas"
          value={publishedCount}
          icon={<CircleCheckBig className="h-5 w-5" />}
          tone="green"
        />
        <StatCard label="Borradores" value={draftsCount} icon={<FilePenLine className="h-5 w-5" />} tone="brand" />
        <StatCard
          label="Pendientes de revisión"
          value={pendingReviewCount}
          hint="Traídas por el scraper"
          icon={<TriangleAlert className="h-5 w-5" />}
          tone="amber"
        />
        <StatCard
          label="Visitas totales"
          value={totalViews.toLocaleString('es-AR')}
          icon={<Eye className="h-5 w-5" />}
          tone="brand"
        />
        <StatCard
          label="Clasificados pendientes"
          value={pendingClassifieds}
          icon={<Megaphone className="h-5 w-5" />}
          tone="amber"
        />
        <StatCard
          label="Fuentes de scraping activas"
          value={activeSources}
          icon={<Bot className="h-5 w-5" />}
          tone="brand"
        />
        <StatCard
          label="Banners activos"
          value={activeBanners}
          icon={<Images className="h-5 w-5" />}
          tone="brand"
        />
      </section>

      {/* Accesos rápidos */}
      <section className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-title">Accesos rápidos</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/noticias/nueva" className="btn-primary btn-sm">
            <FilePlus2 className="h-4 w-4" />
            Nueva noticia
          </Link>
          <Link href="/admin/scraping" className="btn-secondary btn-sm">
            <Bot className="h-4 w-4" />
            Ejecutar scraping
          </Link>
          <Link href="/admin/ia" className="btn-secondary btn-sm">
            <Sparkles className="h-4 w-4" />
            Configurar IA
          </Link>
          <Link href="/admin/banners" className="btn-secondary btn-sm">
            <Images className="h-4 w-4" />
            Gestionar banners
          </Link>
        </div>
      </section>

      {/* Pendientes de revisión */}
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 pb-3">
          <h2 className="flex items-center gap-2 font-editorial text-lg font-bold text-amber-900">
            <TriangleAlert className="h-5 w-5" />
            Pendientes de revisión
          </h2>
          <span className="badge-amber">{reviewArticles.length} nota(s)</span>
        </div>

        {reviewArticles.length === 0 ? (
          <p className="text-sm text-amber-800">
            No hay notas pendientes de revisión. El scraper no trajo novedades.
          </p>
        ) : (
          <ul className="space-y-3">
            {reviewArticles.map((article) => {
              const matched = article.scrapedItem?.matchedKeywords?.length ?? 0;
              return (
                <li
                  key={article.id}
                  className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-brand-900">{article.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-news-500">
                      <span>{article.category.name}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatFechaCorta(article.createdAt)}</span>
                      <PRIORITY_BADGE priority={article.priority} />
                      {matched > 0 ? (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-800">
                          {matched} palabra(s) clave local
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <Link href={`/admin/noticias/${article.id}`} className="btn-primary btn-sm shrink-0">
                    Revisar
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Últimas notas */}
        <section className="admin-card xl:col-span-2">
          <div className="admin-card-header">
            <h2 className="admin-title">Últimas notas</h2>
            <Link href="/admin/noticias" className="text-sm font-semibold text-brand-700 hover:text-brand-900">
              Ver todas
            </Link>
          </div>

          {latestArticles.length === 0 ? (
            <p className="text-sm text-news-500">Todavía no hay notas cargadas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-admin">
                <thead>
                  <tr>
                    <th>Título</th>
                    <th>Categoría</th>
                    <th>Estado</th>
                    <th>Prioridad</th>
                    <th>Fecha</th>
                    <th className="text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {latestArticles.map((article) => (
                    <tr key={article.id}>
                      <td className="max-w-[280px]">
                        <Link
                          href={`/admin/noticias/${article.id}`}
                          className="font-semibold text-brand-900 hover:text-brand-600"
                        >
                          <span className="line-clamp-2-custom">{article.title}</span>
                        </Link>
                      </td>
                      <td>{article.category.name}</td>
                      <td>
                        <StatusBadge status={article.status} />
                      </td>
                      <td>
                        <PRIORITY_BADGE priority={article.priority} />
                      </td>
                      <td className="whitespace-nowrap text-xs text-news-500">
                        {formatFechaCorta(article.createdAt)}
                      </td>
                      <td>
                        <div className="flex justify-end gap-2">
                          <Link href={`/admin/noticias/${article.id}`} className="btn-secondary btn-sm">
                            Editar
                          </Link>
                          <a
                            href={`/nota/${article.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-ghost btn-sm"
                          >
                            Ver
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Actividad de scraping */}
        <section className="admin-card">
          <div className="admin-card-header">
            <h2 className="flex items-center gap-2 admin-title">
              <Activity className="h-4 w-4" />
              Actividad reciente de scraping
            </h2>
          </div>

          {recentJobs.length === 0 ? (
            <p className="text-sm text-news-500">Todavía no se ejecutó ninguna corrida de scraping.</p>
          ) : (
            <ul className="space-y-3">
              {recentJobs.map((job) => (
                <li key={job.id} className="rounded-lg border border-news-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold text-brand-900">{job.source.name}</span>
                    <StatusBadge status={job.status} />
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-news-500">
                    <span>Encontrados: {job.itemsFound}</span>
                    <span>Creados: {job.itemsCreated}</span>
                    <span>{formatFechaCorta(job.startedAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Nota informativa sobre clasificados */}
      {pendingClassifieds > 0 ? (
        <section className="admin-card flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm text-news-700">
            <Ban className="h-4 w-4 text-amber-600" />
            Hay {pendingClassifieds} clasificado(s) esperando moderación.
          </p>
          <Link href="/admin/clasificados?estado=PENDING" className="btn-secondary btn-sm">
            Ir a clasificados
          </Link>
        </section>
      ) : null}
    </div>
  );
}
