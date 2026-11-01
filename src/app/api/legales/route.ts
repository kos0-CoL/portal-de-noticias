import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const pages = await prisma.legalPage.findMany({
    where: { isActive: true },
    select: { id: true, slug: true, title: true, metaTitle: true, metaDescription: true }
  });
  return NextResponse.json(pages);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { slug, title, content, metaTitle, metaDescription, isActive } = body;

    const page = await prisma.legalPage.create({
      data: { slug, title, content, metaTitle, metaDescription, isActive: isActive ?? true }
    });
    return NextResponse.json(page, { status: 201 });
  } catch (error) {
    console.error('[legales]', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
