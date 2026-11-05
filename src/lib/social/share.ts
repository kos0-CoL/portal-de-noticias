import { createHmac } from 'crypto';
import type { Prisma, SocialChannel, SocialNetwork } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { decryptSecret } from '@/lib/crypto';
import { absoluteUrl, articleUrl } from '@/lib/seo';
import { stripHtml, truncate } from '@/lib/utils';

/**
 * Difusion automatica en redes sociales.
 *
 * - Telegram: llamada real a la Bot API.
 * - Facebook / Instagram / X / WhatsApp: POST real a un webhook (Make, Zapier,
 *   n8n o un servicio propio) firmado con HMAC-SHA256.
 * - Si el canal no tiene webhook ni credenciales, queda en modo simulacion
 *   (SKIPPED) pero se guarda el payload en la cola del panel.
 *
 * Ninguna funcion lanza excepciones hacia arriba por fallas de red.
 */

export interface SocialPayload {
  text: string;
  url: string;
  imageUrl?: string | null;
  title: string;
  summary: string;
}

export interface SocialArticleInput {
  title: string;
  slug: string;
  summary?: string | null;
  socialSummary?: string | null;
  coverImage?: string | null;
  ogImage?: string | null;
  category?: { name: string } | null;
  categoryName?: string | null;
}

export interface ChannelResult {
  channel: string;
  network: string;
  status: 'SENT' | 'ERROR' | 'SKIPPED';
  error?: string;
}

interface DeliverOutcome {
  status: 'SENT' | 'ERROR' | 'SKIPPED';
  error?: string;
  permalink?: string | null;
}

const MSG_SIN_CREDENCIALES = 'Canal sin webhook ni credenciales configuradas (modo simulación)';

/** Convierte el nombre de la categoria en un hashtag valido, sin acentos. */
function hashtagFrom(name: string): string {
  const clean = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '');
  return clean ? `#${clean}` : '';
}

/** Texto publicable: titulo, resumen, enlace absoluto y hashtags del portal. */
export function buildSocialPayload(article: SocialArticleInput): SocialPayload {
  const url = absoluteUrl(articleUrl(article.slug));
  const summary = truncate(stripHtml(article.socialSummary || article.summary || ''), 240);

  const hashtags = ['#Saladillo', '#SaladilloNoticias'];
  const categoria = article.category?.name ?? article.categoryName;
  if (categoria) {
    const tag = hashtagFrom(categoria);
    if (tag) hashtags.push(tag);
  }

  const bloques: string[] = [article.title.trim()];
  if (summary) bloques.push(summary);
  bloques.push(url);
  bloques.push(hashtags.join(' '));

  return {
    text: truncate(bloques.join('\n\n'), 1000),
    url,
    imageUrl: article.ogImage ?? article.coverImage ?? null,
    title: article.title.trim(),
    summary
  };
}

/** Firma HMAC-SHA256 del cuerpo, para que el receptor valide el origen. */
function signPayload(body: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET no está definida en las variables de entorno.');
  }
  return createHmac('sha256', secret).update(body).digest('hex');
}

/** Envio real a Telegram via Bot API. */
async function deliverTelegram(channel: SocialChannel, payload: SocialPayload): Promise<DeliverOutcome> {
  const token = process.env.TELEGRAM_BOT_TOKEN || (channel.accessToken ? decryptSecret(channel.accessToken) : '');
  if (!token || !channel.chatId) {
    return { status: 'SKIPPED', error: 'Canal de Telegram sin token o chat ID configurado (modo simulación)' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: channel.chatId, text: payload.text, parse_mode: 'HTML' }),
      signal: controller.signal
    });

    const data = (await response.json().catch(() => null)) as
      | { ok?: boolean; description?: string; result?: { message_id?: number; link?: string } }
      | null;

    if (response.ok && data?.ok) {
      return { status: 'SENT', permalink: data.result?.link ?? null };
    }
    return { status: 'ERROR', error: data?.description ?? `Telegram respondió con HTTP ${response.status}.` };
  } catch (error) {
    return {
      status: 'ERROR',
      error: error instanceof Error ? error.message : 'Error desconocido al publicar en Telegram.'
    };
  } finally {
    clearTimeout(timeout);
  }
}

/** Envio real al webhook configurado (Make / Zapier / n8n / API propia). */
async function deliverWebhook(channel: SocialChannel, payload: SocialPayload): Promise<DeliverOutcome> {
  if (!channel.webhookUrl) {
    return { status: 'SKIPPED', error: MSG_SIN_CREDENCIALES };
  }

  const body = JSON.stringify(payload);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(channel.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Saladillo-Signature': signPayload(body)
      },
      body,
      signal: controller.signal
    });

    const rawText = await response.text();
    let permalink: string | null = null;
    try {
      const parsed = JSON.parse(rawText) as { permalink?: string; url?: string };
      permalink = parsed.permalink ?? parsed.url ?? null;
    } catch {
      /* el webhook puede no devolver JSON */
    }

    if (response.ok) {
      return { status: 'SENT', permalink };
    }
    return { status: 'ERROR', error: `El webhook respondió con HTTP ${response.status}: ${truncate(rawText, 200)}` };
  } catch (error) {
    return {
      status: 'ERROR',
      error: error instanceof Error ? error.message : 'Error desconocido al llamar al webhook.'
    };
  } finally {
    clearTimeout(timeout);
  }
}

/** Decide el transporte segun la red del canal. */
async function deliverToChannel(channel: SocialChannel, payload: SocialPayload): Promise<DeliverOutcome> {
  try {
    if (channel.network === 'TELEGRAM') {
      return await deliverTelegram(channel, payload);
    }
    if (channel.webhookUrl) {
      return await deliverWebhook(channel, payload);
    }
    if (channel.accessToken) {
      return { status: 'ERROR', error: 'El canal tiene credenciales pero no un webhook configurado. Cargá la URL de webhook.' };
    }
    return { status: 'SKIPPED', error: MSG_SIN_CREDENCIALES };
  } catch (error) {
    return {
      status: 'ERROR',
      error: error instanceof Error ? error.message : 'Error desconocido al publicar.'
    };
  }
}

/**
 * Publica una nota en los canales indicados (o en todos los que tengan
 * autoPublish si no se pasa ninguno). Nunca lanza: devuelve el resultado por canal.
 */
export async function shareArticle(articleId: string, channelIds?: string[]): Promise<ChannelResult[]> {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: { category: true }
  });

  if (!article) {
    throw new Error('No se encontró la nota que querés difundir.');
  }

  if (article.status !== 'PUBLISHED') {
    throw new Error('Solo se pueden difundir notas publicadas.');
  }

  const channels = await prisma.socialChannel.findMany({
    where:
      channelIds && channelIds.length > 0
        ? { id: { in: channelIds }, isActive: true }
        : { isActive: true, autoPublish: true }
  });

  if (channels.length === 0) {
    return [];
  }

  const payload = buildSocialPayload(article);
  const results: ChannelResult[] = [];

  for (const channel of channels) {
    try {
      const post = await prisma.socialPost.upsert({
        where: { articleId_channelId: { articleId, channelId: channel.id } },
        create: {
          articleId,
          channelId: channel.id,
          status: 'PENDING',
          payload: payload as unknown as Prisma.InputJsonValue
        },
        update: {
          status: 'PENDING',
          error: null,
          payload: payload as unknown as Prisma.InputJsonValue
        }
      });

      const outcome = await deliverToChannel(channel, payload);

      await prisma.socialPost.update({
        where: { id: post.id },
        data: {
          status: outcome.status,
          error: outcome.error ?? null,
          permalink: outcome.permalink ?? null,
          sentAt: outcome.status === 'SENT' ? new Date() : null
        }
      });

      results.push({
        channel: channel.name,
        network: channel.network,
        status: outcome.status,
        error: outcome.error
      });
    } catch (error) {
      console.warn(`[difusión] Falló la publicación en el canal ${channel.name} (${channel.id}).`, error);
      results.push({
        channel: channel.name,
        network: channel.network,
        status: 'ERROR',
        error: error instanceof Error ? error.message : 'Error desconocido.'
      });
    }
  }

  return results;
}

/** Reintenta un envio fallido reutilizando el payload guardado. */
export async function retrySocialPost(postId: string): Promise<{ status: string; error?: string }> {
  const post = await prisma.socialPost.findUnique({
    where: { id: postId },
    include: { channel: true, article: { include: { category: true } } }
  });

  if (!post) {
    throw new Error('No se encontró el registro de publicación a reintentar.');
  }

  const payload = buildSocialPayload(post.article);
  const outcome = await deliverToChannel(post.channel, payload);

  await prisma.socialPost.update({
    where: { id: postId },
    data: {
      status: outcome.status,
      error: outcome.error ?? null,
      permalink: outcome.permalink ?? null,
      sentAt: outcome.status === 'SENT' ? new Date() : null,
      payload: payload as unknown as Prisma.InputJsonValue
    }
  });

  return { status: outcome.status, error: outcome.error };
}

export function buildWhatsAppLink(payload: SocialPayload): string {
  return `https://wa.me/?text=${encodeURIComponent(`${payload.title} ${payload.url}`)}`;
}

export function buildFacebookShareLink(payload: SocialPayload): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(payload.url)}`;
}

export function buildTelegramShareLink(payload: SocialPayload): string {
  return `https://t.me/share/url?url=${encodeURIComponent(payload.url)}&text=${encodeURIComponent(payload.title)}`;
}

export function buildXShareLink(payload: SocialPayload): string {
  return `https://twitter.com/intent/tweet?url=${encodeURIComponent(payload.url)}&text=${encodeURIComponent(payload.title)}`;
}

/** Red del canal como string simple, util para el panel. */
export function networkLabel(network: SocialNetwork | string): string {
  const labels: Record<string, string> = {
    FACEBOOK: 'Facebook',
    INSTAGRAM: 'Instagram',
    TELEGRAM: 'Telegram',
    X: 'X (Twitter)',
    WHATSAPP: 'WhatsApp'
  };
  return labels[network] ?? String(network);
}
