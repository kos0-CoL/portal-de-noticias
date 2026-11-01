import Image from 'next/image';
import Link from 'next/link';
import type { Article, Category, Tag } from '@prisma/client';
import { articleUrl } from '@/lib/seo';
import { cn, tiempoRelativo } from '@/lib/utils';
import { CategoryBadge } from '@/components/public/CategoryBadge';

export type ArticleCardData = Article & {
  category: Category;
  tags?: Tag[];
};

export type ArticleCardVariant = 'hero' | 'standard' | 'compact' | 'list';

interface ArticleCardProps {
  article: ArticleCardData;
  variant?: ArticleCardVariant;
  className?: string;
}

/** Badge rojo "ÚLTIMO MOMENTO" o ámbar "PRIORIDAD ALTA" según la nota. */
function PriorityBadges({ article }: { article: ArticleCardData }) {
  if (article.priority === 'URGENTE' || article.isBreaking) {
    return (
      <span className="badge bg-accent-500 text-white">
        <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden="true" />
        Último momento
      </span>
    );
  }
  if (article.priority === 'ALTA') {
    return <span className="badge-amber">Prioridad alta</span>;
  }
  return null;
}

/** Línea de metadatos: tiempo relativo, minutos de lectura y fuente. */
function MetaLine({ article, className }: { article: ArticleCardData; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-news-500', className)}>
      <time dateTime={article.publishedAt ? new Date(article.publishedAt).toISOString() : undefined}>
        {article.publishedAt ? tiempoRelativo(article.publishedAt) : 'Sin fecha'}
      </time>
      <span aria-hidden="true">·</span>
      <span>{article.readingTime} min de lectura</span>
      {article.sourceName ? (
        <>
          <span aria-hidden="true">·</span>
          <span className="truncate">Fuente: {article.sourceName}</span>
        </>
      ) : null}
    </div>
  );
}

/** Portada con next/image; placeholder gris si la nota no tiene imagen. */
function Cover({
  article,
  sizes,
  className,
  priority = false
}: {
  article: ArticleCardData;
  sizes: string;
  className?: string;
  priority?: boolean;
}) {
  if (!article.coverImage) {
    return <div className={cn('bg-news-200', className)} aria-hidden="true" />;
  }
  return (
    <div className={cn('relative overflow-hidden bg-news-200', className)}>
      <Image
        src={article.coverImage}
        alt={article.coverImageAlt || article.title}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover transition duration-300 group-hover:scale-105"
      />
    </div>
  );
}

/** Tarjeta de nota reutilizable en cuatro formatos. */
export function ArticleCard({ article, variant = 'standard', className }: ArticleCardProps) {
  const href = articleUrl(article.slug);

  if (variant === 'hero') {
    return (
      <article className={cn('group news-card', className)}>
        <Link href={href} className="block">
          <Cover article={article} sizes="(max-width: 768px) 100vw, (max-width: 1200px) 66vw, 760px" className="aspect-[16/9] w-full" priority />
        </Link>
        <div className="news-card-body">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadges article={article} />
            <CategoryBadge name={article.category.name} slug={article.category.slug} color={article.category.color} asLink={false} />
          </div>
          <h2 className="headline-xl">
            <Link href={href} className="link-underline inline">
              {article.title}
            </Link>
          </h2>
          {article.summary ? (
            <p className="line-clamp-3-custom text-sm leading-relaxed text-news-600 sm:text-base">{article.summary}</p>
          ) : null}
          <MetaLine article={article} className="mt-auto pt-1" />
        </div>
      </article>
    );
  }

  if (variant === 'compact') {
    return (
      <article className={cn('group flex gap-3', className)}>
        <Link href={href} className="shrink-0" aria-hidden="true" tabIndex={-1}>
          <Cover article={article} sizes="112px" className="h-20 w-24 rounded-md sm:h-[72px] sm:w-28" />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <CategoryBadge name={article.category.name} slug={article.category.slug} color={article.category.color} asLink={false} className="!px-2 !py-0 !text-[10px]" />
            <PriorityBadges article={article} />
          </div>
          <h3 className="headline-sm">
            <Link href={href} className="link-underline inline">
              {article.title}
            </Link>
          </h3>
          <MetaLine article={article} />
        </div>
      </article>
    );
  }

  if (variant === 'list') {
    return (
      <article className={cn('group news-card flex-row', className)}>
        <Link href={href} className="relative block w-28 shrink-0 sm:w-52" aria-hidden="true" tabIndex={-1}>
          <Cover article={article} sizes="(max-width: 640px) 112px, 208px" className="h-full w-full" />
        </Link>
        <div className="news-card-body min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <CategoryBadge name={article.category.name} slug={article.category.slug} color={article.category.color} asLink={false} />
            <PriorityBadges article={article} />
          </div>
          <h2 className="headline-md sm:text-lg">
            <Link href={href} className="link-underline inline">
              {article.title}
            </Link>
          </h2>
          {article.summary ? (
            <p className="line-clamp-2-custom text-sm leading-relaxed text-news-600">{article.summary}</p>
          ) : null}
          <MetaLine article={article} className="mt-auto pt-1" />
        </div>
      </article>
    );
  }

  // Variante "standard" por defecto.
  return (
    <article className={cn('group news-card', className)}>
      <Link href={href} className="block">
        <Cover article={article} sizes="(max-width: 768px) 100vw, 33vw" className="aspect-[16/10] w-full" />
      </Link>
      <div className="news-card-body">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryBadge name={article.category.name} slug={article.category.slug} color={article.category.color} asLink={false} />
          <PriorityBadges article={article} />
        </div>
        <h3 className="headline-md">
          <Link href={href} className="link-underline inline">
            {article.title}
          </Link>
        </h3>
        {article.summary ? (
          <p className="line-clamp-2-custom text-sm leading-relaxed text-news-600">{article.summary}</p>
        ) : null}
        <MetaLine article={article} className="mt-auto pt-1" />
      </div>
    </article>
  );
}
