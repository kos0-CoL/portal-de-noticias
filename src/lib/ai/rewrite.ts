import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAiSettings } from '@/lib/settings';
import { countWords, estimateReadingTime, escapeHtml, sanitizeHtml, similarity, slugify, stripHtml, truncate } from '@/lib/utils';
import { chatComplete, type ChatMessage } from '@/lib/ai/provider';
import { systemPromptFor, userPromptFor, type AiTonalityValue, type RewriteInput } from '@/lib/ai/tones';

/**
 * El corazón del sistema: toma una nota (propia o traída por el scraper) y
 * pide a la IA una reescritura completa con metadatos SEO y de difusión.
 *
 * Nunca devuelve datos sin validar: todo pasa por zod, se sanitiza y se
 * compara con el original para calcular el "originalityScore".
 */

export type { AiTonalityValue, RewriteInput };

/** Palabras clave locales que se le pasan a la IA como contexto editorial. */
const LOCAL_KEYWORDS_HINT = ['Saladillo', 'Del Carril', 'Cazón', 'Polvaredas'];

export interface RewriteResult {
  title: string;
  content: string;
  summary: string;
  metaTitle: string;
  metaDescription: string;
  tags: string[];
  socialSummary: string;
  focusKeyword: string;
  imageAlt: string;
  citedSource: boolean;
  model: string;
  /** Similitud (0..1) entre el texto original y el reescrito. Menor es mejor. */
  similarity: number;
}

/** Esquema tolerante: los campos de texto se rescatan con default si vienen raros. */
const respuestaIaSchema = z.object({
  title: z.string().min(1, 'La IA no devolvió un título.'),
  content: z.string().min(1, 'La IA no devolvió el contenido de la nota.'),
  summary: z.string().catch(''),
  metaTitle: z.string().catch(''),
  metaDescription: z.string().catch(''),
  tags: z.array(z.string()).catch([]),
  socialSummary: z.string().catch(''),
  focusKeyword: z.string().catch(''),
  imageAlt: z.string().catch('')
});

/**
 * Extrae el primer objeto JSON valido del texto devuelto por la IA.
 * Tolerante a ```json ... ``` y a texto suelto alrededor del objeto.
 */
function extractJsonObject(raw: string): string {
  let text = raw.trim();

  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text);
  if (fence) text = fence[1].trim();

  try {
    JSON.parse(text);
    return text;
  } catch {
    /* sigue con la extraccion manual */
  }

  const start = text.indexOf('{');
  if (start >= 0) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < text.length; i++) {
      const char = text[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') inString = true;
      else if (char === '{') depth++;
      else if (char === '}') {
        depth--;
        if (depth === 0) return text.slice(start, i + 1);
      }
    }
  }

  throw new Error('La IA no devolvió un JSON válido. Volvé a intentar la reescritura.');
}

/** Limpia y normaliza el HTML que devuelve el modelo. */
function normalizarHtml(html: string): string {
  return sanitizeHtml(html.replace(/```html|```/gi, '').trim());
}

/** Arma el parrafo de atribucion a la fuente original. */
function parrafoFuente(sourceName: string, sourceUrl: string): string {
  return `<p><em>Con información de <a href="${sourceUrl}" target="_blank" rel="nofollow noopener">${escapeHtml(
    sourceName
  )}</a>.</em></p>`;
}

/**
 * Reescribe una nota con IA y devuelve la propuesta completa (sin tocar la base).
 */
export async function rewriteArticle(input: RewriteInput): Promise<RewriteResult> {
  const settings = await getAiSettings();

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPromptFor(input.tonality) },
    { role: 'user', content: userPromptFor(input) }
  ];

  const raw = await chatComplete(messages, {
    json: true,
    model: settings.model,
    temperature: settings.temperature
  });

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(extractJsonObject(raw));
  } catch (error) {
    throw new Error(
      error instanceof Error && error.message.includes('JSON')
        ? error.message
        : 'No se pudo interpretar la respuesta de la IA. Volvé a intentar la reescritura.'
    );
  }

  const validacion = respuestaIaSchema.safeParse(parsedJson);
  if (!validacion.success) {
    const detalle = validacion.error.issues.map((i) => i.path.join('.') + ': ' + i.message).join('; ');
    throw new Error(`La IA devolvió una respuesta incompleta (${detalle}). Volvé a intentar.`);
  }

  const data = validacion.data;
  const summary = truncate(data.summary.trim() || stripHtml(data.content), 600);

  let content = normalizarHtml(data.content);
  const sourceName = input.sourceName?.trim();
  const sourceUrl = input.sourceUrl?.trim();
  const debeCitar = Boolean(input.citeSource && sourceName && sourceUrl);
  let citedSource = false;

  if (debeCitar && sourceName && sourceUrl) {
    const yaCita = content.includes(sourceUrl) || /con informaci[oó]n de/i.test(content);
    if (!yaCita) {
      content = `${content}\n${parrafoFuente(sourceName, sourceUrl)}`;
    }
    citedSource = true;
  }

  const tags = Array.from(new Set(data.tags.map((t) => t.trim().replace(/^#/, '')).filter(Boolean))).slice(0, 8);
  const metaTitle = truncate(data.metaTitle.trim() || data.title.trim(), 60);
  const metaDescription = truncate(data.metaDescription.trim() || stripHtml(summary), 158);
  const socialSummary = truncate(data.socialSummary.trim() || stripHtml(summary), 280);
  const focusKeyword = data.focusKeyword.trim() || truncate(data.title.trim(), 60);

  const originalPlano = stripHtml(input.content);
  const nuevoPlano = stripHtml(content);

  return {
    title: data.title.trim(),
    content,
    summary,
    metaTitle,
    metaDescription,
    tags,
    socialSummary,
    focusKeyword,
    imageAlt: data.imageAlt.trim() || truncate(data.title.trim(), 120),
    citedSource,
    model: settings.model,
    similarity: similarity(originalPlano, nuevoPlano)
  };
}

/**
 * Reescribe una nota ya guardada. Con `save: false` devuelve la propuesta para
 * que el editor la previsualice sin modificar nada en la base.
 */
export async function rewriteArticleById(
  articleId: string,
  opts: { tonality?: AiTonalityValue; citeSource?: boolean; save?: boolean } = {}
): Promise<RewriteResult & { articleId: string }> {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: { category: true, tags: true }
  });

  if (!article) {
    throw new Error('No se encontró la nota que querés reescribir.');
  }

  const settings = await getAiSettings();
  const tonality = (opts.tonality ?? (article.aiTonality as AiTonalityValue | null) ?? (settings.defaultTonality as AiTonalityValue)) as AiTonalityValue;
  const citeSource = opts.citeSource ?? settings.citeSource;

  const input: RewriteInput = {
    title: article.title,
    content: article.content,
    sourceName: article.sourceName,
    sourceUrl: article.sourceUrl,
    categoryName: article.category?.name ?? 'Interés General',
    tonality,
    citeSource,
    sourcePublishedAt: article.sourcePublishedAt,
    localKeywords: Array.from(new Set(LOCAL_KEYWORDS_HINT)),
    extraInstructions: settings.systemPrompt
  };

  const result = await rewriteArticle(input);

  if (opts.save) {
    const wordCount = countWords(result.content);
    const readingTime = estimateReadingTime(result.content);

    await prisma.article.update({
      where: { id: articleId },
      data: {
        content: result.content,
        summary: result.summary,
        metaTitle: result.metaTitle,
        metaDescription: result.metaDescription,
        socialSummary: result.socialSummary,
        focusKeyword: result.focusKeyword,
        ogImage: article.ogImage ?? article.coverImage ?? null,
        aiTonality: tonality,
        aiRewritten: true,
        aiModel: result.model,
        aiCitesSource: result.citedSource,
        originalityScore: result.similarity,
        wordCount,
        readingTime,
        tags: {
          set: [],
          connectOrCreate: result.tags.map((name) => ({
            where: { name },
            create: { name, slug: slugify(name) }
          }))
        }
      }
    });
  }

  return { ...result, articleId };
}
