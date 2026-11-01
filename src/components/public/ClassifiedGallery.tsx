'use client';

import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface ClassifiedGalleryProps {
  images: string[];
  alt: string;
}

/**
 * Galería de un aviso clasificado: foto grande + miniaturas.
 * Es cliente porque el intercambio de foto activa necesita estado; con una sola
 * imagen se renderiza directamente sin controles.
 */
export function ClassifiedGallery({ images, alt }: ClassifiedGalleryProps) {
  const [activa, setActiva] = useState(0);
  if (images.length === 0) return null;

  return (
    <div>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-news-200 bg-news-100">
        <Image
          src={images[activa]}
          alt={alt}
          fill
          sizes="(max-width: 1024px) 100vw, 760px"
          className="object-contain"
          priority
        />
      </div>

      {images.length > 1 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {images.map((url, indice) => (
            <button
              key={url}
              type="button"
              onClick={() => setActiva(indice)}
              aria-label={`Ver la foto ${indice + 1} de ${images.length}`}
              aria-current={indice === activa}
              className={cn(
                'relative h-16 w-20 overflow-hidden rounded-md border-2 transition',
                indice === activa ? 'border-brand-800' : 'border-news-200 hover:border-brand-300'
              )}
            >
              <Image src={url} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
