'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Download, Loader2, Plus, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DiffImportacion } from '@/lib/pharmacy/import';
import type { FarmaciaOpcion } from '@/components/admin/RotationOrderEditor';

/**
 * Vista previa de la importación del organigrama del Colegio.
 *
 * Primero se busca el mes: el servidor descarga, parsea y devuelve el diff sin
 * tocar la base. Recién el botón **Confirmar importación** escribe, y solo los
 * días que quedaron tildados. Los nombres que el Colegio usa y no están
 * cargados se resuelven en el paso de mapeo: se asignan a una farmacia
 * existente o se dan de alta (inactivas) para completarlas después.
 */

interface LogImportacion {
  fecha: string;
  url: string;
  error: string;
}

interface PharmacyImportPreviewProps {
  url: string;
  log: LogImportacion[];
  farmacias: FarmaciaOpcion[];
}

const ETIQUETA_ESTADO: Record<string, string> = {
  igual: 'igual',
  cambia: 'cambia',
  nuevo: 'nuevo',
  'sin-mapear': 'sin mapear'
};

const COLOR_ESTADO: Record<string, string> = {
  igual: 'bg-news-100 text-news-600',
  cambia: 'bg-amber-100 text-amber-800',
  nuevo: 'bg-emerald-100 text-emerald-800',
  'sin-mapear': 'bg-accent-500/10 text-accent-500'
};

const VALOR_CREAR = '__crear__';

function formatearFecha(iso: string): string {
  const [anio, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${anio}`;
}

export default function PharmacyImportPreview({ url, log, farmacias }: PharmacyImportPreviewProps) {
  const router = useRouter();
  const [direccion, setDireccion] = useState(url);
  const [diff, setDiff] = useState<DiffImportacion | null>(null);
  const [seleccion, setSeleccion] = useState<Record<string, boolean>>({});
  const [mapeo, setMapeo] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<'buscar' | 'confirmar' | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  function aplicarSeleccion(diffNuevo: DiffImportacion, mapeoNuevo: Record<string, string>) {
    const siguiente: Record<string, boolean> = {};
    for (const dia of diffNuevo.dias) {
      if (dia.estado === 'nuevo' || dia.estado === 'cambia') siguiente[dia.fecha] = true;
      else if (dia.estado === 'sin-mapear') siguiente[dia.fecha] = Boolean(mapeoNuevo[dia.nombre]);
    }
    setSeleccion(siguiente);
  }

  async function buscar() {
    setOcupado('buscar');
    setMensaje(null);
    try {
      const response = await fetch('/api/admin/farmacias/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: direccion })
      });
      const data = (await response.json()) as { ok: boolean; error?: string; diff?: DiffImportacion };
      if (!response.ok || !data.ok || !data.diff) {
        setDiff(null);
        setMensaje({ tipo: 'error', texto: data.error ?? 'No se pudo leer el organigrama.' });
        router.refresh();
        return;
      }

      const inicial: Record<string, string> = {};
      for (const nombre of data.diff.sinMapear) inicial[nombre.nombre] = nombre.sugerenciaId ?? '';

      setDiff(data.diff);
      setMapeo(inicial);
      aplicarSeleccion(data.diff, inicial);

      const { resumen } = data.diff;
      setMensaje({
        tipo: 'ok',
        texto: `Organigrama leído: ${resumen.total} día(s) · ${resumen.cambian} para cambiar · ${resumen.nuevos} nuevos · ${resumen.sinMapear} sin mapear`
      });
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo contactar al servidor.' });
    } finally {
      setOcupado(null);
    }
  }

  function cambiarMapeo(nombre: string, valor: string) {
    const siguiente = { ...mapeo, [nombre]: valor };
    setMapeo(siguiente);
    if (!diff) return;

    // Los días de ese nombre siguen al mapeo: si quedó resuelto se tildan,
    // y si se volvió a "sin decidir" se destildan.
    const dias = diff.dias.filter((dia) => dia.estado === 'sin-mapear' && dia.nombre === nombre);
    setSeleccion((actual) => {
      const copia = { ...actual };
      for (const dia of dias) copia[dia.fecha] = Boolean(valor);
      return copia;
    });
  }

  function marcarTodasParaCrear() {
    if (!diff) return;
    const siguiente = { ...mapeo };
    for (const nombre of diff.sinMapear) {
      if (!siguiente[nombre.nombre]) siguiente[nombre.nombre] = VALOR_CREAR;
    }
    setMapeo(siguiente);
    aplicarSeleccion(diff, siguiente);
  }

  function alternar(fecha: string) {
    setSeleccion((actual) => ({ ...actual, [fecha]: !actual[fecha] }));
  }

  async function confirmar() {
    if (!diff) return;
    setOcupado('confirmar');
    setMensaje(null);

    const dias = diff.dias
      .filter((dia) => seleccion[dia.fecha])
      .map((dia) => {
        const elegido = dia.estado === 'sin-mapear' ? mapeo[dia.nombre] : '';
        return {
          fecha: dia.fecha,
          nombre: dia.nombre,
          pharmacyId: elegido && elegido !== VALOR_CREAR ? elegido : dia.estado === 'sin-mapear' ? null : dia.pharmacyId
        };
      });

    const crear = diff.sinMapear
      .filter((nombre) => mapeo[nombre.nombre] === VALOR_CREAR)
      .map((nombre) => ({ nombre: nombre.nombre, address: nombre.direccion, phone: nombre.telefono }));

    const mes = `${diff.anio}-${String(diff.mes).padStart(2, '0')}`;

    try {
      const response = await fetch('/api/admin/farmacias/importar/confirmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes, dias, crear })
      });
      const data = (await response.json()) as {
        ok: boolean;
        error?: string;
        aplicados?: number;
        sinMapear?: number;
        creadas?: { name: string }[];
      };
      if (!response.ok || !data.ok) {
        setMensaje({ tipo: 'error', texto: data.error ?? 'La importación falló.' });
        return;
      }

      const detalle = [
        `${data.aplicados ?? 0} día(s) importados`,
        data.creadas?.length ? `${data.creadas.length} farmacia(s) creadas inactivas: ${data.creadas.map((f) => f.name).join(', ')}` : null,
        data.sinMapear ? `${data.sinMapear} día(s) quedaron sin mapear` : null
      ].filter(Boolean);

      setMensaje({ tipo: 'ok', texto: detalle.join(' · ') });
      router.refresh();
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo contactar al servidor.' });
    } finally {
      setOcupado(null);
    }
  }

  const tildados = diff ? diff.dias.filter((dia) => seleccion[dia.fecha]).length : 0;
  const sinDecidir = diff ? diff.sinMapear.filter((nombre) => !mapeo[nombre.nombre]).length : 0;
  const nombrePorId = new Map(farmacias.map((farmacia) => [farmacia.id, farmacia.name]));

  return (
    <div className="space-y-6">
      <section className="admin-card space-y-4">
        <div className="admin-card-header">
          <h2 className="admin-title text-base">Página del Colegio</h2>
          <span className="text-xs text-news-500">Se ignora robots.txt y se usan cabeceras de navegador real.</span>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[20rem] flex-1">
            <label className="label" htmlFor="import-url">
              Dirección del organigrama
            </label>
            <input
              id="import-url"
              className="input w-full"
              type="url"
              value={direccion}
              onChange={(evento) => setDireccion(evento.target.value)}
              placeholder="https://acasaladillo.com.ar/?page_id=3080"
            />
          </div>
          <button type="button" className="btn-primary" onClick={buscar} disabled={ocupado !== null || !direccion.trim()}>
            {ocupado === 'buscar' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
            Buscar organigrama
          </button>
          {diff && (
            <button type="button" className="btn-ghost" onClick={buscar} disabled={ocupado !== null}>
              <RefreshCw className="h-4 w-4" aria-hidden />
              Volver a buscar
            </button>
          )}
        </div>

        <p className="text-xs text-news-500">
          Si el Colegio se muda de página, cambiá la dirección acá y volvé a buscar: queda guardada para la próxima vez.
        </p>

        {log.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50/70 p-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-800">
              <AlertTriangle className="h-4 w-4" aria-hidden />
              Últimas respuestas con error
            </p>
            <ul className="mt-2 space-y-2">
              {log.map((entrada) => (
                <li key={`${entrada.fecha}-${entrada.error.slice(0, 24)}`} className="text-xs text-amber-900">
                  <span className="font-semibold tabular-nums">{new Date(entrada.fecha).toLocaleString('es-AR')}</span> —{' '}
                  {entrada.error}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {diff && (
        <>
          <section className="admin-card space-y-4">
            <div className="admin-card-header">
              <h2 className="admin-title text-base">
                Organigrama de {String(diff.mes).padStart(2, '0')}/{diff.anio}
              </h2>
              <span className="text-xs text-news-500">
                {diff.resumen.iguales} igual(es) · {diff.resumen.cambian} para cambiar · {diff.resumen.nuevos} nuevo(s) ·{' '}
                {diff.resumen.sinMapear} sin mapear
              </span>
            </div>

            {diff.sinMapear.length > 0 && (
              <div className="rounded-md border border-brand-200 bg-brand-50/60 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-brand-900">
                    Nombres del Colegio que no están cargados ({diff.sinMapear.length})
                  </p>
                  <button type="button" className="btn-ghost btn-sm" onClick={marcarTodasParaCrear}>
                    <Plus className="h-4 w-4" aria-hidden />
                    Dar de alta las que no decidí
                  </button>
                </div>
                <p className="mt-1 text-xs text-news-500">
                  Se crean <strong>inactivas</strong> con el nombre del Colegio como alias, para completarlas en Farmacias
                  antes de que aparezcan en el sitio.
                </p>

                <div className="mt-3 space-y-2">
                  {diff.sinMapear.map((nombre) => (
                    <div key={nombre.nombre} className="flex flex-wrap items-center gap-3 rounded-md border border-news-200 bg-white p-2">
                      <div className="min-w-[12rem] flex-1">
                        <p className="text-sm font-semibold text-brand-900">
                          {nombre.nombre} <span className="font-normal text-news-500">· {nombre.dias} día(s)</span>
                        </p>
                        <p className="text-xs text-news-500">
                          {nombre.enDirectorio ? `${nombre.direccion}${nombre.telefono ? ` · ${nombre.telefono}` : ''}` : 'No figura en el directorio de la página'}
                        </p>
                      </div>
                      <select
                        className="input"
                        aria-label={`Mapeo de ${nombre.nombre}`}
                        value={mapeo[nombre.nombre] ?? ''}
                        onChange={(evento) => cambiarMapeo(nombre.nombre, evento.target.value)}
                      >
                        <option value="">Sin decidir (no se importa)</option>
                        <option value={VALOR_CREAR}>Dar de alta «{nombre.nombre}» (inactiva)</option>
                        {farmacias.map((farmacia) => (
                          <option key={farmacia.id} value={farmacia.id}>
                            Asignar a {farmacia.name}
                            {farmacia.isActive ? '' : ' (inactiva)'}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {diff.sinDatos.length > 0 && (
              <div className="rounded-md border border-news-200 bg-news-50 p-3">
                <p className="text-sm font-semibold text-news-700">
                  Días cargados que el Colegio no publica ({diff.sinDatos.length})
                </p>
                <p className="mt-1 text-xs text-news-500">
                  La importación no los toca: quedan como están hasta que los revises a mano en el organigrama.
                </p>
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-news-600">
                  {diff.sinDatos.map((dia) => (
                    <li key={dia.fecha}>
                      {formatearFecha(dia.fecha)} — {dia.pharmacyName}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="max-h-[32rem] overflow-auto rounded-md border border-news-200">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-news-50 text-left text-xs uppercase tracking-wide text-news-500">
                  <tr>
                    <th className="w-10 p-2">
                      <span className="sr-only">Importar</span>
                    </th>
                    <th className="p-2">Día</th>
                    <th className="p-2">Colegio</th>
                    <th className="p-2">Queda</th>
                    <th className="p-2">Hoy tiene</th>
                    <th className="p-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {diff.dias.map((dia) => {
                    const elegido = dia.estado === 'sin-mapear' ? mapeo[dia.nombre] : '';
                    const destino =
                      elegido === VALOR_CREAR
                        ? `«${dia.nombre}» (nueva, inactiva)`
                        : elegido
                          ? nombrePorId.get(elegido) ?? '—'
                          : dia.pharmacyName;

                    return (
                      <tr key={dia.fecha} className={cn('border-t border-news-100', seleccion[dia.fecha] && 'bg-brand-50/40')}>
                        <td className="p-2">
                          <input
                            type="checkbox"
                            className="checkbox"
                            checked={Boolean(seleccion[dia.fecha])}
                            onChange={() => alternar(dia.fecha)}
                            aria-label={`Importar el ${formatearFecha(dia.fecha)}`}
                          />
                        </td>
                        <td className="whitespace-nowrap p-2 tabular-nums text-news-600">{formatearFecha(dia.fecha)}</td>
                        <td className="p-2">
                          <span className="font-semibold text-brand-900">{dia.nombre}</span>
                          <span className="block text-xs text-news-500">{dia.direccion}</span>
                        </td>
                        <td className="p-2 text-news-700">{destino ?? <span className="text-accent-500">sin mapear</span>}</td>
                        <td className="p-2 text-news-500">
                          {dia.actualName ?? '—'}
                          {dia.actualOrigen ? <span className="block text-xs">({dia.actualOrigen.toLowerCase()})</span> : null}
                        </td>
                        <td className="p-2">
                          <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', COLOR_ESTADO[dia.estado])}>
                            {ETIQUETA_ESTADO[dia.estado]}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="btn-primary" onClick={confirmar} disabled={ocupado !== null || tildados === 0}>
                {ocupado === 'confirmar' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                Confirmar importación ({tildados})
              </button>
              <span className="text-xs text-news-500">
                Solo se escriben los días tildados. Los que dejes destildados quedan como están.
              </span>
              {sinDecidir > 0 && (
                <span className="text-xs font-semibold text-accent-500">
                  Quedan {sinDecidir} nombre(s) sin decidir: sus días no se van a importar.
                </span>
              )}
            </div>
          </section>

          <p className="text-xs text-news-500">
            Después de importar podés revisar el mes en{' '}
            <Link className="font-semibold text-brand-700 underline" href={`/admin/farmacias/organigrama?mes=${diff.anio}-${String(diff.mes).padStart(2, '0')}`}>
              el organigrama
            </Link>{' '}
            y corregir cualquier día suelto.
          </p>
        </>
      )}

      {mensaje && (
        <p className={cn('text-sm font-semibold', mensaje.tipo === 'ok' ? 'text-emerald-700' : 'text-accent-500')}>
          {mensaje.texto}
        </p>
      )}
    </div>
  );
}
