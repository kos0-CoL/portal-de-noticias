'use client';

import { ExternalLink, MapPin, Phone, MessageCircle } from 'lucide-react';

/**
 * Botones de "cómo llegar" y contacto para una farmacia.
 *
 * - Cómo llegar: abre Google Maps con el destino (coordenadas o dirección).
 *   Teléfono: enlace tel:.
 *   WhatsApp: enlace wa.me con el número limpio (sin + ni espacios).
 */

interface PharmacyDirectionsProps {
  direccion: string;
  lat?: number | null;
  lng?: number | null;
  telefono?: string | null;
  whatsapp?: string | null;
}

function numeroLimpio(valor: string | undefined | null): string {
  if (!valor) return '';
  const digitos = valor.replace(/\D/g, '');
  return digitos.startsWith('54') ? digitos : `54${digitos}`;
}

export default function PharmacyDirections({ direccion, lat, lng, telefono, whatsapp }: PharmacyDirectionsProps) {
  const destino = lat != null && lng != null ? `${lat},${lng}` : direccion;
  const mapaUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}`;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <a
        href={mapaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-lg border border-news-200 bg-white px-3 py-2 text-left text-sm font-medium text-news-700 hover:bg-news-50 transition"
      >
        <MapPin className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
        Cómo llegar
      </a>
      {telefono && (
        <a
          href={`tel:${numeroLimpio(telefono)}`}
          className="flex items-center gap-2 rounded-lg border border-news-200 bg-white px-3 py-2 text-left text-sm font-medium text-news-700 hover:bg-news-50 transition"
        >
          <Phone className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
          Llamar
        </a>
      )}
      {whatsapp && (
        <a
          href={`https://wa.me/${numeroLimpio(whatsapp)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-lg border border-news-200 bg-white px-3 py-2 text-left text-sm font-medium text-news-700 hover:bg-news-50 transition"
        >
          <MessageCircle className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
          WhatsApp
        </a>
      )}
    </div>
  );
}
