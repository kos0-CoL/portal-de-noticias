'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchBarProps {
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  /** Estilo claro para franjas oscuras (cabecera azul marino). */
  variant?: 'light' | 'dark';
  autoFocus?: boolean;
}

/** Input de busqueda que navega a /buscar?q=... */
export function SearchBar({
  defaultValue = '',
  placeholder = 'Buscar notas, temas o lugares…',
  className,
  variant = 'light',
  autoFocus = false
}: SearchBarProps) {
  const router = useRouter();
  const [q, setQ] = useState(defaultValue);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const termino = q.trim();
    if (!termino) return;
    router.push(`/buscar?q=${encodeURIComponent(termino)}`);
  }

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className={cn(
        'flex w-full items-center gap-1 rounded-md border',
        variant === 'dark'
          ? 'border-white/20 bg-white/10 focus-within:border-white/40'
          : 'border-news-300 bg-white',
        className
      )}
    >
      <label className="sr-only" htmlFor="buscador-portal">
        Buscar en el portal
      </label>
      <input
        id="buscador-portal"
        type="search"
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none',
          variant === 'dark'
            ? 'text-white placeholder:text-brand-200'
            : 'text-news-800 placeholder:text-news-400'
        )}
      />
      <button
        type="submit"
        aria-label="Buscar"
        className={cn(
          'mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded transition',
          variant === 'dark'
            ? 'text-brand-50 hover:bg-white/15'
            : 'text-brand-700 hover:bg-brand-50'
        )}
      >
        <Search className="h-4 w-4" aria-hidden="true" />
      </button>
    </form>
  );
}
