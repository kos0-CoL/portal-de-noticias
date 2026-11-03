import { isoDeFecha, parseMes, semanasDelMes } from '@/lib/pharmacy/schedule';

/**
 * Armado del organigrama como imagen, sin navegador.
 *
 * Se genera un SVG y se rasteriza con sharp, que ya está en el proyecto y corre
 * en el mismo entorno que el resto del panel. Antes esto abría un Chromium con
 * Puppeteer, pero en Vercel el binario no existe en el deploy y el endpoint
 * fallaba con "Could not find Chrome".
 *
 * Las fuentes se embeben en el SVG mediante @font-face (data URI base64) para
 * que no dependan de tipografías del sistema (Pango/librsvg no las encuentra
 * en serverless).
 *
 * Módulo puro: no toca la base ni el sistema de archivos.
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

export interface CeldaOrganigrama {
  /** "YYYY-MM-DD". */
  fecha: string;
  dia: number;
  /** false para los días de los meses vecinos que completan la semana. */
  delMes: boolean;
  pharmacyName: string | null;
}

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/** Nombre de la fuente embebida (se declara con @font-face en el SVG). */
const FUENTE = 'DejaVu Sans';

const PALETA = {
  fondo: '#0b2545',
  kicker: '#7fb3ff',
  claro: '#ffffff',
  suave: '#cbd9ea',
  tarjeta: '#ffffff',
  celdaDentro: '#f8fafc',
  celdaDentroBorde: '#e2e8f0',
  celdaFuera: '#ffffff',
  celdaFueraBorde: '#f1f5f9',
  tinta: '#0b2545',
  tintaTenue: '#cbd5e1',
  semana: '#64748b'
};

let fuenteRegularBase64: string | null = null;
let fuenteBoldBase64: string | null = null;
let fuentesCargadas = false;

/** Lee las fuentes TTF del proyecto y las guarda como base64 (una sola vez). */
async function cargarFuentes(): Promise<void> {
  if (fuentesCargadas) return;
  fuentesCargadas = true;
  try {
    const fsMod = await import('fs/promises');
    const pathMod = await import('path');
    const dir = pathMod.join(process.cwd(), 'src', 'lib', 'pharmacy', 'fonts');
    const regularBuf = await fsMod.readFile(pathMod.join(dir, 'DejaVuSans.ttf'));
    const boldBuf = await fsMod.readFile(pathMod.join(dir, 'DejaVuSans-Bold.ttf'));
    fuenteRegularBase64 = regularBuf.toString('base64');
    fuenteBoldBase64 = boldBuf.toString('base64');
  } catch {
    // Si no se pueden leer las fuentes (p. ej. entorno sin archivos), se usa
    // font-family genérico y librsvg caerá a fuentes del sistema si las hay.
  }
}

/** Bloque <defs><style>@font-face</style></defs> con las fuentes embebidas. */
function defsDeFuentes(): string {
  if (!fuenteRegularBase64 || !fuenteBoldBase64) return '';
  return `
    <defs>
      <style>
        @font-face {
          font-family: '${FUENTE}';
          src: url('data:font/truetype;charset=utf-8;base64,${fuenteRegularBase64}') format('truetype');
          font-weight: 400;
          font-style: normal;
        }
        @font-face {
          font-family: '${FUENTE}';
          src: url('data:font/truetype;charset=utf-8;base64,${fuenteBoldBase64}') format('truetype');
          font-weight: 700;
          font-style: normal;
        }
      </style>
    </defs>
  `;
}

/** Escapa el texto para que sea XML válido. */
function esc(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Corta el nombre en líneas. El SVG no sabe envolver texto solo, así que se
 * mide por cantidad de caracteres según el ancho disponible.
 */
export function partirNombre(nombre: string, maxChars: number, maxLineas = 2): string[] {
  const palabras = nombre.toUpperCase().split(/\s+/).filter(Boolean);
  const lineas: string[] = [];
  let actual = '';

  for (const palabra of palabras) {
    const candidato = actual ? `${actual} ${palabra}` : palabra;
    if (!actual || candidato.length <= maxChars) {
      actual = candidato;
    } else {
      lineas.push(actual);
      actual = palabra;
    }
  }
  if (actual) lineas.push(actual);

  if (lineas.length <= maxLineas) return lineas;

  const recortadas = lineas.slice(0, maxLineas);
  const ultima = recortadas[maxLineas - 1];
  recortadas[maxLineas - 1] = `${ultima.slice(0, Math.max(1, maxChars - 1))}…`;
  return recortadas;
}

/** Grilla completa de las semanas del mes, con los días vecinos incluidos. */
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

/** SVG del organigrama, del tamaño exacto del formato. */
export function construirSvg(
  datos: DatosOrganigrama,
  width: number,
  height: number,
  celdas: CeldaOrganigrama[],
  filas: number,
  fuenteDefs = ''
): string {
  // El formato cuadrado (1080×1080) necesita tipografía y aire más chicos.
  const compacto = height <= 1100;

  const margen = compacto ? 44 : 56;
  const espacio = 8;
  const radioCelda = 12;
  const padCelda = compacto ? 8 : 10;

  const fsKicker = compacto ? 20 : 24;
  const fsTitulo = compacto ? 54 : 68;
  const fsLado = compacto ? 20 : 24;
  const fsSemana = compacto ? 16 : 18;
  const fsDia = compacto ? 22 : 26;
  const fsNombre = compacto ? 15 : 17;
  const fsPie = compacto ? 18 : 22;

  const headerH = compacto ? 150 : 175;
  const footerH = compacto ? 44 : 54;
  const cardPad = compacto ? 16 : 20;

  const cardX = margen;
  const cardW = width - 2 * margen;
  const cardY = margen + headerH;
  const cardH = height - margen - footerH - cardY;

  const gridX = cardX + cardPad;
  const gridW = cardW - 2 * cardPad;
  const semanaH = compacto ? 24 : 28;
  const gridY = cardY + cardPad + semanaH + espacio;
  const gridH = cardY + cardH - cardPad - gridY;

  const celdaW = (gridW - 6 * espacio) / 7;
  const celdaH = (gridH - (filas - 1) * espacio) / filas;

  const maxChars = Math.max(6, Math.floor((celdaW - 2 * padCelda) / (fsNombre * 0.6)));
  const lineHeight = fsNombre;

  const partes: string[] = [];

  partes.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="${PALETA.fondo}" />`);

  // Encabezado
  const kickerBase = margen + fsKicker;
  const tituloBase = kickerBase + 12 + fsTitulo * 0.78;
  partes.push(
    `<text x="${margen}" y="${kickerBase}" font-family="${FUENTE}" font-size="${fsKicker}" font-weight="700" letter-spacing="3" fill="${PALETA.kicker}">${esc('FARMACIAS DE TURNO')}</text>`
  );
  partes.push(
    `<text x="${margen}" y="${tituloBase}" font-family="${FUENTE}" font-size="${fsTitulo}" font-weight="700" fill="${PALETA.claro}">${esc(datos.titulo)}</text>`
  );

  const ladoX = width - margen;
  const urlBase = tituloBase;
  const ciudadBase = urlBase - fsLado * 1.35;
  partes.push(
    `<text x="${ladoX}" y="${ciudadBase}" text-anchor="end" font-family="${FUENTE}" font-size="${fsLado}" font-weight="700" fill="${PALETA.suave}">${esc(datos.ciudad)}</text>`
  );
  partes.push(
    `<text x="${ladoX}" y="${urlBase}" text-anchor="end" font-family="${FUENTE}" font-size="${fsLado}" fill="${PALETA.suave}">${esc(datos.url.replace(/^https?:\/\//, ''))}</text>`
  );

  // Tarjeta blanca
  partes.push(
    `<rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="24" fill="${PALETA.tarjeta}" />`
  );

  DIAS_SEMANA.forEach((dia, indice) => {
    const centro = gridX + indice * (celdaW + espacio) + celdaW / 2;
    partes.push(
      `<text x="${centro}" y="${cardY + cardPad + fsSemana}" text-anchor="middle" font-family="${FUENTE}" font-size="${fsSemana}" font-weight="700" letter-spacing="1" fill="${PALETA.semana}">${esc(dia.toUpperCase())}</text>`
    );
  });

  celdas.forEach((celda, indice) => {
    const columna = indice % 7;
    const fila = Math.floor(indice / 7);
    const x = gridX + columna * (celdaW + espacio);
    const y = gridY + fila * (celdaH + espacio);

    const relleno = celda.delMes ? PALETA.celdaDentro : PALETA.celdaFuera;
    const borde = celda.delMes ? PALETA.celdaDentroBorde : PALETA.celdaFueraBorde;
    partes.push(
      `<g id="celda-${celda.fecha}"><rect x="${x}" y="${y}" width="${celdaW}" height="${celdaH}" rx="${radioCelda}" fill="${relleno}" stroke="${borde}" />`
    );

    const colorDia = celda.delMes ? PALETA.tinta : PALETA.tintaTenue;
    partes.push(
      `<text x="${x + padCelda}" y="${y + padCelda + fsDia * 0.82}" font-family="${FUENTE}" font-size="${fsDia}" font-weight="700" fill="${colorDia}">${celda.dia}</text>`
    );

    if (celda.delMes) {
      const lineas = partirNombre(celda.pharmacyName ?? '—', maxChars);
      const colorNombre = celda.pharmacyName ? PALETA.tinta : PALETA.tintaTenue;
      const baseUltima = y + celdaH - padCelda - 4;

      lineas.forEach((linea, i) => {
        const base = baseUltima - (lineas.length - 1 - i) * lineHeight;
        partes.push(
          `<text x="${x + padCelda}" y="${base}" font-family="${FUENTE}" font-size="${fsNombre}" font-weight="700" fill="${colorNombre}">${esc(linea)}</text>`
        );
      });
    }

    partes.push('</g>');
  });

  const pieBase = height - margen + fsPie * 0.4;
  partes.push(
    `<text x="${width / 2}" y="${pieBase}" text-anchor="middle" font-family="${FUENTE}" font-size="${fsPie}" fill="${PALETA.suave}">${esc(`Turnos de ${datos.horario} · ${datos.sitio}`)}</text>`
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${fuenteDefs}${partes.join('')}</svg>`;
}

/** PNG del organigrama, rasterizado con sharp. */
export async function renderOrganigramaPng(datos: DatosOrganigrama, formato: FormatoImagen): Promise<Buffer> {
  const { width, height } = FORMATOS_IMAGEN[formato];
  const { celdas, filas } = celdasDeMes(datos.mes, datos.turnos);

  await cargarFuentes();
  const fuenteDefs = defsDeFuentes();
  const svg = construirSvg(datos, width, height, celdas, filas, fuenteDefs);

  // Import dinámico: sharp es una dependencia opcional que se resuelve en runtime.
  const mod = (await import('sharp')) as unknown as { default?: SharpFactory };
  const sharp = mod.default ?? (mod as unknown as SharpFactory);
  if (typeof sharp !== 'function') {
    throw new Error('sharp no está disponible: no se puede generar la imagen.');
  }

  return sharp(Buffer.from(svg)).png().toBuffer();
}

interface SharpFactory {
  (input: Buffer): {
    png(): { toBuffer(): Promise<Buffer> };
  };
}
