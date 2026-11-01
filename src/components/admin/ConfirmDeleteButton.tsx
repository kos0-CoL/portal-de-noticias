'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Botón de borrado con confirmación nativa.
 * Hace DELETE a la URL recibida y refresca la vista (o redirige si se indica).
 */

export interface ConfirmDeleteButtonProps {
  url: string;
  label?: string;
  confirmText?: string;
  /** Si se indica, tras borrar navega a esta ruta en lugar de refrescar. */
  redirectTo?: string;
  className?: string;
  /** Oculta el texto y deja solo el icono (útil en tablas compactas). */
  iconOnly?: boolean;
}

export function ConfirmDeleteButton({
  url,
  label = 'Eliminar',
  confirmText = '¿Confirmás que querés eliminar este elemento? Esta acción no se puede deshacer.',
  redirectTo,
  className,
  iconOnly = false
}: ConfirmDeleteButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (loading) return;
    if (!window.confirm(confirmText)) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, { method: 'DELETE' });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(data?.error ?? 'No se pudo eliminar el elemento.');
      }
      if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado al eliminar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        title={error ?? label}
        className={cn('btn-danger btn-sm', className)}
        aria-label={label}
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        {iconOnly ? null : <span>{label}</span>}
      </button>
      {error ? <span className="text-[11px] font-medium text-red-600">{error}</span> : null}
    </span>
  );
}

export default ConfirmDeleteButton;
