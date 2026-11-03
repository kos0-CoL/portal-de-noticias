import { describe, expect, it } from 'vitest';
import {
  diasDelMes,
  fechaEnSaladillo,
  fechaUtc,
  horaEnSaladillo,
  hoyEnSaladillo,
  inicioDeMes,
  isoDeFecha,
  sumarDiasISO,
  turnoVigente,
  semanasDelMes
} from '@/lib/pharmacy/schedule';

describe('fechaEnSaladillo y horaEnSaladillo', () => {
  it('usa la hora de Saladillo, no la del servidor', () => {
    // 02:00 UTC del 2 de noviembre son las 23:00 del 1 en Saladillo (UTC-3).
    const instante = new Date('2026-11-02T02:00:00Z');
    expect(fechaEnSaladillo(instante)).toBe('2026-11-01');
    expect(horaEnSaladillo(instante)).toBe('23:00');
  });

  it('devuelve la misma fecha cuando el día ya cambió en Saladillo', () => {
    const instante = new Date('2026-11-02T11:00:00Z');
    expect(fechaEnSaladillo(instante)).toBe('2026-11-02');
    expect(horaEnSaladillo(instante)).toBe('08:00');
  });
});

describe('hoyEnSaladillo', () => {
  it('devuelve la medianoche UTC del día en curso en Saladillo', () => {
    const hoy = hoyEnSaladillo(new Date('2026-11-02T02:00:00Z'));
    expect(isoDeFecha(hoy)).toBe('2026-11-01');
    expect(hoy.toISOString()).toBe('2026-11-01T00:00:00.000Z');
  });
});

describe('fechaUtc y sumarDiasISO', () => {
  it('construye la fecha en UTC para no correrse un día', () => {
    expect(fechaUtc('2026-11-02').toISOString()).toBe('2026-11-02T00:00:00.000Z');
  });

  it('cruza fin de mes y fin de año en los dos sentidos', () => {
    expect(sumarDiasISO('2026-10-31', 1)).toBe('2026-11-01');
    expect(sumarDiasISO('2026-11-01', -1)).toBe('2026-10-31');
    expect(sumarDiasISO('2026-12-31', 1)).toBe('2027-01-01');
    expect(sumarDiasISO('2026-03-01', -1)).toBe('2026-02-28');
    expect(sumarDiasISO('2024-03-01', -1)).toBe('2024-02-29');
  });
});

describe('diasDelMes', () => {
  it('sabe cuántos días tiene cada mes', () => {
    expect(diasDelMes(2026, 10)).toBe(31);
    expect(diasDelMes(2026, 11)).toBe(30);
    expect(diasDelMes(2027, 2)).toBe(28);
    expect(diasDelMes(2024, 2)).toBe(29);
  });
});

describe('inicioDeMes', () => {
  it('devuelve la medianoche UTC del día 1', () => {
    expect(inicioDeMes(2026, 11).toISOString()).toBe('2026-11-01T00:00:00.000Z');
  });
});

describe('semanasDelMes', () => {
  it('arma la grilla de lunes a domingo con los días de los meses vecinos', () => {
    // El 1 de noviembre de 2026 cae domingo, así que la primera semana arranca el 26 de octubre.
    const semanas = semanasDelMes(2026, 11);
    expect(semanas).toHaveLength(6);
    expect(semanas.every((semana) => semana.length === 7)).toBe(true);
    expect(isoDeFecha(semanas[0][0])).toBe('2026-10-26');
    expect(isoDeFecha(semanas[0][6])).toBe('2026-11-01');
    expect(isoDeFecha(semanas[5][6])).toBe('2026-12-06');
  });

  it('incluye los 30 días de noviembre una sola vez', () => {
    const delMes = semanasDelMes(2026, 11)
      .flat()
      .filter((fecha) => fecha.getUTCMonth() === 10);
    expect(delMes).toHaveLength(30);
  });

  it('cierra en 5 semanas cuando el mes entra justo', () => {
    // Octubre de 2026 arranca jueves: 3 días de septiembre + 31 de octubre = 5 semanas.
    const semanas = semanasDelMes(2026, 10);
    expect(semanas).toHaveLength(5);
    expect(isoDeFecha(semanas[0][0])).toBe('2026-09-28');
    expect(isoDeFecha(semanas[4][6])).toBe('2026-11-01');
  });
});

describe('turnoVigente', () => {
  it('a las 08:00 el turno vigente es el del mismo día', () => {
    const vigente = turnoVigente(new Date('2026-11-02T11:00:00Z'));
    expect(vigente.fechaISO).toBe('2026-11-02');
    expect(vigente.cambiaElISO).toBe('2026-11-03');
    expect(vigente.inicio).toBe('08:00');
    expect(vigente.fin).toBe('08:00');
  });

  it('a las 07:59 el turno vigente sigue siendo el del día anterior', () => {
    const vigente = turnoVigente(new Date('2026-11-02T10:59:00Z'));
    expect(vigente.fechaISO).toBe('2026-11-01');
    expect(vigente.cambiaElISO).toBe('2026-11-02');
  });

  it('a las 23:00 el turno vigente es el que empezó a la mañana', () => {
    const vigente = turnoVigente(new Date('2026-11-02T02:00:00Z'));
    expect(vigente.fechaISO).toBe('2026-11-01');
    expect(vigente.cambiaEl).toEqual(fechaUtc('2026-11-02'));
  });

  it('respeta un horario distinto al de 8 a 8', () => {
    const vigente = turnoVigente(new Date('2026-11-02T02:00:00Z'), { shiftStart: '00:00', shiftEnd: '00:00' });
    expect(vigente.fechaISO).toBe('2026-11-01');
    expect(vigente.inicio).toBe('00:00');
  });
});
