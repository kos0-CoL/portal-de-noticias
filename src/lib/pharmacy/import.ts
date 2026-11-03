/**
 * Importación del organigrama del Colegio de Farmacéuticos de Saladillo.
 *
 * Módulo puro: recibe el HTML ya descargado, así el parseo y el diff contra lo
 * cargado se testean contra un fixture real sin tocar la red ni la base.
 *
 * La página del Colegio tiene tres partes que nos interesan:
 *   1. el título con el mes ("Farmacias de Turno Mes Octubre 2026");
 *   2. el organigrama, una lista ordenada donde la posición es el día del mes;
 *   3. el directorio, con la dirección y el teléfono de cada farmacia.
 */

import { diasDelMes } from '@/lib/pharmacy/schedule';

export interface TurnoColegio {
  dia: number;
  nombre: string;
  direccion: string;
}

export interface FarmaciaColegio {
  nombre: string;
  direccion: string;
  telefono: string;
}

export interface OrganigramaColegio {
  anio: number;
  mes: number;
  turnos: TurnoColegio[];
  directorio: FarmaciaColegio[];
}

/** Debajo de esto se asume que la página cambió de estructura o no está el mes. */
const MINIMO_DIAS = 20;

const MESES: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12
};

/** Entidades que aparecen en la página; el resto se resuelve por código numérico. */
const ENTIDADES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  laquo: '«',
  raquo: '»',
  aacute: 'á',
  eacute: 'é',
  iacute: 'í',
  oacute: 'ó',
  uacute: 'ú',
  ntilde: 'ñ',
  Aacute: 'Á',
  Eacute: 'É',
  Iacute: 'Í',
  Oacute: 'Ó',
  Uacute: 'Ú',
  Ntilde: 'Ñ'
};

/** Sin acentos, para comparar nombres y meses escritos de cualquier forma. */
function sinAcentos(valor: string): string {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * "Abelenda Cabral" → "ABELENDA CABRAL". Es la forma en que se comparan los
 * nombres del Colegio contra el nombre y los alias de cada farmacia cargada.
 */
export function normalizarNombre(valor: string): string {
  return sinAcentos(String(valor ?? ''))
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/** "ABELENDA II" → "Abelenda II", para el nombre de una farmacia nueva. */
export function nombrePropio(valor: string): string {
  const limpio = String(valor ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return limpio.replace(/(^|\s)(\p{L})/gu, (_, espacio: string, letra: string) => espacio + letra.toUpperCase());
}

function decodificar(texto: string): string {
  return texto.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (todo, codigo: string) => {
    if (codigo.startsWith('#')) {
      const hexadecimal = codigo[1] === 'x' || codigo[1] === 'X';
      const numero = Number.parseInt(codigo.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
      return Number.isNaN(numero) ? todo : String.fromCodePoint(numero);
    }
    return ENTIDADES[codigo] ?? todo;
  });
}

/**
 * Texto plano de un fragmento de HTML, con un salto de línea por cada `<br>`.
 * Las entidades se decodifican después de sacar las etiquetas: al revés, un
 * `&lt;` del contenido se confundiría con una etiqueta.
 */
function textoPlano(fragmento: string): string {
  return fragmento
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .split('\n')
    .map((linea) => decodificar(linea).replace(/[ \t\u00a0]+/g, ' ').trim())
    .join('\n')
    .trim();
}

/** "ORIANDA – BELGRANO Y ALMAFUERTE" → ["ORIANDA", "BELGRANO Y ALMAFUERTE"]. */
function separarNombreYDireccion(linea: string): [string, string] | null {
  const partes = /^(.+?)\s+[–—]\s+(.+)$/.exec(linea) ?? /^(.+?)\s+-\s+(.+)$/.exec(linea);
  if (!partes) return null;
  return [partes[1].trim(), partes[2].trim()];
}

/** Lista ordenada del organigrama: la posición del `<li>` es el día del mes. */
function leerTurnos(html: string, desde: number): TurnoColegio[] {
  const bloque = /<ol[^>]*>([\s\S]*?)<\/ol>/i.exec(html.slice(desde));
  if (!bloque) return [];

  const items = bloque[1].split(/<li\b[^>]*>/i).slice(1);
  const turnos: TurnoColegio[] = [];

  items.forEach((item, indice) => {
    const texto = textoPlano(item.split(/<\/li>/i)[0] ?? '');
    if (!texto) return; // el Colegio deja un <li> vacío al final de la lista
    const partes = separarNombreYDireccion(texto);
    if (!partes) return;
    turnos.push({ dia: indice + 1, nombre: partes[0], direccion: partes[1] });
  });

  return turnos;
}

const LINEA_DIRECTORIO = /^(.+?)\s+[–—-]\s+Dirección:\s*(.+?)\s+[–—-]\s+Tel\.?\s*([\d\s\-()]+)$/i;

/** Directorio "NOMBRE – Dirección: ... – Tel. ..." que viene arriba del organigrama. */
function leerDirectorio(html: string): FarmaciaColegio[] {
  const directorio: FarmaciaColegio[] = [];

  for (const linea of textoPlano(html).split('\n')) {
    const partes = LINEA_DIRECTORIO.exec(linea);
    if (!partes) continue;
    const nombre = partes[1].trim();
    if (directorio.some((farmacia) => normalizarNombre(farmacia.nombre) === normalizarNombre(nombre))) continue;
    directorio.push({ nombre, direccion: partes[2].trim(), telefono: partes[3].trim() });
  }

  return directorio;
}

/**
 * Parsea la página del Colegio. Falla con un mensaje claro en vez de devolver
 * datos parciales: un organigrama a medias es peor que no importar nada.
 */
export function parsearPaginaColegio(html: string): OrganigramaColegio {
  const titulo = /Farmacias de Turno\s+Mes\s+([\p{L}]+)\s+(\d{4})/iu.exec(html);
  if (!titulo) {
    throw new Error('No se pudo reconocer el mes: el título de la página del Colegio cambió de formato.');
  }

  const mes = MESES[sinAcentos(titulo[1]).toLowerCase()];
  if (!mes) {
    throw new Error(`No se reconoció el mes "${titulo[1]}" en la página del Colegio.`);
  }

  const anio = Number(titulo[2]);
  const turnos = leerTurnos(html, titulo.index);
  if (turnos.length < MINIMO_DIAS) {
    throw new Error(
      `La página del Colegio no trae el organigrama del mes (se reconocieron ${turnos.length} día(s)).`
    );
  }

  return { anio, mes, turnos, directorio: leerDirectorio(html) };
}

export interface FarmaciaMapeable {
  id: string;
  name: string;
  alias: string[];
}

/** Claves con las que una farmacia cargada puede matchear un nombre del Colegio. */
function claves(farmacia: FarmaciaMapeable): string[] {
  return [normalizarNombre(farmacia.name), ...farmacia.alias.map((alias) => normalizarNombre(alias))];
}

/** Farmacias cuyo nombre o alias arranca con el nombre del Colegio. */
function candidatosPorPrefijo(nombre: string, farmacias: FarmaciaMapeable[]): FarmaciaMapeable[] {
  const buscado = normalizarNombre(nombre);
  if (!buscado) return [];
  return farmacias.filter((farmacia) => claves(farmacia).some((clave) => clave.startsWith(`${buscado} `)));
}

/**
 * Farmacia que corresponde a un nombre del Colegio: primero por coincidencia
 * exacta con el nombre o algún alias, después por prefijo ("ABELENDA" →
 * "ABELENDA CABRAL"). Si el prefijo apunta a más de una farmacia no se resuelve
 * solo, porque elegir mal dejaría el turno en la farmacia equivocada.
 */
export function resolverFarmacia(nombre: string, farmacias: FarmaciaMapeable[]): string | null {
  const buscado = normalizarNombre(nombre);
  if (!buscado) return null;

  const exacta = farmacias.find((farmacia) => claves(farmacia).includes(buscado));
  if (exacta) return exacta.id;

  const candidatos = candidatosPorPrefijo(nombre, farmacias);
  return candidatos.length === 1 ? candidatos[0].id : null;
}

/**
 * Sugerencia para un nombre que no se pudo resolver: la primera farmacia cuyo
 * nombre o alias empieza con el nombre del Colegio. El panel la muestra
 * preseleccionada y el usuario la puede cambiar.
 */
export function sugerirFarmacia(nombre: string, farmacias: FarmaciaMapeable[]): FarmaciaMapeable | null {
  return candidatosPorPrefijo(nombre, farmacias)[0] ?? null;
}

export interface TurnoActual {
  fecha: string;
  pharmacyId: string;
  pharmacyName: string;
  origen: string;
}

export type EstadoDia = 'igual' | 'cambia' | 'nuevo' | 'sin-mapear';

export interface DiaImportacion {
  dia: number;
  fecha: string;
  /** Nombre tal como viene del Colegio: es la clave del mapeo. */
  nombre: string;
  direccion: string;
  pharmacyId: string | null;
  pharmacyName: string | null;
  estado: EstadoDia;
  actualName: string | null;
  actualOrigen: string | null;
}

export interface NombreSinMapear {
  nombre: string;
  dias: number;
  sugerenciaId: string | null;
  sugerenciaNombre: string | null;
  /** También figura en el directorio de la página. */
  enDirectorio: boolean;
  /** Dirección para dar de alta la farmacia: la del directorio manda. */
  direccion: string;
  telefono: string | null;
}

export interface DiffImportacion {
  anio: number;
  mes: number;
  dias: DiaImportacion[];
  sinMapear: NombreSinMapear[];
  /**
   * Días del mes con turno cargado que el Colegio no publica. Confirmar la
   * importación no los toca: son días que se cargaron a mano o de otro mes y
   * borrarlos sin pedirlo sería peor que dejarlos.
   */
  sinDatos: { fecha: string; pharmacyName: string; origen: string }[];
  directorio: (FarmaciaColegio & { pharmacyId: string | null })[];
  resumen: { total: number; iguales: number; cambian: number; nuevos: number; sinMapear: number };
}

function isoDe(anio: number, mes: number, dia: number): string {
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/**
 * Compara lo que publica el Colegio contra lo que ya está cargado, sin escribir
 * nada. Los días se clasifican en iguales, con cambio, nuevos y sin mapear.
 */
export function construirDiff(
  organigrama: OrganigramaColegio,
  farmacias: FarmaciaMapeable[],
  actuales: TurnoActual[]
): DiffImportacion {
  const porFecha = new Map(actuales.map((turno) => [turno.fecha, turno]));
  const nombrePorId = new Map(farmacias.map((farmacia) => [farmacia.id, farmacia.name]));

  const dias = organigrama.turnos.map<DiaImportacion>((turno) => {
    const fecha = isoDe(organigrama.anio, organigrama.mes, turno.dia);
    const actual = porFecha.get(fecha) ?? null;
    const pharmacyId = resolverFarmacia(turno.nombre, farmacias);

    const estado: EstadoDia = !pharmacyId
      ? 'sin-mapear'
      : !actual
        ? 'nuevo'
        : actual.pharmacyId === pharmacyId
          ? 'igual'
          : 'cambia';

    return {
      dia: turno.dia,
      fecha,
      nombre: turno.nombre,
      direccion: turno.direccion,
      pharmacyId,
      pharmacyName: pharmacyId ? nombrePorId.get(pharmacyId) ?? null : null,
      estado,
      actualName: actual?.pharmacyName ?? null,
      actualOrigen: actual?.origen ?? null
    };
  });

  const entradasDirectorio = organigrama.directorio.map((farmacia) => ({
    clave: normalizarNombre(farmacia.nombre),
    direccion: farmacia.direccion,
    telefono: farmacia.telefono
  }));

  /**
   * Entrada del directorio para un nombre del organigrama. El organigrama
   * abrevia ("ABELENDA") lo que el directorio escribe completo ("ABELENDA
   * CABRAL"), así que además de la coincidencia exacta se acepta el prefijo.
   */
  function entradaDirectorio(clave: string) {
    return (
      entradasDirectorio.find((entrada) => entrada.clave === clave) ??
      entradasDirectorio.find((entrada) => entrada.clave.startsWith(`${clave} `)) ??
      entradasDirectorio.find((entrada) => clave.startsWith(`${entrada.clave} `)) ??
      null
    );
  }

  const grupos = new Map<string, NombreSinMapear>();

  for (const dia of dias) {
    if (dia.estado !== 'sin-mapear') continue;
    const clave = normalizarNombre(dia.nombre);
    const datos = entradaDirectorio(clave);
    const grupo = grupos.get(clave) ?? {
      nombre: dia.nombre,
      dias: 0,
      sugerenciaId: null,
      sugerenciaNombre: null,
      enDirectorio: datos !== null,
      direccion: datos?.direccion ?? dia.direccion,
      telefono: datos?.telefono ?? null
    };
    grupo.dias += 1;
    grupos.set(clave, grupo);
  }

  const sinMapear = [...grupos.values()].map((grupo) => {
    const sugerida = sugerirFarmacia(grupo.nombre, farmacias);
    return { ...grupo, sugerenciaId: sugerida?.id ?? null, sugerenciaNombre: sugerida?.name ?? null };
  });

  const publicadas = new Set(dias.map((dia) => dia.fecha));
  const sinDatos: DiffImportacion['sinDatos'] = [];
  for (let dia = 1; dia <= diasDelMes(organigrama.anio, organigrama.mes); dia += 1) {
    const fecha = isoDe(organigrama.anio, organigrama.mes, dia);
    const actual = porFecha.get(fecha);
    if (actual && !publicadas.has(fecha)) {
      sinDatos.push({ fecha, pharmacyName: actual.pharmacyName, origen: actual.origen });
    }
  }

  return {
    anio: organigrama.anio,
    mes: organigrama.mes,
    dias,
    sinMapear,
    sinDatos,
    directorio: organigrama.directorio.map((farmacia) => ({
      ...farmacia,
      pharmacyId: resolverFarmacia(farmacia.nombre, farmacias)
    })),
    resumen: {
      total: dias.length,
      iguales: dias.filter((dia) => dia.estado === 'igual').length,
      cambian: dias.filter((dia) => dia.estado === 'cambia').length,
      nuevos: dias.filter((dia) => dia.estado === 'nuevo').length,
      sinMapear: dias.filter((dia) => dia.estado === 'sin-mapear').length
    }
  };
}
