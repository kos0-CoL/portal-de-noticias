import { ESTADO_LABELS, PRIORIDAD_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';

/**
 * Badge de estado reutilizable en todo el backoffice.
 * Es "server-safe": no usa hooks, por lo que se puede renderizar tanto en
 * Server Components como dentro de componentes cliente.
 */

interface BadgeMeta {
  label: string;
  className: string;
}

/**
 * Estados posibles de las distintas entidades del panel:
 * Artículo (DRAFT/PENDING_REVIEW/PUBLISHED/ARCHIVED),
 * Clasificado (PENDING/PUBLISHED/REJECTED/EXPIRED),
 * Item scrapeado (PENDING/PROCESSED/DISCARDED/ERROR),
 * Post social (PENDING/SENT/ERROR/SKIPPED),
 * Job de scraping (QUEUED/RUNNING/SUCCESS/PARTIAL/ERROR),
 * Fuente (IDLE/RUNNING/OK/ERROR).
 */
const STATUS_META: Record<string, BadgeMeta> = {
  // Artículos
  DRAFT: { label: ESTADO_LABELS.DRAFT, className: 'badge-gray' },
  PENDING_REVIEW: { label: ESTADO_LABELS.PENDING_REVIEW, className: 'badge-amber' },
  PUBLISHED: { label: ESTADO_LABELS.PUBLISHED, className: 'badge-green' },
  ARCHIVED: { label: ESTADO_LABELS.ARCHIVED, className: 'badge-gray' },
  // Clasificados y estados compartidos
  PENDING: { label: 'Pendiente', className: 'badge-amber' },
  REJECTED: { label: 'Rechazado', className: 'badge-red' },
  EXPIRED: { label: 'Expirado', className: 'badge-gray' },
  // Items scrapeados
  PROCESSED: { label: 'Procesado', className: 'badge-blue' },
  DISCARDED: { label: 'Descartado', className: 'badge-gray' },
  // Redes sociales
  SENT: { label: 'Enviado', className: 'badge-green' },
  SKIPPED: { label: 'Omitido', className: 'badge-gray' },
  // Comentarios
  APPROVED: { label: 'Aprobado', className: 'badge-green' },
  SPAM: { label: 'Spam', className: 'badge-red' },
  // Jobs de scraping
  QUEUED: { label: 'En cola', className: 'badge-gray' },
  RUNNING: { label: 'En ejecución', className: 'badge-blue' },
  SUCCESS: { label: 'Completado', className: 'badge-green' },
  PARTIAL: { label: 'Parcial', className: 'badge-amber' },
  // Fuentes
  OK: { label: 'OK', className: 'badge-green' },
  IDLE: { label: 'Inactivo', className: 'badge-gray' },
  // Error compartido
  ERROR: { label: 'Error', className: 'badge-red' }
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const meta = STATUS_META[status] ?? { label: status, className: 'badge-gray' };
  return <span className={cn(meta.className, className)}>{meta.label}</span>;
}

const PRIORITY_META: Record<string, BadgeMeta> = {
  NORMAL: { label: PRIORIDAD_LABELS.NORMAL, className: 'badge-gray' },
  ALTA: { label: PRIORIDAD_LABELS.ALTA, className: 'badge-amber' },
  URGENTE: { label: PRIORIDAD_LABELS.URGENTE, className: 'badge-red' }
};

/** Badge de prioridad: NORMAL (gris), ALTA (ámbar) y URGENTE (rojo). */
export function PRIORITY_BADGE({ priority, className }: { priority: string; className?: string }) {
  const meta = PRIORITY_META[priority] ?? { label: priority, className: 'badge-gray' };
  return <span className={cn(meta.className, className)}>{meta.label}</span>;
}

/** Alias en camelCase por comodidad de uso en JSX. */
export const PriorityBadge = PRIORITY_BADGE;

export default StatusBadge;
