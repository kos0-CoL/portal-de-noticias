import Link from 'next/link';
import { Zap } from 'lucide-react';
import { articleUrl } from '@/lib/seo';

interface NewsTickerProps {
  items: { title: string; slug: string }[];
}

/**
 * Franja de "ultimo momento". La lista se duplica para que el loop de la
 * animacion (translateX de 0 a -50%) sea continuo y no se note el salto.
 */
export function NewsTicker({ items }: NewsTickerProps) {
  if (!items || items.length === 0) return null;

  const duplicados = [...items, ...items];

  return (
    <div className="flex items-stretch overflow-hidden bg-accent-500 text-white">
      <span className="flex shrink-0 items-center gap-1.5 bg-accent-600 px-3 text-[11px] font-bold uppercase tracking-widest sm:px-4">
        <Zap className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Último momento</span>
        <span className="sm:hidden">Último</span>
      </span>
      <div className="relative flex-1 overflow-hidden" aria-live="off">
        <div className="flex w-max animate-ticker items-center py-2">
          {duplicados.map((item, i) => (
            <Link
              key={`${item.slug}-${i}`}
              href={articleUrl(item.slug)}
              className="whitespace-nowrap px-6 text-sm font-medium hover:underline"
              aria-hidden={i >= items.length}
              tabIndex={i >= items.length ? -1 : undefined}
            >
              {item.title}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
