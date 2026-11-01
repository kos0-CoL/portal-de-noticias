import type { Metadata } from 'next';
import { SITE } from '@/lib/constants';
import { SiteHeader } from '@/components/public/SiteHeader';
import { SiteFooter } from '@/components/public/SiteFooter';

export const metadata: Metadata = {
  title: `Contacto — ${SITE.name}`,
  description: `Contactá con la redacción de ${SITE.name}. {SITE.city}, {SITE.province}.`,
  alternates: { canonical: '/contacto' },
  openGraph: {
    type: 'website',
    title: `Contacto — ${SITE.name}`,
    url: `${SITE.url}/contacto`,
    siteName: SITE.name,
    locale: 'es_AR'
  }
};

export default function ContactoPage() {
  return (
    <>
      <SiteHeader />

      <main className="container-news py-10">
        <nav aria-label="Migas de pan" className="mb-6 text-xs text-news-500">
          <a href="/" className="hover:text-brand-700">Inicio</a>
          <span className="mx-1.5" aria-hidden="true">/</span>
          <span className="text-news-700">Contacto</span>
        </nav>

        <article className="max-w-3xl mx-auto grid gap-8 lg:grid-cols-[1fr_320px]">
          <section>
            <h1 className="headline-xl text-balance text-brand-900">Contacto</h1>
            <p className="mt-4 text-news-600 leading-relaxed">
              ¿Tenés una noticia, una denuncia o un aviso para la comunidad? Escribinos a la
              redacción de {SITE.name}. Estamos en {SITE.city}, {SITE.province}, y queremos
              escucharte.
            </p>

            <div className="mt-8 space-y-6">
              <div className="flex items-start gap-4 p-4 rounded-lg border border-news-200 bg-white">
                <div className="mt-0.5 text-brand-700">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-brand-900">Redacción</h3>
                  <p className="text-news-600">{SITE.email}</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-lg border border-news-200 bg-white">
                <div className="mt-0.5 text-brand-700">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 6.75c0 8.284 9.457 10.402 11.25 8.484 1.793-1.918 0-5.578-1.5-8.484M21 12a9 9 0 11-18 0 9 9 0 0118 0zM11.25 15H3m-1.436 4.566c1.537.775 3.435 1.218 5.436 1.218s3.9-.443 5.436-1.218c1.537-.775 1.25-2.271.5-3.885l-.393-.832c-.31-.656-1.646-.439-1.336.5l.393.832c.751 1.613-1.033 3.11-.5 3.885zM15 7.5l3 3m0 0l-3 3m3-3H3m3 3l3-3" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-brand-900">Dirección</h3>
                  <p className="text-news-600">{SITE.city}, {SITE.province}, {SITE.country}</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-lg border border-news-200 bg-white">
                <div className="mt-0.5 text-brand-700">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 12c0-1.268.493-2.417 1.24-3.307a5.26 5.26 0 013.557-1.194c1.519-.059 2.942.432 4.06 1.438a5.26 5.26 0 013.018 3.018c.573 1.004.732 2.182.478 3.301c-.254 1.121-.997 2.044-1.965 2.644c-.968.601-2.174.523-3.012-.454a5.27 5.27 0 01-2.524-2.627c-.156-.733-.028-1.496.459-2.058zM11.25 10.5H3m-1.436 4.566c1.537.775 3.435 1.218 5.436 1.218s3.9-.443 5.436-1.218c1.537-.775 1.25-2.271.5-3.885l-.393-.832c-.31-.656-1.646-.439-1.336.5l.393.832c.751 1.613-1.033 3.11-.5 3.885zM15 7.5l3 3m0 0l-3 3m3-3H3m3 3l3-3" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-brand-900">Teléfono</h3>
                  <p className="text-news-600">{SITE.phone}</p>
                </div>
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-lg border border-news-200 bg-white p-6">
              <h3 className="mb-4 font-editorial text-lg font-bold text-brand-900">Enviar mensaje</h3>
              <form className="space-y-4" action="#">
                <div>
                  <label className="block text-sm font-medium text-news-700">Nombre</label>
                  <input type="text" required className="mt-1 block w-full rounded border border-news-200 bg-white px-3 py-2 text-news-900 focus:border-brand-600 focus:ring-1 focus:ring-brand-600" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-news-700">Correo electrónico</label>
                  <input type="email" required className="mt-1 block w-full rounded border border-news-200 bg-white px-3 py-2 text-news-900 focus:border-brand-600 focus:ring-1 focus:ring-brand-600" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-news-700">Mensaje</label>
                  <textarea required rows={5} className="mt-1 block w-full rounded border border-news-200 bg-white px-3 py-2 text-news-900 focus:border-brand-600 focus:ring-1 focus:ring-brand-600" />
                </div>
                <button type="submit" className="inline-flex items-center gap-2 rounded-md bg-brand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition">
                  Enviar mensaje
                </button>
              </form>
            </div>
          </aside>
        </article>
      </main>

      <SiteFooter />
    </>
  );
}
