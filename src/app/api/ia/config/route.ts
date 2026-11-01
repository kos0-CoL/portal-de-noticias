import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireApiSession, UnauthorizedError } from '@/lib/auth';
import { getAiSettingsForClient, setSetting, SETTING_KEYS } from '@/lib/settings';

/**
 * Configuracion de IA (/admin/ia). GET nunca devuelve la clave en claro.
 * Requiere sesion del panel.
 */

const PROVEEDORES = ['openai', 'openrouter', 'groq', 'anthropic', 'gemini', 'custom'] as const;
const TONOS = ['INFORMATIVO_NEUTRAL', 'CERCANO_LOCAL', 'LLAMATIVO_CLICKBAIT', 'FORMAL_SERIO'] as const;
const POSICIONES = ['southeast', 'southwest', 'northeast', 'northwest', 'center'] as const;

const configSchema = z.object({
  provider: z.enum(PROVEEDORES).optional(),
  model: z.string().trim().optional(),
  baseUrl: z.string().trim().optional(),
  defaultTonality: z.enum(TONOS).optional(),
  citeSource: z.boolean().optional(),
  rewriteEnabled: z.boolean().optional(),
  temperature: z.number().min(0).max(1).optional(),
  systemPrompt: z.string().optional(),
  apiKey: z.string().optional(),
  clearApiKey: z.boolean().optional(),
  imageWatermark: z
    .object({
      enabled: z.boolean(),
      text: z.string(),
      opacity: z.number().min(0).max(1),
      position: z.enum(POSICIONES),
      logoUrl: z.string().nullable()
    })
    .optional(),
  imageMaxWidth: z.number().int().min(320).max(4000).optional(),
  imageQuality: z.number().int().min(30).max(100).optional()
});

async function guardarConfiguracion(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = configSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Configuración inválida.', errores: parsed.error.issues.map((i) => i.message) },
      { status: 400 }
    );
  }

  const data = parsed.data;

  if (data.clearApiKey) {
    await setSetting(SETTING_KEYS.aiApiKey, '', { secret: true, group: 'ia' });
  } else if (typeof data.apiKey === 'string' && data.apiKey.trim() !== '') {
    // Solo se sobreescribe si el usuario escribio una clave nueva.
    await setSetting(SETTING_KEYS.aiApiKey, data.apiKey.trim(), { secret: true, group: 'ia' });
  }

  const tareas: Promise<unknown>[] = [];
  const grupoIa = { group: 'ia' };
  const grupoImagenes = { group: 'images' };

  if (data.provider) tareas.push(setSetting(SETTING_KEYS.aiProvider, data.provider, grupoIa));
  if (data.model !== undefined) tareas.push(setSetting(SETTING_KEYS.aiModel, data.model, grupoIa));
  if (data.baseUrl !== undefined) tareas.push(setSetting(SETTING_KEYS.aiBaseUrl, data.baseUrl, grupoIa));
  if (data.defaultTonality) tareas.push(setSetting(SETTING_KEYS.aiDefaultTonality, data.defaultTonality, grupoIa));
  if (data.citeSource !== undefined) tareas.push(setSetting(SETTING_KEYS.aiCiteSource, data.citeSource, grupoIa));
  if (data.rewriteEnabled !== undefined) tareas.push(setSetting(SETTING_KEYS.aiRewriteEnabled, data.rewriteEnabled, grupoIa));
  if (data.temperature !== undefined) tareas.push(setSetting(SETTING_KEYS.aiTemperature, data.temperature, grupoIa));
  if (data.systemPrompt !== undefined) tareas.push(setSetting(SETTING_KEYS.aiSystemPrompt, data.systemPrompt, grupoIa));
  if (data.imageWatermark) tareas.push(setSetting(SETTING_KEYS.imageWatermark, data.imageWatermark, grupoImagenes));
  if (data.imageMaxWidth !== undefined) tareas.push(setSetting(SETTING_KEYS.imageMaxWidth, data.imageMaxWidth, grupoImagenes));
  if (data.imageQuality !== undefined) tareas.push(setSetting(SETTING_KEYS.imageQuality, data.imageQuality, grupoImagenes));

  await Promise.all(tareas);

  const settings = await getAiSettingsForClient();
  return NextResponse.json({ ok: true, settings });
}

export async function GET() {
  try {
    await requireApiSession();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: 'Error de autenticación.' }, { status: 500 });
  }

  try {
    const settings = await getAiSettingsForClient();
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    console.error('[api/ia/config] Error al leer la configuración.', error);
    return NextResponse.json({ ok: false, error: 'No se pudo leer la configuración de IA.' }, { status: 500 });
  }
}

async function conSesion(request: NextRequest) {
  try {
    await requireApiSession();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: 'Error de autenticación.' }, { status: 500 });
  }
  try {
    return await guardarConfiguracion(request);
  } catch (error) {
    console.error('[api/ia/config] Error al guardar la configuración.', error);
    return NextResponse.json({ ok: false, error: 'No se pudo guardar la configuración de IA.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  return conSesion(request);
}

export async function POST(request: NextRequest) {
  return conSesion(request);
}
