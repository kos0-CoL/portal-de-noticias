'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Save, Trash2, Zap } from 'lucide-react';
import type { AiProvider, AiSettings, WatermarkSettings } from '@/lib/settings';
import { TONALIDADES } from '@/lib/constants';
import { cn } from '@/lib/utils';

/**
 * Formulario de configuración de IA (/admin/ia).
 * Toda la escritura se hace contra /api/ia/config y la prueba contra /api/ia/probar.
 */

interface IaSettingsFormProps {
  initial: AiSettings;
  /** BASE_URLS viene por props para no arrastrar el módulo de Prisma al bundle del cliente. */
  baseUrls: Record<string, string>;
  modelosSugeridos: Record<string, string[]>;
  watermark: WatermarkSettings;
  imageMaxWidth: number;
  imageQuality: number;
}

interface ProbarResultado {
  ok: boolean;
  message: string;
  model?: string;
  latencyMs?: number;
}

const PROVEEDORES: { value: AiProvider; label: string }[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'groq', label: 'Groq' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'custom', label: 'Otro proveedor (compatible con OpenAI)' }
];

const POSICIONES: { value: WatermarkSettings['position']; label: string }[] = [
  { value: 'southeast', label: 'Abajo a la derecha' },
  { value: 'southwest', label: 'Abajo a la izquierda' },
  { value: 'northeast', label: 'Arriba a la derecha' },
  { value: 'northwest', label: 'Arriba a la izquierda' },
  { value: 'center', label: 'Centro' }
];

const VALOR_OTRO = '__otro__';

/** Recuadro gris que muestra dónde caería la marca de agua. */
function PrevisualizacionMarca({ position }: { position: WatermarkSettings['position'] }) {
  const ubicacion: Record<WatermarkSettings['position'], string> = {
    southeast: 'bottom-2 right-2',
    southwest: 'bottom-2 left-2',
    northeast: 'top-2 right-2',
    northwest: 'top-2 left-2',
    center: 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'
  };
  return (
    <div className="relative h-28 w-44 overflow-hidden rounded-md border border-news-300 bg-news-200">
      <div className="absolute inset-0 flex items-center justify-center text-[10px] uppercase tracking-widest text-news-400">
        imagen
      </div>
      <span
        className={cn(
          'absolute rounded bg-black/45 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white',
          ubicacion[position]
        )}
      >
        Saladillo Noticias
      </span>
    </div>
  );
}

export default function IaSettingsForm({ initial, baseUrls, modelosSugeridos, watermark, imageMaxWidth: maxWidthInicial, imageQuality: calidadInicial }: IaSettingsFormProps) {
  const [provider, setProvider] = useState<AiProvider>(initial.provider);
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl || baseUrls[initial.provider] || '');
  const sugeridos = useMemo(() => modelosSugeridos[provider] ?? [], [modelosSugeridos, provider]);
  const [modeloSeleccionado, setModeloSeleccionado] = useState<string>(
    sugeridos.includes(initial.model) ? initial.model : VALOR_OTRO
  );
  const [modeloLibre, setModeloLibre] = useState(initial.model);

  const [apiKey, setApiKey] = useState('');
  const [maskedKey, setMaskedKey] = useState(initial.apiKeyMasked);
  const [hasKey, setHasKey] = useState(initial.hasApiKey);
  const [clearKey, setClearKey] = useState(false);

  const [semillaModelo] = useState(initial.model);
  const [defaultTonality, setDefaultTonality] = useState(initial.defaultTonality);
  const [citeSource, setCiteSource] = useState(initial.citeSource);
  const [rewriteEnabled, setRewriteEnabled] = useState(initial.rewriteEnabled);
  const [temperature, setTemperature] = useState(initial.temperature);
  const [systemPrompt, setSystemPrompt] = useState(initial.systemPrompt);

  const [watermarkEnabled, setWatermarkEnabled] = useState(watermark.enabled);
  const [watermarkText, setWatermarkText] = useState(watermark.text);
  const [watermarkOpacity, setWatermarkOpacity] = useState(watermark.opacity);
  const [watermarkPosition, setWatermarkPosition] = useState<WatermarkSettings['position']>(watermark.position);
  const [watermarkLogo, setWatermarkLogo] = useState(watermark.logoUrl ?? '');
  const [imageMaxWidth, setImageMaxWidth] = useState(maxWidthInicial);
  const [imageQuality, setImageQuality] = useState(calidadInicial);

  const [guardando, setGuardando] = useState(false);
  const [probando, setProbando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [resultadoPrueba, setResultadoPrueba] = useState<ProbarResultado | null>(null);

  const modeloFinal = modeloSeleccionado === VALOR_OTRO ? modeloLibre.trim() : modeloSeleccionado;

  function cambiarProveedor(nuevo: AiProvider) {
    setProvider(nuevo);
    setBaseUrl(baseUrls[nuevo] ?? '');
    const lista = modelosSugeridos[nuevo] ?? [];
    if (lista.length > 0) {
      setModeloSeleccionado(lista.includes(semillaModelo) ? semillaModelo : lista[0]);
    } else {
      setModeloSeleccionado(VALOR_OTRO);
    }
  }

  async function probarConexion() {
    setProbando(true);
    setResultadoPrueba(null);
    try {
      const response = await fetch('/api/ia/probar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          model: modeloFinal,
          baseUrl,
          apiKey: apiKey.trim() ? apiKey.trim() : undefined
        })
      });
      const data = (await response.json()) as { ok: boolean; result?: ProbarResultado; error?: string };
      setResultadoPrueba(
        data.result ?? { ok: false, message: data.error ?? 'No se pudo probar la conexión.' }
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
        provider,
        model: modeloFinal,
        baseUrl,
        defaultTonality,
        citeSource,
        rewriteEnabled,
        temperature,
        systemPrompt,
        imageWatermark: {
          enabled: watermarkEnabled,
          text: watermarkText,
          opacity: watermarkOpacity,
          position: watermarkPosition,
          logoUrl: watermarkLogo.trim() ? watermarkLogo.trim() : null
        },
        imageMaxWidth,
        imageQuality
      };
      if (apiKey.trim()) payload.apiKey = apiKey.trim();
      if (clearKey) payload.clearApiKey = true;

      const response = await fetch('/api/ia/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = (await response.json()) as { ok: boolean; settings?: AiSettings; error?: string };

      if (!response.ok || !data.ok) {
        setMensaje({ tipo: 'error', texto: data.error ?? 'No se pudo guardar la configuración.' });
        return;
      }

      if (data.settings) {
        setMaskedKey(data.settings.apiKeyMasked);
        setHasKey(data.settings.hasApiKey);
      }
      setApiKey('');
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
      {!hasKey && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <div className="text-sm">
            <p className="font-semibold">Todavía no hay una API Key de IA cargada.</p>
            <p className="mt-0.5">
              La reescritura automática y la generación de metadatos van a fallar hasta que cargues una clave en esta
              pantalla.
            </p>
          </div>
        </div>
      )}

      {/* --- Proveedor y credenciales --- */}
      <section className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-title">Proveedor y credenciales</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="ia-provider">
              Proveedor
            </label>
            <select
              id="ia-provider"
              className="select"
              value={provider}
              onChange={(e) => cambiarProveedor(e.target.value as AiProvider)}
            >
              {PROVEEDORES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="ia-model">
              Modelo
            </label>
            <select
              id="ia-model"
              className="select"
              value={modeloSeleccionado}
              onChange={(e) => setModeloSeleccionado(e.target.value)}
            >
              {sugeridos.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
              <option value={VALOR_OTRO}>Otro (escribir manualmente)</option>
            </select>
            {modeloSeleccionado === VALOR_OTRO && (
              <input
                className="input mt-2"
                placeholder="Nombre exacto del modelo"
                value={modeloLibre}
                onChange={(e) => setModeloLibre(e.target.value)}
              />
            )}
          </div>

          <div className="sm:col-span-2">
            <label className="label" htmlFor="ia-apikey">
              API Key
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="ia-apikey"
                type="password"
                className="input flex-1"
                autoComplete="off"
                placeholder={maskedKey || 'sk-...'}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  if (e.target.value) setClearKey(false);
                }}
              />
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => {
                  setApiKey('');
                  setClearKey(true);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Quitar clave
              </button>
            </div>
            <p className="mt-2 text-xs text-news-500">
              La clave se guarda cifrada con AES-256-GCM y nunca se devuelve al navegador. Si dejás el campo vacío, no
              se sobreescribe la clave actual.
            </p>
            {clearKey && (
              <p className="mt-1 text-xs font-semibold text-accent-500">
                Atención: al guardar se va a borrar la clave actual.
              </p>
            )}
          </div>

          <div className="sm:col-span-2">
            <label className="label" htmlFor="ia-baseurl">
              URL base del proveedor
            </label>
            <input
              id="ia-baseurl"
              className="input disabled:bg-news-100 disabled:text-news-500"
              value={baseUrl}
              disabled={provider !== 'custom'}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.proveedor.com/v1"
            />
            <p className="mt-2 text-xs text-news-500">
              {provider === 'custom'
                ? 'En proveedor propio podés editar la URL base. Debe ser compatible con la API de Chat Completions.'
                : 'Se completa automáticamente según el proveedor elegido.'}
            </p>
          </div>

          <div className="sm:col-span-2">
            <label className="label" htmlFor="ia-temp">
              Temperatura (creatividad): {temperature.toFixed(2)}
            </label>
            <input
              id="ia-temp"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              className="w-full accent-brand-700"
            />
            <p className="mt-1 text-xs text-news-500">
              Valores altos dan textos más sueltos; valores bajos, más fieles al original.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" className="btn-secondary" onClick={probarConexion} disabled={probando}>
            {probando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Zap className="h-4 w-4" aria-hidden />}
            Probar conexión
          </button>
          <button type="button" className="btn-primary" onClick={guardar} disabled={guardando}>
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
            Guardar configuración
          </button>
        </div>

        {resultadoPrueba && (
          <div
            className={cn(
              'mt-4 flex items-start gap-2 rounded-md border p-3 text-sm',
              resultadoPrueba.ok
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                : 'border-red-300 bg-red-50 text-red-700'
            )}
          >
            {resultadoPrueba.ok ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            )}
            <div>
              <p>{resultadoPrueba.message}</p>
              {resultadoPrueba.ok && (
                <p className="mt-0.5 text-xs opacity-80">
                  Modelo: {resultadoPrueba.model} · Latencia: {resultadoPrueba.latencyMs} ms
                </p>
              )}
            </div>
          </div>
        )}

        {mensaje && (
          <p className={cn('mt-3 text-sm font-semibold', mensaje.tipo === 'ok' ? 'text-emerald-700' : 'text-accent-500')}>
            {mensaje.texto}
          </p>
        )}
      </section>

      {/* --- Redacción por defecto --- */}
      <section className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-title">Redacción por defecto</h2>
        </div>

        <p className="label">Tono por defecto</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {TONALIDADES.map((tono) => (
            <button
              key={tono.value}
              type="button"
              onClick={() => setDefaultTonality(tono.value)}
              className={cn(
                'rounded-lg border p-3 text-left transition',
                defaultTonality === tono.value
                  ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-500/20'
                  : 'border-news-300 bg-white hover:border-brand-300'
              )}
            >
              <span className="block text-sm font-bold text-brand-900">{tono.label}</span>
              <span className="mt-1 block text-xs text-news-500">{tono.description}</span>
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-3">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="checkbox mt-0.5"
              checked={rewriteEnabled}
              onChange={(e) => setRewriteEnabled(e.target.checked)}
            />
            <span className="text-sm text-news-700">Reescribir automáticamente las notas que trae el scraper</span>
          </label>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="checkbox mt-0.5"
              checked={citeSource}
              onChange={(e) => setCiteSource(e.target.checked)}
            />
            <span className="text-sm text-news-700">Citar siempre la fuente original al final de la nota</span>
          </label>
        </div>

        <div className="mt-5">
          <label className="label" htmlFor="ia-system">
            Instrucciones adicionales para la IA
          </label>
          <textarea
            id="ia-system"
            className="textarea"
            placeholder="Ej: evitar la palabra 'impactante'; usar 'vecinos' en lugar de 'habitantes'..."
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
          />
          <p className="mt-1 text-xs text-news-500">Se anexan al prompt del sistema en cada reescritura.</p>
        </div>
      </section>

      {/* --- Marcas de agua e imágenes --- */}
      <section className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-title">Marcas de agua e imágenes</h2>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="checkbox mt-0.5"
                checked={watermarkEnabled}
                onChange={(e) => setWatermarkEnabled(e.target.checked)}
              />
              <span className="text-sm text-news-700">Aplicar marca de agua a las imágenes procesadas</span>
            </label>

            <div>
              <label className="label" htmlFor="ia-wm-text">
                Texto de la marca
              </label>
              <input
                id="ia-wm-text"
                className="input"
                value={watermarkText}
                onChange={(e) => setWatermarkText(e.target.value)}
              />
            </div>

            <div>
              <label className="label" htmlFor="ia-wm-opacity">
                Opacidad: {Math.round(watermarkOpacity * 100)}%
              </label>
              <input
                id="ia-wm-opacity"
                type="range"
                min={0.05}
                max={1}
                step={0.05}
                value={watermarkOpacity}
                onChange={(e) => setWatermarkOpacity(Number(e.target.value))}
                className="w-full accent-brand-700"
              />
            </div>

            <div>
              <label className="label" htmlFor="ia-wm-position">
                Posición
              </label>
              <select
                id="ia-wm-position"
                className="select"
                value={watermarkPosition}
                onChange={(e) => setWatermarkPosition(e.target.value as WatermarkSettings['position'])}
              >
                {POSICIONES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="ia-wm-logo">
                URL del logo (opcional)
              </label>
              <input
                id="ia-wm-logo"
                className="input"
                placeholder="https://... o /uploads/logo.png"
                value={watermarkLogo}
                onChange={(e) => setWatermarkLogo(e.target.value)}
              />
              <p className="mt-1 text-xs text-news-500">Si se completa, se usa el logo en lugar del texto.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="label">Previsualización de la posición</p>
              <PrevisualizacionMarca position={watermarkPosition} />
            </div>

            <div>
              <label className="label" htmlFor="ia-wm-width">
                Ancho máximo (px)
              </label>
              <input
                id="ia-wm-width"
                type="number"
                min={320}
                max={4000}
                className="input"
                value={imageMaxWidth}
                onChange={(e) => setImageMaxWidth(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="label" htmlFor="ia-wm-quality">
                Calidad WebP: {imageQuality}
              </label>
              <input
                id="ia-wm-quality"
                type="range"
                min={30}
                max={100}
                step={1}
                value={imageQuality}
                onChange={(e) => setImageQuality(Number(e.target.value))}
                className="w-full accent-brand-700"
              />
            </div>
          </div>
        </div>

        <div className="mt-6">
          <button type="button" className="btn-primary" onClick={guardar} disabled={guardando}>
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
            Guardar configuración
          </button>
        </div>
      </section>
    </div>
  );
}
