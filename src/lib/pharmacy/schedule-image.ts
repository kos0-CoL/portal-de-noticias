import { createElement } from 'react';
import { OrganigramaPrint, type CeldaOrganigrama } from '@/components/admin/OrganigramaPrint';
import { isoDeFecha, parseMes, semanasDelMes } from '@/lib/pharmacy/schedule';

/**
 * Armado del HTML del organigrama para capturarlo con Puppeteer.
 *
 * Módulo puro y testeable: no toca la base ni el navegador. Devuelve el HTML ya
 * renderizado (no un componente) porque el que lo consume usa setContent().
 */

export type FormatoImagen = 'historia' | 'post';

export interface DimensionesImagen {
  width: number;
  height: number;
}

export const FORMATOS_IMAGEN: Record<FormatoImagen, DimensionesImagen> = {
  historia: { width: 1080, height: 1350 },
  post: { width: 1080, height: 1080 }
};

export const FORMATOS_VALIDOS: FormatoImagen[] = ['historia', 'post'];

export interface TurnoMes {
  /** "YYYY-MM-DD". */
  fecha: string;
  pharmacyName: string | null;
}

export interface DatosOrganigrama {
  /** "YYYY-MM". */
  mes: string;
  /** "Noviembre de 2026". */
  titulo: string;
  sitio: string;
  ciudad: string;
  url: string;
  /** "08:00 a 08:00 del día siguiente". */
  horario: string;
  turnos: TurnoMes[];
}

export interface OrganigramaImagen {
  html: string;
  width: number;
  height: number;
}

/**
 * Grilla completa de la semana que contiene al mes: incluye los días vecinos
 * que hacen falta para que sea rectangular, marcados con `delMes: false`.
 */
export function celdasDeMes(mes: string, turnos: TurnoMes[]): { celdas: CeldaOrganigrama[]; filas: number } {
  const parsed = parseMes(mes);
  if (!parsed) throw new Error(`Mes inválido: ${mes}`);

  const porFecha = new Map(turnos.map((turno) => [turno.fecha, turno]));
  const semanas = semanasDelMes(parsed.anio, parsed.mes);

  const celdas = semanas.flat().map((fecha): CeldaOrganigrama => {
    const iso = isoDeFecha(fecha);
    return {
      fecha: iso,
      dia: fecha.getUTCDate(),
      delMes: iso.slice(0, 7) === mes,
      pharmacyName: porFecha.get(iso)?.pharmacyName ?? null
    };
  });

  return { celdas, filas: semanas.length };
}

/** HTML autocontenido del organigrama, con las dimensiones del formato pedido. */
export async function renderOrganigramaHtml(datos: DatosOrganigrama, formato: FormatoImagen): Promise<OrganigramaImagen> {
  const { width, height } = FORMATOS_IMAGEN[formato];
  const { celdas, filas } = celdasDeMes(datos.mes, datos.turnos);

  // Import dinámico a propósito: Next bloquea `react-dom/server` en el grafo
  // del servidor si aparece como import estático.
  const { renderToStaticMarkup } = await import('react-dom/server');

  const markup = renderToStaticMarkup(
    createElement(OrganigramaPrint, {
      mes: datos.mes,
      titulo: datos.titulo,
      sitio: datos.sitio,
      ciudad: datos.ciudad,
      url: datos.url,
      horario: datos.horario,
      width,
      height,
      filas,
      celdas
    })
  );

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8" /><style>html,body{margin:0;padding:0;}</style></head><body>${markup}</body></html>`;

  return { html, width, height };
}
