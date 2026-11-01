import type { Metadata } from 'next';
import { ArrowDown, ArrowUp, Droplets, Thermometer, Wind } from 'lucide-react';
import { SITE } from '@/lib/constants';
import { getSaladilloForecast, getSaladilloWeather } from '@/lib/weather';
import { SiteHeader } from '@/components/public/SiteHeader';
import { SiteFooter } from '@/components/public/SiteFooter';
import { SectionTitle } from '@/components/public/SectionTitle';
import { BannerZone } from '@/components/public/BannerZone';

export const revalidate = 900;

export const metadata: Metadata = {
  title: 'Clima en Saladillo',
  description: `Clima actual y pronóstico extendido para ${SITE.city}, ${SITE.province}.`,
  alternates: { canonical: '/clima' }
};

/** Formatea una fecha YYYY-MM-DD sin corrimientos de zona horaria. */
function nombreDia(fecha: string): string {
  const [y, m, d] = fecha.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const texto = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC'
  }).format(date);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export default async function ClimaPage() {
  const [clima, pronostico] = await Promise.all([getSaladilloWeather(), getSaladilloForecast()]);

  const actualizado = new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires'
  }).format(new Date(clima.updatedAt));

  return (
    <>
      <SiteHeader />

      <main className="container-news py-6">
        <header className="border-b border-news-200 pb-4">
          <span className="kicker text-brand-600">Servicios</span>
          <h1 className="headline-xl mt-1">Clima en {SITE.city}</h1>
          <p className="mt-2 text-news-600">Datos actualizados a las {actualizado} hs.</p>
        </header>

        <div className="mt-5">
          <BannerZone zone="HOME_TOP" />
        </div>

        {/* Clima actual */}
        <section
          aria-label="Clima actual"
          className="brand-gradient mt-6 grid grid-cols-1 items-center gap-6 rounded-xl p-6 text-white shadow-card sm:grid-cols-[auto_1fr] sm:p-8"
        >
          <div className="text-center sm:text-left">
            <span className="block text-6xl leading-none sm:text-7xl" aria-hidden="true">
              {clima.icon}
            </span>
          </div>
          <div>
            <p className="font-editorial text-5xl font-bold leading-none sm:text-6xl">{clima.tempC}°C</p>
            <p className="mt-2 text-lg font-semibold text-brand-100">{clima.description}</p>
            <p className="mt-1 text-sm text-brand-200">
              Sensación térmica de {clima.feelsLikeC}°C · Máx {clima.maxC}° / Mín {clima.minC}°
            </p>

            <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-white/15 bg-white/5 p-3">
                <dt className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-brand-200">
                  <Thermometer className="h-3.5 w-3.5" aria-hidden="true" /> Sensación
                </dt>
                <dd className="mt-1 text-xl font-bold">{clima.feelsLikeC}°C</dd>
              </div>
              <div className="rounded-lg border border-white/15 bg-white/5 p-3">
                <dt className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-brand-200">
                  <Droplets className="h-3.5 w-3.5" aria-hidden="true" /> Humedad
                </dt>
                <dd className="mt-1 text-xl font-bold">{clima.humidity}%</dd>
              </div>
              <div className="rounded-lg border border-white/15 bg-white/5 p-3">
                <dt className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-brand-200">
                  <Wind className="h-3.5 w-3.5" aria-hidden="true" /> Viento
                </dt>
                <dd className="mt-1 text-xl font-bold">
                  {clima.windKmh} <span className="text-sm font-semibold">{clima.windDir}</span>
                </dd>
              </div>
            </dl>
          </div>
        </section>

        {/* Pronóstico 7 días */}
        <section className="mt-10">
          <SectionTitle title="Pronóstico extendido (7 días)" />
          {pronostico.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {pronostico.map((dia) => (
                <article key={dia.date} className="news-card news-card-body items-center text-center">
                  <span className="text-3xl" aria-hidden="true">
                    {dia.icon}
                  </span>
                  <h3 className="headline-sm capitalize">{nombreDia(dia.date)}</h3>
                  <p className="text-sm text-news-600">{dia.description}</p>
                  <p className="flex items-center gap-3 text-sm font-semibold">
                    <span className="inline-flex items-center gap-1 text-red-600">
                      <ArrowUp className="h-4 w-4" aria-hidden="true" /> {dia.maxC}°
                    </span>
                    <span className="inline-flex items-center gap-1 text-sky-600">
                      <ArrowDown className="h-4 w-4" aria-hidden="true" /> {dia.minC}°
                    </span>
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-news-200 bg-white p-6 text-center text-news-500">
              El pronóstico no está disponible en este momento.
            </p>
          )}
        </section>

        <div className="mt-10">
          <BannerZone zone="FOOTER" />
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
