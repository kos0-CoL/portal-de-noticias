import { describe, expect, it } from 'vitest';
import {
  farmaciaDeFecha,
  generarMes,
  normalizarOrden,
  proximosDias,
  turnoDeFecha,
  type CicloRotacion
} from '@/lib/pharmacy/rotation';
import { fechaUtc } from '@/lib/pharmacy/schedule';

/** El ciclo real del Colegio: 10 posiciones, con ORIANDA repetida. */
const CICLO: string[] = [
  'orianda',
  'marcos',
  'libertad',
  'fuillerat',
  'juan-martin',
  'abelenda',
  'cartelle',
  'manzano',
  'orianda',
  'abelenda-ii'
];

const ciclo: CicloRotacion = { orden: CICLO, ancla: '2026-10-01' };

describe('turnoDeFecha', () => {
  it('devuelve el índice del ciclo para el ancla', () => {
    expect(turnoDeFecha(fechaUtc('2026-10-01'), ciclo)).toBe(0);
  });

  it('reproduce el ciclo de 10 días completo', () => {
    const esperado = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1];
    const obtenido = Array.from({ length: 12 }, (_, i) => turnoDeFecha(fechaUtc(`2026-10-${String(i + 1).padStart(2, '0')}`), ciclo));
    expect(obtenido).toEqual(esperado);
  });

  it('devuelve un índice válido para fechas anteriores al ancla', () => {
    expect(turnoDeFecha(fechaUtc('2026-09-30'), ciclo)).toBe(9);
    expect(farmaciaDeFecha(fechaUtc('2026-09-30'), ciclo)).toBe('abelenda-ii');
  });

  it('devuelve -1 si el ciclo está vacío o sin ancla', () => {
    expect(turnoDeFecha(fechaUtc('2026-10-01'), { orden: [], ancla: '2026-10-01' })).toBe(-1);
    expect(turnoDeFecha(fechaUtc('2026-10-01'), { orden: CICLO, ancla: null })).toBe(-1);
  });
});

describe('generarMes', () => {
  it('genera los 31 días de octubre 2026', () => {
    const dias = generarMes(2026, 10, ciclo);
    expect(dias).toHaveLength(31);
    expect(dias[0]).toEqual({ fecha: fechaUtc('2026-10-01'), fechaISO: '2026-10-01', pharmacyId: 'orianda' });
    expect(dias[30].fechaISO).toBe('2026-10-31');
  });

  it('hace que ORIANDA caiga en las dos posiciones del ciclo (índices 0 y 8)', () => {
    const dias = generarMes(2026, 10, ciclo);
    const oriandas = dias.filter((d) => d.pharmacyId === 'orianda').map((d) => d.fechaISO);
    expect(oriandas).toEqual(['2026-10-01', '2026-10-09', '2026-10-11', '2026-10-19', '2026-10-21', '2026-10-29', '2026-10-31']);
  });

  it('arranca el mes en un índice distinto de 0 si el ancla no cae el día 1', () => {
    // El 2 de octubre es ORIANDA (índice 0), así que el 1 de octubre queda en el último lugar del ciclo.
    const conAncla = { orden: CICLO, ancla: '2026-10-02' };
    const dias = generarMes(2026, 10, conAncla);
    expect(dias[0].pharmacyId).toBe('abelenda-ii');
    expect(turnoDeFecha(fechaUtc('2026-10-02'), conAncla)).toBe(0);
  });

  it('devuelve una lista vacía si el ciclo no está configurado', () => {
    expect(generarMes(2026, 10, { orden: [], ancla: null })).toEqual([]);
  });

  it('genera los 30 días de noviembre y de un mes de 28', () => {
    expect(generarMes(2026, 11, ciclo)).toHaveLength(30);
    expect(generarMes(2027, 2, ciclo)).toHaveLength(28);
  });
});

describe('proximosDias', () => {
  it('devuelve la cantidad pedida arrancando en la fecha indicada', () => {
    const dias = proximosDias(fechaUtc('2026-11-02'), 20, ciclo);
    expect(dias).toHaveLength(20);
    expect(dias[0].fechaISO).toBe('2026-11-02');
    expect(dias[19].fechaISO).toBe('2026-11-21');
  });

  it('repite el ciclo cada 10 días', () => {
    const dias = proximosDias(fechaUtc('2026-10-01'), 20, ciclo);
    expect(dias[0].pharmacyId).toBe(dias[10].pharmacyId);
    expect(dias[9].pharmacyId).toBe(dias[19].pharmacyId);
  });
});

describe('normalizarOrden', () => {
  it('descarta ids inexistentes o inactivos y conserva el orden del resto', () => {
    const validos = new Set(['orianda', 'marcos', 'abelenda']);
    expect(normalizarOrden(['orianda', 'borrada', 'marcos', 'inactiva', 'abelenda'], validos)).toEqual([
      'orianda',
      'marcos',
      'abelenda'
    ]);
  });

  it('conserva las repeticiones, que son parte del ciclo', () => {
    const validos = new Set(['orianda', 'marcos']);
    expect(normalizarOrden(['orianda', 'marcos', 'orianda'], validos)).toEqual(['orianda', 'marcos', 'orianda']);
  });

  it('devuelve una lista vacía si no queda ningún id válido', () => {
    expect(normalizarOrden(['a', 'b'], new Set<string>())).toEqual([]);
  });
});
