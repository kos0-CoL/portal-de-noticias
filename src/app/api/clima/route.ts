import { NextResponse } from 'next/server';
import { getSaladilloWeather } from '@/lib/weather';

export const revalidate = 900;

/** Clima actual de Saladillo en JSON, cacheado 15 minutos en el CDN. */
export async function GET() {
  const clima = await getSaladilloWeather();
  return NextResponse.json(clima, {
    headers: { 'Cache-Control': 'public, s-maxage=900' }
  });
}
