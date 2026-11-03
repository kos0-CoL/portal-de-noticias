import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { UnauthorizedError, requireApiSession } from '@/lib/auth';
import { getPharmacySettings } from '@/lib/settings';
import { proveedorPorDefecto } from '@/lib/storage';
import { renderScreenshot } from '@/lib/scraper/screenshot';
import { renderOrganigramaHtml, type DatosOrganigrama, type FormatoImagen } from '@/lib/pharmacy/schedule-image';
import { isoDeFecha, nombreDeMes, parseMes, rangoDeMes } from '@/lib/pharmacy/schedule';
import { SITE } from '@/lib/constants';

/**
 * POST /api/admin/farmacias/organigrama/imagen — genera el PNG del mes.
 *
 * El HTML se arma del lado del servidor y se le pasa a Puppeteer con
 * setContent(): el navegador nunca navega al panel.
 *
 * Si hay un proveedor de almacenamiento configurado, el PNG se sube y se
 * devuelve su URL. Si no, se devuelve en base64 para descarga directa, sin
 * fallar por falta de storage.
 */

export const maxDuration = 60;

const schema = z.object({
  mes: z.string().trim().regex(/^\d{4}-\d{2}$/, 'Mes inválido'),
  formato: z.enum(['historia', 'post']).default('historia')
});

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
}

export async function POST(request: Request) {
  try {
    await requireApiSession();
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
  }

  const pedido = parseMes(parsed.data.mes);
  if (!pedido) {
    return NextResponse.json({ ok: false, error: 'Mes inválido' }, { status: 400 });
  }

  const { inicio, fin } = rangoDeMes(pedido.anio, pedido.mes);
  const [turnos, settings] = await Promise.all([
    prisma.pharmacyShift.findMany({
      where: { date: { gte: inicio, lt: fin } },
      select: { date: true, pharmacy: { select: { name: true } } },
      orderBy: { date: 'asc' }
    }),
    getPharmacySettings()
  ]);

  const titulo = nombreDeMes(pedido.anio, pedido.mes);
  if (!turnos.length) {
    return NextResponse.json(
      {
        ok: false,
        error: `No hay turnos cargados para ${titulo}. Generá o importá el mes antes de exportarlo.`
      },
      { status: 400 }
    );
  }

  const datos: DatosOrganigrama = {
    mes: parsed.data.mes,
    titulo,
    sitio: SITE.name,
    ciudad: SITE.city,
    url: SITE.url.replace(/\/$/, ''),
    horario: `${settings.shiftStart} a ${settings.shiftEnd} del día siguiente`,
    turnos: turnos.map((turno) => ({ fecha: isoDeFecha(turno.date), pharmacyName: turno.pharmacy.name }))
  };

  const formato: FormatoImagen = parsed.data.formato;
  const { html, width, height } = await renderOrganigramaHtml(datos, formato);

  let png: Buffer;
  try {
    png = await renderScreenshot(html, { width, height });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'error desconocido';
    return NextResponse.json({ ok: false, error: mensaje }, { status: 502 });
  }

  const nombreArchivo = `${parsed.data.mes}-${formato}.png`;

  // Subida al almacenamiento externo; si algo falla se entrega igual el PNG.
  try {
    const proveedor = await proveedorPorDefecto();
    if (proveedor && (await proveedor.disponible())) {
      const { url } = await proveedor.subir(png, {
        nombre: `organigrama/${nombreArchivo}`,
        contentType: 'image/png'
      });
      return NextResponse.json({ ok: true, url, base64: null, filename: nombreArchivo, formato, width, height });
    }
  } catch {
    // Sin storage disponible: se devuelve el PNG en base64 para descargar.
  }

  return NextResponse.json({
    ok: true,
    url: null,
    base64: png.toString('base64'),
    filename: nombreArchivo,
    formato,
    width,
    height
  });
}
