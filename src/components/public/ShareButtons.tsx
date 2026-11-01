'use client';

import { useState } from 'react';
import { Check, Facebook, Link2, MessageCircle, Send, Twitter } from 'lucide-react';

interface ShareButtonsProps {
  url: string;
  title: string;
}

/** Botones de compartir en redes + copiar enlace. */
export function ShareButtons({ url, title }: ShareButtonsProps) {
  const [copiado, setCopiado] = useState(false);

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const redes = [
    { label: 'Compartir en Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, Icon: Facebook },
    { label: 'Compartir en X', href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`, Icon: Twitter },
    { label: 'Compartir en WhatsApp', href: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`, Icon: MessageCircle },
    { label: 'Compartir en Telegram', href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`, Icon: Send }
  ];

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-news-500">Compartir</span>
      {redes.map(({ label, href, Icon }, i) => (
        <a
          key={i}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-news-300 bg-white text-brand-700 transition hover:border-brand-300 hover:bg-brand-50"
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </a>
      ))}
      <button
        type="button"
        onClick={copiar}
        aria-label="Copiar enlace de la nota"
        className="flex h-9 items-center gap-1.5 rounded-md border border-news-300 bg-white px-3 text-xs font-semibold text-brand-700 transition hover:border-brand-300 hover:bg-brand-50"
      >
        {copiado ? <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" /> : <Link2 className="h-4 w-4" aria-hidden="true" />}
        {copiado ? 'Copiado' : 'Copiar enlace'}
      </button>
    </div>
  );
}
