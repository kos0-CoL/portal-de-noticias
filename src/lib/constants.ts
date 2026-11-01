/**
 * Constantes globales del portal.
 * Todo el texto de marca y las listas de navegacion salen de aca para que
 * un cambio de nombre comercial no obligue a tocar componentes.
 */

/** Nombre de la cookie de sesión del backoffice.
 *  Vive acá (y no en `auth.ts`) porque `middleware.ts` corre en Edge runtime y
 *  no puede importar un módulo que arrastre bcryptjs ni Prisma. */
export const SESSION_COOKIE = 'sn_session';

export const SITE = {
  name: 'Saladillo Noticias',
  shortName: 'Saladillo',
  tagline: 'El diario de nuestra ciudad',
  city: 'Saladillo',
  province: 'Buenos Aires',
  country: 'Argentina',
  latitude: -35.6386,
  longitude: -59.7789,
  timezone: 'America/Argentina/Buenos_Aires',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  email: 'redaccion@saladillonoticias.com.ar',
  phone: '+54 2344 45-0000'
} as const;

/** Localidades del partido de Saladillo + parajes relevantes para el filtro local. */
export const LOCALIDADES = [
  'Saladillo',
  'Del Carril',
  'Cazón',
  'Polvaredas',
  'Juan José Paso',
  'Álvarez de Toledo',
  'La Barrancosa',
  'Saladillo Norte'
] as const;

/** Palabras de contexto institucional que tambien disparan prioridad alta. */
export const TERMINOS_INSTITUCIONALES = [
  'Intendencia',
  'Concejo Deliberante',
  'Municipalidad de Saladillo',
  'Hospital Posadas',
  'Hospital Zonal',
  'Bomberos Voluntarios',
  'Policía Comunal',
  'Juzgado de Paz',
  'Delegación',
  'Sociedad Rural',
  'Cooperativa Eléctrica'
] as const;

export const ZONAS = [
  { id: 'Centro', label: 'Centro' },
  { id: 'Norte', label: 'Zona Norte' },
  { id: 'Sur', label: 'Zona Sur' },
  { id: 'Del Carril', label: 'Del Carril' },
  { id: 'Cazón', label: 'Cazón' },
  { id: 'Polvaredas', label: 'Polvaredas' }
] as const;

/** Opciones de tono que se le pasan al motor de IA desde el panel. */
export const TONALIDADES = [
  {
    value: 'INFORMATIVO_NEUTRAL',
    label: 'Informativo y Neutral',
    description: 'Estilo periodístico clásico: hechos, fuentes y cierre. Sin adjetivos innecesarios.'
  },
  {
    value: 'CERCANO_LOCAL',
    label: 'Cercano y Local',
    description: 'Adaptado a la comunidad de Saladillo, con lenguaje cotidiano y referencias a la ciudad.'
  },
  {
    value: 'LLAMATIVO_CLICKBAIT',
    label: 'Llamativo y Clickbait',
    description: 'Titulares de alto impacto pensados para redes sociales. Sin perder veracidad.'
  },
  {
    value: 'FORMAL_SERIO',
    label: 'Formal y Serio',
    description: 'Registro protocolar para política, economía y actos oficiales.'
  }
] as const;

export type TonabilidadValue = (typeof TONALIDADES)[number]['value'];

export const NAV_MENU = [
  { label: 'Inicio', href: '/' },
  { label: 'Policiales', href: '/categoria/policiales' },
  { label: 'Política', href: '/categoria/politica' },
  { label: 'Deportes', href: '/categoria/deportes' },
  { label: 'Interés General', href: '/categoria/interes-general' },
  { label: 'Clasificados', href: '/clasificados' }
] as const;

/** Secciones del módulo de Clasificados de la comunidad. */
export const SECCIONES_CLASIFICADOS = ['Empleos', 'Inmuebles', 'Vehículos', 'Servicios', 'Comunidad'] as const;

/** Cantidad máxima de fotos que admite un aviso clasificado. */
export const MAX_FOTOS_CLASIFICADO = 3;

/** Días de vigencia de un aviso desde que se aprueba. */
export const DIAS_VIGENCIA_CLASIFICADO = 30;

export const ZONA_LABELS: Record<string, string> = {
  HEADER: 'Cabecera (leaderboard)',
  HOME_TOP: 'Home - debajo del destacado',
  INLINE_ARTICLE: 'Dentro de la nota',
  SIDEBAR: 'Barra lateral',
  FOOTER: 'Pie de página',
  MOBILE_STICKY: 'Celular - anclado abajo'
};

export const ESTADO_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  PENDING_REVIEW: 'Pendiente de revisión',
  PUBLISHED: 'Publicada',
  ARCHIVED: 'Archivada'
};

export const PRIORIDAD_LABELS: Record<string, string> = {
  NORMAL: 'Normal',
  ALTA: 'Prioridad Alta',
  URGENTE: 'Urgente'
};

/** Zonas de banner que se renderizan en el sitio publico, en orden de aparicion. */
export const ZONAS_PUBLICAS = [
  'HEADER',
  'HOME_TOP',
  'INLINE_ARTICLE',
  'SIDEBAR',
  'FOOTER',
  'MOBILE_STICKY'
] as const;

export type ZonaPublica = (typeof ZONAS_PUBLICAS)[number];
