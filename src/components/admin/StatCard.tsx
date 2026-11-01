import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Tarjeta de métrica del dashboard. Server-safe (sin hooks).
 */

type Tone = 'brand' | 'green' | 'amber' | 'red';

const TONE_CLASSES: Record<Tone, string> = {
  brand: 'bg-brand-100 text-brand-800',
  green: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-700'
};

export interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: ReactNode;
  tone?: Tone;
}

export function StatCard({ label, value, hint, icon, tone = 'brand' }: StatCardProps) {
  return (
    <div className="admin-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-news-500">{label}</p>
          <p className="mt-1 font-editorial text-2xl font-bold leading-none text-brand-900">{value}</p>
          {hint ? <p className="mt-1.5 text-xs text-news-500">{hint}</p> : null}
        </div>
        {icon ? (
          <span
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
              TONE_CLASSES[tone]
            )}
            aria-hidden="true"
          >
            {icon}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default StatCard;
