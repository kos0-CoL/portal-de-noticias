import Link from 'next/link';
import { Pencil, Trash2 } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { tiempoRelativo } from '@/lib/utils';
import ScraperRunner from '@/components/admin/ScraperRunner';
import SourceForm, { type FuenteInicial } from '@/components/admin/SourceForm';

export const dynamic = 'force-dynamic';

const ESTADO_BADGE: Record<string, string> = {
  IDLE: 'badge-gray',
  RUNNING: 'badge-blue',
  OK: 'badge-green',
  ERROR: 'badge-red'
};

interface PageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

/** CRUD de fuentes de scraping. */
export default async function FuentesPage({ searchParams }: PageProps) {
  const editarId = typeof searchParams.editar === 'string' ? searchParams.editar : undefined;

  const [fuentes, categorias, fuenteEditar] = await Promise.all([
    prisma.source.findMany({
      orderBy: { createdAt: 'desc' },
      include: { mappings: true, _count: { select: { items: true } } }
    }),
    prisma.category.findMany({ orderBy: { position: 'asc' }, select: { id: true, name: true } }),
    editarId
      ? prisma.source.findUnique({ where: { id: editarId }, include: { mappings: true } })
      : Promise.resolve(null)
  ]);

  const inicial: FuenteInicial | null = fuenteEditar
    ? {
        id: fuenteEditar.id,
        name: fuenteEditar.name,
        baseUrl: fuenteEditar.baseUrl,
        isActive: fuenteEditar.isActive,
        rotateUserAgent: fuenteEditar.rotateUserAgent,
        requestDelayMs: fuenteEditar.requestDelayMs,
        maxItemsPerRun: fuenteEditar.maxItemsPerRun,
        respectRobots: fuenteEditar.respectRobots,
        usePuppeteer: fuenteEditar.usePuppeteer,
        useAiExtraction: fuenteEditar.useAiExtraction,
        crawlSelector: fuenteEditar.crawlSelector,
        articleSelector: fuenteEditar.articleSelector,
        titleSelector: fuenteEditar.titleSelector,
        imageSelector: fuenteEditar.imageSelector,
        scheduleCron: fuenteEditar.scheduleCron,
        mappings: fuenteEditar.mappings.map((m) => ({
          id: m.id,
          externalCategoryName: m.externalCategoryName,
          externalCategoryUrl: m.externalCategoryUrl,
          localCategoryId: m.localCategoryId
        }))
      }
    : null;

  return (
    <div className="container-news space-y-6 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-editorial text-2xl font-bold text-brand-900">Fuentes de scraping</h1>
          <p className="text-sm text-news-500">
            Configurá de dónde se extraen las noticias, cómo se leen y cada cuánto se ejecutan.
          </p>
        </div>
        <Link className="btn-ghost btn-sm" href="/admin/scraping">
          Volver al panel
        </Link>
      </header>

      <section className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-title">Ejecutar una fuente</h2>
        </div>
        <ScraperRunner
          defaultAll={false}
          fuentes={fuentes.map((fuente) => ({ id: fuente.id, name: fuente.name, isActive: fuente.isActive }))}
        />
      </section>

      <section className="admin-card overflow-x-auto">
        <div className="admin-card-header">
          <h2 className="admin-title">Fuentes ({fuentes.length})</h2>
        </div>
        <table className="table-admin">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>URL base</th>
              <th>Estado</th>
              <th>Programación</th>
              <th>Última ejecución</th>
              <th>Mapeos</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {fuentes.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-news-500">
                  No hay fuentes cargadas todavía.
                </td>
              </tr>
            )}
            {fuentes.map((fuente) => (
              <tr key={fuente.id}>
                <td>
                  <span className="font-medium text-brand-900">{fuente.name}</span>
                  {!fuente.isActive && <span className="ml-2 badge-gray">Inactiva</span>}
                </td>
                <td className="max-w-[240px] truncate text-news-500">{fuente.baseUrl}</td>
                <td>
                  <span className={ESTADO_BADGE[fuente.status] ?? 'badge-gray'}>{fuente.status}</span>
                </td>
                <td className="text-xs text-news-600">{fuente.scheduleCron ?? 'Manual'}</td>
                <td>{fuente.lastRunAt ? tiempoRelativo(fuente.lastRunAt) : '—'}</td>
                <td>{fuente.mappings.length}</td>
                <td className="text-right">
                  <div className="flex justify-end gap-2">
                    <Link className="btn-secondary btn-sm" href={`/admin/scraping/fuentes?editar=${fuente.id}`}>
                      <Pencil className="h-3.5 w-3.5" />
                      Editar / Ejecutar / Eliminar
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-3">
        <h2 className="font-editorial text-xl font-bold text-brand-900">
          {inicial ? `Editar fuente: ${inicial.name}` : 'Nueva fuente'}
        </h2>
        {inicial && (
          <Link className="btn-ghost btn-sm inline-flex" href="/admin/scraping/fuentes">
            <Trash2 className="h-3.5 w-3.5" />
            Cancelar edición y crear una nueva
          </Link>
        )}
        <SourceForm categorias={categorias} initial={inicial} />
      </section>
    </div>
  );
}
