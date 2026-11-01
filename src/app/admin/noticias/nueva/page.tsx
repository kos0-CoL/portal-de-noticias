import { prisma } from '@/lib/prisma';
import { ArticleEditor } from '@/components/admin/ArticleEditor';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Nueva noticia | Panel de administración'
};

type SearchParams = { [key: string]: string | string[] | undefined };

function single(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * Página de creación. Renderiza el mismo editor con article=null; el guardado
 * hace POST /api/noticias y navega al editor del id devuelto.
 * Con ?copy=<id> precarga los datos de una nota existente para duplicarla.
 */
export default async function NuevaNoticiaPage({ searchParams }: { searchParams: SearchParams }) {
  const copyId = single(searchParams.copy);

  const [categories, tags, authors, source] = await Promise.all([
    prisma.category.findMany({ orderBy: { position: 'asc' }, select: { id: true, name: true, slug: true } }),
    prisma.tag.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, slug: true } }),
    prisma.user.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    copyId
      ? prisma.article.findUnique({ where: { id: copyId }, include: { tags: true } })
      : Promise.resolve(null)
  ]);

  const article = source
    ? {
        id: null,
        title: `${source.title} (copia)`,
        slug: '',
        summary: source.summary ?? '',
        content: source.content,
        coverImage: source.coverImage ?? '',
        coverImageAlt: source.coverImageAlt ?? '',
        categoryId: source.categoryId,
        tags: source.tags.map((tag) => tag.name),
        status: 'DRAFT',
        priority: source.priority,
        metaTitle: source.metaTitle ?? '',
        metaDescription: source.metaDescription ?? '',
        socialSummary: source.socialSummary ?? '',
        focusKeyword: source.focusKeyword ?? '',
        ogImage: source.ogImage ?? '',
        isFeatured: false,
        isBreaking: false,
        expiresAt: '',
        publishedAt: '',
        authorId: source.authorId ?? '',
        reviewNotes: '',
        aiTonality: source.aiTonality ?? 'CERCANO_LOCAL',
        sourceName: null,
        sourceUrl: null,
        matchedKeywords: [] as string[]
      }
    : null;

  return (
    <div className="space-y-6">
      <div className="admin-card">
        <h1 className="admin-title">{source ? 'Duplicar noticia' : 'Nueva noticia'}</h1>
        <p className="mt-1 text-sm text-news-500">
          {source
            ? 'Se precargaron los datos de la nota original. Al guardar se crea una nota nueva.'
            : 'El titular y la categoría son obligatorios. Podés guardar como borrador y completar después.'}
        </p>
      </div>

      <ArticleEditor article={article} categories={categories} tags={tags} authors={authors} />
    </div>
  );
}
