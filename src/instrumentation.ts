/**
 * Hook de instrumentación de Next.js.
 * Se ejecuta una sola vez cuando arranca el servidor (runtime Node).
 * Acá se enciende el planificador interno de scraping: cada 60 segundos
 * revisa qué fuentes están vencidas según su `scheduleCron` y las ejecuta.
 *
 * Se activa únicamente si `ENABLE_INTERNAL_SCHEDULER=true`, para no dispararlo
 * en Vercel ni en entornos donde el cron lo maneja un servicio externo
 * (en ese caso usá `/api/cron` con el header `Authorization: Bearer $CRON_SECRET`).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  try {
    const { startScheduler } = await import('@/lib/scraper/scheduler');
    startScheduler();
  } catch (error) {
    console.error('[instrumentation] No se pudo iniciar el planificador de scraping:', error);
  }
}
