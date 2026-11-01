import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { userHasActiveSubscription, getActivePlans } from '@/lib/paywall/access';
import { SiteHeader } from '@/components/public/SiteHeader';
import { SiteFooter } from '@/components/public/SiteFooter';
import { SITE } from '@/lib/constants';

export const metadata = {
  title: `Suscripciones Premium — ${SITE.name}`,
  description: 'Accedé a contenido exclusivo de Saladillo Noticias con una suscripción premium.',
};

export default async function SuscripcionesPage() {
  const session = await getSession();
  const usuarioId = session?.sub ?? null;

  const planes = await getActivePlans();
  const tieneSuscripcion = usuarioId ? await userHasActiveSubscription(usuarioId) : false;

  if (!planes || planes.length === 0) {
    return (
      <>
        <SiteHeader />
        <main className="container-news py-6">
          <div className="max-w-2xl mx-auto text-center py-12">
            <h1 className="text-2xl font-bold text-brand-900 mb-4">Suscripciones Premium</h1>
            <p className="text-news-600 mb-6">
              Actualmente no hay planes de suscripción disponibles.
            </p>
            <Link href="/" className="text-brand-600 hover:underline">
              Volver al inicio
            </Link>
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  const intervaloLabel = (intervalo: string) =>
    intervalo === 'ANUAL' ? 'por año' : 'por mes';

  return (
    <>
      <SiteHeader />

      <main className="container-news py-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="mb-8 font-editorial text-3xl font-bold text-brand-900 text-center">
            Suscribite a Saladillo Noticias Premium
          </h1>
          <p className="mb-8 text-center text-news-600 text-lg">
            Accedé a notas exclusivas, contenido en profundidad y apoyá el periodismo local de Saladillo.
          </p>

          {/* Estado de suscripción del usuario */}
          {usuarioId && tieneSuscripcion && (
            <div className="mb-8 rounded-lg border border-brand-200 bg-brand-50 p-6 text-center">
              <h2 className="mb-2 font-bold text-brand-900">Ya tenés suscripción activa</h2>
              <p className="text-news-600">Disfrutás de acceso completo a todo el contenido premium del portal.</p>
              <Link href="/notas-mias" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:underline transition">
                Gestionar mi suscripción
                <span aria-hidden="true"> →</span>
              </Link>
            </div>
          )}

          {/* Lista de planes */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {planes.map((plan) => {
              const precioMes = plan.intervalo === 'ANUAL'
                ? Number(plan.precio) / plan.diasDuracion * 30
                : Number(plan.precio);

              return (
                <div
                  key={plan.id}
                  className={`rounded-lg border p-6 flex flex-col ${
                    plan.esPopular
                      ? 'border-brand-800 bg-brand-50 ring-2 ring-brand-800 ring-offset-2'
                      : 'border-news-200 bg-white hover:border-news-300 transition'
                  }`}
                >
                  {plan.esPopular && (
                    <span className="mb-2 inline-flex items-center gap-1 rounded-full border border-brand-800 bg-brand-800 px-2.5 py-0.5 text-xs font-bold text-white uppercase tracking-tighter">
                      Más popular
                    </span>
                  )}

                  <h3 className="mb-2 font-bold text-brand-900">{plan.nombre}</h3>
                  <p className="mb-4 text-news-600 text-sm leading-relaxed">{plan.descripcion ?? ''}</p>

                  <div className="mb-6 flex items-baseline gap-1">
                    <span className="font-editorial text-3xl font-bold text-brand-900">${precioMes.toFixed(0)}</span>
                    <span className="text-news-500">ARS {intervaloLabel(plan.intervalo)}</span>
                  </div>

                  {plan.caracteristicas && Array.isArray(plan.caracteristicas) && plan.caracteristicas.length > 0 ? (
                    <ul className="mb-6 space-y-2 text-sm text-news-600">
                      {(plan.caracteristicas as string[]).map((caracteristica: string, i: number) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="mt-0.5 text-brand-600">✓</span>
                          <span>{caracteristica}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <button
                    onClick={() => {
                      // Navegar al checkout mediante llamada a la API
                      void fetch('/api/paywall/checkout', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ planId: plan.id }),
                      }).then(async (res) => {
                        if (!res.ok) {
                          if (res.status === 401) {
                            window.location.href = '/login';
                            return;
                          }
                          alert('No se pudo iniciar el proceso de suscripción. Intentá nuevamente.');
                          return;
                        }
                        const data = await res.json();
                        if (data.checkoutUrl) {
                          window.location.href = data.checkoutUrl;
                        }
                      });
                    }}
                    className={`w-full py-3 rounded-md font-semibold transition ${
                      plan.esPopular
                        ? 'bg-brand-800 text-white hover:bg-brand-700'
                        : 'bg-brand-600 text-white hover:bg-brand-700'
                    }`}
                  >
                    Suscribirme
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-12 rounded-lg border border-news-200 bg-news-50 p-6 text-center text-sm text-news-500">
            <p className="mb-2">
              Los pagos se procesan a través de Mercado Pago. Tu suscripción se activa automáticamente al confirmar el pago.
            </p>
            <p className="mb-0">Podés cancelar tu renovación automática en cualquier momento desde tu cuenta.</p>
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
