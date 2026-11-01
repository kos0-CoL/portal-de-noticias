import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const { slug, title, content, metaTitle, metaDescription, isActive } = body;

    const page = await prisma.legalPage.update({
      where: { id: params.id },
      data: { slug, title, content, metaTitle, metaDescription, isActive }
    });
    return NextResponse.json(page);
  } catch (error) {
    console.error('[legales PUT]', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.legalPage.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[legales DELETE]', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
