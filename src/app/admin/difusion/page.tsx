import { Share2 } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { maskSecret } from '@/lib/crypto';
import SocialManager, { type CanalDTO, type PostDTO } from '@/components/admin/SocialManager';

/**
 * /admin/difusion — Difusión automática en redes sociales.
 * Lista los canales configurados y la cola de publicaciones recientes.
 */

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Difusión en redes' };

export default async function AdminDifusionPage() {
  const [canales, posts] = await Promise.all([
    prisma.socialChannel.findMany({ orderBy: [{ network: 'asc' }, { createdAt: 'desc' }] }),
    prisma.socialPost.findMany({
      take: 30,
      orderBy: { createdAt: 'desc' },
      include: { article: { select: { id: true, title: true, slug: true } }, channel: true }
    })
  ]);

  const canalesDTO: CanalDTO[] = canales.map((canal) => ({
    id: canal.id,
    network: canal.network,
    name: canal.name,
    webhookUrl: canal.webhookUrl,
    chatId: canal.chatId,
    autoPublish: canal.autoPublish,
    isActive: canal.isActive,
    accessTokenMasked: canal.accessToken ? maskSecret(canal.accessToken) : '',
    hasAccessToken: Boolean(canal.accessToken)
  }));

  const postsDTO: PostDTO[] = posts.map((post) => ({
    id: post.id,
    status: post.status,
    error: post.error,
    permalink: post.permalink,
    sentAt: post.sentAt ? post.sentAt.toISOString() : null,
    createdAt: post.createdAt.toISOString(),
    article: { id: post.article.id, title: post.article.title, slug: post.article.slug },
    channel: { name: post.channel.name, network: post.channel.network }
  }));

  return (
    <div className="space-y-6">
      <header>
        <p className="kicker text-brand-600">Panel</p>
        <h1 className="admin-title flex items-center gap-2 text-xl">
          <Share2 className="h-5 w-5 text-brand-700" aria-hidden />
          Difusión en redes
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-news-500">
          Conectá las redes del portal para publicar las notas de forma automática o manual, y seguí el estado de cada
          envío.
        </p>
      </header>

      <SocialManager canales={canalesDTO} posts={postsDTO} />
    </div>
  );
}
