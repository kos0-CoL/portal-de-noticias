import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { UnauthorizedError, requireApiSession } from '@/lib/auth';
import { countWords, estimateReadingTime, sanitizeHtml, slugify } from '@/lib/utils';

/**
 * GET    /api/noticias/[id] — devuelve una nota con sus relaciones.
 * PATCH  /api/noticias/[id] — actualiza campos (recalcula lectura y tags).
 * DELETE /api/noticias/[id] — elimina la nota.
 * Todas requieren sesión.
 */

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  slug: z.string().optional(),
  summary: z.string().nullable().optional(),
  content: z.string().optional(),
  coverImage: z.string().nullable().optional(),
  coverImageAlt: z.string().nullable().optional(),
  categoryId: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'ARCHIVED']).optional(),
  priority: z.enum(['NORMAL', 'ALTA', 'URGENTE']).optional(),
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

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildTagConnect(names: string[]) {
  // La unique `Tag.slug` se deriva del nombre, así que dos variantes con distinta
  // tilde (ej. "Premios Goñi" y "Premios Goni") comparten slug: deduplicamos por
  // slug y conectamos por slug para no chocar con la restricción única.
  const porSlug = new Map<string, string>();
  for (const name of names) {
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

async function uniqueSlug(base: string, excludeId: string): Promise<string> {
  const root = slugify(base) || 'nota';
  let candidate = root;
  let counter = 2;
  for (let i = 0; i < 50; i++) {
    const existing = await prisma.article.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!existing || existing.id === excludeId) return candidate;
    candidate = `${root}-${counter++}`;
  }
  return `${root}-${Date.now()}`;
}

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    await requireApiSession();
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }

  const article = await prisma.article.findUnique({
    where: { id: params.id },
    include: { category: true, tags: true, images: true, author: true }
  });
  if (!article) {
    return NextResponse.json({ ok: false, error: 'Nota no encontrada' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, article });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireApiSession();
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const existing = await prisma.article.findUnique({ where: { id: params.id }, select: { id: true, slug: true } });
  if (!existing) {
    return NextResponse.json({ ok: false, error: 'Nota no encontrada' }, { status: 404 });
  }

  const updateData: Prisma.ArticleUpdateInput = {};

  if (data.title !== undefined) updateData.title = data.title.trim();
  if (data.slug !== undefined && data.slug.trim()) {
    const desired = slugify(data.slug);
    if (desired && desired !== existing.slug) {
      updateData.slug = await uniqueSlug(desired, existing.id);
    }
  }
  if (data.summary !== undefined) updateData.summary = data.summary;
  if (data.coverImage !== undefined) updateData.coverImage = data.coverImage;
  if (data.coverImageAlt !== undefined) updateData.coverImageAlt = data.coverImageAlt;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.metaTitle !== undefined) updateData.metaTitle = data.metaTitle;
  if (data.metaDescription !== undefined) updateData.metaDescription = data.metaDescription;
  if (data.socialSummary !== undefined) updateData.socialSummary = data.socialSummary;
  if (data.focusKeyword !== undefined) updateData.focusKeyword = data.focusKeyword;
  if (data.ogImage !== undefined) updateData.ogImage = data.ogImage;
  if (data.isFeatured !== undefined) updateData.isFeatured = data.isFeatured;
  if (data.isBreaking !== undefined) updateData.isBreaking = data.isBreaking;
  if (data.reviewNotes !== undefined) updateData.reviewNotes = data.reviewNotes;
  if (data.expiresAt !== undefined) updateData.expiresAt = toDate(data.expiresAt);
  if (data.publishedAt !== undefined) updateData.publishedAt = toDate(data.publishedAt);
  if (data.authorId !== undefined) updateData.author = data.authorId ? { connect: { id: data.authorId } } : { disconnect: true };
  if (data.categoryId !== undefined) updateData.category = { connect: { id: data.categoryId } };

  if (data.content !== undefined) {
    const content = sanitizeHtml(data.content);
    updateData.content = content;
    updateData.readingTime = estimateReadingTime(content);
    updateData.wordCount = countWords(content);
  }

  if (data.tags !== undefined) {
    updateData.tags = { set: [], connectOrCreate: buildTagConnect(data.tags) };
  }

  const article = await prisma.article.update({
    where: { id: params.id },
    data: updateData,
    include: { category: true, tags: true }
  });

  return NextResponse.json({ ok: true, article });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    await requireApiSession();
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }

  const existing = await prisma.article.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ ok: false, error: 'Nota no encontrada' }, { status: 404 });
  }

  await prisma.article.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
