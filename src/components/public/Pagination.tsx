import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  /** Ruta base sin query string, ej. "/categoria/politica". */
  basePath: string;
  /** Otros parametros de query a preservar (ej. { q: 'saladillo' }). */
  params?: Record<string, string | undefined>;
}

/** Paginacion simple con links ?page=N. */
export function Pagination({ currentPage, totalPages, basePath, params }: PaginationProps) {
  if (totalPages <= 1) return null;

  function hrefFor(page: number): string {
    const sp = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v) sp.set(k, v);
      }
    }
    if (page > 1) sp.set('page', String(page));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  // Ventana de paginas alrededor de la actual.
  const inicio = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const fin = Math.min(totalPages, inicio + 4);
  const paginas: number[] = [];
  for (let p = inicio; p <= fin; p++) paginas.push(p);

  const linkBase =
    'inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-3 text-sm font-semibold transition';

  return (
    <nav aria-label="Paginación" className="mt-8 flex items-center justify-center gap-1.5">
      {currentPage > 1 ? (
        <Link href={hrefFor(currentPage - 1)} className={cn(linkBase, 'border-news-300 bg-white text-brand-800 hover:border-brand-300 hover:bg-brand-50')} aria-label="Página anterior">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </Link>
      ) : (
        <span className={cn(linkBase, 'cursor-not-allowed border-news-200 bg-news-100 text-news-400')} aria-disabled="true">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </span>
      )}

      {paginas[0] > 1 ? <span className="px-1 text-news-500">…</span> : null}

      {paginas.map((p) =>
        p === currentPage ? (
          <span key={p} aria-current="page" className={cn(linkBase, 'border-brand-800 bg-brand-800 text-white')}>
            {p}
          </span>
        ) : (
          <Link key={p} href={hrefFor(p)} className={cn(linkBase, 'border-news-300 bg-white text-brand-800 hover:border-brand-300 hover:bg-brand-50')}>
            {p}
          </Link>
        )
      )}

      {fin < totalPages ? <span className="px-1 text-news-500">…</span> : null}

      {currentPage < totalPages ? (
        <Link href={hrefFor(currentPage + 1)} className={cn(linkBase, 'border-news-300 bg-white text-brand-800 hover:border-brand-300 hover:bg-brand-50')} aria-label="Página siguiente">
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      ) : (
        <span className={cn(linkBase, 'cursor-not-allowed border-news-200 bg-news-100 text-news-400')} aria-disabled="true">
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </span>
      )}
    </nav>
  );
}
