/**
 * Fechas y horarios de turno en la zona de Saladillo.
 *
 * Módulo puro: todas las fechas se manejan como medianoche UTC del día local,
 * igual que en el resto del portal, para no arrastrar corrimientos de un día.
 */

export const ZONA_SALADILLO = 'America/Argentina/Buenos_Aires';

const MS_POR_DIA = 86_400_000;

/** "YYYY-MM-DD" del momento dado, en hora de Saladillo. */
export function fechaEnSaladillo(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_SALADILLO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(ahora);
}

/** "HH:mm" del momento dado, en hora de Saladillo. */
export function horaEnSaladillo(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONA_SALADILLO,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(ahora);
}

/** "YYYY-MM-DD" → medianoche UTC de ese día. */
export function fechaUtc(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

/** Medianoche UTC del día en curso en Saladillo. */
export function hoyEnSaladillo(ahora: Date = new Date()): Date {
  return fechaUtc(fechaEnSaladillo(ahora));
}

/** Medianoche UTC del día, en formato "YYYY-MM-DD". */
export function isoDeFecha(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

/** Copia de `fecha` corrida `dias` días (acepta negativos). */
export function sumarDias(fecha: Date, dias: number): Date {
  return new Date(fecha.getTime() + dias * MS_POR_DIA);
}

/** Suma días a una fecha "YYYY-MM-DD" y devuelve "YYYY-MM-DD". */
export function sumarDiasISO(iso: string, dias: number): string {
  return isoDeFecha(sumarDias(fechaUtc(iso), dias));
}

/** Cantidad de días del mes (1-12). */
export function diasDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

/** Primer día del mes, como medianoche UTC. */
export function inicioDeMes(anio: number, mes: number): Date {
  return new Date(Date.UTC(anio, mes - 1, 1));
}

/**
 * Semanas del mes, de lunes a domingo. La primera y la última semana incluyen
 * los días de los meses vecinos que hacen falta para completarlas, así el
 * calendario del panel es siempre una grilla rectangular.
 */
export function semanasDelMes(anio: number, mes: number): Date[][] {
  const primero = inicioDeMes(anio, mes);
  // getUTCDay(): 0 = domingo. Se corre para que la semana empiece el lunes.
  const corrimiento = (primero.getUTCDay() + 6) % 7;
  const arranque = sumarDias(primero, -corrimiento);
  const celdas = Math.ceil((corrimiento + diasDelMes(anio, mes)) / 7) * 7;

  const semanas: Date[][] = [];
  for (let i = 0; i < celdas; i += 7) {
    semanas.push(Array.from({ length: 7 }, (_, j) => sumarDias(arranque, i + j)));
  }
  return semanas;
}

/** Rango `[inicio, fin)` del mes, en medianoche UTC. `fin` es el 1 del mes siguiente. */
export function rangoDeMes(anio: number, mes: number): { inicio: Date; fin: Date } {
  return { inicio: inicioDeMes(anio, mes), fin: inicioDeMes(anio, mes + 1) };
}

/** "YYYY-MM" → `{ anio, mes }`, o null si no es un mes válido. */
export function parseMes(valor: string): { anio: number; mes: number } | null {
  const partes = /^(\d{4})-(\d{2})$/.exec(valor.trim());
  if (!partes) return null;

  const anio = Number(partes[1]);
  const mes = Number(partes[2]);
  if (mes < 1 || mes > 12) return null;
  return { anio, mes };
}

/** "YYYY-MM" del mes en curso en Saladillo. */
export function mesEnSaladillo(ahora: Date = new Date()): string {
  return fechaEnSaladillo(ahora).slice(0, 7);
}

/** Clave "YYYY-MM" del mes corrido `salto` meses, para la navegación del calendario. */
export function mesVecino(anio: number, mes: number, salto: number): string {
  const total = anio * 12 + (mes - 1) + salto;
  const nuevoAnio = Math.floor(total / 12);
  const nuevoMes = (total % 12) + 1;
  return `${nuevoAnio}-${String(nuevoMes).padStart(2, '0')}`;
}

/** "Noviembre de 2026", para títulos del panel. */
export function nombreDeMes(anio: number, mes: number): string {
  const texto = new Intl.DateTimeFormat('es-AR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(Date.UTC(anio, mes - 1, 1)));

  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export interface ShiftHours {
  /** Hora en que empieza el turno, "HH:mm". */
  shiftStart: string;
  /** Hora en que termina, "HH:mm" del día siguiente. */
  shiftEnd: string;
}

export interface TurnoVigente {
  /** Fecha del turno: medianoche UTC del día en que empezó. */
  fecha: Date;
  fechaISO: string;
  /** Hora en que empezó, "HH:mm". */
  inicio: string;
  /** Hora en que termina, "HH:mm" del día siguiente. */
  fin: string;
  /** Relevo: medianoche UTC del día siguiente al del turno. */
  cambiaEl: Date;
  cambiaElISO: string;
}

const HORARIO_POR_DEFECTO: ShiftHours = { shiftStart: '08:00', shiftEnd: '08:00' };

/**
 * Turno vigente en ese momento. El turno va de `shiftStart` a `shiftEnd` del
 * día siguiente, así que antes de la hora de inicio el vigente sigue siendo el
 * del día anterior. Con el horario real (8:00 a 8:00), entre las 00:00 y las
 * 08:00 el turno vigente es el de ayer.
 */
export function turnoVigente(
  ahora: Date = new Date(),
  horas: ShiftHours = HORARIO_POR_DEFECTO
): TurnoVigente {
  const hoy = fechaEnSaladillo(ahora);
  const arrancoHoy = horaEnSaladillo(ahora) >= horas.shiftStart;
  const fechaISO = arrancoHoy ? hoy : sumarDiasISO(hoy, -1);
  const cambiaElISO = sumarDiasISO(fechaISO, 1);

  return {
    fecha: fechaUtc(fechaISO),
    fechaISO,
    inicio: horas.shiftStart,
    fin: horas.shiftEnd,
    cambiaEl: fechaUtc(cambiaElISO),
    cambiaElISO
  };
}
