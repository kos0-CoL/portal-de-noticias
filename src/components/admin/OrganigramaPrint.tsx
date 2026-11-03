import type { CSSProperties } from 'react';

/**
 * Vista del organigrama pensada para capturarse como imagen, no para navegarse.
 *
 * Usa estilos inline a propósito: el HTML se le pasa a Puppeteer con
 * setContent(), así que no hay CSS compilado de Next disponible. Es el único
 * componente del panel con esta restricción.
 */

export interface CeldaOrganigrama {
  /** "YYYY-MM-DD". */
  fecha: string;
  /** Número de día del mes. */
  dia: number;
  /** false para los días de los meses vecinos que completan la semana. */
  delMes: boolean;
  pharmacyName: string | null;
}

export interface OrganigramaPrintProps {
  /** "YYYY-MM". */
  mes: string;
  /** "Noviembre de 2026". */
  titulo: string;
  sitio: string;
  ciudad: string;
  url: string;
  /** "08:00 a 08:00 del día siguiente". */
  horario: string;
  width: number;
  height: number;
  /** Cantidad de semanas de la grilla (5 o 6). */
  filas: number;
  celdas: CeldaOrganigrama[];
}

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/** Estilo de cada celda del calendario. */
function estiloCelda(delMes: boolean, compacto: boolean): CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: compacto ? 8 : 10,
    borderRadius: 12,
    backgroundColor: delMes ? '#f8fafc' : '#ffffff',
    border: `1px solid ${delMes ? '#e2e8f0' : '#f1f5f9'}`,
    minHeight: 0,
    overflow: 'hidden'
  };
}

export function OrganigramaPrint(props: OrganigramaPrintProps) {
  const { titulo, sitio, ciudad, url, horario, width, height, filas, celdas } = props;
  // El formato apaisado (1080×1080) necesita tipografía y aire más chicos.
  const compacto = height <= 1100;

  return (
    <div
      style={{
        width,
        height,
        boxSizing: 'border-box',
        padding: compacto ? 44 : 56,
        backgroundColor: '#0b2545',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Helvetica, Arial, sans-serif'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          marginBottom: compacto ? 18 : 26
        }}
      >
        <div>
          <div
            style={{
              fontSize: compacto ? 20 : 24,
              letterSpacing: 3,
              textTransform: 'uppercase',
              color: '#7fb3ff',
              fontWeight: 700
            }}
          >
            Farmacias de turno
          </div>
          <div style={{ fontSize: compacto ? 54 : 68, fontWeight: 800, lineHeight: 1.05, marginTop: 6 }}>{titulo}</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: compacto ? 20 : 24, color: '#cbd9ea' }}>
          <div style={{ fontWeight: 700 }}>{ciudad}</div>
          <div>{url.replace(/^https?:\/\//, '')}</div>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          backgroundColor: '#ffffff',
          borderRadius: 24,
          padding: compacto ? 16 : 20,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 8, marginBottom: 8 }}>
          {DIAS_SEMANA.map((dia) => (
            <div
              key={dia}
              style={{
                textAlign: 'center',
                fontSize: compacto ? 16 : 18,
                fontWeight: 700,
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: 1
              }}
            >
              {dia}
            </div>
          ))}
        </div>

        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
            gridTemplateRows: `repeat(${filas}, minmax(0, 1fr))`,
            gap: 8,
            minHeight: 0
          }}
        >
          {celdas.map((celda) => (
            <div key={celda.fecha} data-dia={celda.delMes ? celda.dia : undefined} style={estiloCelda(celda.delMes, compacto)}>
              <div style={{ fontSize: compacto ? 22 : 26, fontWeight: 800, color: celda.delMes ? '#0b2545' : '#cbd5e1' }}>
                {celda.dia}
              </div>
              <div
                style={{
                  fontSize: compacto ? 15 : 17,
                  fontWeight: 700,
                  lineHeight: 1.15,
                  textTransform: 'uppercase',
                  wordBreak: 'break-word',
                  color: celda.delMes ? (celda.pharmacyName ? '#0b2545' : '#cbd5e1') : '#f8fafc'
                }}
              >
                {celda.delMes ? (celda.pharmacyName ?? '—') : ''}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          marginTop: compacto ? 14 : 20,
          fontSize: compacto ? 18 : 22,
          color: '#cbd9ea',
          textAlign: 'center'
        }}
      >
        Turnos de {horario} · {sitio}
      </div>
    </div>
  );
}
