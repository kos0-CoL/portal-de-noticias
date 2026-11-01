'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2, Pencil, Plus, Power, Save, Trash2, X } from 'lucide-react';
import { ZONA_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';

/**
 * Gestor de banners del panel (/admin/banners).
 * Formulario de alta/edición + tabla con acciones. Tras cada mutación se
 * refresca el Server Component con router.refresh().
 */

export interface BannerDTO {
  id: string;
  name: string;
  advertiser: string | null;
  type: 'IMAGE' | 'ADSENSE' | 'HTML' | 'ROTATING';
  zone: 'HEADER' | 'HOME_TOP' | 'INLINE_ARTICLE' | 'SIDEBAR' | 'FOOTER' | 'MOBILE_STICKY';
  imageUrl: string | null;
  targetUrl: string | null;
  htmlCode: string | null;
  adSlot: string | null;
  weight: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  impressions: number;
  clicks: number;
}

interface BannerManagerProps {
  banners: BannerDTO[];
}

type TipoBanner = BannerDTO['type'];
type ZonaBanner = BannerDTO['zone'];

const ZONAS: ZonaBanner[] = ['HEADER', 'HOME_TOP', 'INLINE_ARTICLE', 'SIDEBAR', 'FOOTER', 'MOBILE_STICKY'];
const TIPOS: { value: TipoBanner; label: string }[] = [
  { value: 'IMAGE', label: 'Imagen (comercio local)' },
  { value: 'ADSENSE', label: 'Google AdSense' },
  { value: 'HTML', label: 'Código HTML' },
  { value: 'ROTATING', label: 'Rotación por peso' }
];

const TIPO_LABEL: Record<TipoBanner, string> = {
  IMAGE: 'Imagen',
  ADSENSE: 'AdSense',
  HTML: 'HTML',
  ROTATING: 'Rotativo'
};

const TIPO_AYUDA: Record<TipoBanner, string> = {
  IMAGE: 'Un banner propio (JPG/PNG/WebP) con enlace de destino. Ideal para comercios de Saladillo.',
  ADSENSE: 'Un bloque de Google AdSense. Requiere el ID de bloque y la variable NEXT_PUBLIC_ADSENSE_CLIENT.',
  HTML: 'Un fragmento de HTML o JavaScript pegado a mano (embeds de terceros, acuerdos especiales).',
  ROTATING: 'Varios banners de la misma zona que se muestran alternados según su peso de rotación.'
};

interface FormState {
  id: string | null;
  name: string;
  advertiser: string;
  type: TipoBanner;
  zone: ZonaBanner;
  imageUrl: string;
  targetUrl: string;
  htmlCode: string;
  adSlot: string;
  weight: number;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}

const FORM_VACIO: FormState = {
  id: null,
  name: '',
  advertiser: '',
  type: 'IMAGE',
  zone: 'HEADER',
  imageUrl: '',
  targetUrl: '',
  htmlCode: '',
  adSlot: '',
  weight: 1,
  startsAt: '',
  endsAt: '',
  isActive: true
};

/** ISO -> valor compatible con <input type="datetime-local">. */
function aDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}T${pad(fecha.getHours())}:${pad(fecha.getMinutes())}`;
}

function ctr(clicks: number, impresiones: number): string {
  if (impresiones <= 0) return '—';
  return `${((clicks / impresiones) * 100).toFixed(2)}%`;
}

function formatearFecha(iso: string | null): string {
  if (!iso) return '—';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '—';
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(fecha);
}

export default function BannerManager({ banners }: BannerManagerProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const activosPorZona = ZONAS.reduce<Record<string, number>>((acc, zona) => {
    acc[zona] = banners.filter((b) => b.zone === zona && b.isActive).length;
    return acc;
  }, {});

  function editar(banner: BannerDTO) {
    setMensaje(null);
    setForm({
      id: banner.id,
      name: banner.name,
      advertiser: banner.advertiser ?? '',
      type: banner.type,
      zone: banner.zone,
      imageUrl: banner.imageUrl ?? '',
      targetUrl: banner.targetUrl ?? '',
      htmlCode: banner.htmlCode ?? '',
      adSlot: banner.adSlot ?? '',
      weight: banner.weight,
      startsAt: aDatetimeLocal(banner.startsAt),
      endsAt: aDatetimeLocal(banner.endsAt),
      isActive: banner.isActive
    });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function guardar() {
    setGuardando(true);
    setMensaje(null);
    try {
      const payload = {
        name: form.name,
        advertiser: form.advertiser || null,
        type: form.type,
        zone: form.zone,
        imageUrl: form.imageUrl || null,
        targetUrl: form.targetUrl || null,
        htmlCode: form.htmlCode || null,
        adSlot: form.adSlot || null,
        weight: Number(form.weight) || 1,
        isActive: form.isActive,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null
      };

      const response = await fetch(form.id ? `/api/banners/${form.id}` : '/api/banners', {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = (await response.json()) as { ok: boolean; error?: string };

      if (!response.ok || !data.ok) {
        setMensaje({ tipo: 'error', texto: data.error ?? 'No se pudo guardar el banner.' });
        return;
      }

      setMensaje({ tipo: 'ok', texto: form.id ? 'Banner actualizado.' : 'Banner creado.' });
      setForm(FORM_VACIO);
      router.refresh();
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo contactar al servidor.' });
    } finally {
      setGuardando(false);
    }
  }

  async function alternarActivo(banner: BannerDTO) {
    setOcupado(banner.id);
    try {
      await fetch(`/api/banners/${banner.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !banner.isActive })
      });
      router.refresh();
    } finally {
      setOcupado(null);
    }
  }

  async function eliminar(banner: BannerDTO) {
    if (typeof window !== 'undefined' && !window.confirm(`¿Eliminar el banner "${banner.name}"?`)) return;
    setOcupado(banner.id);
    try {
      await fetch(`/api/banners/${banner.id}`, { method: 'DELETE' });
      if (form.id === banner.id) setForm(FORM_VACIO);
      router.refresh();
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* --- Mapa visual de zonas --- */}
      <section className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-title">Zonas del portal</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ZONAS.map((zona) => {
            const activos = activosPorZona[zona] ?? 0;
            const ejemplo = banners.find((b) => b.zone === zona && b.isActive && b.imageUrl);
            return (
              <div key={zona} className="rounded-lg border border-news-200 bg-news-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-brand-900">{ZONA_LABELS[zona] ?? zona}</span>
                  <span className={cn(activos > 0 ? 'badge-green' : 'badge-gray')}>{activos} activos</span>
                </div>
                <div className="mt-2 flex h-16 items-center justify-center overflow-hidden rounded border border-dashed border-news-300 bg-white">
                  {ejemplo?.imageUrl ? (
                    <Image
                      src={ejemplo.imageUrl}
                      alt={ejemplo.name}
                      width={280}
                      height={60}
                      unoptimized
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <span className="text-[11px] uppercase tracking-wide text-news-400">Sin previsualización</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* --- Formulario --- */}
      <section className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-title">{form.id ? 'Editar banner' : 'Nuevo banner'}</h2>
          {form.id && (
            <button type="button" className="btn-ghost btn-sm" onClick={() => setForm(FORM_VACIO)}>
              <X className="h-3.5 w-3.5" aria-hidden />
              Cancelar edición
            </button>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="b-name">
              Nombre *
            </label>
            <input id="b-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="b-advertiser">
              Anunciante
            </label>
            <input
              id="b-advertiser"
              className="input"
              placeholder="Comercio local"
              value={form.advertiser}
              onChange={(e) => setForm({ ...form, advertiser: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="b-type">
              Tipo
            </label>
            <select
              id="b-type"
              className="select"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as TipoBanner })}
            >
              {TIPOS.map((tipo) => (
                <option key={tipo.value} value={tipo.value}>
                  {tipo.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-news-500">{TIPO_AYUDA[form.type]}</p>
          </div>
          <div>
            <label className="label" htmlFor="b-zone">
              Zona
            </label>
            <select
              id="b-zone"
              className="select"
              value={form.zone}
              onChange={(e) => setForm({ ...form, zone: e.target.value as ZonaBanner })}
            >
              {ZONAS.map((zona) => (
                <option key={zona} value={zona}>
                  {ZONA_LABELS[zona] ?? zona}
                </option>
              ))}
            </select>
          </div>

          {/* Campos condicionales */}
          {(form.type === 'IMAGE' || form.type === 'ROTATING') && (
            <>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="b-image">
                  URL de la imagen *
                </label>
                <input
                  id="b-image"
                  className="input"
                  placeholder="https://... o /uploads/imagen.webp"
                  value={form.imageUrl}
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                />
                {form.imageUrl && (
                  <div className="mt-2 max-w-xs overflow-hidden rounded border border-news-200">
                    <Image src={form.imageUrl} alt="Previsualización" width={300} height={100} unoptimized className="h-auto w-full object-contain" />
                  </div>
                )}
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="b-target">
                  URL de destino
                </label>
                <input
                  id="b-target"
                  className="input"
                  placeholder="https://sitio-del-comercio.com.ar"
                  value={form.targetUrl}
                  onChange={(e) => setForm({ ...form, targetUrl: e.target.value })}
                />
              </div>
              {form.type === 'ROTATING' && (
                <div>
                  <label className="label" htmlFor="b-weight">
                    Peso de rotación
                  </label>
                  <input
                    id="b-weight"
                    type="number"
                    min={1}
                    max={100}
                    className="input"
                    value={form.weight}
                    onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })}
                  />
                  <p className="mt-1 text-xs text-news-500">A mayor peso, más veces aparece.</p>
                </div>
              )}
            </>
          )}

          {form.type === 'ADSENSE' && (
            <div className="sm:col-span-2">
              <label className="label" htmlFor="b-adslot">
                ID de bloque de AdSense *
              </label>
              <input
                id="b-adslot"
                className="input"
                placeholder="1234567890"
                value={form.adSlot}
                onChange={(e) => setForm({ ...form, adSlot: e.target.value })}
              />
            </div>
          )}

          {form.type === 'HTML' && (
            <div className="sm:col-span-2">
              <label className="label" htmlFor="b-html">
                Código HTML *
              </label>
              <textarea
                id="b-html"
                className="textarea font-mono text-xs"
                placeholder="<div>...</div>"
                value={form.htmlCode}
                onChange={(e) => setForm({ ...form, htmlCode: e.target.value })}
              />
            </div>
          )}

          <div>
            <label className="label" htmlFor="b-starts">
              Vigencia desde
            </label>
            <input
              id="b-starts"
              type="datetime-local"
              className="input"
              value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="b-ends">
              Vigencia hasta
            </label>
            <input
              id="b-ends"
              type="datetime-local"
              className="input"
              value={form.endsAt}
              onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-3 sm:col-span-2">
            <input
              type="checkbox"
              className="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            <span className="text-sm text-news-700">Banner activo</span>
          </label>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" className="btn-primary" onClick={guardar} disabled={guardando || !form.name.trim()}>
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : form.id ? <Save className="h-4 w-4" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
            {form.id ? 'Guardar cambios' : 'Crear banner'}
          </button>
        </div>

        {mensaje && (
          <p className={cn('mt-3 text-sm font-semibold', mensaje.tipo === 'ok' ? 'text-emerald-700' : 'text-accent-500')}>
            {mensaje.texto}
          </p>
        )}
      </section>

      {/* --- Tabla --- */}
      <section className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-title">Banners cargados</h2>
        </div>
        {banners.length === 0 ? (
          <p className="text-sm text-news-500">Todavía no hay banners. Creá el primero con el formulario de arriba.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-admin min-w-[900px]">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Anunciante</th>
                  <th>Tipo</th>
                  <th>Zona</th>
                  <th>Estado</th>
                  <th>Vigencia</th>
                  <th className="text-right">Impr.</th>
                  <th className="text-right">Clics</th>
                  <th className="text-right">CTR</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {banners.map((banner) => (
                  <tr key={banner.id}>
                    <td className="font-semibold text-brand-900">{banner.name}</td>
                    <td>{banner.advertiser || '—'}</td>
                    <td>{TIPO_LABEL[banner.type]}</td>
                    <td className="text-xs">{ZONA_LABELS[banner.zone] ?? banner.zone}</td>
                    <td>
                      <span className={banner.isActive ? 'badge-green' : 'badge-gray'}>
                        {banner.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap text-xs">
                      {formatearFecha(banner.startsAt)} → {formatearFecha(banner.endsAt)}
                    </td>
                    <td className="text-right tabular-nums">{banner.impressions.toLocaleString('es-AR')}</td>
                    <td className="text-right tabular-nums">{banner.clicks.toLocaleString('es-AR')}</td>
                    <td className="text-right tabular-nums">{ctr(banner.clicks, banner.impressions)}</td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          className="btn-ghost btn-sm"
                          title="Editar"
                          onClick={() => editar(banner)}
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          className="btn-ghost btn-sm"
                          title={banner.isActive ? 'Desactivar' : 'Activar'}
                          disabled={ocupado === banner.id}
                          onClick={() => alternarActivo(banner)}
                        >
                          <Power className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          className="btn-ghost btn-sm text-accent-500"
                          title="Eliminar"
                          disabled={ocupado === banner.id}
                          onClick={() => eliminar(banner)}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 flex items-center gap-2 text-xs text-news-500">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          Las métricas se incrementan desde el endpoint público de tracking del banner.
        </p>
      </section>
    </div>
  );
}
