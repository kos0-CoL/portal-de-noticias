import { Megaphone } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import BannerManager, { type BannerDTO } from '@/components/admin/BannerManager';

/**
 * /admin/banners — Gestor de publicidad y monetización.
 * Lista los banners por zona, con métricas de impresiones, clics y CTR.
 */

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Banners y monetización' };

function calcularCtr(clicks: number, impresiones: number): string {
  if (impresiones <= 0) return '—';
  return `${((clicks / impresiones) * 100).toFixed(2)}%`;
}

export default async function AdminBannersPage() {
  const banners = await prisma.banner.findMany({
    orderBy: [{ zone: 'asc' }, { weight: 'desc' }, { createdAt: 'desc' }]
  });

  const datos: BannerDTO[] = banners.map((banner) => ({
    id: banner.id,
    name: banner.name,
    advertiser: banner.advertiser,
    type: banner.type,
    zone: banner.zone,
    imageUrl: banner.imageUrl,
    targetUrl: banner.targetUrl,
    htmlCode: banner.htmlCode,
    adSlot: banner.adSlot,
    weight: banner.weight,
    isActive: banner.isActive,
    startsAt: banner.startsAt ? banner.startsAt.toISOString() : null,
    endsAt: banner.endsAt ? banner.endsAt.toISOString() : null,
    impressions: banner.impressions,
    clicks: banner.clicks
  }));

  const totalImpresiones = banners.reduce((acc, b) => acc + b.impressions, 0);
  const totalClics = banners.reduce((acc, b) => acc + b.clicks, 0);
  const activos = banners.filter((b) => b.isActive).length;

  const comercios = Array.from(
    banners.reduce((map, banner) => {
      const clave = banner.advertiser?.trim() || 'Sin anunciante';
      map.set(clave, (map.get(clave) ?? 0) + 1);
      return map;
    }, new Map<string, number>())
  ).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <header>
        <p className="kicker text-brand-600">Panel</p>
        <h1 className="admin-title flex items-center gap-2 text-xl">
          <Megaphone className="h-5 w-5 text-brand-700" aria-hidden />
          Banners y monetización
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-news-500">
          Administrá los espacios publicitarios del portal: banners de comercios locales, bloques de AdSense y códigos
          de terceros.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="admin-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-news-500">Banners totales</p>
          <p className="mt-1 font-editorial text-2xl font-bold text-brand-900">{banners.length}</p>
        </div>
        <div className="admin-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-news-500">Activos</p>
          <p className="mt-1 font-editorial text-2xl font-bold text-brand-900">{activos}</p>
        </div>
        <div className="admin-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-news-500">Impresiones</p>
          <p className="mt-1 font-editorial text-2xl font-bold text-brand-900">{totalImpresiones.toLocaleString('es-AR')}</p>
        </div>
        <div className="admin-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-news-500">Clics / CTR</p>
          <p className="mt-1 font-editorial text-2xl font-bold text-brand-900">
            {totalClics.toLocaleString('es-AR')}
            <span className="ml-2 align-middle text-sm font-semibold text-news-500">
              {calcularCtr(totalClics, totalImpresiones)}
            </span>
          </p>
        </div>
      </section>

      <BannerManager banners={datos} />

      <section className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-title">Comercios locales anunciantes</h2>
        </div>
        {comercios.length === 0 ? (
          <p className="text-sm text-news-500">Todavía no hay anunciantes cargados.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {comercios.map(([nombre, cantidad]) => (
              <li key={nombre} className="badge-blue">
                {nombre} · {cantidad}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
