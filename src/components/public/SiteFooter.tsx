import Link from 'next/link';
import { Facebook, Instagram, Mail, MapPin, Phone, Send } from 'lucide-react';
import { LOCALIDADES, NAV_MENU, SITE } from '@/lib/constants';
import NewsletterForm from './NewsletterForm';

const SECCIONES_FOOTER = [
  { label: 'Policiales', href: '/categoria/policiales' },
  { label: 'Política', href: '/categoria/politica' },
  { label: 'Deportes', href: '/categoria/deportes' },
  { label: 'Interés General', href: '/categoria/interes-general' },
  { label: 'Agro', href: '/categoria/agro' }
];

const SERVICIOS_FOOTER = [
  { label: 'Clasificados', href: '/clasificados' },
  { label: 'Farmacias de turno', href: '/farmacias' },
  { label: 'Clima en Saladillo', href: '/clima' },
  { label: 'Buscar notas', href: '/buscar' }
];

/** Pie de pagina institucional en azul marino oscuro. */
export function SiteFooter() {
  const anio = new Date().getFullYear();

  return (
    <footer className="mt-12 bg-brand-950 text-brand-100">
      <div className="container-news grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
        {/* Marca */}
        <div>
          <p className="font-editorial text-xl font-bold text-white">
            Saladillo<span className="text-brand-300"> Noticias</span>
          </p>
          <p className="mt-2 text-sm text-brand-200">{SITE.tagline}</p>
          <p className="mt-3 text-sm text-brand-200">
            Periodismo local de {SITE.city}, {SITE.province}.
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" aria-hidden="true" />
              <span>{SITE.city}, {SITE.province}, {SITE.country}</span>
            </li>
            <li className="flex items-center gap-2">
              <Mail className="h-4 w-4 shrink-0 text-brand-300" aria-hidden="true" />
              <a href={`mailto:${SITE.email}`} className="hover:text-white">
                {SITE.email}
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Phone className="h-4 w-4 shrink-0 text-brand-300" aria-hidden="true" />
              <a href={`tel:${SITE.phone.replace(/[^\d+]/g, '')}`} className="hover:text-white">
                {SITE.phone}
              </a>
            </li>
          </ul>
        </div>

        {/* Secciones */}
        <nav aria-label="Secciones">
          <h2 className="kicker text-brand-300">Secciones</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {SECCIONES_FOOTER.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="transition hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Servicios */}
        <nav aria-label="Servicios">
          <h2 className="kicker text-brand-300">Servicios</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {SERVICIOS_FOOTER.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="transition hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <h2 className="kicker mt-6 text-brand-300">Seguinos</h2>
          <div className="mt-3 flex items-center gap-3">
            <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook de Saladillo Noticias" className="rounded-md border border-white/15 p-2 transition hover:bg-white/10">
              <Facebook className="h-4 w-4" aria-hidden="true" />
            </a>
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram de Saladillo Noticias" className="rounded-md border border-white/15 p-2 transition hover:bg-white/10">
              <Instagram className="h-4 w-4" aria-hidden="true" />
            </a>
            <a href="https://t.me" target="_blank" rel="noopener noreferrer" aria-label="Telegram de Saladillo Noticias" className="rounded-md border border-white/15 p-2 transition hover:bg-white/10">
              <Send className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </nav>

        {/* Localidades */}
        <div>
          <h2 className="kicker text-brand-300">Localidades</h2>
          <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-2 text-sm">
            {LOCALIDADES.map((loc) => (
              <li key={loc}>
                <Link
                  href={`/buscar?q=${encodeURIComponent(loc)}`}
                  className="rounded-full border border-white/15 px-3 py-1 text-xs transition hover:bg-white/10 hover:text-white"
                >
                  {loc}
                </Link>
              </li>
            ))}
          </ul>
          <h2 className="kicker mt-6 text-brand-300">Navegación</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {NAV_MENU.slice(1, 4).map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="transition hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Newsletter */}
        <div className="lg:col-span-2">
          <NewsletterForm className="max-w-md" />
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-news flex flex-col items-center justify-between gap-2 py-4 text-xs text-brand-300 sm:flex-row">
          <p>
            © {anio} {SITE.name}. Todos los derechos reservados.
          </p>
          <p className="text-center sm:text-right">
            Prohibida su reproducción total o parcial sin autorización. Los contenidos citados de terceros
            pertenecen a sus respectivos autores.
          </p>
        </div>
      </div>
    </footer>
  );
}
