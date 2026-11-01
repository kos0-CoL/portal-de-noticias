import Link from 'next/link';
import { NAV_MENU, SITE } from '@/lib/constants';
import { formatFecha } from '@/lib/utils';
import { HeaderInteractions } from '@/components/public/HeaderInteractions';
import { WeatherWidget } from '@/components/public/WeatherWidget';
import { PharmacyWidget } from '@/components/public/PharmacyWidget';

const LINKS_SECUNDARIOS = [
  { label: 'Farmacias', href: '/farmacias' },
  { label: 'Clima', href: '/clima' },
  { label: 'Clasificados', href: '/clasificados' }
];

/**
 * Cabecera institucional sticky en azul marino.
 * Es un server component: toda la interactividad (buscador + menu mobile) vive
 * en HeaderInteractions.
 */
export function SiteHeader() {
  const fecha = formatFecha(new Date(), false);

  return (
    <header className="brand-gradient sticky top-0 z-50 shadow-header">
      {/* Barra superior fina con fecha y enlaces secundarios */}
      <div className="border-b border-white/10">
        <div className="container-news flex h-8 items-center justify-between gap-4 text-[11px] text-brand-200">
          <time dateTime={new Date().toISOString()} className="truncate">
            {fecha} · {SITE.city}, {SITE.province}
          </time>
          <nav aria-label="Enlaces secundarios" className="hidden items-center gap-4 sm:flex">
            {LINKS_SECUNDARIOS.map((l) => (
              <Link key={l.href} href={l.href} className="font-medium transition hover:text-white">
                {l.label}
              </Link>
            ))}
            <a href={`mailto:${SITE.email}`} className="font-medium transition hover:text-white">
              Contacto
            </a>
          </nav>
        </div>
      </div>

      {/* Logotipo + interacciones */}
      <div className="container-news relative flex items-center justify-between gap-4 py-3">
        <Link href="/" className="group flex items-baseline gap-2" aria-label={`${SITE.name} — Inicio`}>
          <span className="font-editorial text-2xl font-bold leading-none text-white sm:text-3xl">
            Saladillo
            <span className="text-brand-300 transition group-hover:text-brand-200"> Noticias</span>
          </span>
          <span className="hidden text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-200 sm:inline">
            Saladillo · Buenos Aires
          </span>
        </Link>

        <HeaderInteractions />
      </div>

      {/* Navegacion principal (desktop) */}
      <nav aria-label="Navegación principal" className="hidden border-t border-white/10 lg:block">
        <div className="container-news">
          <ul className="flex items-stretch">
            {NAV_MENU.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex h-11 items-center border-b-2 border-transparent px-4 text-sm font-semibold text-brand-100 transition hover:border-brand-300 hover:text-white"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* Franja de servicios: clima + farmacia de turno */}
      <div className="border-t border-white/10 bg-brand-900/50">
        <div className="container-news grid gap-2 py-2 sm:grid-cols-2">
          <WeatherWidget />
          <PharmacyWidget compacto />
        </div>
      </div>
    </header>
  );
}
