import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { ExternalLink, Eye, Filter } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { tiempoRelativo, stripHtml } from '@/lib/utils';
import { discardScrapedItem } from '@/lib/scraper/pipeline';
import { highlightMatches } from '@/lib/scraper/keywords';
import ScrapedItemReview from '@/components/admin/ScrapedItemReview';

export const dynamic = 'force-dynamic';

const PRIORIDAD_BADGE: Record<string, string> = {
  NORMAL: 'badge-gray',
  ALTA: 'badge-amber',
  URGENTE: 'badge-red'
};

interface PageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

/** Lee un único valor de searchParams (ignora los repetidos). */
function primerValor(valor: string | string[] | undefined): string | undefined {
  if (Array.isArray(valor)) return valor[0];
  return valor;
}

/** Server action para descartar un item de la cola. */
async function descartarItem(formData: FormData) {
  'use server';
  const id = String(formData.get('id') ?? '');
  if (id) {
    await discardScrapedItem(id);
  }
  revalidatePath('/admin/scraping/cola');
}

/** Bandeja de revisión: notas traídas por el scraper listas para aprobar. */
export default async function ColaPage({ searchParams }: PageProps) {
  const prioridadParam = primerValor(searchParams.prioridad);
  const fuenteParam = primerValor(searchParams.fuente);
  const prioridad = prioridadParam && prioridadParam !== 'TODAS' ? prioridadParam : undefined;
  const fuenteId = fuenteParam && fuenteParam !== 'TODAS' ? fuenteParam : undefined;
  const itemId = primerValor(searchParams.item);

  const fuentes = await prisma.source.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } });
  const fuenteSeleccionada = fuenteId ? fuentes.find((f) => f.id === fuenteId) ?? null : null;

  const [notas, items, itemDetalle] = await Promise.all([
    prisma.article.findMany({
      where: {
        status: 'PENDING_REVIEW',
        ...(prioridad ? { priority: prioridad as 'NORMAL' | 'ALTA' | 'URGENTE' } : {}),
        ...(fuenteSeleccionada ? { sourceName: fuenteSeleccionada.name } : {})
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      take: 50,
      include: { category: true, scrapedItem: true }
    }),
    prisma.scrapedItem.findMany({
      where: {
        status: 'PENDING',
        ...(prioridad ? { priority: prioridad as 'NORMAL' | 'ALTA' | 'URGENTE' } : {}),
        ...(fuenteId ? { sourceId: fuenteId } : {})
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      take: 50,
      include: { source: true, article: true }
    }),
    itemId
      ? prisma.scrapedItem.findUnique({
          where: { id: itemId },
          include: { source: true, article: { include: { category: true } } }
        })
      : Promise.resolve(null)
  ]);

  const htmlDestacado = itemDetalle
    ? highlightMatches(stripHtml(itemDetalle.rawContent ?? ''), itemDetalle.matchedKeywords)
    : '';

  return (
    <div className="container-news space-y-6 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-editorial text-2xl font-bold text-brand-900">Bandeja de revisión</h1>
          <p className="text-sm text-news-500">
            Todo lo que trajo el scraper esperando tu aprobación antes de publicarse.
          </p>
        </div>
        <Link className="btn-ghost btn-sm" href="/admin/scraping">
          Volver al panel
        </Link>
      </header>

      {/* Filtros */}
      <form className="admin-card flex flex-wrap items-end gap-3" method="get">
        <div>
          <label className="label" htmlFor="f-prioridad">Prioridad</label>
          <select id="f-prioridad" name="prioridad" className="select" defaultValue={searchParams.prioridad ?? 'TODAS'}>
            <option value="TODAS">Todas</option>
            <option value="URGENTE">Urgente</option>
            <option value="ALTA">Prioridad alta</option>
            <option value="NORMAL">Normal</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="f-fuente">Fuente</label>
          <select id="f-fuente" name="fuente" className="select" defaultValue={searchParams.fuente ?? 'TODAS'}>
            <option value="TODAS">Todas</option>
            {fuentes.map((fuente) => (
              <option key={fuente.id} value={fuente.id}>
                {fuente.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-secondary">
          <Filter className="h-4 w-4" />
          Filtrar
        </button>
      </form>

      {/* Diff lado a lado */}
      {itemDetalle && (
        <section className="space-y-3">
          <div className="admin-card-header">
            <h2 className="admin-title">Revisión de la nota</h2>
            <Link className="btn-ghost btn-sm" href="/admin/scraping/cola">
              Cerrar
            </Link>
          </div>
          <ScrapedItemReview
            itemId={itemDetalle.id}
            articleId={itemDetalle.article?.id ?? null}
            titulo={itemDetalle.title}
            fuente={itemDetalle.source.name}
            urlOriginal={itemDetalle.url}
            htmlDestacado={htmlDestacado}
            categoriaLocal={itemDetalle.article?.category.name ?? itemDetalle.externalCategory}
            prioridad={itemDetalle.priority}
            coincidencias={itemDetalle.matchedKeywords}
          />
        </section>
      )}

      {/* Notas pendientes */}
      <section className="admin-card overflow-x-auto">
        <div className="admin-card-header">
          <h2 className="admin-title">Notas pendientes de revisión ({notas.length})</h2>
          <span className="text-xs text-news-500">Las de prioridad alta aparecen primero.</span>
        </div>
        <table className="table-admin">
          <thead>
            <tr>
              <th>Prioridad</th>
              <th>Título</th>
              <th>Fuente</th>
              <th>Categoría</th>
              <th>Palabras locales</th>
              <th>Capturada</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {notas.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-news-500">
                  No hay notas pendientes de revisión con estos filtros.
                </td>
              </tr>
            )}
            {notas.map((nota) => (
              <tr key={nota.id}>
                <td>
                  <span className={PRIORIDAD_BADGE[nota.priority] ?? 'badge-gray'}>{nota.priority}</span>
                </td>
                <td className="max-w-[320px]">
                  <span className="font-medium text-brand-900">{nota.title}</span>
                </td>
                <td className="text-news-600">{nota.sourceName ?? '—'}</td>
                <td>{nota.category.name}</td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {(nota.scrapedItem?.matchedKeywords ?? []).slice(0, 4).map((palabra) => (
                      <span key={palabra} className="badge-amber">
                        {palabra}
                      </span>
                    ))}
                    {(nota.scrapedItem?.matchedKeywords ?? []).length === 0 && (
                      <span className="text-xs text-news-400">—</span>
                    )}
                  </div>
                </td>
                <td className="text-xs text-news-600">{tiempoRelativo(nota.createdAt)}</td>
                <td className="text-right">
                  <div className="flex justify-end gap-2">
                    {nota.scrapedItem && (
                      <Link className="btn-secondary btn-sm" href={`/admin/scraping/cola?item=${nota.scrapedItem.id}`}>
                        <Eye className="h-3.5 w-3.5" />
                        Ver diff
                      </Link>
                    )}
                    <Link className="btn-primary btn-sm" href={`/admin/noticias/${nota.id}`}>
                      Revisar
                    </Link>
                    {nota.sourceUrl && (
                      <a
                        className="btn-ghost btn-sm"
                        href={nota.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Original
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Items en cola */}
      <section className="admin-card overflow-x-auto">
        <div className="admin-card-header">
          <h2 className="admin-title">Items en cola ({items.length})</h2>
          <span className="text-xs text-news-500">Extraídos y esperando procesamiento.</span>
        </div>
        <table className="table-admin">
          <thead>
            <tr>
              <th>Prioridad</th>
              <th>Título</th>
              <th>Fuente</th>
              <th>Categoría destino</th>
              <th>Palabras locales</th>
              <th>Capturado</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-news-500">
                  No hay items en cola con estos filtros.
                </td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <span className={PRIORIDAD_BADGE[item.priority] ?? 'badge-gray'}>{item.priority}</span>
                </td>
                <td className="max-w-[320px]">
                  <span className="font-medium text-brand-900">{item.title}</span>
                </td>
                <td className="text-news-600">{item.source.name}</td>
                <td>{item.externalCategory ?? '—'}</td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {item.matchedKeywords.slice(0, 4).map((palabra) => (
                      <span key={palabra} className="badge-amber">
                        {palabra}
                      </span>
                    ))}
                    {item.matchedKeywords.length === 0 && <span className="text-xs text-news-400">—</span>}
                  </div>
                </td>
                <td className="text-xs text-news-600">{tiempoRelativo(item.createdAt)}</td>
                <td className="text-right">
                  <div className="flex justify-end gap-2">
                    <Link className="btn-secondary btn-sm" href={`/admin/scraping/cola?item=${item.id}`}>
                      <Eye className="h-3.5 w-3.5" />
                      Revisar
                    </Link>
                    <a
                      className="btn-ghost btn-sm"
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Original
                    </a>
                    <form action={descartarItem}>
                      <input type="hidden" name="id" value={item.id} />
                      <button type="submit" className="btn-ghost btn-sm text-red-600">
                        Descartar
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
