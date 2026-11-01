import type { Metadata, Viewport } from 'next';
import { Inter, Source_Serif_4 } from 'next/font/google';
import { prisma } from '@/lib/prisma';
import { SITE } from '@/lib/constants';
import { CookieConsentBanner } from '@/components/public/CookieConsentBanner';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap'
});

const editorial = Source_Serif_4({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-editorial',
  display: 'swap'
});

export async function generateMetadata(): Promise<Metadata> {
  const seo = await prisma.siteSeo.findFirst();

  return {
    metadataBase: new URL(SITE.url),
    title: {
      default: seo?.metaTitle ?? `${SITE.name} — Noticias de ${SITE.city}, ${SITE.province}`,
      template: `%s | ${seo?.siteTitle ?? SITE.name}`
    },
    description: seo?.metaDescription ?? `Últimas noticias de ${SITE.city}, Del Carril, Cazón y Polvaredas. Policiales, política, deportes, interés general y clasificados de la comunidad.`,
    keywords: Array.isArray(seo?.keywords) && seo.keywords.length > 0
      ? (seo.keywords as string[])
      : ['Saladillo', 'noticias Saladillo', 'Saladillo Buenos Aires', 'Del Carril', 'Cazón', 'Polvaredas'],
    applicationName: seo?.siteTitle ?? SITE.name,
    authors: [{ name: seo?.siteTitle ?? SITE.name }],
    openGraph: {
      type: 'website',
      locale: 'es_AR',
      siteName: seo?.siteTitle ?? SITE.name,
      url: SITE.url,
      title: seo?.metaTitle ?? `${SITE.name} — ${SITE.tagline}`,
      images: seo?.ogImage ? [{ url: seo.ogImage }] : undefined
    },
    twitter: { card: (seo?.twitterCard ?? 'summary_large_image') as 'summary' | 'summary_large_image' },
    robots: seo?.robots === 'noindex, nofollow' || seo?.robots === 'noindex' ? { index: false, follow: false } : { index: true, follow: true },
    icons: { icon: '/favicon.ico' }
  };
}

export const viewport: Viewport = {
  themeColor: '#0B1C36',
  width: 'device-width',
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={`${inter.variable} ${editorial.variable}`}>
      <body className="min-h-screen font-sans">
        {children}
        <CookieConsentBanner />
      </body>
    </html>
  );
}
