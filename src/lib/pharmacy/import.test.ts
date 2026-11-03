import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  construirDiff,
  nombrePropio,
  normalizarNombre,
  parsearPaginaColegio,
  resolverFarmacia,
  sugerirFarmacia,
  type FarmaciaMapeable
} from './import';

/**
 * El fixture es el bloque del artículo de
 * https://acasaladillo.com.ar/?page_id=3080 tal como estaba el 2026-11-02,
 * cuando publicaba el organigrama de octubre de 2026.
 */
const html = readFileSync(path.join(process.cwd(), 'src/lib/pharmacy/__fixtures__/colegio-2026-10.html'), 'utf8');

const FARMACIAS: FarmaciaMapeable[] = [
  { id: 'orianda', name: 'Orianda', alias: [] },
  { id: 'marcos', name: 'Marcos', alias: [] },
  { id: 'abelenda', name: 'Abelenda Cabral', alias: ['ABELENDA CABRAL'] },
  { id: 'abelenda-2', name: 'Abelenda II', alias: [] }
];

describe('parsearPaginaColegio', () => {
  it('reconoce el mes y el año del título', () => {
    const organigrama = parsearPaginaColegio(html);

    expect(organigrama.mes).toBe(10);
    expect(organigrama.anio).toBe(2026);
  });

  it('reconoce los 31 días del mes, en orden', () => {
    const { turnos } = parsearPaginaColegio(html);

    expect(turnos.map((turno) => turno.dia)).toEqual(Array.from({ length: 31 }, (_, i) => i + 1));
  });

  it('toma la posición en la lista como día del mes', () => {
    const { turnos } = parsearPaginaColegio(html);
    const porDia = new Map(turnos.map((turno) => [turno.dia, turno]));

    expect(porDia.get(1)).toEqual({ dia: 1, nombre: 'ORIANDA', direccion: 'BELGRANO y ALMAFUERTE' });
    expect(porDia.get(2)).toEqual({ dia: 2, nombre: 'MARCOS', direccion: 'MITRE 2798 ESQ. ESTRADA' });
    expect(porDia.get(10)?.nombre).toBe('ABELENDA II');
    expect(porDia.get(31)?.nombre).toBe('ORIANDA');
  });

  it('decodifica las entidades HTML', () => {
    const { turnos } = parsearPaginaColegio(html);

    expect(turnos.every((turno) => !/[&#]/.test(turno.nombre) && !/[&#]/.test(turno.direccion))).toBe(true);
  });

  it('lee el directorio con dirección y teléfono', () => {
    const { directorio } = parsearPaginaColegio(html);

    expect(directorio).toHaveLength(9);
    expect(directorio.find((farmacia) => farmacia.nombre === 'ABELENDA CABRAL')).toEqual({
      nombre: 'ABELENDA CABRAL',
      direccion: 'Cabral y Ruta 205',
      telefono: '02344-452240'
    });
    expect(directorio.find((farmacia) => farmacia.nombre === 'DEMARIA')).toEqual({
      nombre: 'DEMARIA',
      direccion: 'Rivadavia 3188',
      telefono: '02344-450663'
    });
  });

  it('falla con un mensaje claro si el título cambió de formato', () => {
    expect(() => parsearPaginaColegio('<html><body><h4>Turnos de farmacias</h4></body></html>')).toThrow(/título/i);
  });

  it('falla si el mes del título no es un mes conocido', () => {
    expect(() => parsearPaginaColegio('<h4>Farmacias de Turno Mes Brumario 2026</h4>')).toThrow(/Brumario/);
  });

  it('falla si no encuentra el organigrama del mes', () => {
    const sinLista = '<h4>Farmacias de Turno Mes Octubre 2026</h4><p>Sin novedades</p>';

    expect(() => parsearPaginaColegio(sinLista)).toThrow(/organigrama/i);
  });
});

describe('normalizarNombre', () => {
  it('ignora acentos, mayúsculas y espacios de más', () => {
    expect(normalizarNombre('  abelenda   cabráL ')).toBe('ABELENDA CABRAL');
  });
});

describe('nombrePropio', () => {
  it('deja el nombre presentable para darlo de alta', () => {
    expect(nombrePropio('ABELENDA II')).toBe('Abelenda Ii');
    expect(nombrePropio('JUAN MARTIN')).toBe('Juan Martin');
  });
});

describe('resolverFarmacia', () => {
  it('matchea por el nombre cargado', () => {
    expect(resolverFarmacia('ORIANDA', FARMACIAS)).toBe('orianda');
  });

  it('matchea por alias', () => {
    expect(resolverFarmacia('abelenda cabral', FARMACIAS)).toBe('abelenda');
  });

  it('no resuelve si el prefijo apunta a más de una farmacia', () => {
    expect(resolverFarmacia('ABELENDA', FARMACIAS)).toBeNull();
  });

  it('no resuelve un nombre que no está cargado', () => {
    expect(resolverFarmacia('DEMARIA', FARMACIAS)).toBeNull();
  });
});

describe('sugerirFarmacia', () => {
  it('sugiere por prefijo la farmacia que empieza igual', () => {
    expect(sugerirFarmacia('ABELENDA', FARMACIAS)?.id).toBe('abelenda');
  });

  it('no sugiere nada si el nombre no se parece a ninguno', () => {
    expect(sugerirFarmacia('DEMARIA', FARMACIAS)).toBeNull();
  });
});

describe('construirDiff', () => {
  const organigrama = parsearPaginaColegio(html);

  it('clasifica los días en iguales, con cambio, nuevos y sin mapear', () => {
    const diff = construirDiff(organigrama, FARMACIAS, [
      { fecha: '2026-10-01', pharmacyId: 'orianda', pharmacyName: 'Orianda', origen: 'ROTACION' },
      { fecha: '2026-10-02', pharmacyId: 'abelenda', pharmacyName: 'Abelenda Cabral', origen: 'MANUAL' }
    ]);

    const porFecha = new Map(diff.dias.map((dia) => [dia.fecha, dia]));
    expect(porFecha.get('2026-10-01')).toMatchObject({ estado: 'igual', pharmacyId: 'orianda' });
    expect(porFecha.get('2026-10-02')).toMatchObject({
      estado: 'cambia',
      pharmacyId: 'marcos',
      actualName: 'Abelenda Cabral',
      actualOrigen: 'MANUAL'
    });
    expect(porFecha.get('2026-10-03')).toMatchObject({ estado: 'sin-mapear' });
    expect(diff.resumen).toEqual({ total: 31, iguales: 1, cambian: 1, nuevos: 11, sinMapear: 18 });
  });

  it('agrupa los nombres sin mapear y sugiere por prefijo', () => {
    const diff = construirDiff(organigrama, FARMACIAS, []);

    expect(diff.sinMapear.map((nombre) => nombre.nombre).sort()).toEqual([
      'ABELENDA',
      'CARTELLE',
      'FUILLERAT',
      'JUAN MARTIN',
      'LIBERTAD',
      'MANZANO'
    ]);
    expect(diff.sinMapear.find((nombre) => nombre.nombre === 'ABELENDA')).toMatchObject({
      dias: 3,
      sugerenciaId: 'abelenda',
      sugerenciaNombre: 'Abelenda Cabral',
      enDirectorio: true,
      direccion: 'Cabral y Ruta 205',
      telefono: '02344-452240'
    });
  });

  it('avisa qué días cargados el Colegio no publica', () => {
    const parcial = { ...organigrama, turnos: organigrama.turnos.filter((turno) => turno.dia !== 5) };
    const diff = construirDiff(parcial, FARMACIAS, [
      { fecha: '2026-10-05', pharmacyId: 'orianda', pharmacyName: 'Orianda', origen: 'MANUAL' },
      { fecha: '2026-11-05', pharmacyId: 'orianda', pharmacyName: 'Orianda', origen: 'MANUAL' }
    ]);

    expect(diff.sinDatos).toEqual([{ fecha: '2026-10-05', pharmacyName: 'Orianda', origen: 'MANUAL' }]);
  });

  it('marca las farmacias del directorio que no están cargadas', () => {
    const diff = construirDiff(organigrama, FARMACIAS, []);

    expect(diff.directorio.find((farmacia) => farmacia.nombre === 'DEMARIA')?.pharmacyId).toBeNull();
    expect(diff.directorio.find((farmacia) => farmacia.nombre === 'ORIANDA')?.pharmacyId).toBe('orianda');
  });
});
