import { truncate } from '@/lib/utils';
import { BASE_URLS, getAiSettings, type AiProvider, type AiSettings } from '@/lib/settings';

/**
 * Cliente HTTP para proveedores de IA compatibles con la API de
 * "OpenAI Chat Completions". Funciona con OpenAI, OpenRouter, Groq, Gemini
 * (endpoint OpenAI-compatible) y cualquier endpoint propio ("custom").
 *
 * No usamos el SDK oficial: todo va con `fetch` nativo para no sumar
 * dependencias y para poder cambiar de proveedor desde el panel sin rebuild.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  /** Pide al proveedor que devuelva JSON estricto (response_format). */
  json?: boolean;
  /** Sobrescribe el modelo configurado. */
  model?: string;
}

/** Forma parcial de la respuesta de Chat Completions que nos interesa leer. */
interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

export const MENSAJE_SIN_API_KEY = 'No hay una API Key de IA configurada. Cargala en /admin/ia.';

/** Resuelve la URL base segun el proveedor; para "custom" usa la guardada. */
export function resolveBaseUrl(provider: AiProvider, custom?: string): string {
  const raw = provider === 'custom' ? (custom ?? '') : BASE_URLS[provider];
  return (raw ?? '').trim().replace(/\/+$/, '');
}

/**
 * Llamada interna de bajo nivel. Aplica timeout, normaliza errores y extrae
 * el texto de la primera eleccion. Siempre lanza Error con mensaje en espanol.
 */
async function requestChat(messages: ChatMessage[], opts: ChatOptions, settings: AiSettings): Promise<string> {
  if (!settings.hasApiKey || !settings.apiKey) {
    throw new Error(MENSAJE_SIN_API_KEY);
  }

  const baseUrl = resolveBaseUrl(settings.provider, settings.baseUrl);
  if (!baseUrl) {
    throw new Error('No hay una URL base configurada para el proveedor de IA. Revisá la configuración en /admin/ia.');
  }

  const model = opts.model?.trim() || settings.model;
  if (!model) {
    throw new Error('No hay un modelo de IA configurado. Elegí uno en /admin/ia.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`
    };

    // Headers recomendados por OpenRouter para identificar el origen de la peticion.
    if (settings.provider === 'openrouter') {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
      if (siteUrl) {
        headers['HTTP-Referer'] = siteUrl;
        headers['X-Title'] = new URL(siteUrl).hostname;
      }
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages,
        temperature: typeof opts.temperature === 'number' ? opts.temperature : settings.temperature,
        max_tokens: typeof opts.maxTokens === 'number' ? opts.maxTokens : 3000,
        ...(opts.json ? { response_format: { type: 'json_object' } } : {})
      }),
      signal: controller.signal
    });

    const rawText = await response.text();

    if (!response.ok) {
      let detalle = rawText;
      try {
        const parsedError = JSON.parse(rawText) as ChatCompletionResponse;
        detalle = parsedError.error?.message ?? rawText;
      } catch {
        /* el cuerpo no era JSON: se usa el texto crudo */
      }
      throw new Error(
        `El proveedor de IA respondió con un error ${response.status}: ${truncate(detalle.trim() || 'sin detalle', 400)}`
      );
    }

    let data: ChatCompletionResponse;
    try {
      data = JSON.parse(rawText) as ChatCompletionResponse;
    } catch {
      throw new Error('La respuesta del proveedor de IA no es un JSON válido.');
    }

    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('El proveedor de IA devolvió una respuesta vacía. Probá de nuevo o cambiá de modelo.');
    }
    return content.trim();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('La consulta a la IA superó el tiempo de espera (60 s). Probá de nuevo o usá un modelo más rápido.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Envia una conversacion completa y devuelve el texto plano generado.
 * @throws Error con mensaje en espanol si falta la API Key o el proveedor falla.
 */
export async function chatComplete(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('No se enviaron mensajes a la IA.');
  }
  const settings = await getAiSettings();
  return requestChat(messages, opts, settings);
}

/**
 * Prueba minima de conexion para el boton "Probar conexión" del panel.
 * Nunca lanza: siempre devuelve un resultado con ok true/false.
 */
export async function testAiConnection(
  overrides?: Partial<AiSettings>
): Promise<{ ok: boolean; message: string; model?: string; latencyMs?: number }> {
  const startedAt = Date.now();
  try {
    const base = await getAiSettings();
    const merged: AiSettings = { ...base, ...overrides };

    // Si vienen overrides con clave nueva, recalculamos los derivados.
    if (overrides?.apiKey) {
      merged.apiKey = overrides.apiKey;
      merged.hasApiKey = true;
    } else if (overrides?.hasApiKey !== undefined && !merged.apiKey) {
      merged.hasApiKey = false;
    }

    const content = await requestChat(
      [
        { role: 'system', content: 'Sos un asistente técnico. Respondés de forma extremadamente breve.' },
        { role: 'user', content: 'Respondé únicamente con la palabra OK' }
      ],
      { maxTokens: 8, temperature: 0 },
      merged
    );

    return {
      ok: true,
      message: `Conexión correcta con ${merged.provider}. El modelo respondió: "${truncate(content, 60)}".`,
      model: merged.model,
      latencyMs: Date.now() - startedAt
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Error desconocido al probar la conexión con la IA.',
      latencyMs: Date.now() - startedAt
    };
  }
}
