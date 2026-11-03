'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Check,
  Facebook,
  FileText,
  Globe,
  Image as ImageIcon,
  Link2,
  Loader2,
  RotateCcw,
  Save,
  Search,
  Send,
  Settings2,
  Share2,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  X
} from 'lucide-react';
import { LOCALIDADES, TONALIDADES } from '@/lib/constants';
import { cn, countWords, estimateReadingTime, slugify } from '@/lib/utils';
import { StatusBadge } from '@/components/admin/StatusBadge';

/**
 * Editor de noticias del backoffice.
 * Formulario completo por pestañas, con guardado en borrador/publicado,
 * generación con IA y difusión en redes sociales.
 */

export interface EditorCategory {
  id: string;
  name: string;
  slug: string;
}

export interface EditorTag {
  id: string;
  name: string;
  slug: string;
}

export interface EditorAuthor {
  id: string;
  name: string;
}

/** Datos normalizados que recibe el editor (todo serializable desde el server). */
export interface EditorArticleInput {
  id?: string | null;
  title?: string;
  slug?: string;
  summary?: string | null;
  content?: string;
  coverImage?: string | null;
  coverImageAlt?: string | null;
  categoryId?: string;
  tags?: string[];
  status?: string;
  priority?: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  socialSummary?: string | null;
  focusKeyword?: string | null;
  ogImage?: string | null;
  isFeatured?: boolean;
  isBreaking?: boolean;
  expiresAt?: string | null;
  publishedAt?: string | null;
  authorId?: string | null;
  reviewNotes?: string | null;
  aiTonality?: string | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
  matchedKeywords?: string[];
}

export interface ArticleEditorProps {
  article: EditorArticleInput | null;
  categories: EditorCategory[];
  tags: EditorTag[];
  authors?: EditorAuthor[];
  /** Proveedores de almacenamiento externo disponibles para alojar la portada. */
  storageProviders?: { id: string; nombre: string }[];
  /** Proveedor por defecto configurado en /admin/almacenamiento (vacío = ninguno). */
  defaultStorageProvider?: string;
}

interface FormState {
  title: string;
  slug: string;
  summary: string;
  content: string;
  coverImage: string;
  coverImageAlt: string;
  categoryId: string;
  tags: string[];
  zona: string;
  isFeatured: boolean;
  isBreaking: boolean;
  expiresAt: string;
  metaTitle: string;
  metaDescription: string;
  socialSummary: string;
  focusKeyword: string;
  ogImage: string;
  tonality: string;
  rewrite: boolean;
  citeSource: boolean;
  priority: string;
  authorId: string;
  publishedAt: string;
  reviewNotes: string;
}

interface AiPayload {
  title?: string;
  summary?: string;
  content?: string;
  metaTitle?: string;
  metaDescription?: string;
  socialSummary?: string;
  focusKeyword?: string;
}

interface ShareResult {
  network?: string;
  channel?: string;
  status: string;
  error?: string;
}

type TabId = 'contenido' | 'seo' | 'ia' | 'avanzado';

const TABS: { id: TabId; label: string; icon: typeof FileText }[] = [
  { id: 'contenido', label: 'Contenido', icon: FileText },
  { id: 'seo', label: 'SEO y redes', icon: Search },
  { id: 'ia', label: 'Procesamiento IA', icon: Sparkles },
  { id: 'avanzado', label: 'Avanzado', icon: Settings2 }
];

/** Convierte una fecha ISO a valor para <input type="datetime-local">. */
function toLocalInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Convierte el valor de un datetime-local a ISO (o null si está vacío). */
function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function initialForm(article: EditorArticleInput | null): FormState {
  return {
    title: article?.title ?? '',
    slug: article?.slug ?? '',
    summary: article?.summary ?? '',
    content: article?.content ?? '',
    coverImage: article?.coverImage ?? '',
    coverImageAlt: article?.coverImageAlt ?? '',
    categoryId: article?.categoryId ?? '',
    tags: article?.tags ?? [],
    zona: '',
    isFeatured: article?.isFeatured ?? false,
    isBreaking: article?.isBreaking ?? false,
    expiresAt: toLocalInput(article?.expiresAt),
    metaTitle: article?.metaTitle ?? '',
    metaDescription: article?.metaDescription ?? '',
    socialSummary: article?.socialSummary ?? '',
    focusKeyword: article?.focusKeyword ?? '',
    ogImage: article?.ogImage ?? '',
    tonality: article?.aiTonality ?? 'CERCANO_LOCAL',
    rewrite: true,
    citeSource: true,
    priority: article?.priority ?? 'NORMAL',
    authorId: article?.authorId ?? '',
    publishedAt: toLocalInput(article?.publishedAt),
    reviewNotes: article?.reviewNotes ?? ''
  };
}

function pickAi(json: unknown): AiPayload {
  const root = (json ?? {}) as Record<string, unknown>;
  const src = (root.article ?? root.data ?? root.result ?? root) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
  return {
    title: str(src.title),
    summary: str(src.summary ?? src.copete),
    content: str(src.content ?? src.body),
    metaTitle: str(src.metaTitle),
    metaDescription: str(src.metaDescription),
    socialSummary: str(src.socialSummary),
    focusKeyword: str(src.focusKeyword)
  };
}

export function ArticleEditor({
  article,
  categories,
  tags,
  authors = [],
  storageProviders = [],
  defaultStorageProvider = ''
}: ArticleEditorProps) {
  const router = useRouter();
  const [articleId, setArticleId] = useState<string | null>(article?.id ?? null);
  const [form, setForm] = useState<FormState>(() => initialForm(article));
  const [tab, setTab] = useState<TabId>('contenido');
  const [slugTouched, setSlugTouched] = useState(Boolean(article?.slug));
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // IA
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AiPayload | null>(null);

  // Alojamiento de la portada en un proveedor externo
  const [storageProvider, setStorageProvider] = useState(defaultStorageProvider || 'default');
  const [alojando, setAlojando] = useState(false);
  const [alojarError, setAlojarError] = useState<string | null>(null);

  // Publicación / difusión
  const [published, setPublished] = useState((article?.status ?? 'DRAFT') === 'PUBLISHED');
  const [sharing, setSharing] = useState<string | null>(null);
  const [shareResults, setShareResults] = useState<ShareResult[]>([]);

  const wordCount = useMemo(() => countWords(form.content), [form.content]);
  const readingTime = useMemo(() => estimateReadingTime(form.content), [form.content]);

  function update<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleTitleChange(value: string) {
    setForm((prev) => ({
      ...prev,
      title: value,
      slug: slugTouched ? prev.slug : slugify(value)
    }));
  }

  function regenerateSlug() {
    setForm((prev) => ({ ...prev, slug: slugify(prev.title) }));
    setSlugTouched(true);
  }

  function addTag(name: string) {
    const clean = name.trim();
    if (!clean) return;
    setForm((prev) => (prev.tags.includes(clean) ? prev : { ...prev, tags: [...prev.tags, clean] }));
    setTagInput('');
  }

  function removeTag(name: string) {
    setForm((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== name) }));
  }

  const tagSuggestions = useMemo(() => {
    const query = tagInput.trim().toLowerCase();
    return tags
      .filter((t) => !form.tags.includes(t.name))
      .filter((t) => (query ? t.name.toLowerCase().includes(query) : true))
      .slice(0, 6);
  }, [tags, tagInput, form.tags]);

  /**
   * ¿La portada ya está alojada en un proveedor externo?
   * No se puede reusar `@/lib/storage` acá: ese módulo arrastra Prisma al bundle del cliente.
   */
  function estaAlojada(url: string): boolean {
    return /\.supabase\.(co|in)\/storage\/v1\/object\/public\//i.test(url);
  }

  /** Sube la portada actual al proveedor elegido y reemplaza la URL por la pública. */
  async function alojarPortada() {
    const origen = form.coverImage.trim();
    if (!origen) return;
    setAlojando(true);
    setAlojarError(null);
    try {
      const res = await fetch('/api/imagenes/alojar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origen, proveedor: storageProvider })
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; url?: string; error?: string } | null;
      if (!res.ok || !data?.ok || !data.url) throw new Error(data?.error ?? 'No se pudo alojar la imagen.');
      update('coverImage', data.url);
    } catch (err) {
      setAlojarError(err instanceof Error ? err.message : 'Error inesperado al alojar la imagen.');
    } finally {
      setAlojando(false);
    }
  }

  function buildPayload() {
    const finalTags = [...form.tags];
    if (form.zona && !finalTags.includes(form.zona)) finalTags.push(form.zona);
    return {
      title: form.title.trim(),
      slug: form.slug.trim() || undefined,
      summary: form.summary || null,
      content: form.content,
      coverImage: form.coverImage || null,
      coverImageAlt: form.coverImageAlt || null,
      categoryId: form.categoryId,
      tags: finalTags,
      priority: form.priority,
      metaTitle: form.metaTitle || null,
      metaDescription: form.metaDescription || null,
      socialSummary: form.socialSummary || null,
      focusKeyword: form.focusKeyword || null,
      ogImage: form.ogImage || null,
      isFeatured: form.isFeatured,
      isBreaking: form.isBreaking,
      expiresAt: fromLocalInput(form.expiresAt),
      publishedAt: fromLocalInput(form.publishedAt),
      authorId: form.authorId || null,
      reviewNotes: form.reviewNotes || null
    };
  }

  /**
   * Guarda la nota (POST si es nueva, PATCH si ya existe).
   * No navega: los llamadores deciden si conviene redirigir al editor.
   */
  async function persist(): Promise<{ id: string | null; created: boolean }> {
    if (!form.title.trim()) {
      setError('El título es obligatorio.');
      setTab('contenido');
      return { id: null, created: false };
    }
    if (!form.categoryId) {
      setError('Seleccioná una categoría antes de guardar.');
      setTab('contenido');
      return { id: null, created: false };
    }
    const created = !articleId;
    setSaving(true);
    setError(null);
    try {
      const url = articleId ? `/api/noticias/${articleId}` : '/api/noticias';
      const method = articleId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload())
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; article?: { id: string; slug: string } }
        | null;
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? 'No se pudo guardar la nota.');

      const id = articleId ?? data.article?.id ?? null;
      if (id) setArticleId(id);
      if (data.article?.slug) update('slug', data.article.slug);
      setSavedAt(Date.now());
      return { id, created };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado al guardar.');
      return { id: null, created: false };
    } finally {
      setSaving(false);
    }
  }

  /** Guardar borrador: persiste y, si la nota es nueva, pasa al editor. */
  async function handleSaveDraft() {
    const { id, created } = await persist();
    if (!id) return;
    if (created) router.replace(`/admin/noticias/${id}`);
    else router.refresh();
  }

  async function saveAndPublish() {
    const { id, created } = await persist();
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/noticias/${id}/publicar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? 'No se pudo publicar la nota.');
      setPublished(true);
      setSavedAt(Date.now());
      if (created) router.replace(`/admin/noticias/${id}`);
      else router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado al publicar.');
    } finally {
      setSaving(false);
    }
  }

  async function generateAI() {
    setAiError(null);
    let id = articleId;
    if (!id) {
      // Sin nota guardada todavía: se crea el borrador sin navegar para no
      // perder el resultado de la IA.
      const result = await persist();
      id = result.id;
      if (!id) return;
    }
    setAiLoading(true);
    try {
      const res = await fetch('/api/ia/reescribir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId: id,
          tonality: form.tonality,
          citeSource: form.citeSource,
          rewrite: form.rewrite
        })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || (data && data.ok === false)) {
        throw new Error((data as { error?: string } | null)?.error ?? 'El motor de IA no devolvió contenido.');
      }
      setAiResult(pickAi(data));
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Error inesperado al generar con IA.');
    } finally {
      setAiLoading(false);
    }
  }

  function applyAi() {
    if (!aiResult) return;
    setForm((prev) => ({
      ...prev,
      title: aiResult.title ?? prev.title,
      summary: aiResult.summary ?? prev.summary,
      content: aiResult.content ?? prev.content,
      metaTitle: aiResult.metaTitle ?? prev.metaTitle,
      metaDescription: aiResult.metaDescription ?? prev.metaDescription,
      socialSummary: aiResult.socialSummary ?? prev.socialSummary,
      focusKeyword: aiResult.focusKeyword ?? prev.focusKeyword
    }));
    setAiResult(null);
    setTab('contenido');
  }

  async function share(network?: string) {
    if (!articleId) return;
    setSharing(network ?? 'ALL');
    setError(null);
    try {
      const res = await fetch('/api/difusion/publicar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(network ? { articleId, network } : { articleId })
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; shares?: ShareResult[] }
        | null;
      if (!res.ok || (data && data.ok === false)) {
        throw new Error(data?.error ?? 'No se pudo difundir la nota.');
      }
      setShareResults(Array.isArray(data?.shares) ? data.shares : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado al difundir.');
    } finally {
      setSharing(null);
    }
  }

  const statusText = saving ? 'Guardando…' : savedAt ? 'Guardado hace un momento' : '';

  return (
    <div className="space-y-6">
      {/* Aviso de nota traída por el scraper */}
      {(article?.status ?? '') === 'PENDING_REVIEW' ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <AlertTriangle className="h-4 w-4" />
            Esta nota proviene de scraping y está pendiente de revisión.
          </p>
        </div>
      ) : null}

      {/* Resultado de la IA */}
      {aiResult ? (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
              <Check className="h-4 w-4" />
              Contenido generado — revisá antes de guardar
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={applyAi} className="btn-primary btn-sm">
                <Check className="h-3.5 w-3.5" />
                Aplicar
              </button>
              <button type="button" onClick={() => setAiResult(null)} className="btn-secondary btn-sm">
                <X className="h-3.5 w-3.5" />
                Descartar
              </button>
            </div>
          </div>
          {aiResult.title ? (
            <p className="mt-3 font-editorial text-base font-bold text-emerald-900">{aiResult.title}</p>
          ) : null}
          {aiResult.summary ? <p className="mt-1 text-sm text-emerald-800">{aiResult.summary}</p> : null}
        </div>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSaveDraft();
        }}
        className="space-y-6"
      >
        <div className="admin-card">
          {/* Pestañas */}
          <div className="mb-5 flex flex-wrap gap-1 border-b border-news-200 pb-3">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition',
                    tab === t.id ? 'bg-brand-800 text-white' : 'text-brand-700 hover:bg-brand-50'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* ---------------- CONTENIDO ---------------- */}
          {tab === 'contenido' ? (
            <div className="space-y-4">
              <div>
                <label htmlFor="title" className="label">
                  Título
                </label>
                <input
                  id="title"
                  value={form.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="input font-editorial text-lg"
                  placeholder="Titular de la noticia"
                />
              </div>

              <div>
                <label htmlFor="slug" className="label">
                  Slug (URL)
                </label>
                <div className="flex gap-2">
                  <input
                    id="slug"
                    value={form.slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      update('slug', e.target.value);
                    }}
                    className="input"
                    placeholder="titular-de-la-noticia"
                  />
                  <button type="button" onClick={regenerateSlug} className="btn-secondary btn-sm shrink-0">
                    <RotateCcw className="h-3.5 w-3.5" />
                    Regenerar
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="summary" className="label">
                  Copete / resumen
                </label>
                <textarea
                  id="summary"
                  value={form.summary}
                  onChange={(e) => update('summary', e.target.value)}
                  className="textarea min-h-[90px]"
                  placeholder="Bajada que acompaña al titular"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="content" className="label mb-0">
                    Cuerpo (HTML)
                  </label>
                  <span className="text-[11px] text-news-500">
                    {wordCount.toLocaleString('es-AR')} palabras · {readingTime} min de lectura
                  </span>
                </div>
                <textarea
                  id="content"
                  value={form.content}
                  onChange={(e) => update('content', e.target.value)}
                  className="textarea min-h-[320px] font-mono text-[13px]"
                  placeholder="<p>Primer párrafo…</p>"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div>
                  <label htmlFor="coverImage" className="label">
                    Imagen de portada (URL)
                  </label>
                  <input
                    id="coverImage"
                    value={form.coverImage}
                    onChange={(e) => update('coverImage', e.target.value)}
                    className="input"
                    placeholder="https://… o /uploads/imagen.webp"
                  />
                  <label htmlFor="coverImageAlt" className="label mt-3">
                    Texto alternativo de la imagen
                  </label>
                  <input
                    id="coverImageAlt"
                    value={form.coverImageAlt}
                    onChange={(e) => update('coverImageAlt', e.target.value)}
                    className="input"
                    placeholder="Descripción de la imagen"
                  />

                  <span className="label mt-3">Alojar portada en</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className="select flex-1"
                      value={storageProvider}
                      onChange={(e) => setStorageProvider(e.target.value)}
                      aria-label="Proveedor de almacenamiento"
                    >
                      <option value="default">
                        Por defecto{defaultStorageProvider ? ` (${defaultStorageProvider})` : ''}
                      </option>
                      {storageProviders.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={alojarPortada}
                      disabled={alojando || !form.coverImage.trim() || estaAlojada(form.coverImage)}
                    >
                      {alojando ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      ) : (
                        <Upload className="h-3.5 w-3.5" aria-hidden />
                      )}
                      Alojar imagen
                    </button>
                  </div>
                  {estaAlojada(form.coverImage) ? (
                    <p className="mt-1 flex items-center gap-1 text-xs font-medium text-emerald-700">
                      <Check className="h-3.5 w-3.5" aria-hidden /> Ya está alojada en el proveedor.
                    </p>
                  ) : alojarError ? (
                    <p className="mt-1 flex items-start gap-1 text-xs text-accent-600">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> {alojarError}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-news-500">
                      Sube la portada (procesada y en WebP) al almacenamiento externo y reemplaza la URL. En Vercel las
                      imágenes guardadas en el servidor no persisten.
                    </p>
                  )}
                </div>
                <div>
                  <span className="label">Vista previa</span>
                  {form.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={form.coverImage}
                      alt={form.coverImageAlt || 'Vista previa de portada'}
                      className="h-40 w-full rounded-lg border border-news-200 object-cover"
                    />
                  ) : (
                    <div className="flex h-40 w-full items-center justify-center rounded-lg border border-dashed border-news-300 bg-news-50 text-xs text-news-400">
                      <ImageIcon className="mr-2 h-4 w-4" /> Sin imagen de portada
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div>
                  <label htmlFor="categoryId" className="label">
                    Categoría
                  </label>
                  <select
                    id="categoryId"
                    value={form.categoryId}
                    onChange={(e) => update('categoryId', e.target.value)}
                    className="select"
                  >
                    <option value="">Seleccioná una categoría…</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="zona" className="label">
                    Localidad / Zona
                  </label>
                  <select
                    id="zona"
                    value={form.zona}
                    onChange={(e) => update('zona', e.target.value)}
                    className="select"
                  >
                    <option value="">Sin especificar</option>
                    {LOCALIDADES.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-news-400">
                    Se guarda como etiqueta de ubicación de la nota.
                  </p>
                </div>
              </div>

              <div>
                <label className="label">Etiquetas</label>
                <div className="flex flex-wrap gap-1.5">
                  {form.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-1 text-xs font-semibold text-brand-800"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="rounded-full p-0.5 hover:bg-brand-200"
                        aria-label={`Quitar etiqueta ${tag}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      addTag(tagInput);
                    }
                  }}
                  className="input mt-2"
                  placeholder="Escribí una etiqueta y presioná Enter"
                />
                {tagInput && tagSuggestions.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {tagSuggestions.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => addTag(t.name)}
                        className="rounded-full border border-news-300 px-2.5 py-0.5 text-xs text-news-600 hover:border-brand-300 hover:bg-brand-50"
                      >
                        + {t.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex items-center gap-2 text-sm font-medium text-news-700">
                  <input
                    type="checkbox"
                    checked={form.isFeatured}
                    onChange={(e) => update('isFeatured', e.target.checked)}
                    className="checkbox"
                  />
                  Destacada (aparece en el bloque principal)
                </label>
                <label className="flex items-center gap-2 text-sm font-medium text-news-700">
                  <input
                    type="checkbox"
                    checked={form.isBreaking}
                    onChange={(e) => update('isBreaking', e.target.checked)}
                    className="checkbox"
                  />
                  Último momento
                </label>
              </div>

              <div>
                <label htmlFor="expiresAt" className="label">
                  Vence el (opcional)
                </label>
                <input
                  id="expiresAt"
                  type="datetime-local"
                  value={form.expiresAt}
                  onChange={(e) => update('expiresAt', e.target.value)}
                  className="input sm:max-w-xs"
                />
              </div>
            </div>
          ) : null}

          {/* ---------------- SEO Y REDES ---------------- */}
          {tab === 'seo' ? (
            <div className="space-y-4">
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="metaTitle" className="label mb-0">
                    Meta título
                  </label>
                  <span className={cn('text-[11px]', form.metaTitle.length > 60 ? 'text-red-600' : 'text-news-500')}>
                    {form.metaTitle.length}/60
                  </span>
                </div>
                <input
                  id="metaTitle"
                  value={form.metaTitle}
                  onChange={(e) => update('metaTitle', e.target.value)}
                  className="input"
                  placeholder="Título para buscadores"
                />
                {form.metaTitle.length > 60 ? (
                  <p className="mt-1 text-[11px] text-red-600">Supera los 60 caracteres recomendados.</p>
                ) : null}
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="metaDescription" className="label mb-0">
                    Meta descripción
                  </label>
                  <span
                    className={cn(
                      'text-[11px]',
                      form.metaDescription.length > 158 ? 'text-red-600' : 'text-news-500'
                    )}
                  >
                    {form.metaDescription.length}/158
                  </span>
                </div>
                <textarea
                  id="metaDescription"
                  value={form.metaDescription}
                  onChange={(e) => update('metaDescription', e.target.value)}
                  className="textarea min-h-[90px]"
                  placeholder="Descripción para los resultados de búsqueda"
                />
                {form.metaDescription.length > 158 ? (
                  <p className="mt-1 text-[11px] text-red-600">Supera los 158 caracteres recomendados.</p>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div>
                  <label htmlFor="focusKeyword" className="label">
                    Palabra clave principal
                  </label>
                  <input
                    id="focusKeyword"
                    value={form.focusKeyword}
                    onChange={(e) => update('focusKeyword', e.target.value)}
                    className="input"
                    placeholder="Ej: Saladillo, intendente, obras"
                  />
                </div>
                <div>
                  <label htmlFor="ogImage" className="label">
                    Imagen para redes (OG)
                  </label>
                  <input
                    id="ogImage"
                    value={form.ogImage}
                    onChange={(e) => update('ogImage', e.target.value)}
                    className="input"
                    placeholder="https://… (opcional)"
                  />
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="socialSummary" className="label mb-0">
                    Resumen para redes
                  </label>
                  <span
                    className={cn('text-[11px]', form.socialSummary.length > 280 ? 'text-red-600' : 'text-news-500')}
                  >
                    {form.socialSummary.length}/280
                  </span>
                </div>
                <textarea
                  id="socialSummary"
                  value={form.socialSummary}
                  onChange={(e) => update('socialSummary', e.target.value)}
                  className="textarea min-h-[100px]"
                  placeholder="Texto corto para Facebook, Instagram o Telegram"
                />
              </div>
            </div>
          ) : null}

          {/* ---------------- PROCESAMIENTO IA ---------------- */}
          {tab === 'ia' ? (
            <div className="space-y-4">
              <div>
                <label htmlFor="tonality" className="label">
                  Tono de reescritura
                </label>
                <select
                  id="tonality"
                  value={form.tonality}
                  onChange={(e) => update('tonality', e.target.value)}
                  className="select sm:max-w-md"
                >
                  {TONALIDADES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-news-500">
                  {TONALIDADES.find((t) => t.value === form.tonality)?.description}
                </p>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-news-700">
                  <input
                    type="checkbox"
                    checked={form.rewrite}
                    onChange={(e) => update('rewrite', e.target.checked)}
                    className="checkbox"
                  />
                  Reescribir con IA
                </label>
                <label className="flex items-center gap-2 text-sm font-medium text-news-700">
                  <input
                    type="checkbox"
                    checked={form.citeSource}
                    onChange={(e) => update('citeSource', e.target.checked)}
                    className="checkbox"
                  />
                  Citar la fuente original al final
                </label>
              </div>

              {article?.sourceName || article?.sourceUrl ? (
                <div className="rounded-lg border border-news-200 bg-news-50 p-4">
                  <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-news-500">
                    <Link2 className="h-3.5 w-3.5" />
                    Origen del contenido (scraper)
                  </p>
                  <p className="mt-2 text-sm text-news-700">{article.sourceName ?? 'Fuente externa'}</p>
                  {article.sourceUrl ? (
                    <a
                      href={article.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"
                    >
                      <Globe className="h-3.5 w-3.5" />
                      {article.sourceUrl}
                    </a>
                  ) : null}
                  {article.matchedKeywords && article.matchedKeywords.length > 0 ? (
                    <p className="mt-2 text-xs text-news-500">
                      Palabras clave locales coincidentes: {article.matchedKeywords.join(', ')}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={generateAI} disabled={aiLoading} className="btn-primary">
                  {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                  {aiLoading ? 'Generando…' : 'Generar con IA'}
                </button>
                {!articleId ? (
                  <span className="text-xs text-news-500">Se guardará el borrador antes de generar.</span>
                ) : null}
              </div>

              {aiError ? (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {aiError}
                </p>
              ) : null}
            </div>
          ) : null}

          {/* ---------------- AVANZADO ---------------- */}
          {tab === 'avanzado' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div>
                  <label htmlFor="authorId" className="label">
                    Autor
                  </label>
                  {authors.length > 0 ? (
                    <select
                      id="authorId"
                      value={form.authorId}
                      onChange={(e) => update('authorId', e.target.value)}
                      className="select"
                    >
                      <option value="">Sin asignar</option>
                      {authors.map((author) => (
                        <option key={author.id} value={author.id}>
                          {author.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-sm text-news-500">No hay usuarios disponibles.</p>
                  )}
                </div>

                <div>
                  <label htmlFor="priority" className="label">
                    Prioridad editorial
                  </label>
                  <select
                    id="priority"
                    value={form.priority}
                    onChange={(e) => update('priority', e.target.value)}
                    className="select"
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="ALTA">Prioridad Alta</option>
                    <option value="URGENTE">Urgente</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="publishedAt" className="label">
                  Fecha de publicación
                </label>
                <input
                  id="publishedAt"
                  type="datetime-local"
                  value={form.publishedAt}
                  onChange={(e) => update('publishedAt', e.target.value)}
                  className="input sm:max-w-xs"
                />
                <p className="mt-1 text-[11px] text-news-400">
                  Si se deja vacío, se completa al publicar.
                </p>
              </div>

              <div>
                <label htmlFor="reviewNotes" className="label">
                  Notas internas de revisión
                </label>
                <textarea
                  id="reviewNotes"
                  value={form.reviewNotes}
                  onChange={(e) => update('reviewNotes', e.target.value)}
                  className="textarea min-h-[100px]"
                  placeholder="Observaciones internas (no se publican)"
                />
              </div>
            </div>
          ) : null}
        </div>

        {/* Barra de guardado sticky */}
        <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-news-200 bg-white/95 px-4 py-3 shadow-header backdrop-blur">
          <button type="submit" disabled={saving} className="btn-secondary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar borrador
          </button>
          <button type="button" onClick={saveAndPublish} disabled={saving} className="btn-primary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Guardar y publicar
          </button>

          {form.slug ? (
            <a
              href={`/nota/${form.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost btn-sm ml-auto"
            >
              <Globe className="h-3.5 w-3.5" />
              Ver en el sitio
            </a>
          ) : null}

          <div className="w-full sm:w-auto sm:text-right">
            {statusText ? <span className="text-xs font-medium text-emerald-700">{statusText}</span> : null}
            {error ? <span className="text-xs font-medium text-red-600">{error}</span> : null}
          </div>
        </div>
      </form>

      {/* Panel de difusión (aparece tras publicar) */}
      {published ? (
        <div className="admin-card">
          <div className="admin-card-header">
            <h2 className="flex items-center gap-2 admin-title">
              <Share2 className="h-4 w-4" />
              Difusión en redes
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => share('FACEBOOK')}
              disabled={sharing !== null}
              className="btn-primary btn-sm"
            >
              {sharing === 'FACEBOOK' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Facebook className="h-3.5 w-3.5" />
              )}
              Compartir en Facebook
            </button>
            <button
              type="button"
              onClick={() => share('TELEGRAM')}
              disabled={sharing !== null}
              className="btn-secondary btn-sm"
            >
              {sharing === 'TELEGRAM' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Publicar en Telegram
            </button>
            <button
              type="button"
              onClick={() => share()}
              disabled={sharing !== null}
              className="btn-secondary btn-sm"
            >
              {sharing === 'ALL' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
              Publicar en todas las redes
            </button>
          </div>

          {shareResults.length > 0 ? (
            <ul className="mt-4 space-y-1.5 text-sm">
              {shareResults.map((result, index) => (
                <li key={`${result.network ?? result.channel ?? index}`} className="flex items-center gap-2">
                  <StatusBadge status={result.status} />
                  <span className="text-news-700">{result.network ?? result.channel ?? 'Canal'}</span>
                  {result.error ? <span className="text-xs text-red-600">{result.error}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Acciones rápidas del encabezado del editor (se renderiza en la página [id]).
 * Publicar / Despublicar / Eliminar.
 */
export function ArticleHeaderActions({
  articleId,
  status,
  slug,
  title
}: {
  articleId: string;
  status: string;
  slug: string;
  title: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isPublished = status === 'PUBLISHED';

  async function togglePublish() {
    setBusy('publish');
    setError(null);
    try {
      const res = await fetch(`/api/noticias/${articleId}/publicar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isPublished ? { unpublish: true } : {})
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? 'No se pudo cambiar el estado de publicación.');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado.');
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!window.confirm(`¿Eliminar la nota "${title}"? Esta acción no se puede deshacer.`)) return;
    setBusy('delete');
    setError(null);
    try {
      const res = await fetch(`/api/noticias/${articleId}`, { method: 'DELETE' });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? 'No se pudo eliminar la nota.');
      router.push('/admin/noticias');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado.');
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={togglePublish} disabled={busy !== null} className="btn-primary btn-sm">
        {busy === 'publish' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        {isPublished ? 'Despublicar' : 'Publicar'}
      </button>
      <a
        href={`/nota/${slug}`}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-secondary btn-sm"
      >
        <Globe className="h-3.5 w-3.5" />
        Ver en el sitio
      </a>
      <button type="button" onClick={remove} disabled={busy !== null} className="btn-danger btn-sm">
        {busy === 'delete' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        Eliminar
      </button>
      {error ? <span className="text-xs font-medium text-red-600">{error}</span> : null}
    </div>
  );
}

export default ArticleEditor;
