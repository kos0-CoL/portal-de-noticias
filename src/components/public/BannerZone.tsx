import Image from 'next/image';
import Script from 'next/script';
import type { BannerZone as PrismaBannerZone } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { cn } from '@/lib/utils';

/**
 * Renderiza los banners publicitarios de una zona del portal.
 * Es un Server Component async: consulta Prisma y devuelve null si no hay nada.
 * Todas las zonas llevan el rótulo "PUBLICIDAD" (transparencia periodística).
 */

export type BannerZoneId = 'HEADER' | 'HOME_TOP' | 'INLINE_ARTICLE' | 'SIDEBAR' | 'FOOTER' | 'MOBILE_STICKY';

export interface BannerZoneProps {
  zone: BannerZoneId;
  className?: string;
}

const MEDIDAS: Record<BannerZoneId, { width: number; height: number }> = {
  HEADER: { width: 970, height: 90 },
  HOME_TOP: { width: 970, height: 90 },
  INLINE_ARTICLE: { width: 728, height: 90 },
  SIDEBAR: { width: 300, height: 250 },
  FOOTER: { width: 970, height: 90 },
  MOBILE_STICKY: { width: 320, height: 50 }
};

/** Imagen por defecto que se muestra cuando no hay banner activo en la zona. */
const IMAGEN_POR_DEFECTO: Record<Exclude<BannerZoneId, 'HEADER'>, string> = {
  HOME_TOP: '/uploads/banners/HOME_TOP_970x90.svg',
  INLINE_ARTICLE: '/uploads/banners/INLINE_ARTICLE_728x90.svg',
  SIDEBAR: '/uploads/banners/SIDEBAR_300x250.svg',
  FOOTER: '/uploads/banners/FOOTER_970x90.svg',
  MOBILE_STICKY: '/uploads/banners/MOBILE_STICKY_320x50.svg'
};

/** Rotulo discreto de publicidad que acompaña a todas las piezas. */
function RotuloPublicidad() {
  return <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-news-400">Publicidad</span>;
}

/** Elige un banner de la lista respetando el peso de rotación. */
function elegirPorPeso<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((acc, item) => acc + Math.max(1, item.weight), 0);
  let umbral = Math.random() * total;
  for (const item of items) {
    umbral -= Math.max(1, item.weight);
    if (umbral <= 0) return item;
  }
  return items[0];
}

export async function BannerZone({ zone, className }: BannerZoneProps) {
  const now = new Date();

  const banners = await prisma.banner.findMany({
    where: {
      zone: zone as PrismaBannerZone,
      isActive: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }
      ]
    },
    orderBy: [{ weight: 'desc' }, { createdAt: 'desc' }]
  });

  const { width, height } = MEDIDAS[zone];

  if (banners.length === 0) {
    const imagenDefault = IMAGEN_POR_DEFECTO[zone];
    if (imagenDefault) {
      return (
        <div className={cn('my-4 w-full', className)}>
          <RotuloPublicidad />
          <Image
            src={imagenDefault}
            alt="Publicite aquí"
            width={width}
            height={height}
            unoptimized
            className="h-auto w-full rounded-md object-contain"
          />
        </div>
      );
    }
    return null;
  }

  const anuncioAdsense = banners.find((b) => b.type === 'ADSENSE' && b.adSlot);
  if (anuncioAdsense) {
    const adClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? '';
    return (
      <div className={cn('my-4 w-full', className)}>
        <RotuloPublicidad />
        {adClient ? (
          <>
            <Script
              async
              strategy="afterInteractive"
              src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adClient}`}
              crossOrigin="anonymous"
            />
            <ins
              className="adsbygoogle block w-full"
              style={{ display: 'block' }}
              data-ad-client={adClient}
              data-ad-slot={anuncioAdsense.adSlot ?? undefined}
            />
          </>
        ) : (
          <div className="flex h-[90px] w-full items-center justify-center rounded-md border border-dashed border-news-300 bg-news-50 px-4 text-center text-xs text-news-500">
            Espacio publicitario (AdSense) — falta configurar NEXT_PUBLIC_ADSENSE_CLIENT.
          </div>
        )}
      </div>
    );
  }

  // Los banners de tipo HTML han sido deshabilitados por seguridad (riesgo XSS).
  // Solo se permiten banners de imagen o AdSense.

  const imagenes = banners.filter((b) => (b.type === 'IMAGE' || b.type === 'ROTATING') && b.imageUrl);
  if (imagenes.length === 0) return null;

  const banner = imagenes.length === 1 ? imagenes[0] : elegirPorPeso(imagenes);
  if (!banner.imageUrl) return null;

  const contenido = (
    <Image
      src={banner.imageUrl}
      alt={banner.name}
      width={width}
      height={height}
      unoptimized
      className="h-auto w-full rounded-md object-contain"
    />
  );

  return (
    <div className={cn('my-4 w-full', className)}>
      <RotuloPublicidad />
      {banner.targetUrl ? (
        <a href={banner.targetUrl} target="_blank" rel="noopener sponsored" className="block">
          {contenido}
        </a>
      ) : (
        contenido
      )}
    </div>
  );
}

export default BannerZone;
