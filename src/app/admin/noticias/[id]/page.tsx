import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { ArticleEditor, ArticleHeaderActions } from '@/components/admin/ArticleEditor';
import { PRIORITY_BADGE, StatusBadge } from '@/components/admin/StatusBadge';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Editar noticia | Panel de administración'
};

/** Editor completo de una noticia existente. */
export default async function EditarNoticiaPage({ params }: { params: { id: string } }) {
  const [article, categories, authors] = await Promise.all([
    prisma.article.findUnique({
      where: { id: params.id },
      include: { category: true, tags: true, images: true, scrapedItem: true }
    }),
    prisma.category.findMany({ orderBy: { position: 'asc' }, select: { id: true, name: true, slug: true } }),
    prisma.user.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } })
  ]);

  if (!article) notFound();

  const editorData = {
    id: article.id,
    title: article.title,
    slug: article.slug,
    summary: article.summary ?? '',
    content: article.content,
    coverImage: article.coverImage ?? '',
    coverImageAlt: article.coverImageAlt ?? '',
    categoryId: article.categoryId,
    tags: article.tags.map((tag) => tag.name),
    status: article.status,
    priority: article.priority,
    metaTitle: article.metaTitle ?? '',
    metaDescription: article.metaDescription ?? '',
    socialSummary: article.socialSummary ?? '',
    focusKeyword: article.focusKeyword ?? '',
    ogImage: article.ogImage ?? '',
    isFeatured: article.isFeatured,
    isBreaking: article.isBreaking,
    expiresAt: article.expiresAt ? article.expiresAt.toISOString() : '',
    publishedAt: article.publishedAt ? article.publishedAt.toISOString() : '',
    authorId: article.authorId ?? '',
    reviewNotes: article.reviewNotes ?? '',
    aiTonality: article.aiTonality ?? 'CERCANO_LOCAL',
    sourceName: article.sourceName,
    sourceUrl: article.sourceUrl,
    matchedKeywords: article.scrapedItem?.matchedKeywords ?? []
  };

  return (
    <div className="space-y-6">
      {/* Encabezado del editor */}
      <div className="admin-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={article.status} />
              <PRIORITY_BADGE priority={article.priority} />
              <span
                className="badge"
                style={{ backgroundColor: `${article.category.color}1a`, color: article.category.color }}
              >
                {article.category.name}
              </span>
            </div>
            <h1 className="headline-lg line-clamp-2-custom">{article.title}</h1>
            <p className="text-xs text-news-500">/nota/{article.slug}</p>
          </div>

          <ArticleHeaderActions
            articleId={article.id}
            status={article.status}
            slug={article.slug}
            title={article.title}
          />
        </div>
      </div>

      <ArticleEditor article={editorData} categories={categories} tags={article.tags} authors={authors} />
    </div>
  );
}
