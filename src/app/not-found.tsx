import Link from 'next/link';
import { Newspaper } from 'lucide-react';
import { SiteHeader } from '@/components/public/SiteHeader';
import { SiteFooter } from '@/components/public/SiteFooter';

export default function NotFound() {
  return (
    <>
      <SiteHeader />

      <main className="container-news flex min-h-[50vh] flex-col items-center justify-center py-16 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-brand-800">
          <Newspaper className="h-8 w-8" aria-hidden="true" />
        </span>
        <p className="mt-6 font-editorial text-5xl font-bold text-brand-900">404</p>
        <h1 className="headline-lg mt-2">No encontramos esta página</h1>
        <p className="mt-2 max-w-md text-news-600">
          Puede que la nota haya sido movida, archivada o que el enlace esté mal escrito. Probá volver al inicio o usar
          el buscador.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link href="/" className="btn-primary">
            Ir al inicio
          </Link>
          <Link href="/buscar" className="btn-secondary">
            Buscar una nota
          </Link>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
