'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Copy, Loader2, Trash2, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FarmaciaOpcion } from '@/components/admin/RotationOrderEditor';

/**
 * Calendario editable del organigrama (/admin/farmacias/organigrama).
 *
 * Cada celda es un día del mes. Se pueden seleccionar varios días y pintarlos
 * de una sola vez con la misma farmacia, o dejarlos sin asignar. Los días
 * corregidos a mano se distinguen del resto: son los que la generación
 * respeta.
 */

export interface DiaOrganigrama {
  fecha: string;
  dia: number;
  /** false para los días de los meses vecinos que completan las semanas. */
  delMes: boolean;
  pharmacyId: string | null;
  pharmacyName: string | null;
  note: string | null;
  source: 'MANUAL' | 'ROTACION' | 'IMPORT' | null;
}

interface PharmacyScheduleCalendarProps {
  mes: string;
  titulo: string;
  mesAnterior: string;
  mesSiguiente: string;
  semanas: DiaOrganigrama[][];
  farmacias: FarmaciaOpcion[];
}

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const ETIQUETA_ORIGEN: Record<string, string> = {
  MANUAL: 'a mano',
  ROTACION: 'rotación',
  IMPORT: 'importado'
};

/** Texto del resultado cuando la respuesta no trae números propios. */
const ETIQUETA_ACCION = {
  generar: 'Mes generado',
  copiar: 'Mes copiado',
  limpiar: 'Mes limpiado',
  aplicar: 'Días actualizados'
} as const;

type Accion = keyof typeof ETIQUETA_ACCION;

export default function PharmacyScheduleCalendar({
  mes,
  titulo,
  mesAnterior,
  mesSiguiente,
  semanas,
  farmacias
}: PharmacyScheduleCalendarProps) {
  const router = useRouter();
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [farmacia, setFarmacia] = useState('');
  const [reemplazar, setReemplazar] = useState(false);
  const [ocupado, setOcupado] = useState<Accion | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const activas = farmacias.filter((opcion) => opcion.isActive);
  const conTurno = semanas.flat().filter((dia) => dia.delMes && dia.pharmacyId).length;
  const aMano = semanas.flat().filter((dia) => dia.delMes && dia.source === 'MANUAL').length;

  function alternar(fecha: string) {
    setSeleccion((actual) => (actual.includes(fecha) ? actual.filter((item) => item !== fecha) : [...actual, fecha]));
  }

  async function pedir(url: string, opciones: RequestInit, accion: Accion) {
    setOcupado(accion);
    setMensaje(null);
    try {
      const response = await fetch(url, opciones);
      const data = (await response.json()) as { ok: boolean; error?: string } & Record<string, number>;
      if (!response.ok || !data.ok) {
        setMensaje({ tipo: 'error', texto: data.error ?? 'La operación falló.' });
        return;
      }

      const detalle = [
        data.generados !== undefined ? `${data.generados} día(s) generados` : null,
        data.respetados ? `${data.respetados} respetados a mano` : null,
        data.copiados !== undefined ? `${data.copiados} día(s) copiados` : null,
        data.sinCopiar ? `${data.sinCopiar} sin equivalente en el mes anterior` : null,
        data.aplicados !== undefined ? `${data.aplicados} día(s) actualizados` : null,
        data.borrados !== undefined ? `${data.borrados} turno(s) borrados` : null
      ].filter(Boolean);

      setMensaje({ tipo: 'ok', texto: detalle.length ? detalle.join(' · ') : ETIQUETA_ACCION[accion] });
      setSeleccion([]);
      router.refresh();
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo contactar al servidor.' });
    } finally {
      setOcupado(null);
    }
  }

  function generar() {
    if (typeof window !== 'undefined' && reemplazar && !window.confirm('Se van a reemplazar también los días corregidos a mano. ¿Seguir?')) {
      return;
    }
    void pedir(
      '/api/admin/farmacias/organigrama',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes, modo: reemplazar ? 'reemplazar-todo' : 'respetar-manual' })
      },
      'generar'
    );
  }

  function copiarAnterior() {
    void pedir(
      '/api/admin/farmacias/organigrama',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes, modo: 'copiar-anterior' })
      },
      'copiar'
    );
  }

  function limpiar() {
    if (typeof window !== 'undefined' && !window.confirm(`¿Borrar todos los turnos de ${titulo}?`)) return;
    void pedir(`/api/admin/farmacias/organigrama?mes=${mes}`, { method: 'DELETE' }, 'limpiar');
  }

  function aplicar() {
    if (seleccion.length === 0) return;
    void pedir(
      '/api/admin/farmacias/organigrama',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cambios: seleccion.map((fecha) => ({ date: fecha, pharmacyId: farmacia || null }))
        })
      },
      'aplicar'
    );
  }

  return (
    <section className="admin-card space-y-4">
      <div className="admin-card-header">
        <div className="flex items-center gap-2">
          <Link className="btn-ghost btn-sm" href={`/admin/farmacias/organigrama?mes=${mesAnterior}`} aria-label="Mes anterior">
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Link>
          <h2 className="admin-title min-w-[10rem] text-center">{titulo}</h2>
          <Link className="btn-ghost btn-sm" href={`/admin/farmacias/organigrama?mes=${mesSiguiente}`} aria-label="Mes siguiente">
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        <span className="text-xs text-news-500">
          {conTurno} día(s) con turno · {aMano} corregido(s) a mano
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" onClick={generar} disabled={ocupado !== null}>
          {ocupado === 'generar' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Wand2 className="h-4 w-4" aria-hidden />}
          Generar mes
        </button>
        <button type="button" className="btn-ghost" onClick={copiarAnterior} disabled={ocupado !== null}>
          <Copy className="h-4 w-4" aria-hidden />
          Copiar mes anterior
        </button>
        <button type="button" className="btn-ghost text-accent-500" onClick={limpiar} disabled={ocupado !== null}>
          <Trash2 className="h-4 w-4" aria-hidden />
          Limpiar mes
        </button>
        <label className="flex items-center gap-2 text-sm text-news-700">
          <input
            type="checkbox"
            className="checkbox"
            checked={reemplazar}
            onChange={(evento) => setReemplazar(evento.target.checked)}
          />
          Reemplazar también los días corregidos a mano
        </label>
      </div>

      {seleccion.length > 0 && (
        <div className="flex flex-wrap items-end gap-3 rounded-md border border-brand-200 bg-brand-50/60 p-3">
          <div>
            <label className="label" htmlFor="cal-farmacia">
              Pintar {seleccion.length} día(s) con
            </label>
            <select id="cal-farmacia" className="input" value={farmacia} onChange={(evento) => setFarmacia(evento.target.value)}>
              <option value="">Sin asignar (quitar el turno)</option>
              {activas.map((opcion) => (
                <option key={opcion.id} value={opcion.id}>
                  {opcion.name}
                </option>
              ))}
            </select>
          </div>
          <button type="button" className="btn-primary" onClick={aplicar} disabled={ocupado !== null}>
            {ocupado === 'aplicar' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Aplicar
          </button>
          <button type="button" className="btn-ghost" onClick={() => setSeleccion([])}>
            Cancelar selección
          </button>
        </div>
      )}

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase tracking-wide text-news-500">
        {DIAS_SEMANA.map((dia) => (
          <span key={dia} className="py-1">
            {dia}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {semanas.flat().map((dia) => {
          const elegido = seleccion.includes(dia.fecha);
          const color =
            dia.source === 'MANUAL'
              ? 'border-amber-300 bg-amber-50'
              : dia.source === 'IMPORT'
                ? 'border-sky-200 bg-sky-50'
                : dia.pharmacyId
                  ? 'border-news-200 bg-white'
                  : 'border-dashed border-news-200 bg-news-50';

          return (
            <button
              key={dia.fecha}
              type="button"
              disabled={!dia.delMes}
              onClick={() => alternar(dia.fecha)}
              aria-pressed={elegido}
              title={dia.fecha}
              className={cn(
                'flex min-h-[76px] flex-col gap-1 rounded-md border p-1.5 text-left align-top',
                dia.delMes ? color : 'border-transparent bg-transparent opacity-40',
                dia.delMes && 'hover:border-brand-400',
                elegido && 'ring-2 ring-brand-500 ring-offset-1'
              )}
            >
              <span className="text-xs font-bold tabular-nums text-news-500">{dia.dia}</span>
              {dia.pharmacyId ? (
                <span className="text-xs font-semibold leading-tight text-brand-900">{dia.pharmacyName}</span>
              ) : (
                <span className="text-[11px] leading-tight text-news-400">sin asignar</span>
              )}
              {dia.source && dia.delMes ? (
                <span className="mt-auto text-[10px] uppercase tracking-wide text-news-400">{ETIQUETA_ORIGEN[dia.source]}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-news-500">
        Hacé clic en los días para seleccionarlos y pintarlos todos juntos. Los días con turno corregido a mano quedan
        marcados y la generación no los toca, salvo que destildes la opción de arriba.
      </p>

      {mensaje && (
        <p className={cn('text-sm font-semibold', mensaje.tipo === 'ok' ? 'text-emerald-700' : 'text-accent-500')}>
          {mensaje.texto}
        </p>
      )}
    </section>
  );
}
