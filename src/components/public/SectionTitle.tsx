import Link from 'next/link';
import { cn } from '@/lib/utils';

interface SectionTitleProps {
  title: string;
  href?: string;
  linkLabel?: string;
  className?: string;
}

/** Encabezado de seccion con barra azul a la izquierda y link "Ver todas". */
export function SectionTitle({ title, href, linkLabel = 'Ver todas', className }: SectionTitleProps) {
  return (
    <div className={cn('mb-4 flex items-center justify-between gap-3 border-b border-news-200 pb-2', className)}>
      <h2 className="flex items-center gap-2 font-editorial text-lg font-bold text-brand-900 sm:text-xl">
        <span className="inline-block h-5 w-1.5 rounded-full bg-brand-800" aria-hidden="true" />
        {title}
      </h2>
      {href ? (
        <Link
          href={href}
          className="shrink-0 text-xs font-semibold uppercase tracking-wide text-brand-600 transition hover:text-brand-800"
        >
          {linkLabel} →
        </Link>
      ) : null}
    </div>
  );
}
