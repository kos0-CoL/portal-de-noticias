import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { UnauthorizedError, requireApiSession } from '@/lib/auth';
import { countWords, estimateReadingTime, sanitizeHtml, slugify } from '@/lib/utils';

/**
 * GET  /api/noticias — listado paginado con filtros (requiere sesión).
 *      Query: estado, categoria, prioridad, q, pagina, limite
 * POST /api/noticias — crea una nota (requiere sesión).
 */

const statusEnum = z.enum(['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'ARCHIVED']);
const priorityEnum = z.enum(['NORMAL', 'ALTA', 'URGENTE']);

const createSchema = z.object({
  title: z.string().min(1, 'El título es obligatorio'),
  slug: z.string().optional(),
  summary: z.string().nullable().optional(),
  content: z.string().optional(),
  coverImage: z.string().nullable().optional(),
  coverImageAlt: z.string().nullable().optional(),
  categoryId: z.string().min(1, 'La categoría es obligatoria'),
  tags: z.array(z.string()).optional(),
  status: statusEnum.optional(),
  priority: priorityEnum.optional(),
  metaTitle: z.string().nullable().optional(),
  metaDescription: z.string().nullable().optional(),
  socialSummary: z.string().nullable().optional(),
  focusKeyword: z.string().nullable().optional(),
  ogImage: z.string().nullable().optional(),
  isFeatured: z.boolean().optional(),
  isBreaking: z.boolean().optional(),
  expiresAt: z.string().nullable().optional(),
  publishedAt: z.string().nullable().optional(),
  authorId: z.string().nullable().optional(),
  reviewNotes: z.string().nullable().optional()
});

/** Genera un slug único agregando un sufijo numérico si ya existe. */
async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base) || 'nota';
  let candidate = root;
  let counter = 2;
  // Bucle acotado: en la práctica el segundo intento ya resuelve.
  for (let i = 0; i < 50; i++) {
    const existing = await prisma.article.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!existing || existing.id === excludeId) return candidate;
    candidate = `${root}-${counter++}`;
  }
  return `${root}-${Date.now()}`;
}

function buildTagConnect(names: string[] | undefined) {
  // La unique `Tag.slug` se deriva del nombre, así que dos variantes con distinta
  // tilde (ej. "Premios Goñi" y "Premios Goni") comparten slug: deduplicamos por
  // slug y conectamos por slug para no chocar con la restricción única.
  const porSlug = new Map<string, string>();
  for (const name of names ?? []) {
    const limpio = name.trim();
    if (!limpio) continue;
    const slug = slugify(limpio) || limpio.toLowerCase();
    if (!porSlug.has(slug)) porSlug.set(slug, limpio);
  }
  return Array.from(porSlug, ([slug, name]) => ({
    where: { slug },
    create: { name, slug }
  }));
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(request: Request) {
  try {
    await requireApiSession();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
    }
    throw error;
  }

  const { searchParams } = new URL(request.url);
  const estado = searchParams.get('estado') ?? undefined;
  const categoria = searchParams.get('categoria') ?? undefined;
  const prioridad = searchParams.get('prioridad') ?? undefined;
  const q = searchParams.get('q') ?? undefined;
  const page = Math.max(1, Number(searchParams.get('pagina') ?? '1') || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limite') ?? '20') || 20));

  const where: Prisma.ArticleWhereInput = {};
  if (estado) where.status = estado as Prisma.ArticleWhereInput['status'];
  if (categoria) where.categoryId = categoria;
  if (prioridad) where.priority = prioridad as Prisma.ArticleWhereInput['priority'];
  if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { summary: { contains: q, mode: 'insensitive' } }
    ];
  }

  const [total, items] = await Promise.all([
    prisma.article.count({ where }),
    prisma.article.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { category: true, author: true, tags: true }
    })
  ]);

  return NextResponse.json({ ok: true, total, page, limit, items });
}

export async function POST(request: Request) {
  try {
    await requireApiSession();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
    }
    throw error;
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const category = await prisma.category.findUnique({ where: { id: data.categoryId }, select: { id: true } });
  if (!category) {
    return NextResponse.json({ ok: false, error: 'La categoría indicada no existe' }, { status: 400 });
  }

  const content = sanitizeHtml(data.content ?? '');
  const slug = await uniqueSlug(data.slug || data.title);
  const status = data.status ?? 'DRAFT';

  const article = await prisma.article.create({
    data: {
      title: data.title.trim(),
      slug,
      summary: data.summary ?? null,
      content,
      coverImage: data.coverImage ?? null,
      coverImageAlt: data.coverImageAlt ?? null,
      status,
      priority: data.priority ?? 'NORMAL',
      metaTitle: data.metaTitle ?? null,
      metaDescription: data.metaDescription ?? null,
      socialSummary: data.socialSummary ?? null,
      focusKeyword: data.focusKeyword ?? null,
      ogImage: data.ogImage ?? null,
      isFeatured: data.isFeatured ?? false,
      isBreaking: data.isBreaking ?? false,
      readingTime: estimateReadingTime(content),
      wordCount: countWords(content),
      publishedAt: status === 'PUBLISHED' ? toDate(data.publishedAt) ?? new Date() : toDate(data.publishedAt),
      expiresAt: toDate(data.expiresAt),
      categoryId: data.categoryId,
      authorId: data.authorId || null,
      reviewNotes: data.reviewNotes ?? null,
      tags: { connectOrCreate: buildTagConnect(data.tags) }
    },
    select: { id: true, slug: true }
  });

  return NextResponse.json({ ok: true, article }, { status: 201 });
}
