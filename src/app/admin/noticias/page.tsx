import Link from 'next/link';
import { FilePlus2, Pencil, Search, Plus } from 'lucide-react';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { formatFechaCorta } from '@/lib/utils';
import { PRIORITY_BADGE, StatusBadge } from '@/components/admin/StatusBadge';
import { ConfirmDeleteButton } from '@/components/admin/ConfirmDeleteButton';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Noticias | Panel de administración'
};

const PAGE_SIZE = 20;

type SearchParams = { [key: string]: string | string[] | undefined };

function single(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value && value.length > 0 ? value : undefined;
}

function buildPageHref(base: Record<string, string | undefined>, page: number): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(base)) {
    if (value) params.set(key, value);
  }
  params.set('pagina', String(page));
  return `/admin/noticias?${params.toString()}`;
}

/** Listado y CRUD de noticias con filtros por querystring y paginación server-side. */
export default async function AdminNoticiasPage({ searchParams }: { searchParams: SearchParams }) {
  const estado = single(searchParams.estado);
  const categoria = single(searchParams.categoria);
  const prioridad = single(searchParams.prioridad);
  const q = single(searchParams.q);
  const pageParam = Number(single(searchParams.pagina) ?? '1');
  const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;

  const where: Prisma.ArticleWhereInput = {};
  if (estado) where.status = estado as Prisma.ArticleWhereInput['status'];
  if (categoria) where.categoryId = categoria;
  if (prioridad) where.priority = prioridad as Prisma.ArticleWhereInput['priority'];
  if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { summary: { contains: q, mode: 'insensitive' } },
      { slug: { contains: q, mode: 'insensitive' } }
    ];
  }

  const [total, articles, categories] = await Promise.all([
    prisma.article.count({ where }),
    prisma.article.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { category: true, author: true }
    }),
    prisma.category.findMany({ orderBy: { position: 'asc' }, select: { id: true, name: true } })
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filters = { estado, categoria, prioridad, q };

  return (
    <div className="space-y-6">
      <div className="admin-card">
        <div className="admin-card-header">
          <div>
            <h2 className="admin-title">Noticias</h2>
            <p className="mt-0.5 text-xs text-news-500">{total} resultado(s)</p>
          </div>
          <Link href="/admin/noticias/nueva" className="btn-primary btn-sm">
            <FilePlus2 className="h-4 w-4" />
            Nueva noticia
          </Link>
        </div>

        {/* Filtros */}
        <form method="get" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label htmlFor="q" className="label">
              Buscar
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-news-400" />
              <input
                id="q"
                name="q"
                defaultValue={q ?? ''}
                placeholder="Título, copete o slug…"
                className="input pl-9"
              />
            </div>
          </div>

          <div>
            <label htmlFor="estado" className="label">
              Estado
            </label>
            <select id="estado" name="estado" defaultValue={estado ?? ''} className="select">
              <option value="">Todos</option>
              <option value="DRAFT">Borrador</option>
              <option value="PENDING_REVIEW">Pendiente de revisión</option>
              <option value="PUBLISHED">Publicada</option>
              <option value="ARCHIVED">Archivada</option>
            </select>
          </div>

          <div>
            <label htmlFor="prioridad" className="label">
              Prioridad
            </label>
            <select id="prioridad" name="prioridad" defaultValue={prioridad ?? ''} className="select">
              <option value="">Todas</option>
              <option value="NORMAL">Normal</option>
              <option value="ALTA">Prioridad Alta</option>
              <option value="URGENTE">Urgente</option>
            </select>
          </div>

          <div>
            <label htmlFor="categoria" className="label">
              Categoría
            </label>
            <select id="categoria" name="categoria" defaultValue={categoria ?? ''} className="select">
              <option value="">Todas</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2 lg:col-span-3">
            <button type="submit" className="btn-primary btn-sm">
              Aplicar filtros
            </button>
            <Link href="/admin/noticias" className="btn-ghost btn-sm">
              Limpiar
            </Link>
          </div>
        </form>
      </div>

      <div className="admin-card">
        {articles.length === 0 ? (
          <p className="text-sm text-news-500">No se encontraron noticias con esos filtros.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-admin">
              <thead>
                <tr>
                  <th className="w-8">
                    <input type="checkbox" className="checkbox" aria-label="Seleccionar todo" />
                  </th>
                  <th className="w-20">Portada</th>
                  <th>Título</th>
                  <th>Categoría</th>
                  <th>Estado</th>
                  <th>Prioridad</th>
                  <th>Autor</th>
                  <th>Fecha</th>
                  <th>Vistas</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {articles.map((article) => (
                  <tr key={article.id}>
                    <td>
                      <input type="checkbox" className="checkbox" aria-label={`Seleccionar ${article.title}`} />
                    </td>
                    <td>
                      {article.coverImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={article.coverImage}
                          alt={article.coverImageAlt ?? article.title}
                          className="h-12 w-16 rounded object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-16 items-center justify-center rounded bg-news-100 text-[10px] text-news-400">
                          Sin imagen
                        </div>
                      )}
                    </td>
                    <td className="max-w-[320px]">
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
                    <td className="whitespace-nowrap text-xs">{article.author?.name ?? '—'}</td>
                    <td className="whitespace-nowrap text-xs text-news-500">{formatFechaCorta(article.createdAt)}</td>
                    <td className="text-xs">{article.views.toLocaleString('es-AR')}</td>
                    <td>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Link
                          href={`/admin/noticias/${article.id}`}
                          className="btn-secondary btn-sm"
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
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
                        <Link
                          href={`/admin/noticias/nueva?copy=${article.id}`}
                          className="btn-ghost btn-sm"
                          title="Duplicar"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Duplicar
                        </Link>
                        <ConfirmDeleteButton
                          url={`/api/noticias/${article.id}`}
                          label="Eliminar"
                          confirmText={`¿Eliminar la nota "${article.title}"? Esta acción no se puede deshacer.`}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {totalPages > 1 ? (
          <nav className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-news-100 pt-4">
            <p className="text-xs text-news-500">
              Página {page} de {totalPages}
            </p>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link href={buildPageHref(filters, page - 1)} className="btn-secondary btn-sm">
                  Anterior
                </Link>
              ) : null}
              {page < totalPages ? (
                <Link href={buildPageHref(filters, page + 1)} className="btn-secondary btn-sm">
                  Siguiente
                </Link>
              ) : null}
            </div>
          </nav>
        ) : null}
      </div>
    </div>
  );
}
