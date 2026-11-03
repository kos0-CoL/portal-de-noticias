'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';

/**
 * Exporta el organigrama del mes como PNG (historia 1080×1350 o post 1080×1080).
 * Si el storage devuelve una URL, se abre en una pestaña; si no, se descarga el
 * PNG que llega en base64.
 */

type Formato = 'historia' | 'post';

export default function OrganigramaExportButton({ mes }: { mes: string }) {
  const [cargando, setCargando] = useState<Formato | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function exportar(formato: Formato) {
    setError(null);
    setCargando(formato);

    try {
      const res = await fetch('/api/admin/farmacias/organigrama/imagen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes, formato })
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ?? 'No se pudo generar la imagen.');
      }

      if (data.url) {
        window.open(data.url as string, '_blank', 'noopener');
        return;
      }

      const binario = atob(data.base64 as string);
      const bytes = new Uint8Array(binario.length);
      for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i);

      const blob = new Blob([bytes], { type: 'image/png' });
      const enlace = document.createElement('a');
      enlace.href = URL.createObjectURL(blob);
      enlace.download = (data.filename as string) ?? `organigrama-${mes}.png`;
      enlace.click();
      URL.revokeObjectURL(enlace.href);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al generar la imagen.');
    } finally {
      setCargando(null);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-ghost btn-sm"
          onClick={() => exportar('historia')}
          disabled={cargando !== null}
        >
          <Download className="h-3.5 w-3.5" aria-hidden />
          {cargando === 'historia' ? 'Generando…' : 'Historia 1080×1350'}
        </button>
        <button type="button" className="btn-ghost btn-sm" onClick={() => exportar('post')} disabled={cargando !== null}>
          <Download className="h-3.5 w-3.5" aria-hidden />
          {cargando === 'post' ? 'Generando…' : 'Post 1080×1080'}
        </button>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
