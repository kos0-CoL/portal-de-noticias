import opentype from 'opentype.js';
import { isoDeFecha, parseMes, semanasDelMes } from '@/lib/pharmacy/schedule';

/**
 * Armado del organigrama como imagen, sin navegador.
 *
 * Se genera un SVG y se rasteriza con sharp. Todo el texto se convierte a
 * <path> con opentype.js usando fuentes TTF embebidas en el proyecto, así la
 * imagen no depende de tipografías del sistema (librsvg/Pango no respeta
 * @font-face embebido en el SVG y en serverless no hay fuentes instaladas).
 *
 * Antes esto abría un Chromium con Puppeteer, pero en Vercel el binario no
 * existe en el deploy y el endpoint fallaba con "Could not find Chrome".
 *
 * Módulo puro: no toca la base ni el sistema de archivos (salvo leer las TTF
 * una sola vez al iniciar).
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

/** Nombre de la fuente (solo para referencia; el texto se dibuja como paths). */
const FUENTE = 'Liberation Sans';

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

let fuenteRegular: opentype.Font | null = null;
let fuenteBold: opentype.Font | null = null;
let fuentesCargadas = false;

/** Lee las fuentes TTF del proyecto y las parsea con opentype (una sola vez).
 * Las TTF viven en public/fonts/ para que Next.js las copie al build y estén
 * disponibles también en serverless (Vercel). */
async function cargarFuentes(): Promise<void> {
  if (fuentesCargadas) return;
  try {
    const fsMod = await import('fs/promises');
    const pathMod = await import('path');
    const dir = pathMod.join(process.cwd(), 'public', 'fonts');
    const regularBuf = await fsMod.readFile(pathMod.join(dir, 'LiberationSans-Regular.ttf'));
    const boldBuf = await fsMod.readFile(pathMod.join(dir, 'LiberationSans-Bold.ttf'));
    fuenteRegular = await opentype.parse(regularBuf);
    fuenteBold = await opentype.parse(boldBuf);
    fuentesCargadas = true;
    console.warn('[organigrama] fuentes cargadas OK desde', dir);
  } catch (error) {
    fuentesCargadas = false;
    console.error(
      '[organigrama] no se pudieron cargar las fuentes TTF desde public/fonts/:',
      error instanceof Error ? error.message : error
    );
  }
}

/** Peso de fuente usado por opentype. */
type PesoFuente = 'regular' | 'bold';

/** Ancla de alineación horizontal (equivalente a text-anchor en SVG). */
type AnclaTexto = 'start' | 'middle' | 'end';

/**
 * Convierte una cadena de texto a un <path> SVG usando la fuente cargada.
 * Si no hay fuente cargada (p. ej. tests sin llamar a cargarFuentes), devuelve
 * un <text> plano como fallback.
 */
function textoAPath(
  texto: string,
  x: number,
  y: number,
  fontSize: number,
  peso: PesoFuente,
  ancla: AnclaTexto = 'start',
  fill: string
): string {
  const font = peso === 'bold' ? fuenteBold : fuenteRegular;
  if (!font) {
    return `<text x="${x}" y="${y}" font-family="${FUENTE}" font-size="${fontSize}" font-weight="${
      peso === 'bold' ? '700' : '400'
    }" fill="${fill}">${esc(texto)}</text>`;
  }

  const avance = font.getAdvanceWidth(texto, fontSize);
  let xAjustado = x;
  if (ancla === 'middle') xAjustado = x - avance / 2;
  if (ancla === 'end') xAjustado = x - avance;

  const path = font.getPath(texto, xAjustado, y, fontSize);
  // toSVG() devuelve "<path d=\"...\" />" completo; extraemos solo el d=""
  const svgPath = path.toSVG(2).replace(/\s+/g, ' ').trim();
  const dMatch = svgPath.match(/d="([^"]*)"/);
  const d = dMatch ? dMatch[1] : '';

  return `<path d="${d}" fill="${fill}" />`;
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
  filas: number
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

  const partes: string[] = [];

  partes.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="${PALETA.fondo}" />`);

  // Encabezado
  const kickerBase = margen + fsKicker;
  const tituloBase = kickerBase + 12 + fsTitulo * 0.78;
  partes.push(textoAPath('FARMACIAS DE TURNO', margen, kickerBase, fsKicker, 'bold', 'start', PALETA.kicker));
  partes.push(textoAPath(datos.titulo, margen, tituloBase, fsTitulo, 'bold', 'start', PALETA.claro));

  const ladoX = width - margen;
  const urlBase = tituloBase;
  const ciudadBase = urlBase - fsLado * 1.35;
  partes.push(textoAPath(datos.ciudad, ladoX, ciudadBase, fsLado, 'bold', 'end', PALETA.suave));
  partes.push(textoAPath(datos.url.replace(/^https?:\/\//, ''), ladoX, urlBase, fsLado, 'regular', 'end', PALETA.suave));

  // Tarjeta blanca
  partes.push(
    `<rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="24" fill="${PALETA.tarjeta}" />`
  );

  DIAS_SEMANA.forEach((dia, indice) => {
    const centro = gridX + indice * (celdaW + espacio) + celdaW / 2;
    partes.push(
      textoAPath(dia.toUpperCase(), centro, cardY + cardPad + fsSemana, fsSemana, 'bold', 'middle', PALETA.semana)
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
      textoAPath(
        String(celda.dia),
        x + padCelda,
        y + padCelda + fsDia * 0.82,
        fsDia,
        'bold',
        'start',
        colorDia
      )
    );

    if (celda.delMes) {
      const lineas = partirNombre(celda.pharmacyName ?? '—', maxChars);
      const colorNombre = celda.pharmacyName ? PALETA.tinta : PALETA.tintaTenue;
      const baseUltima = y + celdaH - padCelda - 4;

      lineas.forEach((linea, i) => {
        const base = baseUltima - (lineas.length - 1 - i) * fsNombre;
        partes.push(textoAPath(linea, x + padCelda, base, fsNombre, 'bold', 'start', colorNombre));
      });
    }

    partes.push('</g>');
  });

  const pieBase = height - margen + fsPie * 0.4;
  partes.push(
    textoAPath(`Turnos de ${datos.horario} · ${datos.sitio}`, width / 2, pieBase, fsPie, 'regular', 'middle', PALETA.suave)
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${partes.join('')}</svg>`;
}

/** PNG del organigrama, rasterizado con sharp. */
export async function renderOrganigramaPng(datos: DatosOrganigrama, formato: FormatoImagen): Promise<Buffer> {
  const { width, height } = FORMATOS_IMAGEN[formato];
  const { celdas, filas } = celdasDeMes(datos.mes, datos.turnos);

  await cargarFuentes();
  const svg = construirSvg(datos, width, height, celdas, filas);

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
