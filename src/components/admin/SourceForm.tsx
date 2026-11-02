'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { escapeHtml } from '@/lib/utils';

export interface CategoriaOpcion {
  id: string;
  name: string;
}

export interface MapeoInicial {
  id?: string;
  externalCategoryName: string;
  externalCategoryUrl: string;
  localCategoryId: string;
}

export interface FuenteInicial {
  id: string;
  name: string;
  baseUrl: string;
  isActive: boolean;
  rotateUserAgent: boolean;
  requestDelayMs: number;
  maxItemsPerRun: number;
  respectRobots: boolean;
  usePuppeteer: boolean;
  useAiExtraction: boolean;
  crawlSelector: string | null;
  articleSelector: string | null;
  titleSelector: string | null;
  imageSelector: string | null;
  scheduleCron: string | null;
  mappings: MapeoInicial[];
}

export interface SourceFormProps {
  categorias: CategoriaOpcion[];
  initial?: FuenteInicial | null;
}

interface FilaMapeo extends MapeoInicial {
  key: string;
}

interface PreviewData {
  title: string;
  excerpt: string;
  content: string;
  images: string[];
  wordCount: number;
  matches: string[];
}

/** Presets de programación más usados, con su expresión cron de 5 campos. */
const CRON_PRESETS = [
  { value: '', label: 'Sin programación (solo manual)' },
  { value: '*/30 * * * *', label: 'Cada 30 minutos' },
  { value: '0 * * * *', label: 'Cada hora' },
  { value: '0 */2 * * *', label: 'Cada 2 horas' },
  { value: '0 */6 * * *', label: 'Cada 6 horas' },
  { value: '0 7 * * *', label: 'Una vez al día (7:00)' }
];

let contadorFila = 0;
function nuevaFila(): FilaMapeo {
  contadorFila += 1;
  return {
    key: `fila-${contadorFila}-${Date.now()}`,
    externalCategoryName: '',
    externalCategoryUrl: '',
    localCategoryId: ''
  };
}

/** Resalta las palabras clave locales sin depender de módulos de servidor. */
function resaltar(texto: string, palabras: string[]): string {
  if (!texto) return '';
  const limpias = Array.from(new Set(palabras.map((p) => p.trim()).filter(Boolean)));
  if (limpias.length === 0) return escapeHtml(texto);
  const alternativas = limpias
    .sort((a, b) => b.length - a.length)
    .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  let regex: RegExp;
  try {
    regex = new RegExp(`(${alternativas})`, 'giu');
  } catch {
    return escapeHtml(texto);
  }
  return texto
    .split(regex)
    .map((parte, indice) =>
      indice % 2 === 1
        ? `<mark class="rounded bg-amber-200 px-0.5 text-brand-900">${escapeHtml(parte)}</mark>`
        : escapeHtml(parte)
    )
    .join('');
}

export default function SourceForm({ categorias, initial = null }: SourceFormProps) {
  const router = useRouter();
  const esEdicion = Boolean(initial?.id);

  const [name, setName] = useState(initial?.name ?? '');
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? '');
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [scheduleCron, setScheduleCron] = useState(initial?.scheduleCron ?? '');
  const [cronPersonalizado, setCronPersonalizado] = useState(
    initial?.scheduleCron && !CRON_PRESETS.some((p) => p.value === initial.scheduleCron) ? initial.scheduleCron : ''
  );

  const [crawlSelector, setCrawlSelector] = useState(initial?.crawlSelector ?? '');
  const [articleSelector, setArticleSelector] = useState(initial?.articleSelector ?? '');
  const [titleSelector, setTitleSelector] = useState(initial?.titleSelector ?? '');
  const [imageSelector, setImageSelector] = useState(initial?.imageSelector ?? '');

  const [rotateUserAgent, setRotateUserAgent] = useState(initial?.rotateUserAgent ?? true);
  const [requestDelayMs, setRequestDelayMs] = useState(initial?.requestDelayMs ?? 1500);
  const [respectRobots, setRespectRobots] = useState(initial?.respectRobots ?? true);
  const [usePuppeteer, setUsePuppeteer] = useState(initial?.usePuppeteer ?? false);
  const [useAiExtraction, setUseAiExtraction] = useState(initial?.useAiExtraction ?? false);

  const [maxItemsPerRun, setMaxItemsPerRun] = useState(initial?.maxItemsPerRun ?? 20);

  const [mapeos, setMapeos] = useState<FilaMapeo[]>(
    initial?.mappings && initial.mappings.length > 0
      ? initial.mappings.map((m) => ({ ...m, key: `mapeo-${m.id ?? Math.random().toString(36).slice(2)}` }))
      : [nuevaFila()]
  );
  const [mapeosEliminados, setMapeosEliminados] = useState<string[]>([]);

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [urlPrueba, setUrlPrueba] = useState('');
  const [probando, setProbando] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [errorPreview, setErrorPreview] = useState<string | null>(null);

  const cronEfectivo = cronPersonalizado.trim() || scheduleCron;

  function actualizarMapeo(key: string, campo: keyof MapeoInicial, valor: string) {
    setMapeos((prev) => prev.map((fila) => (fila.key === key ? { ...fila, [campo]: valor } : fila)));
  }

  function eliminarMapeo(fila: FilaMapeo) {
    if (fila.id) setMapeosEliminados((prev) => [...prev, fila.id as string]);
    setMapeos((prev) => {
      const restantes = prev.filter((f) => f.key !== fila.key);
      return restantes.length > 0 ? restantes : [nuevaFila()];
    });
  }

  async function sincronizarMapeos(sourceId: string): Promise<void> {
    for (const id of mapeosEliminados) {
      await fetch(`/api/scraping/fuentes/${sourceId}/mapeos?mappingId=${id}`, { method: 'DELETE' });
    }
    for (const fila of mapeos) {
      if (!fila.externalCategoryName.trim() || !fila.externalCategoryUrl.trim() || !fila.localCategoryId) continue;
      await fetch(`/api/scraping/fuentes/${sourceId}/mapeos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          externalCategoryName: fila.externalCategoryName.trim(),
          externalCategoryUrl: fila.externalCategoryUrl.trim(),
          localCategoryId: fila.localCategoryId
        })
      });
    }
  }

  async function guardar() {
    setGuardando(true);
    setMensaje(null);
    setError(null);

    const payload = {
      name: name.trim(),
      baseUrl: baseUrl.trim(),
      isActive,
      rotateUserAgent,
      requestDelayMs: Number(requestDelayMs) || 0,
      maxItemsPerRun: Number(maxItemsPerRun) || 1,
      respectRobots,
      usePuppeteer,
      useAiExtraction,
      crawlSelector: crawlSelector.trim() || null,
      articleSelector: articleSelector.trim() || null,
      titleSelector: titleSelector.trim() || null,
      imageSelector: imageSelector.trim() || null,
      scheduleCron: cronEfectivo.trim() || null
    };

    try {
      const respuesta = await fetch(
        esEdicion ? `/api/scraping/fuentes/${initial?.id}` : '/api/scraping/fuentes',
        {
          method: esEdicion ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );
      const data = (await respuesta.json()) as { ok: boolean; fuente?: { id: string }; error?: string };
      if (!respuesta.ok || !data.ok || !data.fuente) {
        setError(data.error ?? 'No se pudo guardar la fuente.');
        return;
      }

      await sincronizarMapeos(data.fuente.id);
      setMapeosEliminados([]);
      setMensaje('Fuente guardada correctamente.');
      router.refresh();
      if (!esEdicion) {
        router.push(`/admin/scraping/fuentes?editar=${data.fuente.id}`);
      }
    } catch {
      setError('Hubo un problema de conexión al guardar la fuente.');
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar() {
    if (!initial?.id) return;
    if (!window.confirm(`¿Eliminar la fuente «${initial.name}»? Se borrarán también sus mapeos y su historial.`)) {
      return;
    }
    setGuardando(true);
    try {
      await fetch(`/api/scraping/fuentes/${initial.id}`, { method: 'DELETE' });
      router.refresh();
      router.push('/admin/scraping/fuentes');
    } finally {
      setGuardando(false);
    }
  }

  async function probarExtraccion() {
    if (!urlPrueba.trim()) return;
    setProbando(true);
    setPreview(null);
    setErrorPreview(null);
    try {
      const respuesta = await fetch('/api/scraping/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlPrueba.trim(), sourceId: esEdicion ? initial?.id : undefined })
      });
      const data = (await respuesta.json()) as {
        ok: boolean;
        error?: string;
        preview?: Omit<PreviewData, 'matches'>;
        filtroLocal?: { matches: string[] };
      };
      if (!respuesta.ok || !data.ok || !data.preview) {
        setErrorPreview(data.error ?? 'No se pudo procesar la URL.');
        return;
      }
      setPreview({ ...data.preview, matches: data.filtroLocal?.matches ?? [] });
    } catch {
      setErrorPreview('Hubo un problema de conexión al probar la extracción.');
    } finally {
      setProbando(false);
    }
  }

  return (
    <div className="space-y-6">
      {mensaje && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {mensaje}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {/* Datos básicos */}
      <section className="admin-card">
        <h3 className="admin-title mb-4">Datos básicos</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="src-name">Nombre de la fuente</label>
            <input
              id="src-name"
              className="input"
              value={name}
              onChange={(evento) => setName(evento.target.value)}
              placeholder="Ej: Diario de Saladillo"
            />
          </div>
          <div>
            <label className="label" htmlFor="src-url">URL base</label>
            <input
              id="src-url"
              className="input"
              value={baseUrl}
              onChange={(evento) => setBaseUrl(evento.target.value)}
              placeholder="https://ejemplo.com.ar"
            />
          </div>
          <div>
            <label className="label" htmlFor="src-cron">Programación (cron de 5 campos)</label>
            <select
              id="src-cron"
              className="select"
              value={scheduleCron}
              onChange={(evento) => {
                setScheduleCron(evento.target.value);
                if (evento.target.value !== '') setCronPersonalizado('');
              }}
            >
              {CRON_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
              <option value="">Personalizado (usar campo de abajo)</option>
            </select>
            <input
              className="input mt-2"
              value={cronPersonalizado}
              onChange={(evento) => {
                setCronPersonalizado(evento.target.value);
                if (evento.target.value) setScheduleCron('');
              }}
              placeholder="Ej: 0 7,19 * * *"
            />
            <p className="mt-1.5 text-xs text-news-500">
              Formato <code>minuto hora día-del-mes mes día-de-semana</code>. Se admite <code>*</code> (cualquiera),
              <code> */n</code> (cada n), listas <code>a,b</code> y rangos <code>a-b</code>. Ejemplo:
              <code> 0 */2 * * *</code> = cada 2 horas en punto. La hora se interpreta en horario de Buenos Aires.
            </p>
          </div>
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-news-700">
              <input
                type="checkbox"
                className="checkbox"
                checked={isActive}
                onChange={(evento) => setIsActive(evento.target.checked)}
              />
              Fuente activa
            </label>
          </div>
        </div>
      </section>

      {/* Extracción */}
      <section className="admin-card">
        <h3 className="admin-title mb-1">Extracción (selectores CSS)</h3>
        <p className="mb-4 text-xs text-news-500">
          Para obtener un selector: abrí el sitio, hacé clic derecho sobre el elemento y elegí «Inspeccionar».
          Copiá la clase o el id del elemento y escribilo acá. Si lo dejás vacío, el sistema usa un heurístico automático.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="src-crawl">Selector del listado</label>
            <input
              id="src-crawl"
              className="input"
              value={crawlSelector}
              onChange={(evento) => setCrawlSelector(evento.target.value)}
              placeholder="Ej: .listado-notas"
            />
          </div>
          <div>
            <label className="label" htmlFor="src-article">Selector del cuerpo de la nota</label>
            <input
              id="src-article"
              className="input"
              value={articleSelector}
              onChange={(evento) => setArticleSelector(evento.target.value)}
              placeholder="Ej: .contenido-nota"
            />
          </div>
          <div>
            <label className="label" htmlFor="src-title">Selector del título</label>
            <input
              id="src-title"
              className="input"
              value={titleSelector}
              onChange={(evento) => setTitleSelector(evento.target.value)}
              placeholder="Ej: h1.titulo"
            />
          </div>
          <div>
            <label className="label" htmlFor="src-image">Selector de la imagen principal</label>
            <input
              id="src-image"
              className="input"
              value={imageSelector}
              onChange={(evento) => setImageSelector(evento.target.value)}
              placeholder="Ej: .nota-foto img"
            />
          </div>
        </div>
      </section>

      {/* Anti-bloqueo */}
      <section className="admin-card">
        <h3 className="admin-title mb-4">Anti-bloqueo y ética de scraping</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-start gap-2 text-sm text-news-700">
            <input
              type="checkbox"
              className="checkbox mt-0.5"
              checked={rotateUserAgent}
              onChange={(evento) => setRotateUserAgent(evento.target.checked)}
            />
            <span>
              <span className="font-semibold">Rotar User-Agent</span>
              <br />
              Alterna entre más de 12 User-Agents de navegadores reales para no parecer un bot repetitivo.
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-news-700">
            <input
              type="checkbox"
              className="checkbox mt-0.5"
              checked={respectRobots}
              onChange={(evento) => setRespectRobots(evento.target.checked)}
            />
            <span>
              <span className="font-semibold">Respetar robots.txt</span>
              <br />
              No accede a secciones que el sitio de origen prohíbe explícitamente.
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-news-700">
            <input
              type="checkbox"
              className="checkbox mt-0.5"
              checked={usePuppeteer}
              onChange={(evento) => setUsePuppeteer(evento.target.checked)}
            />
            <span>
              <span className="font-semibold">Renderizar con navegador (Puppeteer)</span>
              <br />
              Para sitios con mucho JavaScript. Es más lento y requiere que Puppeteer esté instalado; si no lo está, se usa el método normal automáticamente.
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-news-700">
            <input
              type="checkbox"
              className="checkbox mt-0.5"
              checked={useAiExtraction}
              onChange={(evento) => setUseAiExtraction(evento.target.checked)}
            />
            <span>
              <span className="font-semibold">Extraer el cuerpo con IA</span>
              <br />
              La IA lee el HTML de cada nota y saca título, cuerpo, imágenes y fecha. Útil cuando los selectores no dan
              resultado. Consume tokens y omite la reescritura automática: la nota queda como borrador para revisar.
            </span>
          </label>
          <div>
            <label className="label" htmlFor="src-delay">Delay entre pedidos (ms)</label>
            <input
              id="src-delay"
              type="number"
              min={0}
              max={60000}
              step={100}
              className="input"
              value={requestDelayMs}
              onChange={(evento) => setRequestDelayMs(Number(evento.target.value))}
            />
            <p className="mt-1.5 text-xs text-news-500">
              Recomendado entre 1500 y 3000 ms para no sobrecargar el sitio de origen.
            </p>
          </div>
        </div>
      </section>

      {/* Límites */}
      <section className="admin-card">
        <h3 className="admin-title mb-4">Límites</h3>
        <div className="max-w-xs">
          <label className="label" htmlFor="src-max">Máximo de notas nuevas por ejecución</label>
          <input
            id="src-max"
            type="number"
            min={1}
            max={200}
            className="input"
            value={maxItemsPerRun}
            onChange={(evento) => setMaxItemsPerRun(Number(evento.target.value))}
          />
        </div>
      </section>

      {/* Mapeo de categorías */}
      <section className="admin-card">
        <div className="admin-card-header">
          <div>
            <h3 className="admin-title">Mapeo de categorías</h3>
            <p className="text-xs text-news-500">
              Relacioná una sección del medio de origen con una categoría local. Ejemplo: mapear la sección
              «Seguridad» de otro medio a «Policiales» de Saladillo.
            </p>
          </div>
          <button type="button" className="btn-secondary btn-sm" onClick={() => setMapeos((prev) => [...prev, nuevaFila()])}>
            <Plus className="h-3.5 w-3.5" />
            Agregar mapeo
          </button>
        </div>

        <div className="space-y-3">
          {mapeos.map((fila) => (
            <div key={fila.key} className="grid gap-2 rounded-lg border border-news-200 p-3 sm:grid-cols-[1fr_1.4fr_1fr_auto]">
              <input
                className="input"
                value={fila.externalCategoryName}
                onChange={(evento) => actualizarMapeo(fila.key, 'externalCategoryName', evento.target.value)}
                placeholder="Sección externa (Ej: Seguridad)"
              />
              <input
                className="input"
                value={fila.externalCategoryUrl}
                onChange={(evento) => actualizarMapeo(fila.key, 'externalCategoryUrl', evento.target.value)}
                placeholder="URL del listado (https://…/seguridad)"
              />
              <select
                className="select"
                value={fila.localCategoryId}
                onChange={(evento) => actualizarMapeo(fila.key, 'localCategoryId', evento.target.value)}
              >
                <option value="">Categoría local…</option>
                {categorias.map((categoria) => (
                  <option key={categoria.id} value={categoria.id}>
                    {categoria.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn-ghost btn-sm text-red-600"
                onClick={() => eliminarMapeo(fila)}
                aria-label="Quitar mapeo"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Probar extracción */}
      <section className="admin-card">
        <h3 className="admin-title mb-1">Probar extracción</h3>
        <p className="mb-4 text-xs text-news-500">
          Pegá la URL de una nota y probá el resultado sin guardar nada en la base.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            className="input flex-1 min-w-[240px]"
            value={urlPrueba}
            onChange={(evento) => setUrlPrueba(evento.target.value)}
            placeholder="https://ejemplo.com.ar/nota/una-nota"
          />
          <button type="button" className="btn-secondary" onClick={probarExtraccion} disabled={probando}>
            {probando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            {probando ? 'Probando…' : 'Probar'}
          </button>
        </div>

        {errorPreview && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorPreview}
          </div>
        )}

        {preview && (
          <div className="mt-4 space-y-3 rounded-lg border border-news-200 bg-news-50 p-4">
            <p className="font-editorial text-lg font-bold text-brand-900">{preview.title}</p>
            {preview.matches.length > 0 ? (
              <p className="text-sm text-news-700" dangerouslySetInnerHTML={{ __html: resaltar(preview.excerpt, preview.matches) }} />
            ) : (
              <p className="text-sm text-news-700">{preview.excerpt}</p>
            )}
            <div className="flex flex-wrap items-center gap-3 text-xs text-news-600">
              <span>{preview.wordCount} palabras</span>
              <span>{preview.images.length} imágenes detectadas</span>
              {preview.matches.length > 0 ? (
                <span className="badge-amber">Coincidencias locales: {preview.matches.join(', ')}</span>
              ) : (
                <span className="badge-gray">Sin palabras clave locales</span>
              )}
            </div>
            {preview.images.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {preview.images.slice(0, 6).map((imagen) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={imagen} src={imagen} alt="Imagen detectada" className="h-20 w-28 rounded object-cover" />
                ))}
              </div>
            )}
            <div
              className="article-body max-h-64 overflow-auto rounded-md bg-white p-3 text-sm"
              dangerouslySetInnerHTML={{ __html: resaltar(preview.content.slice(0, 1500), preview.matches) }}
            />
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" onClick={guardar} disabled={guardando}>
          {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {esEdicion ? 'Guardar cambios' : 'Crear fuente'}
        </button>
        {esEdicion && (
          <button type="button" className="btn-danger" onClick={eliminar} disabled={guardando}>
            <Trash2 className="h-4 w-4" />
            Eliminar fuente
          </button>
        )}
      </div>
    </div>
  );
}
