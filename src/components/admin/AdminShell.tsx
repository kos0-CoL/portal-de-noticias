'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Bot,
  Cross,
  FilePlus2,
  FolderTree,
  HardDrive,
  Image as ImageIcon,
  LayoutDashboard,
  Megaphone,
  Menu,
  Newspaper,
  Search,
  Share2,
  Sparkles,
  X
} from 'lucide-react';
import { SITE } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { LogoutButton } from '@/components/admin/LogoutButton';

/**
 * Shell del Panel de Administración.
 * Sidebar azul marino a la izquierda (colapsable en celular) + header blanco
 * con el título de la sección y los datos del usuario.
 *
 * Detecta el pathname con usePathname(): en /admin/login se renderiza solo el
 * contenido (sin shell) porque esa pantalla no requiere sesión.
 */

export interface AdminShellUser {
  name: string;
  email: string;
  role: string;
}

export interface AdminShellProps {
  user: AdminShellUser | null;
  children: React.ReactNode;
  title?: string;
}

const NAV_ITEMS: { href: string; label: string; icon: typeof LayoutDashboard }[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/noticias', label: 'Noticias', icon: Newspaper },
  { href: '/admin/noticias/nueva', label: 'Nueva noticia', icon: FilePlus2 },
  { href: '/admin/categorias', label: 'Categorías', icon: FolderTree },
  { href: '/admin/clasificados', label: 'Clasificados', icon: Megaphone },
  { href: '/admin/scraping', label: 'Scraping', icon: Bot },
  { href: '/admin/ia', label: 'Configuración de IA', icon: Sparkles },
  { href: '/admin/almacenamiento', label: 'Almacenamiento', icon: HardDrive },
  { href: '/admin/farmacias', label: 'Farmacias', icon: Cross },
  { href: '/admin/banners', label: 'Banners / Monetización', icon: ImageIcon },
  { href: '/admin/difusion', label: 'Difusión en redes', icon: Share2 },
  { href: '/admin/seo', label: 'SEO y Legales', icon: Search }
];

const SECTION_TITLES: { match: (pathname: string) => boolean; title: string }[] = [
  { match: (p) => p === '/admin', title: 'Dashboard' },
  { match: (p) => p === '/admin/noticias/nueva', title: 'Nueva noticia' },
  { match: (p) => p.startsWith('/admin/noticias'), title: 'Gestión de noticias' },
  { match: (p) => p.startsWith('/admin/categorias'), title: 'Categorías y etiquetas' },
  { match: (p) => p.startsWith('/admin/clasificados'), title: 'Clasificados' },
  { match: (p) => p.startsWith('/admin/scraping'), title: 'Scraping' },
  { match: (p) => p.startsWith('/admin/ia'), title: 'Configuración de IA' },
  { match: (p) => p.startsWith('/admin/almacenamiento'), title: 'Almacenamiento de imágenes' },
  { match: (p) => p.startsWith('/admin/farmacias'), title: 'Farmacias y turnos' },
  { match: (p) => p.startsWith('/admin/banners'), title: 'Banners / Monetización' },
  { match: (p) => p.startsWith('/admin/difusion'), title: 'Difusión en redes' },
  { match: (p) => p.startsWith('/admin/seo'), title: 'SEO y Legales' }
];

function resolveTitle(pathname: string): string {
  return SECTION_TITLES.find((entry) => entry.match(pathname))?.title ?? 'Panel de administración';
}

function isActive(href: string, pathname: string): boolean {
  if (href === '/admin') return pathname === '/admin';
  if (href === '/admin/noticias') {
    return (
      pathname === '/admin/noticias' ||
      (pathname.startsWith('/admin/noticias/') && !pathname.startsWith('/admin/noticias/nueva'))
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function roleLabel(role: string): string {
  if (role === 'ADMIN') return 'Administrador';
  if (role === 'EDITOR') return 'Editor';
  return role;
}

export function AdminShell({ user, children, title }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isLogin = pathname === '/admin/login';

  // Sin sesión y fuera del login: volvemos al login (el middleware ya lo hace,
  // esto cubre el caso de una sesión que expira mientras se navega).
  useEffect(() => {
    if (!user && !isLogin) {
      router.replace('/admin/login');
    }
  }, [user, isLogin, router]);

  // Cerramos el sidebar móvil al cambiar de sección.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // La pantalla de login se muestra sin shell.
  if (isLogin) return <>{children}</>;

  if (!user) {
    return (
      <div className="brand-gradient flex min-h-screen items-center justify-center text-white">
        <p className="text-sm font-medium">Redirigiendo al inicio de sesión…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-news-100 lg:flex">
      {/* Sidebar */}
      <aside
        className={cn(
          'brand-gradient fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col transition-transform duration-200',
          'lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-4">
          <Link href="/admin" className="flex flex-col">
            <span className="font-editorial text-lg font-bold leading-tight text-white">{SITE.name}</span>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-brand-200">
              Panel de administración
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-md p-1 text-brand-100 hover:bg-white/10 lg:hidden"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn('admin-sidebar-link', active && 'admin-sidebar-link-active')}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-4 py-3 text-[11px] text-brand-200">
          {SITE.city}, {SITE.province}
        </div>
      </aside>

      {/* Fondo oscuro al abrir el sidebar en celular */}
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-news-200 bg-white px-4 py-3 shadow-sm">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-1.5 text-brand-800 hover:bg-news-100 lg:hidden"
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </button>

          <h1 className="admin-title truncate">{title ?? resolveTitle(pathname)}</h1>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold leading-tight text-brand-900">{user.name}</p>
              <p className="text-[11px] text-news-500">{user.email}</p>
            </div>
            <span className="badge-blue">{roleLabel(user.role)}</span>
            <LogoutButton />
          </div>
        </header>

        <main className="p-4 lg:p-8 bg-news-100 min-h-screen">{children}</main>
      </div>
    </div>
  );
}

export default AdminShell;
