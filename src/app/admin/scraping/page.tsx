import Link from 'next/link';
import { Activity, AlertTriangle, CheckCircle2, Clock, FileClock, Rss } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { formatFecha, tiempoRelativo } from '@/lib/utils';
import ScraperRunner from '@/components/admin/ScraperRunner';

export const dynamic = 'force-dynamic';

const PRIORIDAD_BADGE: Record<string, string> = {
  NORMAL: 'badge-gray',
  ALTA: 'badge-amber',
  URGENTE: 'badge-red'
};

const ESTADO_JOB_BADGE: Record<string, string> = {
  QUEUED: 'badge-gray',
  RUNNING: 'badge-blue',
  SUCCESS: 'badge-green',
  PARTIAL: 'badge-amber',
  ERROR: 'badge-red'
};

/** Panel principal de scraping: métricas, ejecución y estado de la cola. */
export default async function AdminScrapingPage() {
  const [
    fuentes,
    jobsRecientes,
    itemsPendientes,
    totalItemsPendientes,
    notasPendientes,
    totalNotasPendientes,
    itemsAlta,
    keywordsActivas,
    ultimaFuente
  ] = await Promise.all([
    prisma.source.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { items: true, jobs: true } } }
    }),
    prisma.scrapeJob.findMany({
      orderBy: { startedAt: 'desc' },
      take: 10,
      include: { source: { select: { name: true } } }
    }),
    prisma.scrapedItem.findMany({
      where: { status: 'PENDING' },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      take: 8,
      include: { source: { select: { name: true } }, article: { select: { id: true, title: true } } }
    }),
    prisma.scrapedItem.count({ where: { status: 'PENDING' } }),
    prisma.article.findMany({
      where: { status: 'PENDING_REVIEW' },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      take: 8,
      include: { category: { select: { name: true } } }
    }),
    prisma.article.count({ where: { status: 'PENDING_REVIEW' } }),
    prisma.scrapedItem.count({ where: { priority: { in: ['ALTA', 'URGENTE'] }, status: 'PENDING' } }),
    prisma.keyword.count({ where: { isActive: true } }),
    prisma.source.findFirst({
      where: { lastRunAt: { not: null } },
      orderBy: { lastRunAt: 'desc' },
      select: { lastRunAt: true, name: true }
    })
  ]);

  const fuentesActivas = fuentes.filter((fuente) => fuente.isActive).length;

  const metricas = [
    { label: 'Fuentes activas', valor: fuentesActivas, icono: Rss, color: 'text-brand-700' },
    { label: 'Items en cola', valor: totalItemsPendientes, icono: FileClock, color: 'text-amber-600' },
    { label: 'Notas por revisar', valor: totalNotasPendientes, icono: Clock, color: 'text-brand-700' },
    { label: 'Prioridad alta', valor: itemsAlta, icono: AlertTriangle, color: 'text-red-600' }
  ];

  return (
    <div className="container-news space-y-6 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-editorial text-2xl font-bold text-brand-900">Scraping y automatización</h1>
          <p className="text-sm text-news-500">
            Motor de extracción de noticias con anti-bloqueo, filtro local y tareas programadas.
          </p>
        </div>
        <div className="flex gap-2">
          <Link className="btn-secondary btn-sm" href="/admin/scraping/fuentes">
            Fuentes
          </Link>
          <Link className="btn-secondary btn-sm" href="/admin/scraping/cola">
            Bandeja de revisión
          </Link>
          <Link className="btn-secondary btn-sm" href="/admin/scraping/keywords">
            Palabras clave
          </Link>
        </div>
      </header>

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metricas.map((metrica) => {
          const Icono = metrica.icono;
          return (
            <div key={metrica.label} className="admin-card flex items-center gap-3">
              <Icono className={`h-8 w-8 ${metrica.color}`} />
              <div>
                <p className="text-2xl font-bold text-brand-900">{metrica.valor}</p>
                <p className="text-xs uppercase tracking-wide text-news-500">{metrica.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-news-500">
        {ultimaFuente?.lastRunAt
          ? `Última ejecución: ${formatFecha(ultimaFuente.lastRunAt)} (${ultimaFuente.name})`
          : 'Todavía no se ejecutó ninguna fuente.'}{' '}
        · {keywordsActivas} palabras clave activas.
      </p>

      {/* Ejecución */}
      <section className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-title">Ejecutar ahora</h2>
          <span className="text-xs text-news-500">
            Podés ejecutar todas las fuentes activas o una en particular.
          </span>
        </div>
        <ScraperRunner
          fuentes={fuentes.map((fuente) => ({ id: fuente.id, name: fuente.name, isActive: fuente.isActive }))}
        />
      </section>

      {/* Fuentes */}
      <section className="admin-card overflow-x-auto">
        <div className="admin-card-header">
          <h2 className="admin-title">Fuentes configuradas</h2>
          <Link className="btn-secondary btn-sm" href="/admin/scraping/fuentes">
            Administrar fuentes
          </Link>
        </div>
        <table className="table-admin">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>URL base</th>
              <th>Estado</th>
              <th>Activa</th>
              <th>Última ejecución</th>
              <th>Items</th>
            </tr>
          </thead>
          <tbody>
            {fuentes.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-news-500">
                  Todavía no cargaste ninguna fuente. Empezá creando una en «Fuentes».
                </td>
              </tr>
            )}
            {fuentes.map((fuente) => (
              <tr key={fuente.id}>
                <td className="font-medium text-brand-900">{fuente.name}</td>
                <td className="max-w-[280px] truncate text-news-500">{fuente.baseUrl}</td>
                <td>
                  <span className={fuente.status === 'OK' ? 'badge-green' : fuente.status === 'ERROR' ? 'badge-red' : 'badge-gray'}>
                    {fuente.status}
                  </span>
                </td>
                <td>{fuente.isActive ? <span className="badge-blue">Sí</span> : <span className="badge-gray">No</span>}</td>
                <td>{fuente.lastRunAt ? tiempoRelativo(fuente.lastRunAt) : '—'}</td>
                <td>{fuente._count.items}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Últimos jobs */}
        <section className="admin-card overflow-x-auto">
          <div className="admin-card-header">
            <h2 className="admin-title">Últimas ejecuciones</h2>
          </div>
          <table className="table-admin">
            <thead>
              <tr>
                <th>Fuente</th>
                <th>Estado</th>
                <th>Nuevas</th>
                <th>Fallidas</th>
                <th>Inicio</th>
              </tr>
            </thead>
            <tbody>
              {jobsRecientes.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-news-500">
                    Sin ejecuciones registradas.
                  </td>
                </tr>
              )}
              {jobsRecientes.map((job) => (
                <tr key={job.id}>
                  <td>{job.source.name}</td>
                  <td>
                    <span className={ESTADO_JOB_BADGE[job.status] ?? 'badge-gray'}>{job.status}</span>
                  </td>
                  <td className="text-emerald-700">{job.itemsCreated}</td>
                  <td className="text-red-600">{job.itemsFailed}</td>
                  <td>{tiempoRelativo(job.startedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Cola pendiente */}
        <section className="admin-card">
          <div className="admin-card-header">
            <h2 className="admin-title">Cola de items pendientes</h2>
            <Link className="btn-ghost btn-sm" href="/admin/scraping/cola">
              Ver toda
            </Link>
          </div>
          <ul className="space-y-2">
            {itemsPendientes.length === 0 && <li className="text-sm text-news-500">No hay items esperando revisión.</li>}
            {itemsPendientes.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 border-b border-news-100 pb-2 last:border-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-brand-900">{item.title}</p>
                  <p className="text-xs text-news-500">{item.source.name}</p>
                </div>
                <span className={PRIORIDAD_BADGE[item.priority] ?? 'badge-gray'}>{item.priority}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Notas pendientes de revisión */}
      <section className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-title">Notas pendientes de revisión</h2>
          <Link className="btn-ghost btn-sm" href="/admin/scraping/cola">
            Ir a la bandeja
          </Link>
        </div>
        <ul className="space-y-2">
          {notasPendientes.length === 0 && (
            <li className="flex items-center gap-2 text-sm text-news-500">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              No hay notas esperando revisión.
            </li>
          )}
          {notasPendientes.map((nota) => (
            <li key={nota.id} className="flex items-start justify-between gap-3 border-b border-news-100 pb-2 last:border-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-brand-900">{nota.title}</p>
                <p className="text-xs text-news-500">
                  {nota.category.name}
                  {nota.sourceName ? ` · ${nota.sourceName}` : ''} · {tiempoRelativo(nota.createdAt)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={PRIORIDAD_BADGE[nota.priority] ?? 'badge-gray'}>{nota.priority}</span>
                <Link className="btn-secondary btn-sm" href={`/admin/noticias/${nota.id}`}>
                  Revisar
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <p className="flex items-center gap-2 text-xs text-news-500">
        <Activity className="h-3.5 w-3.5" />
        El scraping respeta robots.txt, incluye delays entre pedidos y nunca sobrecarga los sitios de origen.
      </p>
    </div>
  );
}
