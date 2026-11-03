import { diasDelMes, fechaUtc, isoDeFecha, sumarDias } from '@/lib/pharmacy/schedule';

/**
 * Ciclo de rotación de farmacias.
 *
 * Módulo puro: reproduce la rotación del Colegio, que es un ciclo de 10 días
 * con repeticiones (ORIANDA aparece dos veces por ciclo, ABELENDA II una sola)
 * y no el orden del directorio.
 */

export interface CicloRotacion {
  /** Ids de farmacia en orden. Puede haber repetidos. */
  orden: string[];
  /** Fecha "YYYY-MM-DD" del primer elemento del ciclo. */
  ancla: string | null;
}

export interface DiaDeTurno {
  fecha: Date;
  fechaISO: string;
  pharmacyId: string;
}

const MS_POR_DIA = 86_400_000;

/**
 * Índice del ciclo que le corresponde a esa fecha, o -1 si el ciclo no está
 * configurado (vacío o sin fecha de referencia). El módulo se ajusta a
 * positivo para que las fechas anteriores al ancla también den un índice
 * válido: el ciclo se repite hacia atrás igual que hacia adelante.
 */
export function turnoDeFecha(fecha: Date, ciclo: CicloRotacion): number {
  if (ciclo.orden.length === 0 || !ciclo.ancla) return -1;
  const ancla = fechaUtc(ciclo.ancla);
  if (Number.isNaN(ancla.getTime())) return -1;

  const dias = Math.floor((fecha.getTime() - ancla.getTime()) / MS_POR_DIA);
  return ((dias % ciclo.orden.length) + ciclo.orden.length) % ciclo.orden.length;
}

/** Farmacia que le toca a esa fecha, o null si el ciclo no está configurado. */
export function farmaciaDeFecha(fecha: Date, ciclo: CicloRotacion): string | null {
  const indice = turnoDeFecha(fecha, ciclo);
  return indice < 0 ? null : ciclo.orden[indice];
}

/** Un día por cada fecha del mes, con la farmacia que le toca. */
export function generarMes(anio: number, mes: number, ciclo: CicloRotacion): DiaDeTurno[] {
  const total = diasDelMes(anio, mes);
  const salida: DiaDeTurno[] = [];

  for (let dia = 1; dia <= total; dia += 1) {
    const fecha = new Date(Date.UTC(anio, mes - 1, dia));
    const pharmacyId = farmaciaDeFecha(fecha, ciclo);
    if (pharmacyId) salida.push({ fecha, fechaISO: isoDeFecha(fecha), pharmacyId });
  }
  return salida;
}

/** Los `cantidad` días siguientes a `desde`, para la vista previa del ciclo. */
export function proximosDias(desde: Date, cantidad: number, ciclo: CicloRotacion): DiaDeTurno[] {
  const salida: DiaDeTurno[] = [];

  for (let i = 0; i < cantidad; i += 1) {
    const fecha = sumarDias(desde, i);
    const pharmacyId = farmaciaDeFecha(fecha, ciclo);
    if (pharmacyId) salida.push({ fecha, fechaISO: isoDeFecha(fecha), pharmacyId });
  }
  return salida;
}

/**
 * Limpia el ciclo antes de guardarlo: deja sólo los ids que existen y están
 * activos. Las repeticiones se conservan, porque son parte del ciclo real y no
 * un error de carga.
 */
export function normalizarOrden(ids: string[], validos: Iterable<string>): string[] {
  const permitidos = new Set(validos);
  return ids.filter((id) => permitidos.has(id));
}
