import { Droplets, Thermometer, Wind, ArrowUp, ArrowDown } from 'lucide-react';
import { getSaladilloWeather } from '@/lib/weather';

/** Widget compacto del clima actual sobre la franja azul marino de la cabecera. */
export async function WeatherWidget() {
  const clima = await getSaladilloWeather();

  return (
    <div
      className="flex items-center gap-3 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-brand-50"
      aria-label={`Clima actual en ${clima.city}: ${clima.description}, ${clima.tempC} grados`}
    >
      <span className="text-3xl leading-none" aria-hidden="true">
        {clima.icon}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-editorial text-2xl font-bold leading-none text-white">{clima.tempC}°</span>
          <span className="truncate text-xs font-semibold text-brand-100">{clima.description}</span>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-brand-200">
          <span className="inline-flex items-center gap-1">
            <Thermometer className="h-3 w-3" aria-hidden="true" /> ST {clima.feelsLikeC}°
          </span>
          <span className="inline-flex items-center gap-1">
            <Droplets className="h-3 w-3" aria-hidden="true" /> {clima.humidity}%
          </span>
          <span className="inline-flex items-center gap-1">
            <Wind className="h-3 w-3" aria-hidden="true" /> {clima.windKmh} km/h {clima.windDir}
          </span>
          <span className="inline-flex items-center gap-1">
            <ArrowUp className="h-3 w-3 text-red-300" aria-hidden="true" /> {clima.maxC}°
            <ArrowDown className="ml-1 h-3 w-3 text-sky-300" aria-hidden="true" /> {clima.minC}°
          </span>
        </div>
      </div>
    </div>
  );
}
