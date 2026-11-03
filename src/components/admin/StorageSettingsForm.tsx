'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Save, Trash2, Zap } from 'lucide-react';
import type { StorageSettings } from '@/lib/settings';

/**
 * Formulario de almacenamiento externo (/admin/almacenamiento).
 * Escritura contra /api/almacenamiento/config y prueba contra /api/almacenamiento/probar.
 */

interface StorageSettingsFormProps {
  initial: StorageSettings;
  proveedores: { id: string; nombre: string }[];
}

interface ProbarResultado {
  ok: boolean;
  message: string;
  url?: string;
}

export default function StorageSettingsForm({ initial, proveedores }: StorageSettingsFormProps) {
  const [defaultProvider, setDefaultProvider] = useState(initial.defaultProvider);
  const [supabaseUrl, setSupabaseUrl] = useState(initial.supabaseUrl);
  const [supabaseBucket, setSupabaseBucket] = useState(initial.supabaseBucket);
  const [serviceKey, setServiceKey] = useState('');
  const [maskedKey, setMaskedKey] = useState(initial.supabaseServiceKeyMasked);
  const [hasKey, setHasKey] = useState(initial.hasSupabaseServiceKey);
  const [clearKey, setClearKey] = useState(false);

  const [guardando, setGuardando] = useState(false);
  const [probando, setProbando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [resultadoPrueba, setResultadoPrueba] = useState<ProbarResultado | null>(null);

  const nombreProveedor = (id: string) => proveedores.find((p) => p.id === id)?.nombre ?? id;

  async function probar() {
    setProbando(true);
    setResultadoPrueba(null);
    try {
      const response = await fetch('/api/almacenamiento/probar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proveedor: defaultProvider || 'default' })
      });
      const data = (await response.json()) as { ok: boolean; url?: string; error?: string };
      setResultadoPrueba(
        data.ok
          ? { ok: true, message: 'Subida de prueba correcta.', url: data.url }
          : { ok: false, message: data.error ?? 'No se pudo probar el almacenamiento.' }
      );
    } catch {
      setResultadoPrueba({ ok: false, message: 'No se pudo contactar al servidor.' });
    } finally {
      setProbando(false);
    }
  }

  async function guardar() {
    setGuardando(true);
    setMensaje(null);
    try {
      const payload: Record<string, unknown> = {
        defaultProvider,
        supabaseUrl: supabaseUrl.trim(),
        supabaseBucket: supabaseBucket.trim()
      };
      if (serviceKey.trim()) payload.supabaseServiceKey = serviceKey.trim();
      if (clearKey) payload.clearSupabaseServiceKey = true;

      const response = await fetch('/api/almacenamiento/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = (await response.json()) as { ok: boolean; settings?: StorageSettings; error?: string };

      if (!response.ok || !data.ok) {
        setMensaje({ tipo: 'error', texto: data.error ?? 'No se pudo guardar la configuración.' });
        return;
      }

      if (data.settings) {
        setMaskedKey(data.settings.supabaseServiceKeyMasked);
        setHasKey(data.settings.hasSupabaseServiceKey);
      }
      setServiceKey('');
      setClearKey(false);
      setMensaje({ tipo: 'ok', texto: 'Configuración guardada correctamente.' });
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo contactar al servidor.' });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-6">
      {!defaultProvider && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <div className="text-sm">
            <p className="font-semibold">No hay un proveedor por defecto elegido.</p>
            <p className="mt-0.5">
              Mientras no elijas uno, las portadas se siguen guardando en el servidor (no persisten en Vercel) y el
              botón «Alojar imagen» del editor no va a funcionar.
            </p>
          </div>
        </div>
      )}

      <section className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-title">Proveedor por defecto</h2>
        </div>

        <div>
          <label className="label" htmlFor="storage-provider">
            ¿Dónde alojar las portadas?
          </label>
          <select
            id="storage-provider"
            className="select"
            value={defaultProvider}
            onChange={(e) => setDefaultProvider(e.target.value)}
          >
            <option value="">Ninguno (guardar en el servidor)</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-news-500">
            Es el proveedor que usa el scraper y el que se propone por defecto en el editor de cada nota.
          </p>
        </div>
      </section>

      <section className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-title">Supabase Storage</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="storage-supabase-url">
              URL del proyecto
            </label>
            <input
              id="storage-supabase-url"
              className="input"
              placeholder="https://xxxxxxxx.supabase.co"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="storage-supabase-bucket">
              Bucket (público)
            </label>
            <input
              id="storage-supabase-bucket"
              className="input"
              placeholder="portadas"
              value={supabaseBucket}
              onChange={(e) => setSupabaseBucket(e.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="label" htmlFor="storage-supabase-key">
              Service Role Key
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="storage-supabase-key"
                type="password"
                className="input flex-1"
                autoComplete="off"
                placeholder={maskedKey || 'eyJhbGciOi…'}
                value={serviceKey}
                onChange={(e) => {
                  setServiceKey(e.target.value);
                  if (e.target.value) setClearKey(false);
                }}
              />
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => {
                  setServiceKey('');
                  setClearKey(true);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Quitar clave
              </button>
            </div>
            <p className="mt-2 text-xs text-news-500">
              Se guarda cifrada con AES-256-GCM y nunca se devuelve al navegador. Si dejás el campo vacío, no se
              sobreescribe la clave actual. El bucket tiene que estar marcado como público.
            </p>
            {clearKey && (
              <p className="mt-1 text-xs font-semibold text-accent-500">
                Atención: al guardar se va a borrar la clave actual.
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" className="btn-primary btn-sm" onClick={guardar} disabled={guardando}>
            {guardando ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Save className="h-3.5 w-3.5" aria-hidden />
            )}
            Guardar
          </button>
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={probar}
            disabled={probando || !hasKey}
            title={hasKey ? undefined : 'Cargá y guardá la service role key primero'}
          >
            {probando ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Zap className="h-3.5 w-3.5" aria-hidden />
            )}
            Probar subida
          </button>

          {mensaje && (
            <span className={`text-sm ${mensaje.tipo === 'ok' ? 'text-emerald-700' : 'text-accent-600'}`}>
              {mensaje.texto}
            </span>
          )}
        </div>

        {resultadoPrueba && (
          <div
            className={`mt-4 flex items-start gap-2 rounded-lg border p-3 text-sm ${
              resultadoPrueba.ok
                ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                : 'border-red-300 bg-red-50 text-red-900'
            }`}
          >
            {resultadoPrueba.ok ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            )}
            <div>
              <p className="font-medium">{resultadoPrueba.message}</p>
              {resultadoPrueba.url && (
                <a
                  href={resultadoPrueba.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block break-all text-xs underline"
                >
                  {resultadoPrueba.url}
                </a>
              )}
              {resultadoPrueba.ok && defaultProvider && (
                <p className="mt-1 text-xs">Proveedor: {nombreProveedor(defaultProvider)}</p>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
