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
  aiExtractModel: 'ai.extractModel',
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
  siteContact: 'site.contact',
  storageDefaultProvider: 'storage.defaultProvider',
  storageSupabaseUrl: 'storage.supabaseUrl',
  storageSupabaseBucket: 'storage.supabaseBucket',
  storageSupabaseServiceKey: 'storage.supabaseServiceKey',
  pharmacyImportUrl: 'pharmacy.importUrl',
  pharmacyRotationOrder: 'pharmacy.rotationOrder',
  pharmacyRotationAnchorDate: 'pharmacy.rotationAnchorDate',
  pharmacyShiftStart: 'pharmacy.shiftStart',
  pharmacyShiftEnd: 'pharmacy.shiftEnd'
} as const;

export const SECRET_KEYS: string[] = [SETTING_KEYS.aiApiKey, SETTING_KEYS.storageSupabaseServiceKey];

export type AiProvider = 'openai' | 'openrouter' | 'groq' | 'anthropic' | 'gemini' | 'custom';

export interface AiSettings {
  provider: AiProvider;
  model: string;
  /** Modelo opcional para la extracción del cuerpo en el scraper. Vacío = usa `model`. */
  extractModel: string;
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

export interface StorageSettings {
  /** Id del proveedor por defecto; cadena vacía = no alojar. */
  defaultProvider: string;
  supabaseUrl: string;
  supabaseBucket: string;
  /** Service role key en texto plano, solo para uso interno del servidor. */
  supabaseServiceKey: string;
  supabaseServiceKeyMasked: string;
  hasSupabaseServiceKey: boolean;
}

export interface PharmacySettings {
  /** Página del Colegio desde la que se importa el organigrama. */
  importUrl: string;
  /** Ciclo de rotación: ids de farmacia en orden, con repeticiones permitidas. */
  rotationOrder: string[];
  /** Fecha (YYYY-MM-DD) que corresponde al primer elemento del ciclo. */
  rotationAnchorDate: string | null;
  /** Hora en que empieza el turno (formato HH:mm). */
  shiftStart: string;
  /** Hora en que termina el turno, del día siguiente (formato HH:mm). */
  shiftEnd: string;
}

export const DEFAULTS = {
  [SETTING_KEYS.aiProvider]: process.env.AI_PROVIDER ?? 'openai',
  [SETTING_KEYS.aiModel]: process.env.AI_MODEL ?? 'gpt-4o-mini',
  [SETTING_KEYS.aiExtractModel]: process.env.AI_EXTRACT_MODEL ?? '',
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
  [SETTING_KEYS.siteContact]: { email: 'redaccion@saladillonoticias.com.ar', phone: '' },
  [SETTING_KEYS.storageDefaultProvider]: process.env.STORAGE_PROVIDER ?? '',
  [SETTING_KEYS.storageSupabaseUrl]: process.env.SUPABASE_URL ?? '',
  [SETTING_KEYS.storageSupabaseBucket]: process.env.SUPABASE_BUCKET ?? '',
  [SETTING_KEYS.storageSupabaseServiceKey]: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  [SETTING_KEYS.pharmacyImportUrl]: 'https://acasaladillo.com.ar/?page_id=3080',
  [SETTING_KEYS.pharmacyRotationOrder]: [] as string[],
  [SETTING_KEYS.pharmacyRotationAnchorDate]: '',
  [SETTING_KEYS.pharmacyShiftStart]: '08:00',
  [SETTING_KEYS.pharmacyShiftEnd]: '08:00'
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
  const [provider, model, extractModel, baseUrl, apiKey, defaultTonality, citeSource, rewriteEnabled, temperature, systemPrompt] =
    await Promise.all([
      getSetting<string>(SETTING_KEYS.aiProvider),
      getSetting<string>(SETTING_KEYS.aiModel),
      getSetting<string>(SETTING_KEYS.aiExtractModel),
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
    extractModel: extractModel ?? '',
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

/** Modelo a usar para extraer el cuerpo de las notas: el dedicado o, si no hay, el general. */
export function resolveExtractModel(settings: AiSettings): string {
  return settings.extractModel.trim() || settings.model;
}

export async function getStorageSettings(): Promise<StorageSettings> {
  const [defaultProvider, supabaseUrl, supabaseBucket, serviceKey] = await Promise.all([
    getSetting<string>(SETTING_KEYS.storageDefaultProvider),
    getSetting<string>(SETTING_KEYS.storageSupabaseUrl),
    getSetting<string>(SETTING_KEYS.storageSupabaseBucket),
    getSetting<string>(SETTING_KEYS.storageSupabaseServiceKey)
  ]);

  const key = serviceKey ?? '';
  return {
    defaultProvider: defaultProvider ?? '',
    supabaseUrl: supabaseUrl ?? '',
    supabaseBucket: supabaseBucket ?? '',
    supabaseServiceKey: key,
    supabaseServiceKeyMasked: key ? maskSecret(key) : '',
    hasSupabaseServiceKey: Boolean(key)
  };
}

/** Version segura: la service role key nunca viaja en claro al navegador. */
export async function getStorageSettingsForClient(): Promise<StorageSettings> {
  const s = await getStorageSettings();
  return { ...s, supabaseServiceKey: '' };
}

export async function getPharmacySettings(): Promise<PharmacySettings> {
  const [importUrl, rotationOrder, anchor, shiftStart, shiftEnd] = await Promise.all([
    getSetting<string>(SETTING_KEYS.pharmacyImportUrl),
    getSetting<string[]>(SETTING_KEYS.pharmacyRotationOrder),
    getSetting<string>(SETTING_KEYS.pharmacyRotationAnchorDate),
    getSetting<string>(SETTING_KEYS.pharmacyShiftStart),
    getSetting<string>(SETTING_KEYS.pharmacyShiftEnd)
  ]);

  return {
    importUrl: (importUrl ?? '').trim(),
    rotationOrder: Array.isArray(rotationOrder) ? rotationOrder : [],
    rotationAnchorDate: anchor ? anchor : null,
    shiftStart: shiftStart || '08:00',
    shiftEnd: shiftEnd || '08:00'
  };
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
