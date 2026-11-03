import { describe, expect, it } from 'vitest';
import {
  celdasDeMes,
  construirSvg,
  FORMATOS_IMAGEN,
  partirNombre,
  renderOrganigramaPng,
  type DatosOrganigrama
} from './schedule-image';

const datos: DatosOrganigrama = {
  mes: '2026-10',
  titulo: 'Octubre de 2026',
  sitio: 'Saladillo Noticias',
  ciudad: 'Saladillo',
  url: 'https://saladillo.example',
  horario: '08:00 a 08:00 del día siguiente',
  turnos: [
    { fecha: '2026-10-01', pharmacyName: 'Orianda' },
    { fecha: '2026-10-02', pharmacyName: 'Juan Martin' }
  ]
};

function svgDe(mes: string, formato: 'historia' | 'post' = 'historia'): string {
  const { width, height } = FORMATOS_IMAGEN[formato];
  const { celdas, filas } = celdasDeMes(mes, datos.turnos);
  return construirSvg({ ...datos, mes }, width, height, celdas, filas);
}

describe('construirSvg', () => {
  it('declara las dimensiones del formato', () => {
    expect(svgDe('2026-10', 'historia')).toContain('width="1080" height="1350"');
    expect(svgDe('2026-10', 'post')).toContain('width="1080" height="1080"');
  });

  it('incluye una celda por día de cada semana del mes', () => {
    const { celdas, filas } = celdasDeMes('2026-10', []);
    const svg = svgDe('2026-10');
    expect(celdas.length).toBe(filas * 7);
    expect((svg.match(/id="celda-/g) ?? [])).toHaveLength(celdas.length);
  });

  it('muestra el título y las farmacias del mes', () => {
    const svg = svgDe('2026-10');
    expect(svg).toContain('Octubre de 2026');
    expect(svg).toContain('ORIANDA');
  });

  it('envuelve los nombres de dos palabras en dos líneas', () => {
    const svg = svgDe('2026-10');
    expect(svg).toContain('JUAN');
    expect(svg).toContain('MARTIN');
  });

  it('no deja texto sin escapar', () => {
    const { width, height } = FORMATOS_IMAGEN.post;
    const { celdas, filas } = celdasDeMes('2026-10', []);
    const svg = construirSvg(
      { ...datos, mes: '2026-10', ciudad: 'Saladillo & Cía <zona>' },
      width,
      height,
      celdas,
      filas
    );
    expect(svg).toContain('Saladillo &amp; Cía &lt;zona&gt;');
  });

  it('falla con un mes inválido', () => {
    expect(() => celdasDeMes('2026-13', [])).toThrow();
  });
});

describe('partirNombre', () => {
  it('deja el nombre en una línea si entra', () => {
    expect(partirNombre('Orianda', 12)).toEqual(['ORIANDA']);
  });

  it('corta en dos líneas por palabra', () => {
    expect(partirNombre('Juan Martin', 8)).toEqual(['JUAN', 'MARTIN']);
  });

  it('trunca con puntos suspensivos si sobra texto', () => {
    const lineas = partirNombre('Farmacia Del Pueblo Norte', 10, 2);
    expect(lineas).toHaveLength(2);
    expect(lineas[1].endsWith('…')).toBe(true);
  });
});

describe('celdasDeMes', () => {
  it('completa las semanas con los días de los meses vecinos', () => {
    const { celdas, filas } = celdasDeMes('2026-10', []);
    expect(celdas.length).toBe(filas * 7);
    expect(celdas.filter((celda) => celda.delMes)).toHaveLength(31);
  });

  it('asigna el turno sólo a la fecha que le corresponde', () => {
    const { celdas } = celdasDeMes('2026-10', [{ fecha: '2026-10-05', pharmacyName: 'Libertad' }]);
    const conTurno = celdas.filter((celda) => celda.pharmacyName === 'Libertad');
    expect(conTurno).toHaveLength(1);
    expect(conTurno[0].dia).toBe(5);
  });
});

describe('renderOrganigramaPng', () => {
  it('genera un PNG con las dimensiones exactas de cada formato', async () => {
    for (const formato of ['historia', 'post'] as const) {
      const png = await renderOrganigramaPng(datos, formato);
      const { width, height } = FORMATOS_IMAGEN[formato];

      expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect(png.readUInt32BE(16)).toBe(width);
      expect(png.readUInt32BE(20)).toBe(height);
      expect(png.byteLength).toBeGreaterThan(2000);
    }
  }, 30_000);
});
