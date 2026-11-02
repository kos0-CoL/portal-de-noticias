import { prisma } from '@/lib/prisma';
import { decryptSecret, encryptSecret, isEncrypted, maskSecret } from '@/lib/crypto';
import { TONALIDADES } from '@/lib/constants';

/**
 * Capa de configuracion persistente (tabla `settings`).
 * Las claves declaradas en SECRET_KEYS se guardan cifradas y jamas se devuelven
 * en texto plano hacia el navegador (solo enmascaradas).
 */

export const SETTING_KEYS = {
  aiProvider: 'ai.provider',
  aiModel: 'ai.model',
  aiBaseUrl: 'ai.baseUrl',
  aiApiKey: 'ai.apiKey',
  aiDefaultTonality: 'ai.defaultTonality',
  aiCiteSource: 'ai.citeSource',
  aiRewriteEnabled: 'ai.rewriteEnabled',
  aiTemperature: 'ai.temperature',
  aiSystemPrompt: 'ai.systemPrompt',
  imageWatermark: 'image.watermark',
  imageMaxWidth: 'image.maxWidth',
  imageQuality: 'image.quality',
  scraperDefaults: 'scraper.defaults',
  socialAutoPublish: 'social.autoPublish',
  siteContact: 'site.contact'
} as const;

export const SECRET_KEYS: string[] = [SETTING_KEYS.aiApiKey];

export type AiProvider = 'openai' | 'openrouter' | 'groq' | 'anthropic' | 'gemini' | 'custom';

export interface AiSettings {
  provider: AiProvider;
  model: string;
  baseUrl: string;
  /** Clave en texto plano, solo para uso interno del servidor. */
  apiKey: string;
  apiKeyMasked: string;
  hasApiKey: boolean;
  defaultTonality: string;
  citeSource: boolean;
  rewriteEnabled: boolean;
  temperature: number;
  systemPrompt: string;
}

export interface WatermarkSettings {
  enabled: boolean;
  text: string;
  opacity: number;
  position: 'southeast' | 'southwest' | 'northeast' | 'northwest' | 'center';
  logoUrl: string | null;
}

export const DEFAULTS = {
  [SETTING_KEYS.aiProvider]: process.env.AI_PROVIDER ?? 'openai',
  [SETTING_KEYS.aiModel]: process.env.AI_MODEL ?? 'gpt-4o-mini',
  [SETTING_KEYS.aiBaseUrl]: process.env.AI_BASE_URL ?? '',
  [SETTING_KEYS.aiApiKey]: process.env.AI_API_KEY ?? '',
  [SETTING_KEYS.aiDefaultTonality]: 'CERCANO_LOCAL',
  [SETTING_KEYS.aiCiteSource]: true,
  [SETTING_KEYS.aiRewriteEnabled]: true,
  [SETTING_KEYS.aiTemperature]: 0.75,
  [SETTING_KEYS.aiSystemPrompt]: '',
  [SETTING_KEYS.imageWatermark]: {
    enabled: true,
    text: 'Saladillo Noticias',
    opacity: 0.35,
    position: 'southeast',
    logoUrl: null
  } satisfies WatermarkSettings,
  [SETTING_KEYS.imageMaxWidth]: 1600,
  [SETTING_KEYS.imageQuality]: 82,
  [SETTING_KEYS.scraperDefaults]: {
    requestDelayMs: 1500,
    maxItemsPerRun: 20,
    rotateUserAgent: true,
    respectRobots: true
  },
  [SETTING_KEYS.socialAutoPublish]: false,
  [SETTING_KEYS.siteContact]: { email: 'redaccion@saladillonoticias.com.ar', phone: '' }
} as const;

export const BASE_URLS: Record<AiProvider, string> = {
  openai: 'https://api.openai.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  groq: 'https://api.groq.com/openai/v1',
  anthropic: 'https://api.anthropic.com/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai',
  custom: ''
};

export const MODELOS_SUGERIDOS: Record<AiProvider, string[]> = {
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'o4-mini'],
  openrouter: ['openai/gpt-4o-mini', 'anthropic/claude-3.5-sonnet', 'meta-llama/llama-3.3-70b-instruct'],
  groq: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
  gemini: ['gemini-2.0-flash', 'gemini-1.5-pro'],
  custom: []
};

async function readRaw(key: string): Promise<unknown> {
  const row = await prisma.setting.findUnique({ where: { key } });
  if (!row) return undefined;
  if (row.isSecret && typeof row.value === 'string') {
    return await decryptSecret(row.value);
  }
  return row.value;
}

export async function getSetting<T = unknown>(key: string): Promise<T | undefined> {
  const value = await readRaw(key);
  if (value === undefined || value === null || value === '') {
    return (DEFAULTS as Record<string, unknown>)[key] as T | undefined;
  }
  return value as T;
}

export async function setSetting(key: string, value: unknown, opts?: { secret?: boolean; group?: string }) {
  const secret = opts?.secret ?? SECRET_KEYS.includes(key);
  const stored = secret ? await encryptSecret(String(value)) : (value as object);
  return prisma.setting.upsert({
    where: { key },
    create: { key, value: stored as object, isSecret: secret, group: opts?.group ?? 'general' },
    update: { value: stored as object, isSecret: secret }
  });
}

export async function getAiSettings(): Promise<AiSettings> {
  const [provider, model, baseUrl, apiKey, defaultTonality, citeSource, rewriteEnabled, temperature, systemPrompt] =
    await Promise.all([
      getSetting<string>(SETTING_KEYS.aiProvider),
      getSetting<string>(SETTING_KEYS.aiModel),
      getSetting<string>(SETTING_KEYS.aiBaseUrl),
      getSetting<string>(SETTING_KEYS.aiApiKey),
      getSetting<string>(SETTING_KEYS.aiDefaultTonality),
      getSetting<boolean>(SETTING_KEYS.aiCiteSource),
      getSetting<boolean>(SETTING_KEYS.aiRewriteEnabled),
      getSetting<number>(SETTING_KEYS.aiTemperature),
      getSetting<string>(SETTING_KEYS.aiSystemPrompt)
    ]);

  const key = apiKey ?? '';
  return {
    provider: (provider ?? 'openai') as AiProvider,
    model: model ?? 'gpt-4o-mini',
    baseUrl: baseUrl ?? BASE_URLS[(provider ?? 'openai') as AiProvider],
    apiKey: key,
    apiKeyMasked: key ? maskSecret(key) : '',
    hasApiKey: Boolean(key),
    defaultTonality: defaultTonality ?? 'CERCANO_LOCAL',
    citeSource: citeSource ?? true,
    rewriteEnabled: rewriteEnabled ?? true,
    temperature: typeof temperature === 'number' ? temperature : 0.75,
    systemPrompt: systemPrompt ?? ''
  };
}

/** Version segura: nunca sale la clave en claro hacia el cliente. */
export async function getAiSettingsForClient(): Promise<AiSettings> {
  const s = await getAiSettings();
  return { ...s, apiKey: '' };
}

export async function getWatermarkSettings(): Promise<WatermarkSettings> {
  const value = await getSetting<WatermarkSettings>(SETTING_KEYS.imageWatermark);
  return (
    value ?? {
      enabled: false,
      text: 'Saladillo Noticias',
      opacity: 0.35,
      position: 'southeast',
      logoUrl: null
    }
  );
}

export function tonalidadLabel(value: string | null | undefined): string {
  return TONALIDADES.find((t) => t.value === value)?.label ?? 'Informativo y Neutral';
}

export { isEncrypted, maskSecret };
