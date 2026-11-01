'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw } from 'lucide-react';

/** Error boundary del portal publico. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Deja registro en consola para depuracion; en produccion el digest identifica el error.
    console.error('[Portal] Error en el render:', error);
  }, [error]);

  return (
    <main className="brand-gradient flex min-h-screen flex-col items-center justify-center px-4 text-center text-white">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
        <AlertTriangle className="h-8 w-8" aria-hidden="true" />
      </span>
      <h1 className="mt-6 font-editorial text-3xl font-bold sm:text-4xl">Algo salió mal</h1>
      <p className="mt-2 max-w-md text-brand-100">
        No pudimos cargar esta sección. Podés intentar nuevamente o volver al inicio del portal.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={reset} className="btn bg-white text-brand-900 hover:bg-brand-50">
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Reintentar
        </button>
        <Link href="/" className="btn border border-white/30 text-white hover:bg-white/10">
          Ir al inicio
        </Link>
      </div>
    </main>
  );
}
