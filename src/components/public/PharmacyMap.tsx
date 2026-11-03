'use client';

import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';

/**
 * Mapa embebido de Google Maps (iframe ?output=embed) para una farmacia.
 *
 * Se muestra solo después del consentimiento de cookies, reutilizando el
 * estado de localStorage que ya maneja CookieConsentBanner (clave
 * sn_cookie_consent). Si el usuario no aceptó, se muestra un botón "Ver
 * mapa" que lo carga a demanda.
 */

interface PharmacyMapProps {
  direccion: string;
  lat?: number | null;
  lng?: number | null;
  /** Texto accesible para el iframe. */
  titulo?: string;
}

export default function PharmacyMap({ direccion, lat, lng, titulo }: PharmacyMapProps) {
  const [aceptado, setAceptado] = useState<boolean | null>(null);
  const [mostrar, setMostrar] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('sn_cookie_consent');
    if (stored) {
      try {
        setAceptado(!!JSON.parse(stored).essential);
      } catch {
        setAceptado(false);
      }
    } else {
      setAceptado(false);
    }
  }, []);

  const src =
    lat != null && lng != null
      ? `https://www.google.com/maps?q=${lat},${lng}&output=embed`
      : `https://www.google.com/maps/search/${encodeURIComponent(direccion)}/?output=embed`;

  const listo = aceptado === true || mostrar;

  const params = new URLSearchParams({
    q: lat != null && lng != null ? `${lat},${lng}` : direccion,
    output: 'embed'
  });

  return (
    <div className="rounded-lg border border-news-200 overflow-hidden">
      {!listo ? (
        <div className="aspect-video bg-news-100 flex items-center justify-center">
          <button
            type="button"
            onClick={() => setMostrar(true)}
            className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-news-300 px-6 py-4 text-sm text-news-500 hover:bg-news-200 transition"
          >
            <MapPin className="h-5 w-5 text-news-400" aria-hidden="true" />
            Ver mapa
          </button>
        </div>
      ) : (
        <iframe
          className="w-full h-[260px] block"
          src={`https://www.google.com/maps?${params.toString()}`}
          title={titulo ?? `Mapa de ${direccion}`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
          aria-hidden={!mostrar}
        />
      )}
    </div>
  );
}
