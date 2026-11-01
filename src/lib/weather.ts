import { SITE } from '@/lib/constants';

/**
 * Clima de Saladillo usando la API gratuita Open-Meteo (no requiere API key).
 *
 * Regla de oro: NINGUNA de estas funciones puede lanzar una excepcion. Si la
 * API se cae o devuelve datos inesperados, se responde con valores estimados
 * para que la home del portal nunca se rompa por el clima.
 */

const WEATHER_LAT = Number(process.env.WEATHER_LAT ?? SITE.latitude);
const WEATHER_LON = Number(process.env.WEATHER_LON ?? SITE.longitude);

/** El clima cambia lento: con 15 minutos de cache alcanza y sobra. */
const REVALIDATE_SECONDS = 900;

const TIMEZONE = 'America%2FArgentina%2FBuenos_Aires';

export interface WeatherNow {
  tempC: number;
  feelsLikeC: number;
  humidity: number;
  windKmh: number;
  windDir: string;
  code: number;
  description: string;
  icon: string;
  city: string;
  updatedAt: string;
  maxC: number;
  minC: number;
}

export interface ForecastDay {
  date: string;
  minC: number;
  maxC: number;
  code: number;
  description: string;
  icon: string;
}

interface OpenMeteoCurrent {
  temperature_2m?: number;
  relative_humidity_2m?: number;
  apparent_temperature?: number;
  weather_code?: number;
  wind_speed_10m?: number;
  wind_direction_10m?: number;
}

interface OpenMeteoDaily {
  time?: string[];
  temperature_2m_max?: number[];
  temperature_2m_min?: number[];
  weather_code?: number[];
}

interface OpenMeteoResponse {
  current?: OpenMeteoCurrent;
  daily?: OpenMeteoDaily;
}

/** Traduce los codigos WMO de Open-Meteo a descripcion + icono. */
export function describeWeatherCode(code: number): { description: string; icon: string } {
  if (code === 0) return { description: 'Cielo despejado', icon: '☀️' };
  if (code >= 1 && code <= 3) return { description: 'Parcialmente nublado', icon: '⛅' };
  if (code === 45 || code === 48) return { description: 'Niebla', icon: '🌫️' };
  if (code >= 51 && code <= 57) return { description: 'Llovizna', icon: '🌦️' };
  if (code >= 61 && code <= 67) return { description: 'Lluvia', icon: '🌧️' };
  if (code >= 71 && code <= 77) return { description: 'Nieve', icon: '❄️' };
  if (code >= 80 && code <= 82) return { description: 'Chaparrones', icon: '🌦️' };
  if (code >= 95 && code <= 99) return { description: 'Tormenta', icon: '⛈️' };
  return { description: 'Sin datos', icon: '🌡️' };
}

/** Grados a punto cardinal en espanol (8 rumbos). */
export function degreesToCardinal(degrees: number): string {
  const rumbos = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  if (!Number.isFinite(degrees)) return 'N';
  const idx = Math.round(((degrees % 360) + 360) % 360 / 45) % 8;
  return rumbos[idx];
}

/**
 * Datos estimados de respaldo para Saladillo.
 * Se usan unicamente cuando la API no responde o devuelve algo inesperado.
 */
function fallbackNow(): WeatherNow {
  return {
    tempC: 18,
    feelsLikeC: 17,
    humidity: 65,
    windKmh: 12,
    windDir: 'SE',
    code: -1,
    description: 'Datos no disponibles',
    icon: '🌡️',
    city: SITE.city,
    updatedAt: new Date().toISOString(),
    maxC: 22,
    minC: 12
  };
}

/** Clima actual en Saladillo. Nunca lanza: devuelve el fallback ante cualquier fallo. */
export async function getSaladilloWeather(): Promise<WeatherNow> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${WEATHER_LAT}&longitude=${WEATHER_LON}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m` +
      `&daily=temperature_2m_max,temperature_2m_min&timezone=${TIMEZONE}&forecast_days=1`;

    const res = await fetch(url, { next: { revalidate: REVALIDATE_SECONDS } });
    if (!res.ok) return fallbackNow();

    const data = (await res.json()) as OpenMeteoResponse;
    const current = data?.current;
    if (!current || typeof current.temperature_2m !== 'number') return fallbackNow();

    const code = Number(current.weather_code ?? 0);
    const { description, icon } = describeWeatherCode(code);
    const maxC = data.daily?.temperature_2m_max?.[0];
    const minC = data.daily?.temperature_2m_min?.[0];

    return {
      tempC: Math.round(current.temperature_2m),
      feelsLikeC: Math.round(current.apparent_temperature ?? current.temperature_2m),
      humidity: Math.round(current.relative_humidity_2m ?? 0),
      windKmh: Math.round(current.wind_speed_10m ?? 0),
      windDir: degreesToCardinal(Number(current.wind_direction_10m ?? 0)),
      code,
      description,
      icon,
      city: SITE.city,
      updatedAt: new Date().toISOString(),
      maxC: Math.round(maxC ?? current.temperature_2m),
      minC: Math.round(minC ?? current.temperature_2m)
    };
  } catch {
    return fallbackNow();
  }
}

/** Pronostico de los proximos 7 dias. Devuelve [] si la API falla. */
export async function getSaladilloForecast(): Promise<ForecastDay[]> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${WEATHER_LAT}&longitude=${WEATHER_LON}` +
      `&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=${TIMEZONE}&forecast_days=7`;

    const res = await fetch(url, { next: { revalidate: REVALIDATE_SECONDS } });
    if (!res.ok) return [];

    const data = (await res.json()) as OpenMeteoResponse;
    const daily = data?.daily;
    const fechas = daily?.time ?? [];
    const maximas = daily?.temperature_2m_max ?? [];
    const minimas = daily?.temperature_2m_min ?? [];
    const codigos = daily?.weather_code ?? [];

    return fechas.map((date, i) => {
      const code = Number(codigos[i] ?? 0);
      const { description, icon } = describeWeatherCode(code);
      return {
        date,
        minC: Math.round(minimas[i] ?? 0),
        maxC: Math.round(maximas[i] ?? 0),
        code,
        description,
        icon
      };
    });
  } catch {
    return [];
  }
}
