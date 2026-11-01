import Link from 'next/link';
import { categoryUrl } from '@/lib/seo';
import { cn } from '@/lib/utils';

interface CategoryBadgeProps {
  name: string;
  slug: string;
  color?: string | null;
  /** Si es false se renderiza solo el chip, sin link. */
  asLink?: boolean;
  className?: string;
}

/** Chip con el nombre y el color de la categoria. */
export function CategoryBadge({ name, slug, color, asLink = true, className }: CategoryBadgeProps) {
  const colorSeguro = color && /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : '#122A4D';

  const chip = (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide',
        className
      )}
      style={{ color: colorSeguro, borderColor: colorSeguro, backgroundColor: `${colorSeguro}14` }}
    >
      {name}
    </span>
  );

  if (!asLink) return chip;

  return (
    <Link href={categoryUrl(slug)} className="inline-flex transition hover:opacity-80">
      {chip}
    </Link>
  );
}
