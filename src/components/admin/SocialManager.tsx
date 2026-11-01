'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  Facebook,
  Instagram,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Twitter,
  X
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Gestor de difusión en redes (/admin/difusion).
 * Tarjetas por red, formulario de canal y cola de publicaciones con reintento.
 */

export type RedSocial = 'FACEBOOK' | 'INSTAGRAM' | 'TELEGRAM' | 'X' | 'WHATSAPP';
export type EstadoPost = 'PENDING' | 'SENT' | 'ERROR' | 'SKIPPED';

export interface CanalDTO {
  id: string;
  network: RedSocial;
  name: string;
  webhookUrl: string | null;
  chatId: string | null;
  autoPublish: boolean;
  isActive: boolean;
  accessTokenMasked: string;
  hasAccessToken: boolean;
}

export interface PostDTO {
  id: string;
  status: EstadoPost;
  error: string | null;
  permalink: string | null;
  sentAt: string | null;
  createdAt: string;
  article: { id: string; title: string; slug: string };
  channel: { name: string; network: RedSocial };
}

interface SocialManagerProps {
  canales: CanalDTO[];
  posts: PostDTO[];
}

interface FormState {
  id: string | null;
  network: RedSocial;
  name: string;
  webhookUrl: string;
  accessToken: string;
  chatId: string;
  autoPublish: boolean;
  isActive: boolean;
}

const REDES: { id: RedSocial; label: string; icon: LucideIcon }[] = [
  { id: 'FACEBOOK', label: 'Facebook', icon: Facebook },
  { id: 'INSTAGRAM', label: 'Instagram', icon: Instagram },
  { id: 'TELEGRAM', label: 'Telegram', icon: Send },
  { id: 'X', label: 'X (Twitter)', icon: Twitter },
  { id: 'WHATSAPP', label: 'WhatsApp', icon: MessageCircle }
];

const AYUDA_RED: Record<RedSocial, string> = {
  TELEGRAM:
    'Creá un bot con @BotFather en Telegram, copiá el token, agregá el bot como administrador del canal y usá @nombreDelCanal (o el ID numérico) como chat ID. Con esto la publicación es directa, sin webhook.',
  FACEBOOK:
    'Usá un webhook de Make, Zapier o n8n (o la Graph API con un servicio propio). El portal hace un POST al webhook con el texto, el enlace y la imagen, firmado con HMAC-SHA256.',
  INSTAGRAM:
    'Instagram no permite publicar solo con texto: configurá un webhook (Make/Zapier/n8n) que reciba la imagen y el pie de foto y haga la publicación vía Graph API.',
  X: 'Cargá un webhook que reciba el payload y publique con la API de X. El texto se recorta automáticamente y se agregan los hashtags del portal.',
  WHATSAPP:
    'Cargá un webhook o el link de un canal/grupo. Podés usar los botones de compartir manual del panel para difundir a mano.'
};

const FORM_VACIO: FormState = {
  id: null,
  network: 'TELEGRAM',
  name: '',
  webhookUrl: '',
  accessToken: '',
  chatId: '',
  autoPublish: false,
  isActive: true
};

const ESTADO_UI: Record<EstadoPost, { label: string; clase: string }> = {
  SENT: { label: 'Enviado', clase: 'badge-green' },
  ERROR: { label: 'Error', clase: 'badge-red' },
  SKIPPED: { label: 'Omitido', clase: 'badge-amber' },
  PENDING: { label: 'Pendiente', clase: 'badge-gray' }
};

function formatearFecha(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '—';
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(fecha);
}

export default function SocialManager({ canales, posts }: SocialManagerProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  function editar(canal: CanalDTO) {
    setMensaje(null);
    setForm({
      id: canal.id,
      network: canal.network,
      name: canal.name,
      webhookUrl: canal.webhookUrl ?? '',
      accessToken: '',
      chatId: canal.chatId ?? '',
      autoPublish: canal.autoPublish,
      isActive: canal.isActive
    });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function guardar() {
    setGuardando(true);
    setMensaje(null);
    try {
      const payload: Record<string, unknown> = {
        network: form.network,
        name: form.name,
        webhookUrl: form.webhookUrl || null,
        chatId: form.chatId || null,
        autoPublish: form.autoPublish,
        isActive: form.isActive
      };
      if (form.accessToken.trim()) payload.accessToken = form.accessToken.trim();

      const response = await fetch(form.id ? `/api/difusion/canales/${form.id}` : '/api/difusion/canales', {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = (await response.json()) as { ok: boolean; error?: string };

      if (!response.ok || !data.ok) {
        setMensaje({ tipo: 'error', texto: data.error ?? 'No se pudo guardar el canal.' });
        return;
      }

      setMensaje({ tipo: 'ok', texto: form.id ? 'Canal actualizado.' : 'Canal creado.' });
      setForm(FORM_VACIO);
      router.refresh();
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo contactar al servidor.' });
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(canal: CanalDTO) {
    if (typeof window !== 'undefined' && !window.confirm(`¿Eliminar el canal "${canal.name}"?`)) return;
    setOcupado(canal.id);
    try {
      await fetch(`/api/difusion/canales/${canal.id}`, { method: 'DELETE' });
      if (form.id === canal.id) setForm(FORM_VACIO);
      router.refresh();
    } finally {
      setOcupado(null);
    }
  }

  async function reintentar(post: PostDTO) {
    setOcupado(post.id);
    setMensaje(null);
    try {
      const response = await fetch('/api/difusion/reintentar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id })
      });
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        setMensaje({ tipo: 'error', texto: data.error ?? 'No se pudo reintentar.' });
      } else {
        setMensaje({ tipo: 'ok', texto: 'Reintento ejecutado.' });
      }
      router.refresh();
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo contactar al servidor.' });
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="space-y-6">
      {mensaje && (
        <p className={cn('text-sm font-semibold', mensaje.tipo === 'ok' ? 'text-emerald-700' : 'text-accent-500')}>
          {mensaje.texto}
        </p>
      )}

      {/* --- Tarjetas por red --- */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REDES.map((red) => {
          const propios = canales.filter((c) => c.network === red.id);
          const Icono = red.icon;
          return (
            <div key={red.id} className="admin-card">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-800">
                  <Icono className="h-4 w-4" aria-hidden />
                </span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-brand-900">{red.label}</p>
                  <p className="text-xs text-news-500">
                    {propios.length === 0 ? 'Sin canales configurados' : `${propios.length} canal(es)`}
                  </p>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {propios.map((canal) => (
                  <div key={canal.id} className="flex items-center justify-between gap-2 rounded-md border border-news-200 px-2 py-1.5">
                    <span className="truncate text-xs text-news-700">{canal.name}</span>
                    <span className="flex items-center gap-1">
                      <span className={canal.isActive ? 'badge-green' : 'badge-gray'}>
                        {canal.isActive ? 'Activa' : 'Pausada'}
                      </span>
                      {canal.autoPublish && <span className="badge-blue">Auto</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {/* --- Formulario --- */}
      <section className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-title">{form.id ? 'Editar canal' : 'Nuevo canal'}</h2>
          {form.id && (
            <button type="button" className="btn-ghost btn-sm" onClick={() => setForm(FORM_VACIO)}>
              <X className="h-3.5 w-3.5" aria-hidden />
              Cancelar edición
            </button>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="c-network">
              Red social
            </label>
            <select
              id="c-network"
              className="select"
              value={form.network}
              onChange={(e) => setForm({ ...form, network: e.target.value as RedSocial })}
            >
              {REDES.map((red) => (
                <option key={red.id} value={red.id}>
                  {red.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-news-500">{AYUDA_RED[form.network]}</p>
          </div>
          <div>
            <label className="label" htmlFor="c-name">
              Nombre del canal *
            </label>
            <input
              id="c-name"
              className="input"
              placeholder="Ej: Canal de Telegram Saladillo Noticias"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="c-webhook">
              Webhook URL
            </label>
            <input
              id="c-webhook"
              className="input"
              placeholder="https://hook.make.com/..."
              value={form.webhookUrl}
              onChange={(e) => setForm({ ...form, webhookUrl: e.target.value })}
            />
            <p className="mt-1 text-xs text-news-500">
              Para Facebook, Instagram, X y WhatsApp. Se hace un POST con el texto, el enlace y la imagen, firmado con
              HMAC-SHA256.
            </p>
          </div>
          <div>
            <label className="label" htmlFor="c-token">
              Access Token
            </label>
            <input
              id="c-token"
              type="password"
              className="input"
              autoComplete="off"
              placeholder={form.id ? 'Dejar vacío para no cambiarlo' : 'Token del bot o de la API'}
              value={form.accessToken}
              onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
            />
            <p className="mt-1 text-xs text-news-500">Se guarda cifrado con AES-256-GCM y no se devuelve al navegador.</p>
          </div>
          <div>
            <label className="label" htmlFor="c-chat">
              Chat ID
            </label>
            <input
              id="c-chat"
              className="input"
              placeholder="@nombreDelCanal o ID numérico"
              value={form.chatId}
              onChange={(e) => setForm({ ...form, chatId: e.target.value })}
            />
            <p className="mt-1 text-xs text-news-500">Requerido para Telegram.</p>
          </div>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              className="checkbox"
              checked={form.autoPublish}
              onChange={(e) => setForm({ ...form, autoPublish: e.target.checked })}
            />
            <span className="text-sm text-news-700">Publicar automáticamente las notas nuevas</span>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              className="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            <span className="text-sm text-news-700">Canal activo</span>
          </label>
        </div>

        <div className="mt-5">
          <button type="button" className="btn-primary" onClick={guardar} disabled={guardando || !form.name.trim()}>
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : form.id ? <Pencil className="h-4 w-4" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
            {form.id ? 'Guardar cambios' : 'Crear canal'}
          </button>
        </div>
      </section>

      {/* --- Canales configurados --- */}
      <section className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-title">Canales configurados</h2>
        </div>
        {canales.length === 0 ? (
          <p className="text-sm text-news-500">Todavía no hay canales. Creá el primero con el formulario de arriba.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-admin min-w-[720px]">
              <thead>
                <tr>
                  <th>Red</th>
                  <th>Nombre</th>
                  <th>Webhook</th>
                  <th>Token</th>
                  <th>Chat ID</th>
                  <th>Estado</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {canales.map((canal) => {
                  const red = REDES.find((r) => r.id === canal.network);
                  const Icono = red?.icon ?? Send;
                  return (
                    <tr key={canal.id}>
                      <td>
                        <span className="flex items-center gap-2 text-xs font-semibold text-brand-900">
                          <Icono className="h-3.5 w-3.5" aria-hidden />
                          {red?.label ?? canal.network}
                        </span>
                      </td>
                      <td className="font-semibold text-brand-900">{canal.name}</td>
                      <td className="max-w-[220px] truncate text-xs">{canal.webhookUrl || '—'}</td>
                      <td className="text-xs">{canal.hasAccessToken ? canal.accessTokenMasked : '—'}</td>
                      <td className="text-xs">{canal.chatId || '—'}</td>
                      <td>
                        <span className="flex flex-wrap gap-1">
                          <span className={canal.isActive ? 'badge-green' : 'badge-gray'}>
                            {canal.isActive ? 'Activo' : 'Inactivo'}
                          </span>
                          {canal.autoPublish && <span className="badge-blue">Auto</span>}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" className="btn-ghost btn-sm" title="Editar" onClick={() => editar(canal)}>
                            <Pencil className="h-3.5 w-3.5" aria-hidden />
                          </button>
                          <button
                            type="button"
                            className="btn-ghost btn-sm text-accent-500"
                            title="Eliminar"
                            disabled={ocupado === canal.id}
                            onClick={() => eliminar(canal)}
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* --- Cola de publicaciones --- */}
      <section className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-title">Cola de publicaciones</h2>
          <span className="text-xs text-news-500">Últimos 30 envíos</span>
        </div>
        {posts.length === 0 ? (
          <p className="text-sm text-news-500">Todavía no hay publicaciones registradas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-admin min-w-[820px]">
              <thead>
                <tr>
                  <th>Nota</th>
                  <th>Canal</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th>Detalle</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => {
                  const estado = ESTADO_UI[post.status];
                  return (
                    <tr key={post.id}>
                      <td className="max-w-[260px]">
                        <Link href={`/nota/${post.article.slug}`} className="line-clamp-2-custom font-semibold text-brand-900 hover:underline">
                          {post.article.title}
                        </Link>
                      </td>
                      <td className="text-xs">{post.channel.name}</td>
                      <td>
                        <span className={estado.clase}>{estado.label}</span>
                      </td>
                      <td className="whitespace-nowrap text-xs">{formatearFecha(post.sentAt ?? post.createdAt)}</td>
                      <td className="max-w-[240px] text-xs text-news-500">
                        {post.error ? (
                          <span className="text-accent-500">{post.error}</span>
                        ) : post.permalink ? (
                          <a href={post.permalink} target="_blank" rel="noopener" className="text-brand-600 hover:underline">
                            Ver publicación
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <div className="flex justify-end">
                          {post.status !== 'SENT' && (
                            <button
                              type="button"
                              className="btn-secondary btn-sm"
                              disabled={ocupado === post.id}
                              onClick={() => reintentar(post)}
                            >
                              {ocupado === post.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                              ) : (
                                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                              )}
                              Reintentar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* --- Guía de conexión --- */}
      <section className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-title">Cómo conectar cada red</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-news-200 p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-brand-900">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
              Telegram (conexión directa)
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-news-600">
              <li>Abrí Telegram y buscá <strong>@BotFather</strong>.</li>
              <li>Enviá <code className="rounded bg-news-100 px-1">/newbot</code> y seguí los pasos para crear el bot.</li>
              <li>Copiá el token que te devuelve BotFather y pegalo en el campo Access Token.</li>
              <li>Agregá el bot como <strong>administrador</strong> del canal o grupo donde va a publicar.</li>
              <li>Usá <strong>@nombreDelCanal</strong> (o el ID numérico) como Chat ID.</li>
              <li>Marcá "Publicar automáticamente" si querés difusión sin intervención.</li>
            </ol>
          </div>
          <div className="rounded-lg border border-news-200 p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-brand-900">
              <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden />
              Facebook, Instagram, X y WhatsApp
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-news-600">
              <li>Creá un escenario en Make, Zapier o n8n que reciba un POST con JSON.</li>
              <li>Copiá la URL del webhook y pegala en el campo Webhook URL.</li>
              <li>El portal envía <code className="rounded bg-news-100 px-1">text</code>, <code className="rounded bg-news-100 px-1">title</code>, <code className="rounded bg-news-100 px-1">summary</code>, <code className="rounded bg-news-100 px-1">url</code> e <code className="rounded bg-news-100 px-1">imageUrl</code>.</li>
              <li>Validá el header <code className="rounded bg-news-100 px-1">X-Saladillo-Signature</code> (HMAC-SHA256 del cuerpo con SESSION_SECRET).</li>
              <li>Si no hay webhook ni token, el envío queda como "Omitido" en modo simulación.</li>
            </ol>
          </div>
        </div>
      </section>
    </div>
  );
}
