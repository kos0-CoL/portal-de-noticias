import Link from 'next/link';
import { Sparkles, ExternalLink } from 'lucide-react';
import {
  getAiSettingsForClient,
  getWatermarkSettings,
  getSetting,
  BASE_URLS,
  MODELOS_SUGERIDOS,
  SETTING_KEYS
} from '@/lib/settings';
import IaSettingsForm from '@/components/admin/IaSettingsForm';

/**
 * /admin/ia — Configuración del motor de IA: proveedor, credenciales, tono por
 * defecto, marca de agua y parámetros de imagen.
 */

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Inteligencia Artificial' };

export default async function AdminIaPage() {
  const [settings, watermark, maxWidth, quality] = await Promise.all([
    getAiSettingsForClient(),
    getWatermarkSettings(),
    getSetting<number>(SETTING_KEYS.imageMaxWidth),
    getSetting<number>(SETTING_KEYS.imageQuality)
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="kicker text-brand-600">Panel</p>
          <h1 className="admin-title flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-brand-700" aria-hidden />
            Inteligencia Artificial
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-news-500">
            Configurá el proveedor, la clave y el estilo de redacción. La reescritura de notas y la generación de
            metadatos SEO usan esta configuración.
          </p>
        </div>
        <Link href="/admin/noticias" className="btn-secondary btn-sm">
          Ir a Noticias
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </header>

      <IaSettingsForm
        initial={settings}
        baseUrls={{ ...BASE_URLS }}
        modelosSugeridos={{ ...MODELOS_SUGERIDOS }}
        watermark={watermark}
        imageMaxWidth={typeof maxWidth === 'number' ? maxWidth : 1600}
        imageQuality={typeof quality === 'number' ? quality : 82}
      />
    </div>
  );
}
