import { describe, expect, it } from 'vitest';
import { celdasDeMes, FORMATOS_IMAGEN, renderOrganigramaHtml, type DatosOrganigrama } from './schedule-image';

const datos: DatosOrganigrama = {
  mes: '2026-10',
  titulo: 'Octubre de 2026',
  sitio: 'Saladillo Noticias',
  ciudad: 'Saladillo',
  url: 'https://saladillo.example',
  horario: '08:00 a 08:00 del día siguiente',
  turnos: [
    { fecha: '2026-10-01', pharmacyName: 'Orianda' },
    { fecha: '2026-10-02', pharmacyName: 'Marcos' }
  ]
};

/** Cada día del mes se marca con un data-dia; los vecinos no. */
function diasDelMes(html: string): number {
  return (html.match(/data-dia="/g) ?? []).length;
}

describe('renderOrganigramaHtml', () => {
  it('incluye los 31 días del mes pedido', async () => {
    const { html } = await renderOrganigramaHtml(datos, 'historia');
    expect(diasDelMes(html)).toBe(31);
  });

  it('respeta un mes corto', async () => {
    const { html } = await renderOrganigramaHtml({ ...datos, mes: '2026-02', titulo: 'Febrero de 2026' }, 'post');
    expect(diasDelMes(html)).toBe(28);
  });

  it('usa el título del mes', async () => {
    const { html } = await renderOrganigramaHtml(datos, 'historia');
    expect(html).toContain('Octubre de 2026');
  });

  it('muestra la farmacia asignada a cada día', async () => {
    const { html } = await renderOrganigramaHtml(datos, 'historia');
    expect(html).toContain('Orianda');
    expect(html).toContain('Marcos');
  });

  it('devuelve las dimensiones de cada formato', async () => {
    expect(FORMATOS_IMAGEN).toEqual({
      historia: { width: 1080, height: 1350 },
      post: { width: 1080, height: 1080 }
    });
    await expect(renderOrganigramaHtml(datos, 'historia')).resolves.toMatchObject({ width: 1080, height: 1350 });
    await expect(renderOrganigramaHtml(datos, 'post')).resolves.toMatchObject({ width: 1080, height: 1080 });
  });

  it('falla con un mes inválido', async () => {
    await expect(renderOrganigramaHtml({ ...datos, mes: '2026-13' }, 'post')).rejects.toThrow();
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
