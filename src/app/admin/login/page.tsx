import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { LoginForm } from '@/components/admin/LoginForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Ingresar | Panel de administración'
};

/** Pantalla de acceso. Si ya hay sesión, se entra directo al dashboard. */
export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect('/admin');

  // Suspense: LoginForm usa useSearchParams() para leer el ?next=.
  return (
    <Suspense
      fallback={
        <div className="brand-gradient flex min-h-screen items-center justify-center">
          <div className="skeleton h-64 w-full max-w-md" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
