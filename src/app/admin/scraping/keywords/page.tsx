import Link from 'next/link';
import { Info } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { LOCALIDADES, TERMINOS_INSTITUCIONALES } from '@/lib/constants';
import KeywordManager, { type KeywordRow } from '@/components/admin/KeywordManager';

export const dynamic = 'force-dynamic';

/** Gestión del filtro de palabras clave locales. */
export default async function KeywordsPage() {
  const keywords = await prisma.keyword.findMany({
    orderBy: [{ weight: 'desc' }, { word: 'asc' }]
  });

  const filas: KeywordRow[] = keywords.map((k) => ({
    id: k.id,
    word: k.word,
    type: k.type as KeywordRow['type'],
    weight: k.weight,
    isActive: k.isActive
  }));

  return (
    <div className="container-news space-y-6 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-editorial text-2xl font-bold text-brand-900">Palabras clave locales</h1>
          <p className="max-w-2xl text-sm text-news-500">
            Cuando una noticia extraída contiene alguna de estas palabras se marca automáticamente como
            «Prioridad Alta», para que aparezca primero en la bandeja de revisión.
          </p>
        </div>
        <Link className="btn-ghost btn-sm" href="/admin/scraping">
          Volver al panel
        </Link>
      </header>

      <KeywordManager keywords={filas} />

      <section className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-title flex items-center gap-2">
            <Info className="h-4 w-4" />
            Cómo funciona la prioridad
          </h2>
        </div>
        <div className="space-y-3 text-sm text-news-700">
          <p>
            El motor suma el <strong>peso</strong> de cada palabra encontrada en el título y el cuerpo de la nota:
          </p>
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <strong>Urgente</strong>: puntaje total de 25 o más, o 3 o más palabras distintas.
            </li>
            <li>
              <strong>Prioridad Alta</strong>: puntaje de 10 o más, o al menos una coincidencia con peso 9 o más
              (localidades e instituciones fuertes).
            </li>
            <li>
              <strong>Normal</strong>: el resto.
            </li>
          </ul>
          <p className="text-news-500">
            Si la tabla está vacía, el sistema usa esta lista por defecto de localidades:
            {' '}
            <strong>{LOCALIDADES.join(', ')}</strong>.
          </p>
          <p className="text-news-500">
            Y estos términos institucionales que también disparan prioridad alta:
            {' '}
            <strong>{TERMINOS_INSTITUCIONALES.join(', ')}</strong>.
          </p>
        </div>
      </section>
    </div>
  );
}
