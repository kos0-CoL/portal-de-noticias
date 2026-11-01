import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const seo = await prisma.siteSeo.findFirst();
  return NextResponse.json(seo ?? {});
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const {
      siteTitle,
      siteTagline,
      metaTitle,
      metaDescription,
      keywords,
      ogImage,
      twitterCard,
      googleAnalyticsId,
      googleSearchConsoleId,
      facebookPixelId,
      robots
    } = body;

    const existing = await prisma.siteSeo.findFirst();

    const seo = existing
      ? await prisma.siteSeo.update({
          where: { id: existing.id },
          data: {
            siteTitle,
            siteTagline,
            metaTitle,
            metaDescription,
            keywords: keywords ?? [],
            ogImage,
            twitterCard,
            googleAnalyticsId,
            googleSearchConsoleId,
            facebookPixelId,
            robots
          }
        })
      : await prisma.siteSeo.create({
          data: {
            siteTitle: siteTitle ?? 'Saladillo Noticias',
            siteTagline: siteTagline ?? 'El diario de nuestra ciudad',
            metaTitle,
            metaDescription,
            keywords: keywords ?? [],
            ogImage,
            twitterCard: twitterCard ?? 'summary_large_image',
            googleAnalyticsId,
            googleSearchConsoleId,
            facebookPixelId,
            robots: robots ?? 'index, follow'
          }
        });

    return NextResponse.json(seo);
  } catch (error) {
    console.error('[site-seo]', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
