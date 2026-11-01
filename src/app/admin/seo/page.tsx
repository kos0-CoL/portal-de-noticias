'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Save, Pencil, FileText, ShieldCheck } from 'lucide-react';

interface SiteSeo {
  id?: string;
  siteTitle?: string;
  siteTagline?: string;
  metaTitle?: string;
  metaDescription?: string;
  keywords?: string[];
  ogImage?: string;
  twitterCard?: string;
  googleAnalyticsId?: string;
  googleSearchConsoleId?: string;
  facebookPixelId?: string;
  robots?: string;
  updatedAt?: string;
}

interface LegalPage {
  id: string;
  slug: string;
  title: string;
  content: string;
  metaTitle?: string;
  metaDescription?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

async function api(path: string, opts: RequestInit = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

export default function AdminSeoPage() {
  const [seo, setSeo] = useState<SiteSeo>({});
  const [pages, setPages] = useState<LegalPage[]>([]);
  const [editingPage, setEditingPage] = useState<LegalPage | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: 'success' as 'success' | 'error' });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [seoData, pagesData] = await Promise.all([
      api('/site-seo'),
      api('/legales')
    ]);
    setSeo(seoData);
    setPages(pagesData);
  }

  async function saveSeo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const form = new FormData(e.currentTarget as HTMLFormElement);
      const payload: SiteSeo = {
        siteTitle: form.get('siteTitle') as string,
        siteTagline: form.get('siteTagline') as string,
        metaTitle: form.get('metaTitle') as string,
        metaDescription: form.get('metaDescription') as string,
        keywords: form.get('keywords')?.toString().split(',').map((k) => k.trim()).filter(Boolean) ?? [],
        ogImage: form.get('ogImage') as string,
        twitterCard: form.get('twitterCard') as string,
        googleAnalyticsId: form.get('googleAnalyticsId') as string,
        googleSearchConsoleId: form.get('googleSearchConsoleId') as string,
        facebookPixelId: form.get('facebookPixelId') as string,
        robots: form.get('robots') as string
      };
      await api('/site-seo', { method: 'PUT', body: JSON.stringify(payload) });
      setMessage({ text: 'Configuración SEO guardada correctamente.', type: 'success' });
    } catch {
      setMessage({ text: 'Error al guardar la configuración SEO.', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function savePage(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const form = new FormData(e.currentTarget as HTMLFormElement);
      const id = form.get('id') as string;
      const payload = {
        slug: form.get('slug') as string,
        title: form.get('title') as string,
        content: form.get('content') as string,
        metaTitle: form.get('metaTitle') as string,
        metaDescription: form.get('metaDescription') as string,
        isActive: form.get('isActive') === 'on'
      };
      if (id && editingPage) {
        await api(`/legales/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await api('/legales', { method: 'POST', body: JSON.stringify(payload) });
      }
      setEditingPage(null);
      setPages([]);
      await load();
      setMessage({ text: 'Página legal guardada correctamente.', type: 'success' });
    } catch {
      setMessage({ text: 'Error al guardar la página legal.', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function deletePage(id: string) {
    if (!confirm('¿Eliminar esta página legal?')) return;
    try {
      await api(`/legales/${id}`, { method: 'DELETE' });
      setPages(pages.filter((p) => p.id !== id));
      setMessage({ text: 'Página eliminada.', type: 'success' });
    } catch {
      setMessage({ text: 'Error al eliminar la página.', type: 'error' });
    }
  }

  function startNewPage() {
    setEditingPage(null);
  }

  function editPage(page: LegalPage) {
    setEditingPage(page);
  }

  const isNewPage = editingPage === null;

  return (
    <div className="space-y-6">
      {message.text && (
        <p className={`rounded-md p-3 text-sm font-medium ${
          message.type === 'success' ? 'border border-green-200 bg-green-50 text-green-700' : 'border border-red-200 bg-red-50 text-red-700'
        }`}>{message.text}</p>
      )}

      {/* === Configuración SEO global === */}
      <section className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-title">Configuración SEO del sitio</h2>
        </div>
        <form onSubmit={saveSeo} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Título del sitio</label>
              <input
                name="siteTitle"
                defaultValue={seo.siteTitle ?? 'Saladillo Noticias'}
                className="input"
              />
            </div>
            <div>
              <label className="label">Eslogan / Tagline</label>
              <input
                name="siteTagline"
                defaultValue={seo.siteTagline ?? 'El diario de nuestra ciudad'}
                className="input"
              />
            </div>
            <div>
              <label className="label">Meta título (home)</label>
              <input name="metaTitle" defaultValue={seo.metaTitle ?? ''} className="input" />
            </div>
            <div>
              <label className="label">Meta descripción (home)</label>
              <input name="metaDescription" defaultValue={seo.metaDescription ?? ''} className="input" />
            </div>
            <div>
              <label className="label">Palabras clave (separadas por coma)</label>
              <input
                name="keywords"
                defaultValue={Array.isArray(seo.keywords) ? seo.keywords.join(', ') : ''}
                className="input"
              />
            </div>
            <div>
              <label className="label">OG Image (URL)</label>
              <input name="ogImage" defaultValue={seo.ogImage ?? ''} className="input" />
            </div>
            <div>
              <label className="label">Twitter Card</label>
              <input name="twitterCard" defaultValue={seo.twitterCard ?? 'summary_large_image'} className="input" />
            </div>
            <div>
              <label className="label">Google Analytics ID</label>
              <input name="googleAnalyticsId" defaultValue={seo.googleAnalyticsId ?? ''} className="input" />
            </div>
            <div>
              <label className="label">Google Search Console ID</label>
              <input name="googleSearchConsoleId" defaultValue={seo.googleSearchConsoleId ?? ''} className="input" />
            </div>
            <div>
              <label className="label">Facebook Pixel ID</label>
              <input name="facebookPixelId" defaultValue={seo.facebookPixelId ?? ''} className="input" />
            </div>
            <div>
              <label className="label">Robots</label>
              <input name="robots" defaultValue={seo.robots ?? 'index, follow'} className="input" />
            </div>
          </div>
          <button type="submit" disabled={saving} className="btn-primary btn-sm">
            <Save className="h-3.5 w-3.5 mr-2" /> {saving ? 'Guardando…' : 'Guardar configuración SEO'}
          </button>
        </form>
      </section>

      {/* === Gestión de páginas legales === */}
      <section className="admin-card">
        <div className="admin-card-header flex items-center justify-between">
          <div>
            <h2 className="admin-title">Páginas legales</h2>
            <p className="text-xs text-news-500 mt-1">
              Privacidad, términos, cookies, contacto y demás páginas que requiere Google.
            </p>
          </div>
          <button type="button" onClick={startNewPage} className="btn-secondary btn-sm flex items-center gap-2">
            <Plus className="h-3.5 w-3.5" /> Nueva página
          </button>
        </div>

        <form onSubmit={savePage} className="space-y-4 mt-4 border border-news-200 rounded-lg p-4 bg-white/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Slug</label>
              <input name="slug" required defaultValue={editingPage?.slug ?? ''} className="input" />
              <p className="text-xs text-news-400 mt-1">Ej: privacidad, terminos, cookies, contacto</p>
            </div>
            <div>
              <label className="label">Título</label>
              <input name="title" required defaultValue={editingPage?.title ?? ''} className="input" />
            </div>
            <div className="md:col-span-2">
              <label className="label">Contenido (HTML)</label>
              <textarea
                name="content"
                rows={10}
                defaultValue={editingPage?.content ?? ''}
                className="input min-h-[200px] font-mono text-sm"
              />
            </div>
            <div>
              <label className="label">Meta título</label>
              <input name="metaTitle" defaultValue={editingPage?.metaTitle ?? ''} className="input" />
            </div>
            <div>
              <label className="label">Meta descripción</label>
              <input name="metaDescription" defaultValue={editingPage?.metaDescription ?? ''} className="input" />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-news-700">
                <input type="checkbox" name="isActive" defaultChecked={editingPage?.isActive ?? true} className="checkbox" />
                Activa / visible
              </label>
            </div>
            {editingPage?.id && (
              <div className="md:col-span-2">
                <button
                  type="button"
                  onClick={() => deletePage(editingPage!.id)}
                  className="btn-danger btn-sm"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Eliminar página
                </button>
              </div>
            )}
          </div>
          <input type="hidden" name="id" defaultValue={editingPage?.id ?? ''} />
          <button type="submit" disabled={saving} className="btn-primary btn-sm">
            <Save className="h-3.5 w-3.5 mr-2" /> {saving ? 'Guardando…' : isNewPage ? 'Crear página' : 'Guardar cambios'}
          </button>
          {editingPage && (
            <button type="button" onClick={startNewPage} className="btn-ghost btn-sm ml-2">
              Cancelar
            </button>
          )}
        </form>

        <div className="mt-6">
          <h3 className="text-sm font-semibold text-news-700 mb-2">Páginas existentes</h3>
          {pages.length === 0 ? (
            <p className="text-sm text-news-500">No hay páginas legales creadas todavía.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-admin w-full">
                <thead>
                  <tr>
                    <th>Slug</th>
                    <th>Título</th>
                    <th className="w-16">Estado</th>
                    <th className="text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {pages.map((page) => (
                    <tr key={page.id}>
                      <td className="text-xs text-news-500 font-mono">{page.slug}</td>
                      <td className="font-semibold text-brand-900">{page.title}</td>
                      <td>
                        <span className={`badge-xs px-2 py-1 rounded text-xs font-medium ${
                          page.isActive ? 'badge-green' : 'badge-gray'
                        }`}>{page.isActive ? 'Activa' : 'Inactiva'}</span>
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          onClick={() => editPage(page)}
                          className="btn-secondary btn-sm mb-1"
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => deletePage(page.id)}
                          className="btn-danger btn-sm"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* === Sugerencias === */}
      <section className="admin-card bg-amber-50 border border-amber-200">
        <div className="admin-card-header flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-amber-700 shrink-0" />
          <div>
            <h3 className="admin-title text-amber-800">Sugerencias de SEO y legal</h3>
            <p className="text-sm text-amber-700 mt-1">
              Para cumplir con Google y GDPR, asegúrate de tener:
            </p>
          </div>
        </div>
        <ul className="list-disc pl-6 space-y-1 text-sm text-amber-700">
          <li>Página de <strong>privacidad</strong> accesible desde el footer.</li>
          <li>Página de <strong>términos y condiciones</strong>.</li>
          <li>Página de <strong>cookies</strong> vinculada desde el banner de consentimiento.</li>
          <li>Página de <strong>contacto</strong> con datos de la redacción.</li>
          <li><code>robots.txt</code> y <code>sitemap.xml</code> configurados.</li>
          <li>Meta descripción única en cada noticia y categoría.</li>
        </ul>
      </section>
    </div>
  );
}
