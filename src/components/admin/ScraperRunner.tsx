'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Loader2, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Resultados que devuelve el endpoint /api/scraping/ejecutar. */
interface RunResult {
  jobId: string;
  sourceName: string;
  found: number;
  created: number;
  skipped: number;
  failed: number;
  log: string[];
}

export interface ScraperRunnerProps {
  fuentes: { id: string; name: string; isActive: boolean }[];
  defaultAll?: boolean;
}

/**
 * Botón de ejecución del scraper con estado de carga y panel de resultados.
 * Al terminar muestra el log completo para que el administrador vea qué pasó.
 */
export default function ScraperRunner({ fuentes, defaultAll = true }: ScraperRunnerProps) {
  const router = useRouter();
  const [todas, setTodas] = useState(defaultAll);
  const [sourceId, setSourceId] = useState(fuentes[0]?.id ?? '');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultados, setResultados] = useState<RunResult[] | null>(null);

  async function ejecutar() {
    setCargando(true);
    setError(null);
    setResultados(null);
    try {
      const respuesta = await fetch('/api/scraping/ejecutar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(todas ? { all: true } : { sourceId })
      });
      const data = (await respuesta.json()) as { ok: boolean; results?: RunResult[]; error?: string };
      if (!respuesta.ok || !data.ok) {
        setError(data.error ?? 'No se pudo ejecutar el scraping.');
        return;
      }
      setResultados(data.results ?? []);
      router.refresh();
    } catch {
      setError('Hubo un problema de conexión al ejecutar el scraping.');
    } finally {
      setCargando(false);
    }
  }

  const puedeEjecutar = !cargando && (todas || Boolean(sourceId));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 text-sm font-medium text-news-700">
          <input
            type="checkbox"
            className="checkbox"
            checked={todas}
            onChange={(evento) => setTodas(evento.target.checked)}
          />
          Ejecutar todas las fuentes
        </label>

        {!todas && (
          <select
            className="select max-w-xs"
            value={sourceId}
            onChange={(evento) => setSourceId(evento.target.value)}
          >
            {fuentes.length === 0 && <option value="">No hay fuentes cargadas</option>}
            {fuentes.map((fuente) => (
              <option key={fuente.id} value={fuente.id}>
                {fuente.name}
                {fuente.isActive ? '' : ' (inactiva)'}
              </option>
            ))}
          </select>
        )}

        <button type="button" className="btn-primary" onClick={ejecutar} disabled={!puedeEjecutar}>
          {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {cargando ? 'Ejecutando…' : 'Ejecutar scraping'}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {resultados && resultados.length === 0 && (
        <p className="text-sm text-news-500">No hay fuentes activas para ejecutar.</p>
      )}

      {resultados && resultados.length > 0 && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {resultados.map((resultado) => (
              <div key={resultado.jobId || resultado.sourceName} className="rounded-lg border border-news-200 bg-news-50 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-semibold text-brand-900">{resultado.sourceName}</span>
                  {resultado.failed > 0 ? (
                    <span className={cn('badge', resultado.created > 0 ? 'badge-amber' : 'badge-red')}>
                      {resultado.created > 0 ? 'Parcial' : 'Error'}
                    </span>
                  ) : (
                    <span className="badge-green">OK</span>
                  )}
                </div>
                <dl className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div>
                    <dt className="text-news-500">Encontradas</dt>
                    <dd className="text-base font-bold text-brand-800">{resultado.found}</dd>
                  </div>
                  <div>
                    <dt className="text-news-500">Nuevas</dt>
                    <dd className="text-base font-bold text-emerald-700">{resultado.created}</dd>
                  </div>
                  <div>
                    <dt className="text-news-500">Omitidas</dt>
                    <dd className="text-base font-bold text-news-600">{resultado.skipped}</dd>
                  </div>
                  <div>
                    <dt className="text-news-500">Fallidas</dt>
                    <dd className="text-base font-bold text-red-600">{resultado.failed}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>

          <div>
            <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-news-700">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Registro de la ejecución
            </p>
            <pre className="max-h-80 overflow-auto rounded-lg bg-brand-950 p-4 font-mono text-[12px] leading-relaxed text-brand-100">
              {resultados.map((resultado) => resultado.log.join('\n')).join('\n\n')}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
