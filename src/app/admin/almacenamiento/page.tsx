import Link from 'next/link';
import { ExternalLink, HardDrive } from 'lucide-react';
import { getStorageSettingsForClient } from '@/lib/settings';
import { LISTA_PROVEEDORES } from '@/lib/storage';
import StorageSettingsForm from '@/components/admin/StorageSettingsForm';

/**
 * /admin/almacenamiento — Configuración del almacenamiento externo de las
 * portadas (Supabase Storage). En Vercel el disco es de solo lectura, así que
 * las imágenes guardadas en el servidor no persisten.
 */

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Almacenamiento de imágenes' };

export default async function AdminAlmacenamientoPage() {
  const settings = await getStorageSettingsForClient();
  const proveedores = LISTA_PROVEEDORES.map((p) => ({ id: p.id as string, nombre: p.nombre }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="kicker text-brand-600">Panel</p>
          <h1 className="admin-title flex items-center gap-2 text-xl">
            <HardDrive className="h-5 w-5 text-brand-700" aria-hidden />
            Almacenamiento de imágenes
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-news-500">
            Elegí dónde se alojan las portadas. El proveedor por defecto lo usa el scraper y es el que se propone en el
            editor de cada nota.
          </p>
        </div>
        <Link href="/admin/noticias" className="btn-secondary btn-sm">
          Ir a Noticias
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </header>

      <StorageSettingsForm initial={settings} proveedores={proveedores} />
    </div>
  );
}
