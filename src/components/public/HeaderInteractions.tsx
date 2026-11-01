'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { NAV_MENU } from '@/lib/constants';
import { SearchBar } from '@/components/public/SearchBar';

/**
 * Unica parte interactiva de la cabecera: buscador y menu mobile.
 * Se aisla en un client component para que SiteHeader siga siendo server.
 */
export function HeaderInteractions() {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <SearchBar variant="dark" className="hidden max-w-xs md:flex" />

      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}
        aria-expanded={abierto}
        aria-controls="menu-mobile"
        className="flex h-10 w-10 items-center justify-center rounded-md border border-white/20 text-white transition hover:bg-white/10 lg:hidden"
      >
        {abierto ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {abierto ? (
        <div
          id="menu-mobile"
          className="absolute left-0 right-0 top-full z-40 border-t border-white/10 bg-brand-900 p-4 shadow-header lg:hidden"
        >
          <SearchBar variant="dark" className="mb-3" />
          <nav aria-label="Navegación principal">
            <ul className="flex flex-col divide-y divide-white/10">
              {NAV_MENU.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setAbierto(false)}
                    className="block py-2.5 text-sm font-semibold text-brand-50 transition hover:text-white"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/10 pt-3 text-[11px] font-semibold uppercase tracking-wide text-brand-200">
            <Link href="/farmacias" onClick={() => setAbierto(false)} className="hover:text-white">
              Farmacias
            </Link>
            <Link href="/clima" onClick={() => setAbierto(false)} className="hover:text-white">
              Clima
            </Link>
            <Link href="/clasificados" onClick={() => setAbierto(false)} className="hover:text-white">
              Clasificados
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
