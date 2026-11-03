import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { UnauthorizedError, requireApiSession } from '@/lib/auth';
import { getPharmacySettings, getSetting, setSetting, SETTING_KEYS, type ImportLogEntry } from '@/lib/settings';
import { fetchHtml } from '@/lib/scraper/fetcher';
import { construirDiff, parsearPaginaColegio, type OrganigramaColegio } from '@/lib/pharmacy/import';
import { isoDeFecha, rangoDeMes } from '@/lib/pharmacy/schedule';

/**
 * POST /api/admin/farmacias/importar — vista previa de la importación.
 *
 * Descarga el organigrama del Colegio, lo parsea y devuelve el diff contra lo
 * cargado. **No escribe turnos ni farmacias**: eso recién pasa en
 * `/importar/confirmar`, con la lista de días que el usuario tildó.
 *
 * Lo único que sí persiste es la URL cuando viene en el cuerpo, porque el
 * campo del panel es la forma de apuntar a otra página si el Colegio la mueve.
 *
 * Los fallos quedan guardados en `pharmacy.importLog` (los últimos 3) para
 * poder diagnosticar sin tener que reproducir el error en el momento.
 */

const MAX_LOGS = 3;

const previewSchema = z.object({
  url: z.string().trim().url('La dirección no es una URL válida').max(500).optional()
});

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
}

async function leerLog(): Promise<ImportLogEntry[]> {
  return (await getSetting<ImportLogEntry[]>(SETTING_KEYS.pharmacyImportLog)) ?? [];
}

/** Guarda el fallo al frente del log, conservando solo los últimos 3. */
async function registrarError(url: string, mensaje: string): Promise<ImportLogEntry[]> {
  const entrada: ImportLogEntry = { fecha: new Date().toISOString(), url, error: mensaje };
  const log = [entrada, ...(await leerLog())].slice(0, MAX_LOGS);
  await setSetting(SETTING_KEYS.pharmacyImportLog, log, { group: 'pharmacy' });
  return log;
}

export async function POST(request: Request) {
  try {
    await requireApiSession();
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }

  const body = await request.json().catch(() => null);
  const parsed = previewSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
  }

  const settings = await getPharmacySettings();
  const url = parsed.data.url ?? settings.importUrl;
  if (!url) {
    return NextResponse.json({ ok: false, error: 'No hay una URL de importación configurada' }, { status: 400 });
  }

  if (parsed.data.url && parsed.data.url !== settings.importUrl) {
    await setSetting(SETTING_KEYS.pharmacyImportUrl, parsed.data.url, { group: 'pharmacy' });
  }

  let html: string;
  try {
    html = await fetchHtml(url, { timeoutMs: 30_000 });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'No se pudo descargar la página del Colegio.';
    const log = await registrarError(url, mensaje);
    return NextResponse.json({ ok: false, error: mensaje, url, log }, { status: 502 });
  }

  let organigrama: OrganigramaColegio;
  try {
    organigrama = parsearPaginaColegio(html);
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'No se pudo interpretar la página del Colegio.';
    const log = await registrarError(url, mensaje);
    return NextResponse.json({ ok: false, error: mensaje, url, log }, { status: 422 });
  }

  const { inicio, fin } = rangoDeMes(organigrama.anio, organigrama.mes);
  const [farmacias, turnos] = await Promise.all([
    prisma.pharmacy.findMany({
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, alias: true, isActive: true }
    }),
    prisma.pharmacyShift.findMany({
      where: { date: { gte: inicio, lt: fin } },
      include: { pharmacy: { select: { name: true } } },
      orderBy: { date: 'asc' }
    })
  ]);

  const diff = construirDiff(
    organigrama,
    farmacias,
    turnos.map((turno) => ({
      fecha: isoDeFecha(turno.date),
      pharmacyId: turno.pharmacyId,
      pharmacyName: turno.pharmacy.name,
      origen: turno.source
    }))
  );

  return NextResponse.json({ ok: true, url, diff, farmacias, log: await leerLog() });
}
