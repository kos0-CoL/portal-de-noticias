'use client';

import { useState, useEffect, useCallback } from 'react';
import { Mail, Trash2, RefreshCw, Loader2, AlertCircle, CheckCircle2, Send } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface SuscriptorDTO {
  id: string;
  email: string;
  name: string | null;
  status: 'ACTIVO' | 'DADO_DE_BAJA';
  source: string;
  createdAt: string;
}

interface PageData {
  items: SuscriptorDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export default function AdminNewsletterPage() {
  const router = useRouter();
  const [data, setData] = useState<PageData | null>(null);
  const [cargando, setCargando] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<'ACTIVO' | 'DADO_DE_BAJA' | ''>('');
  const [busqueda, setBusqueda] = useState('');
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  // Estado del formulario de envío de boletín
  const [campoTitulo, setCampoTitulo] = useState('');
  const [campoAsunto, setCampoAsunto] = useState('');
  const [enviarAhora, setEnviarAhora] = useState(false);
  const [enviandoCampaña, setEnviandoCampaña] = useState(false);
  const [mensajeCampaña, setMensajeCampaña] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    const params = new URLSearchParams({
      page: '1',
      pageSize: '50',
      ...(filtroEstado ? { status: filtroEstado } : {}),
      ...(busqueda ? { q: busqueda } : {})
    });
    try {
      const res = await fetch(`/api/admin/newsletter?${params}`);
      const datos = (await res.json()) as PageData;
      if (res.ok) setData(datos);
      else setMensaje({ tipo: 'error', texto: 'No se pudo cargar el listado.' });
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo contactar al servidor.' });
    } finally {
      setCargando(false);
    }
  }, [filtroEstado, busqueda]);

  async function manejarEnvioCampaña(e: React.FormEvent) {
    e.preventDefault();
    setMensajeCampaña(null);
    setEnviandoCampaña(true);

    try {
      const res = await fetch('/api/admin/newsletter/campañas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: campoTitulo.trim() || 'Resumen diario',
          asunto: campoAsunto.trim() || 'Resumen diario de Saladillo Noticias',
          tipo: 'resumen_diario',
          enviarAhora,
        }),
      });

      const datos = await res.json();

      if (!res.ok) {
        setMensajeCampaña({ tipo: 'error', texto: datos.error ?? 'No se pudo enviar el boletín.' });
        return;
      }

      setMensajeCampaña({
        tipo: 'ok',
        texto: enviarAhora
          ? `Boletín enviado a ${datos.totalSuscriptores ?? 0} suscriptor(es).`
          : 'Borrador creado. Podés enviarlo cuando quieras.',
      });
      setCampoTitulo('');
      setCampoAsunto('');
      setEnviarAhora(false);
    } catch {
      setMensajeCampaña({ tipo: 'error', texto: 'Error inesperado al enviar el boletín.' });
    } finally {
      setEnviandoCampaña(false);
    }
  }

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function eliminar(id: string) {
    if (!window.confirm('¿Dar de baja y eliminar este suscriptor del boletín?')) return;
    setEliminando(id);
    setMensaje(null);
    try {
      const res = await fetch(`/api/admin/newsletter/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setMensaje({ tipo: 'ok', texto: 'Suscriptor eliminado.' });
        router.refresh();
      } else {
        setMensaje({ tipo: 'error', texto: 'No se pudo eliminar el suscriptor.' });
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error inesperado.' });
    } finally {
      setEliminando(null);
    }
  }

  const estadoLabel = (s: string) => (s === 'ACTIVO' ? 'Activo' : 'Dado de baja');
  const estadoClase = (s: string) => (s === 'ACTIVO' ? 'badge-green' : 'badge-red');

  return (
    <div className="space-y-6">
      <header>
        <p className="kicker text-brand-600">Panel</p>
        <h1 className="admin-title flex items-center gap-2 text-xl">
          <Mail className="h-5 w-5 text-brand-700" aria-hidden />
          Boletín de noticias
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-news-500">
          Gestión de suscriptores al newsletter. Los lectores se suscriben desde el portal y podés dar de baja a
          cualquier contacto desde acá.
        </p>
      </header>

      {mensaje && (
        <p className={`text-sm font-semibold ${mensaje.tipo === 'ok' ? 'text-emerald-700' : 'text-accent-500'}`}>
          {mensaje.texto}
        </p>
      )}

      {/* Filtros y búsqueda */}
      <section className="admin-card">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 w-64">
            <Mail className="absolute left-3 top-3 h-4 w-4 text-news-400" aria-hidden />
            <input
              type="text"
              placeholder="Buscar por email..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="block w-full pl-9 pr-3 py-2 rounded border border-news-300 bg-white text-sm text-news-800 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
            />
          </div>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as any)}
            className="block w-auto py-2 rounded border border-news-300 bg-white text-sm text-news-800 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
          >
            <option value="">Todos los estados</option>
            <option value="ACTIVO">Activos</option>
            <option value="DADO_DE_BAJA">Dados de baja</option>
          </select>
          <button
            type="button"
            onClick={cargar}
            disabled={cargando}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {cargando ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden />
            )}
            Refrescar
          </button>
        </div>
      </section>

      {/* Listado */}
      <section className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-title">Suscriptores</h2>
          <span className="text-xs text-news-500">{data?.total ?? 0} registro(s)</span>
        </div>

        {cargando || !data ? (
          <div className="p-8 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-brand-600 mx-auto" aria-hidden />
            <p className="mt-2 text-sm text-news-500">Cargando...</p>
          </div>
        ) : data.items.length === 0 ? (
          <p className="p-8 text-center text-sm text-news-500">
            No se encontraron suscriptores con los filtros aplicados.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-admin min-w-full">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Nombre</th>
                  <th>Estado</th>
                  <th>Fuente</th>
                  <th className="whitespace-nowrap">Fecha alta</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((s) => (
                  <tr key={s.id}>
                    <td className="font-semibold text-brand-900 truncate max-w-[240px]">
                      {s.email}
                    </td>
                    <td className="text-sm text-news-700">{s.name ?? '—'}</td>
                    <td>
                      <span className={estadoClase(s.status)}>{estadoLabel(s.status)}</span>
                    </td>
                    <td className="text-xs text-news-500">{s.source}</td>
                    <td className="whitespace-nowrap text-xs text-news-500">
                      {new Date(s.createdAt).toLocaleDateString('es-AR')}
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        className="btn-ghost btn-sm text-accent-500"
                        disabled={eliminando === s.id}
                        onClick={() => eliminar(s.id)}
                      >
                        {eliminando === s.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Envío de boletín */}
      <section className="admin-card rounded-lg border border-news-200 bg-white p-6">
        <div className="flex items-start gap-3 mb-4">
          <Mail className="h-5 w-5 text-brand-600 mt-0.5" aria-hidden />
          <div>
            <h2 className="text-sm font-bold text-brand-900">Enviar boletín</h2>
            <p className="text-xs text-news-500 mt-1">
              Crea y envía una campaña de resumen diario a todos los suscriptores activos.
            </p>
          </div>
        </div>

        <form onSubmit={manejarEnvioCampaña} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-news-700 mb-1">Título</label>
              <input
                type="text"
                value={campoTitulo}
                onChange={(e) => setCampoTitulo(e.target.value)}
                placeholder="Resumen diario - 31 de octubre de 2026"
                className="block w-full pl-3 pr-3 py-2 rounded border border-news-300 bg-white text-sm text-news-800 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-news-700 mb-1">Asunto</label>
              <input
                type="text"
                value={campoAsunto}
                onChange={(e) => setCampoAsunto(e.target.value)}
                placeholder="Resumen diario de Saladillo"
                className="block w-full pl-3 pr-3 py-2 rounded border border-news-300 bg-white text-sm text-news-800 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={enviarAhora}
              onChange={(e) => setEnviarAhora(e.target.checked)}
              className="rounded border-news-300 text-brand-600 focus:ring-brand-500"
            />
            <label className="text-sm text-news-700 cursor-pointer">
              Enviar ahora a {data?.total ?? 0} suscriptor(es) activo(s)
            </label>
          </div>

          <button
            type="submit"
            disabled={enviandoCampaña}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {enviandoCampaña ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Send className="h-4 w-4" aria-hidden />
            )}
            {enviandoCampaña ? 'Enviando...' : 'Enviar boletín'}
          </button>

          {mensajeCampaña && (
            <p className={`text-sm font-semibold ${mensajeCampaña.tipo === 'ok' ? 'text-emerald-700' : 'text-accent-500'}`}>
              {mensajeCampaña.texto}
            </p>
          )}
        </form>
      </section>

      {/* Guía rápida */}
      <section className="admin-card rounded-lg border border-news-200 bg-news-50 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" aria-hidden />
          <div>
            <p className="text-sm font-bold text-brand-900">Cómo se usa el boletín</p>
            <ol className="mt-1 list-decimal space-y-1 pl-4 text-xs text-news-600">
              <li>
                Los lectores se suscriben desde el formulario en el pie de página del portal.
              </li>
              <li>
                Cada nuevo suscriptor queda como <strong>ACTIVO</strong> y se guarda en la tabla
                <code className="rounded bg-white px-1">newsletter_subscribers</code>.
              </li>
              <li>
                Para enviar un boletín, usá el formulario <strong>Enviar boletín</strong> de arriba. Se genera
                automáticamente un resumen con las notas publicadas en las últimas 24 horas y se envía a todos
                los suscriptores activos.
              </li>
              <li>
                Configurá las variables de entorno <code className="rounded bg-white px-1">SMTP_HOST</code>,
                <code className="rounded bg-white px-1">SMTP_PORT</code>, <code className="rounded bg-white px-1">SMTP_USER</code> y
                <code className="rounded bg-white px-1">SMTP_PASS</code> para enviar emails reales. Sin ellas, el envío
                se hace en modo desarrollo (solo se imprime en consola).
              </li>
              <li>
                Si un lector pide la baja, eliminalo desde el listado o marcalo como <strong>DADO_DE_BAJA</strong>.
              </li>
            </ol>
          </div>
        </div>
      </section>
    </div>
  );
}
