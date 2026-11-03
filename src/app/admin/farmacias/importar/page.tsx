import Link from 'next/link';
import { ArrowLeft, Download } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getPharmacySettings, getSetting, SETTING_KEYS, type ImportLogEntry } from '@/lib/settings';
import PharmacyImportPreview from '@/components/admin/PharmacyImportPreview';
import type { FarmaciaOpcion } from '@/components/admin/RotationOrderEditor';

/**
 * /admin/farmacias/importar — Traer el organigrama del Colegio.
 *
 * La página solo muestra: el trabajo pesado (descarga, parseo y diff) pasa en
 * `/api/admin/farmacias/importar`, que no escribe nada hasta que se confirma.
 */

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Importar organigrama' };

export default async function ImportarOrganigramaPage() {
  const [settings, log, farmacias] = await Promise.all([
    getPharmacySettings(),
    getSetting<ImportLogEntry[]>(SETTING_KEYS.pharmacyImportLog),
    prisma.pharmacy.findMany({
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, isActive: true }
    })
  ]);

  const opciones: FarmaciaOpcion[] = farmacias;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link className="btn-ghost btn-sm" href="/admin/farmacias">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Farmacias
        </Link>
        <div>
          <p className="kicker text-brand-600">Panel</p>
          <h1 className="admin-title flex items-center gap-2 text-xl">
            <Download className="h-5 w-5 text-brand-700" aria-hidden />
            Importar organigrama
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-news-500">
            Trae el mes publicado por el Colegio de Farmacéuticos, compara con lo que ya está cargado y muestra qué
            cambia. Nada se escribe hasta confirmar la importación.
          </p>
        </div>
      </header>

      <PharmacyImportPreview url={settings.importUrl} log={log ?? []} farmacias={opciones} />
    </div>
  );
}
