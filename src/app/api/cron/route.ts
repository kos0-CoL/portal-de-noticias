import { NextResponse, type NextRequest } from 'next/server';
import { runAllActiveSources } from '@/lib/scraper/pipeline';
import { expirarAvisosVencidos } from '@/lib/classifieds';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Endpoint de cron externo (Vercel Cron, cron-job.org, GitHub Actions).
 * Se protege con `Authorization: Bearer ${CRON_SECRET}`. Si no hay secreto
 * configurado, queda deshabilitado para no exponer el scraping a cualquiera.
 */
async function ejecutar(request: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) {
    return NextResponse.json(
      { ok: false, error: 'Cron deshabilitado: falta CRON_SECRET' },
      { status: 503 }
    );
  }

  const autorizacion = request.headers.get('authorization') ?? '';
  if (autorizacion !== `Bearer ${secreto}`) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  }

  try {
    // Solo corre las fuentes cuyo scheduleCron ya venció.
    const results = await runAllActiveSources({ trigger: 'cron', dueOnly: true });
    // Los avisos clasificados que cumplieron su vigencia pasan a EXPIRED.
    const clasificadosExpirados = await expirarAvisosVencidos();
    const resumen = {
      fuentes: results.length,
      creadas: results.reduce((acc, r) => acc + r.created, 0),
      omitidas: results.reduce((acc, r) => acc + r.skipped, 0),
      fallidas: results.reduce((acc, r) => acc + r.failed, 0),
      clasificadosExpirados
    };
    return NextResponse.json({ ok: true, resumen, results });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error desconocido en el cron.';
    return NextResponse.json({ ok: false, error: mensaje }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return ejecutar(request);
}

export async function POST(request: NextRequest) {
  return ejecutar(request);
}
