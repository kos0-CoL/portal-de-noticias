'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowDown, ArrowUp, ChevronDown, Loader2, Plus, Save, X } from 'lucide-react';
import { proximosDias } from '@/lib/pharmacy/rotation';
import { fechaUtc } from '@/lib/pharmacy/schedule';
import { cn } from '@/lib/utils';

/**
 * Editor del ciclo de rotación (/admin/farmacias/organigrama).
 *
 * El ciclo es una lista de farmacias con repeticiones: el turno de una fecha es
 * `orden[(días desde el ancla) mod largo]`. La vista previa de los próximos 20
 * días se calcula con la misma función pura que usa la generación, así que si
 * acá se ve bien, el mes va a salir bien.
 */

export interface FarmaciaOpcion {
  id: string;
  name: string;
  isActive: boolean;
}

interface RotationOrderEditorProps {
  farmacias: FarmaciaOpcion[];
  orden: string[];
  ancla: string | null;
  /** Hoy en Saladillo, "YYYY-MM-DD". Lo fija el servidor para que la vista previa no dependa del navegador. */
  desde: string;
}

/** "2026-11-05" → "05/11". */
function diaMes(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

export default function RotationOrderEditor({ farmacias, orden, ancla, desde }: RotationOrderEditorProps) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(orden.length === 0);
  const [ciclo, setCiclo] = useState<string[]>(orden);
  const [referencia, setReferencia] = useState(ancla ?? '');
  const [aAgregar, setAAgregar] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const porId = useMemo(() => new Map(farmacias.map((farmacia) => [farmacia.id, farmacia])), [farmacias]);
  const activas = farmacias.filter((farmacia) => farmacia.isActive);

  const preview = useMemo(() => {
    const utilizables = ciclo.filter((id) => porId.get(id)?.isActive);
    return proximosDias(fechaUtc(desde), 20, { orden: utilizables, ancla: referencia || null });
  }, [ciclo, referencia, desde, porId]);

  const inactivasEnCiclo = ciclo.filter((id) => porId.has(id) && !porId.get(id)!.isActive);

  function agregar() {
    const id = aAgregar || activas[0]?.id;
    if (!id) return;
    setCiclo([...ciclo, id]);
    setAAgregar('');
  }

  function mover(indice: number, salto: number) {
    const destino = indice + salto;
    if (destino < 0 || destino >= ciclo.length) return;
    const copia = [...ciclo];
    [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
    setCiclo(copia);
  }

  function quitar(indice: number) {
    setCiclo(ciclo.filter((_, posicion) => posicion !== indice));
  }

  async function guardar() {
    setGuardando(true);
    setMensaje(null);
    try {
      const response = await fetch('/api/admin/farmacias/organigrama', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orden: ciclo, ancla: referencia || null })
      });
      const data = (await response.json()) as { ok: boolean; error?: string };

      if (!response.ok || !data.ok) {
        setMensaje({ tipo: 'error', texto: data.error ?? 'No se pudo guardar el ciclo.' });
        return;
      }

      setMensaje({ tipo: 'ok', texto: 'Ciclo guardado.' });
      router.refresh();
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo contactar al servidor.' });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="admin-card">
      <div className="admin-card-header">
        <button
          type="button"
          className="flex items-center gap-2 text-left"
          aria-expanded={abierto}
          onClick={() => setAbierto(!abierto)}
        >
          <ChevronDown className={cn('h-4 w-4 text-news-500 transition-transform', !abierto && '-rotate-90')} aria-hidden />
          <h2 className="admin-title">Ciclo de rotación</h2>
          <span className="badge-gray">{ciclo.length} posiciones</span>
        </button>
        <span className="text-xs text-news-500">
          {referencia ? `Referencia: ${diaMes(referencia)}/${referencia.slice(0, 4)}` : 'Sin fecha de referencia'}
        </span>
      </div>

      {abierto && (
        <div className="space-y-5">
          <p className="text-sm text-news-500">
            El turno de cada día sale de recorrer esta lista en orden y volver a empezar. Se permiten repeticiones: en el
            organigrama real ORIANDA aparece dos veces por ciclo.
          </p>

          <div>
            <span className="label">Orden del ciclo</span>
            {ciclo.length === 0 ? (
              <p className="text-sm text-news-500">El ciclo está vacío. Agregá al menos una farmacia.</p>
            ) : (
              <ol className="flex flex-wrap gap-2">
                {ciclo.map((id, indice) => {
                  const farmacia = porId.get(id);
                  return (
                    <li key={`${id}-${indice}`} className="flex items-center gap-1 rounded-md border border-news-200 bg-white px-2 py-1">
                      <span className="w-5 text-center text-xs font-bold tabular-nums text-news-400">{indice + 1}</span>
                      <span className={cn('text-sm font-medium', farmacia?.isActive ? 'text-brand-900' : 'text-news-400 line-through')}>
                        {farmacia?.name ?? 'Farmacia borrada'}
                      </span>
                      <button
                        type="button"
                        className="btn-ghost btn-sm px-1"
                        title="Subir"
                        disabled={indice === 0}
                        onClick={() => mover(indice, -1)}
                      >
                        <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="btn-ghost btn-sm px-1"
                        title="Bajar"
                        disabled={indice === ciclo.length - 1}
                        onClick={() => mover(indice, 1)}
                      >
                        <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="btn-ghost btn-sm px-1 text-accent-500"
                        title="Quitar del ciclo"
                        onClick={() => quitar(indice)}
                      >
                        <X className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}

            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div>
                <label className="label" htmlFor="rot-farmacia">
                  Agregar farmacia
                </label>
                <select
                  id="rot-farmacia"
                  className="input"
                  value={aAgregar}
                  onChange={(evento) => setAAgregar(evento.target.value)}
                >
                  <option value="">Elegí una farmacia…</option>
                  {activas.map((farmacia) => (
                    <option key={farmacia.id} value={farmacia.id}>
                      {farmacia.name}
                    </option>
                  ))}
                </select>
              </div>
              <button type="button" className="btn-ghost" onClick={agregar} disabled={activas.length === 0}>
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Agregar al final
              </button>
            </div>
            {activas.length === 0 && (
              <p className="mt-2 flex items-center gap-2 text-xs text-accent-500">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                No hay farmacias activas. Cargalas en <a className="underline" href="/admin/farmacias">Farmacias</a> antes de
                armar el ciclo.
              </p>
            )}
          </div>

          <div>
            <label className="label" htmlFor="rot-ancla">
              Fecha de referencia (le toca a la primera de la lista)
            </label>
            <input
              id="rot-ancla"
              type="date"
              className="input max-w-xs"
              value={referencia}
              onChange={(evento) => setReferencia(evento.target.value)}
            />
            <p className="mt-1 text-xs text-news-500">
              Es el día en que arranca el ciclo. Conviene sacarla del organigrama del Colegio para que coincida.
            </p>
          </div>

          {inactivasEnCiclo.length > 0 && (
            <p className="flex items-center gap-2 text-sm text-accent-500">
              <AlertTriangle className="h-4 w-4" aria-hidden />
              Hay farmacias inactivas en el ciclo: no se pueden guardar así. Activálas o quitalas del ciclo.
            </p>
          )}

          <div>
            <span className="label">Vista previa de los próximos 20 días</span>
            {preview.length === 0 ? (
              <p className="text-sm text-news-500">Falta el ciclo o la fecha de referencia para poder previsualizar.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3 lg:grid-cols-4">
                {preview.map((dia) => (
                  <li key={dia.fechaISO} className="flex items-baseline gap-2 border-b border-dashed border-news-100 py-1 text-sm">
                    <span className="tabular-nums text-news-500">{diaMes(dia.fechaISO)}</span>
                    <span className="font-medium text-brand-900">{porId.get(dia.pharmacyId)?.name ?? '—'}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn-primary" onClick={guardar} disabled={guardando || inactivasEnCiclo.length > 0}>
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
              Guardar ciclo
            </button>
            {mensaje && (
              <span className={cn('text-sm font-semibold', mensaje.tipo === 'ok' ? 'text-emerald-700' : 'text-accent-500')}>
                {mensaje.texto}
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
