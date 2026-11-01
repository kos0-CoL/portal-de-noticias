import { getSession } from '@/lib/auth';
import { AdminShell } from '@/components/admin/AdminShell';

/**
 * Layout del Panel de Administración.
 *
 * Responsabilidades:
 *  - Obtener la sesión (getSession) y pasarla al shell.
 *  - Delegar en AdminShell la decisión de mostrar u ocultar el sidebar:
 *    como /admin/login también pasa por este layout, AdminShell detecta el
 *    pathname y renderiza solo el contenido cuando no hay sesión de panel.
 *
 * La protección de rutas la hace el middleware (src/middleware.ts): cualquier
 * /admin salvo /admin/login sin cookie válida se redirige al login ANTES de
 * llegar aquí. Por eso este layout no debe redirigir a ciegas: sólo se ejecuta
 * sin sesión en la pantalla de login, que debe poder verse siempre.
 */
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return <AdminShell user={session}>{children}</AdminShell>;
}
