'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Loader2, Send, Sparkles, Save } from 'lucide-react';
import { TONALIDADES } from '@/lib/constants';

export interface ScrapedItemReviewProps {
  itemId: string;
  articleId: string | null;
  titulo: string;
  fuente: string | null;
  urlOriginal: string;
  /** Contenido original del scraper con las palabras clave ya resaltadas. */
  htmlDestacado: string;
  categoriaLocal: string | null;
  prioridad: string;
  coincidencias: string[];
}

/** Extrae el contenido reescrito de respuestas que pueden venir con formas distintas. */
function extraerContenido(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const candidatos = [
    d.content,
    (d.article as Record<string, unknown> | undefined)?.content,
    (d.result as Record<string, unknown> | undefined)?.content,
    d.html,
    d.texto
  ];
  for (const candidato of candidatos) {
    if (typeof candidato === 'string' && candidato.trim()) return candidato;
  }
  return null;
}

const REDES = ['Facebook', 'Instagram', 'Telegram', 'X', 'WhatsApp'];

/**
 * Revisión lado a lado: a la izquierda el original del scraper, a la derecha las
 * acciones (reescribir con IA, guardar borrador y publicar).
 */
export default function ScrapedItemReview({
  itemId,
  articleId,
  titulo,
  fuente,
  urlOriginal,
  htmlDestacado,
  categoriaLocal,
  prioridad,
  coincidencias
}: ScrapedItemReviewProps) {
  const router = useRouter();

  const [tonalidad, setTonalidad] = useState<string>('CERCANO_LOCAL');
  const [citarFuente, setCitarFuente] = useState(true);
  const [reescribiendo, setReescribiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [descartando, setDescartando] = useState(false);
  const [resultadoIa, setResultadoIa] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [publicado, setPublicado] = useState(false);

  async function reescribir() {
    if (!articleId) {
      setError('Este item todavía no tiene un artículo asociado.');
      return;
    }
    setReescribiendo(true);
    setError(null);
    setMensaje(null);
    try {
      const respuesta = await fetch('/api/ia/reescribir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId, tonality: tonalidad, citeSource: citarFuente, save: true })
      });
      const data = (await respuesta.json()) as unknown;
      if (!respuesta.ok) {
        setError('No se pudo reescribir la nota con IA.');
        return;
      }
      const contenido = extraerContenido(data);
      setResultadoIa(contenido ?? '<p class="text-news-500">La IA devolvió una respuesta sin contenido reconocible.</p>');
      setMensaje('Reescritura generada. Revisá el resultado antes de publicar.');
      router.refresh();
    } catch {
      setError('Hubo un problema de conexión al llamar a la IA.');
    } finally {
      setReescribiendo(false);
    }
  }

  async function guardarBorrador() {
    if (!articleId) {
      setError('Este item todavía no tiene un artículo asociado.');
      return;
    }
    setGuardando(true);
    setError(null);
    setMensaje(null);
    try {
      const respuesta = await fetch(`/api/noticias/${articleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PENDING_REVIEW' })
      });
      if (!respuesta.ok) {
        setError('No se pudo guardar el borrador.');
        return;
      }
      setMensaje('Borrador guardado.');
      router.refresh();
    } catch {
      setError('Hubo un problema de conexión al guardar el borrador.');
    } finally {
      setGuardando(false);
    }
  }

  async function publicar() {
    if (!articleId) {
      setError('Este item todavía no tiene un artículo asociado.');
      return;
    }
    setPublicando(true);
    setError(null);
    setMensaje(null);
    try {
      const respuesta = await fetch(`/api/noticias/${articleId}/publicar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (!respuesta.ok) {
        setError('No se pudo publicar la nota.');
        return;
      }
      setPublicado(true);
      setMensaje('Nota publicada.');
      router.refresh();
    } catch {
      setError('Hubo un problema de conexión al publicar.');
    } finally {
      setPublicando(false);
    }
  }

  async function descartar() {
    if (!window.confirm('¿Descartar este item de la cola?')) return;
    setDescartando(true);
    try {
      await fetch(`/api/scraping/cola/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DISCARDED' })
      });
      router.refresh();
      router.push('/admin/scraping/cola');
    } finally {
      setDescartando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-news-600">
        <span className="badge-blue">{categoriaLocal ?? 'Sin categoría'}</span>
        <span className="badge-gray">{prioridad}</span>
        {fuente && <span>Fuente: {fuente}</span>}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Contenido original */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h3 className="admin-title">Contenido original del scraper</h3>
            <a className="btn-ghost btn-sm" href={urlOriginal} target="_blank" rel="noopener noreferrer">
              Ver original
            </a>
          </div>
          <p className="mb-3 font-editorial text-lg font-bold text-brand-900">{titulo}</p>
          {coincidencias.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {coincidencias.map((palabra) => (
                <span key={palabra} className="badge-amber">
                  {palabra}
                </span>
              ))}
            </div>
          )}
          <div
            className="article-body max-h-[520px] overflow-auto rounded-md bg-news-50 p-3 text-sm"
            dangerouslySetInnerHTML={{ __html: htmlDestacado }}
          />
        </div>

        {/* Acciones */}
        <div className="admin-card space-y-4">
          <h3 className="admin-title">Acciones de edición</h3>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {mensaje && (
            <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{mensaje}</span>
            </div>
          )}

          <div>
            <label className="label" htmlFor="rev-tono">Tono de la reescritura</label>
            <select id="rev-tono" className="select" value={tonalidad} onChange={(evento) => setTonalidad(evento.target.value)}>
              {TONALIDADES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-news-700">
            <input
              type="checkbox"
              className="checkbox"
              checked={citarFuente}
              onChange={(evento) => setCitarFuente(evento.target.checked)}
            />
            Citar la fuente original
          </label>

          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={reescribir} disabled={reescribiendo || !articleId}>
              {reescribiendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {reescribiendo ? 'Reescribiendo…' : 'Reescribir con IA'}
            </button>
            <button type="button" className="btn-secondary" onClick={guardarBorrador} disabled={guardando || !articleId}>
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar borrador
            </button>
            <button type="button" className="btn-secondary" onClick={descartar} disabled={descartando}>
              Descartar
            </button>
          </div>

          {resultadoIa && (
            <div>
              <p className="mb-1.5 text-sm font-semibold text-news-700">Resultado de la IA</p>
              <div
                className="article-body max-h-72 overflow-auto rounded-md border border-news-200 bg-white p-3 text-sm"
                dangerouslySetInnerHTML={{ __html: resultadoIa }}
              />
            </div>
          )}

          <div className="border-t border-news-200 pt-4">
            <p className="mb-2 text-xs text-news-500">
              Al publicar, esta nota se difundirá a los canales configurados si la opción está activa.
            </p>
            <button type="button" className="btn-primary" onClick={publicar} disabled={publicando || !articleId || publicado}>
              {publicando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {publicado ? 'Publicada' : 'Publicar'}
            </button>

            {publicado && (
              <div className="mt-3">
                <p className="mb-2 text-sm font-semibold text-news-700">Difundir en redes</p>
                <div className="flex flex-wrap gap-2">
                  {REDES.map((red) => (
                    <a
                      key={red}
                      className="btn-secondary btn-sm"
                      href={`/admin/difusion?article=${articleId ?? ''}`}
                    >
                      {red}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
