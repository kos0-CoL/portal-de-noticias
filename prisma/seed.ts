/**
 * Seed del portal de noticias de Saladillo.
 *
 * Ejecutar con:  npm run db:seed
 *
 * Todo el contenido es de ejemplo/ficcion y sirve para ver el portal funcionando
 * con volumen realista desde el primer arranque.
 */
import { PrismaClient, ArticleStatus, ArticlePriority, AiTonality, BannerType, BannerZone, SocialNetwork, KeywordType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { SITE } from '../src/lib/constants';

const prisma = new PrismaClient();

/** Genera una URL de imagen real para las notas de ejemplo. */
function img(prompt: string, size: 'landscape_4_3' | 'square' | 'landscape_16_9' = 'landscape_4_3') {
  return `https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=${encodeURIComponent(prompt)}&image_size=${size}`;
}

function slug(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function countWords(html: string) {
  return html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
}

const CATEGORIAS = [
  { name: 'Policiales', slug: 'policiales', color: '#7F1D1D', iconName: 'ShieldAlert', position: 1, description: 'Hechos de inseguridad, accidentes y justicia en Saladillo y la zona.' },
  { name: 'Política', slug: 'politica', color: '#1A3C69', iconName: 'Landmark', position: 2, description: 'Municipalidad, Concejo Deliberante, gestión y obras públicas.' },
  { name: 'Deportes', slug: 'deportes', color: '#065F46', iconName: 'Trophy', position: 3, description: 'Liga Saladillo de fútbol, básquet, automovilismo y deportes amateur.' },
  { name: 'Interés General', slug: 'interes-general', color: '#234E86', iconName: 'Newspaper', position: 4, description: 'Comunidad, salud, educación, cultura y servicios de la ciudad.' },
  { name: 'Clasificados', slug: 'clasificados', color: '#B45309', iconName: 'Store', position: 5, description: 'Avisos de la comunidad: empleos, inmuebles, vehículos y servicios.' },
  { name: 'Agro', slug: 'agro', color: '#3F6212', iconName: 'Tractor', position: 6, description: 'Campo, ganadería, soja y la rural de Saladillo.' }
];

const KEYWORDS = [
  { word: 'Saladillo', type: KeywordType.LOCALIDAD, weight: 10 },
  { word: 'Del Carril', type: KeywordType.LOCALIDAD, weight: 10 },
  { word: 'Cazón', type: KeywordType.LOCALIDAD, weight: 10 },
  { word: 'Polvaredas', type: KeywordType.LOCALIDAD, weight: 9 },
  { word: 'Juan José Paso', type: KeywordType.LOCALIDAD, weight: 8 },
  { word: 'Álvarez de Toledo', type: KeywordType.LOCALIDAD, weight: 8 },
  { word: 'La Barrancosa', type: KeywordType.LOCALIDAD, weight: 7 },
  { word: 'Intendencia', type: KeywordType.FUNCIONARIO, weight: 8 },
  { word: 'Concejo Deliberante', type: KeywordType.FUNCIONARIO, weight: 8 },
  { word: 'Municipalidad de Saladillo', type: KeywordType.FUNCIONARIO, weight: 9 },
  { word: 'Hospital Posadas', type: KeywordType.TEMA, weight: 8 },
  { word: 'Bomberos Voluntarios', type: KeywordType.TEMA, weight: 7 },
  { word: 'Policía Comunal', type: KeywordType.FUNCIONARIO, weight: 7 },
  { word: 'Sociedad Rural de Saladillo', type: KeywordType.TEMA, weight: 7 },
  { word: 'Cooperativa Eléctrica', type: KeywordType.TEMA, weight: 6 }
];

interface SeedArticle {
  title: string;
  summary: string;
  content: string;
  category: string;
  priority?: ArticlePriority;
  featured?: boolean;
  breaking?: boolean;
  hoursAgo: number;
  tags: string[];
  tonality?: AiTonality;
  imagePrompt: string;
  fromScraper?: { source: string; url: string };
}

const NOTAS: SeedArticle[] = [
  {
    title: 'Saladillo puso en marcha el operativo de prevención vial en la Ruta 205',
    summary:
      'La Municipalidad junto a la Policía Comunal desplegó controles de alcoholemia y documentación sobre el acceso norte. El operativo se repetirá todos los fines de semana largos.',
    category: 'policiales',
    priority: ArticlePriority.URGENTE,
    featured: true,
    breaking: true,
    hoursAgo: 1,
    tags: ['Saladillo', 'Ruta 205', 'Seguridad Vial', 'Policía Comunal'],
    tonality: AiTonality.INFORMATIVO_NEUTRAL,
    imagePrompt:
      'Portal de noticias local: control policial nocturno sobre una ruta provincial argentina, patrulla con balizas azules, conos sobre el asfalto, fotografía periodística realista, luz nocturna',
    content: `<p>La Municipalidad de Saladillo y la Policía Comunal activaron este viernes un operativo de prevención vial sobre el kilómetro 187 de la Ruta Provincial 205, en el acceso norte a la ciudad. El despliegue incluyó controles de alcoholemia, verificación de documentación y revisión de las condiciones técnicas de los vehículos.</p>
<p>Según informaron desde la Secretaría de Seguridad, durante las primeras cuatro horas se fiscalizaron 212 vehículos, se labraron 19 actas por infracciones y se retuvieron seis licencias por resultado positivo de alcohol en sangre.</p>
<h2>Cómo sigue el cronograma</h2>
<p>El dispositivo continuará los días sábado y domingo en distintos puntos de la ciudad, con especial atención a los accesos y a las zonas cercanas a los clubes, donde se concentra mayor circulación nocturna.</p>
<blockquote>“La idea no es recaudar, es bajar los siniestros. El año pasado tuvimos una reducción del 22% en choques con lesionados en el ejido urbano y queremos sostener esa tendencia”, señaló el responsable del área de Tránsito.</blockquote>
<p>Desde el Hospital Zonal informaron que durante el último mes no se registraron ingresos graves por siniestros viales dentro del casco urbano, aunque reiteraron la recomendación de circular con las luces encendidas también de día.</p>
<h3>Recomendaciones para los vecinos</h3>
<ul>
<li>Circular con documentación y licencia vigente, incluso en trayectos cortos.</li>
<li>Respetar los límites de velocidad de 40 km/h en el casco urbano.</li>
<li>Usar casco en motos y ciclomotores, sin excepción.</li>
</ul>
<p>Los vecinos pueden denunciar emergencias al 911 o a la línea directa de la Policía Comunal.</p>`
  },
  {
    title: 'El Concejo Deliberante aprobó el presupuesto 2027 con foco en obras de agua potable',
    summary:
      'La ordenanza obtuvo siete votos a favor y dos abstenciones. Un tercio del presupuesto se destinará a la ampliación de la red de agua en barrios del sur de Saladillo.',
    category: 'politica',
    priority: ArticlePriority.ALTA,
    featured: true,
    hoursAgo: 5,
    tags: ['Concejo Deliberante', 'Presupuesto', 'Obras Públicas', 'Saladillo'],
    tonality: AiTonality.FORMAL_SERIO,
    imagePrompt:
      'Sala de un concejo deliberante argentino durante una sesión, ediles en bancas de madera, bandera argentina al fondo, fotografía documental seria, luz natural',
    content: `<p>El Concejo Deliberante de Saladillo aprobó por siete votos a favor y dos abstenciones la ordenanza del presupuesto municipal para el ejercicio 2027. La norma proyecta un incremento del 18% en términos reales respecto del año anterior y prioriza las obras de infraestructura sanitaria.</p>
<p>Del total previsto, un tercio se asignará a la ampliación de la red de agua potable en los barrios del sector sur, donde unas 900 familias todavía dependen de conexiones precarias. El proyecto contempla además la renovación de 14 kilómetros de cañerías en el casco céntrico.</p>
<h2>Los ejes del presupuesto</h2>
<ol>
<li>Ampliación y recambio de la red de agua potable y cloacas.</li>
<li>Repavimentación de 32 cuadras y mantenimiento de calles de tierra en los barrios periféricos.</li>
<li>Equipamiento para el Hospital Zonal y refuerzo del servicio de emergencias.</li>
<li>Programa de forestación urbana y mejora del alumbrado público con tecnología LED.</li>
</ol>
<blockquote>“Cada peso está asignado a una partida concreta. Vamos a publicar el detalle de ejecución trimestral en el portal del municipio para que cualquier vecino pueda controlarlo”, indicaron desde la comisión de Hacienda.</blockquote>
<p>Las abstenciones provinieron de los bloques que reclamaban mayor inversión en el sector educativo y un plan específico para la zona rural. Desde el Ejecutivo respondieron que el Fondo Educativo se maneja por separado y que el cronograma de caminos rurales se anunciará en las próximas semanas.</p>`
  },
  {
    title: 'Alumni le ganó a Del Carril en un clásico que se definió en el último minuto',
    summary:
      'El equipo de Saladillo se impuso 2 a 1 en el estadio municipal. El gol del triunfo llegó a los 47 minutos del segundo tiempo, de tiro libre, ante más de 1.500 personas.',
    category: 'deportes',
    featured: true,
    hoursAgo: 9,
    tags: ['Liga Saladillo', 'Fútbol', 'Del Carril', 'Alumni'],
    tonality: AiTonality.CERCANO_LOCAL,
    imagePrompt:
      'Partido de fútbol amateur en un estadio municipal argentino al atardecer, jugadores disputando una pelota, tribuna popular con banderas, fotografía deportiva realista',
    content: `<p>En una tarde que quedará en la memoria de los hinchas, Alumni se quedó con el clásico ante el equipo de Del Carril por 2 a 1, en un partido que se definió con un tiro libre ejecutado a los 47 minutos del complemento.</p>
<p>El local abrió el marcador a los 20 del primer tiempo con una definición cruzada tras una jugada colectiva. La visita empató en el arranque del segundo tiempo con un remate de media distancia que se metió junto al palo izquierdo del arquero local.</p>
<h2>El detalle que cambió el partido</h2>
<p>Con el empate, el técnico movió el banco y sumó dos delanteros. El premio llegó sobre el final: falta al borde del área y un zurdazo que se clavó en el ángulo. La tribuna explotó.</p>
<blockquote>“Este grupo trabaja desde enero para estos momentos. El clásico se gana con corazón y con orden, y hoy tuvimos las dos cosas”, dijo el capitán tras el partido.</blockquote>
<p>Con este resultado, Alumni suma 31 puntos y se acomoda en la parte alta de la tabla de la Liga de Saladillo, mientras que Del Carril queda obligado a sumar de a tres en la próxima fecha.</p>`
  },
  {
    title: 'Polvaredas tendrá su primera feria de emprendedores el próximo domingo',
    summary:
      'Más de 40 productores locales de Polvaredas, Cazón y Saladillo participarán de la feria en la plaza central, con gastronomía, artesanías y espectáculos en vivo.',
    category: 'interes-general',
    hoursAgo: 14,
    tags: ['Polvaredas', 'Emprendedores', 'Comunidad', 'Cazón'],
    tonality: AiTonality.CERCANO_LOCAL,
    imagePrompt:
      'Feria de emprendedores al aire libre en una plaza de pueblo argentino, puestos con toldos de colores, artesanías y comida regional, familias paseando, fotografía cálida de día',
    content: `<p>La localidad de Polvaredas se prepara para recibir el próximo domingo a más de 40 emprendedores de la zona en la primera edición de la Feria del Productor Local, que se desarrollará en la plaza central desde las 10 hasta las 19 horas.</p>
<p>La propuesta incluye puestos de gastronomía, artesanías en cuero y madera, viveros, productos de granja y una feria de emprendedores textiles. Durante toda la jornada habrá espectáculos musicales en vivo y actividades para chicos.</p>
<h2>Quiénes participan</h2>
<p>Según la organización, estarán presentes productores de Polvaredas, Cazón, Del Carril y Saladillo, además de tres cooperativas de la zona rural que ofrecerán miel, conservas y quesos artesanales.</p>
<blockquote>“Queremos que la gente del pueblo no tenga que viajar para comprar lo que se produce acá al lado. Esta feria es el primer paso”, explicaron desde la comisión organizadora.</blockquote>
<p>La entrada es libre y gratuita. Habrá servicio de cantina a cargo de la comisión de la capilla y estacionamiento señalizado sobre la avenida de acceso.</p>`
  },
  {
    title: 'Detuvieron a dos personas por una serie de robos en comercios del centro de Saladillo',
    summary:
      'La investigación se extendió durante tres semanas y permitió recuperar mercadería por más de cuatro millones de pesos. Los detenidos quedaron a disposición de la Justicia.',
    category: 'policiales',
    priority: ArticlePriority.ALTA,
    hoursAgo: 20,
    tags: ['Policiales', 'Saladillo', 'Seguridad', 'Justicia'],
    tonality: AiTonality.INFORMATIVO_NEUTRAL,
    imagePrompt:
      'Comisaría argentina de ciudad mediana, patrullero estacionado en la puerta, fotografía periodística documental, luz de día',
    content: `<p>Personal de la Policía Comunal de Saladillo detuvo a dos personas acusadas de integrar una banda dedicada a robos en comercios del centro. La investigación se extendió durante tres semanas y contó con el análisis de 60 horas de imágenes de cámaras de seguridad.</p>
<p>En los allanamientos realizados en dos domicilios se recuperó mercadería por un valor estimado en cuatro millones de pesos: indumentaria, herramientas eléctricas, telefonía y elementos de perfumería.</p>
<h2>Cómo operaban</h2>
<p>De acuerdo con la pesquisa, los detenidos ingresaban a los locales en horarios de mayor circulación, aprovechando la atención de los empleados sobre otros clientes. Luego trasladaban el material a un depósito que también fue allanado.</p>
<blockquote>“Es un trabajo que llevó tiempo y que se sostuvo con la colaboración de los comerciantes, que aportaron grabaciones y testigos”, informó la fuerza.</blockquote>
<p>Los detenidos quedaron a disposición del Juzgado de Garantías interviniente. Desde el municipio recordaron que los comercios pueden sumarse al programa de alarmas comunitarias y cámaras conectadas al centro de monitoreo.</p>`
  },
  {
    title: 'La Sociedad Rural de Saladillo confirmó la fecha de la 89ª Exposición de Ganadería',
    summary:
      'El tradicional evento se realizará en el predio del parque y contará con juras de reproductores, remate de hacienda y un pabellón de agroindustria con 120 expositores.',
    category: 'agro',
    hoursAgo: 26,
    tags: ['Sociedad Rural', 'Ganadería', 'Agro', 'Saladillo'],
    tonality: AiTonality.FORMAL_SERIO,
    imagePrompt:
      'Exposición rural argentina con bovinos de raza en pista de jura, cabañeros con chaleco, público observando, fotografía documental de campo, luz natural',
    content: `<p>La Sociedad Rural de Saladillo confirmó que la 89ª Exposición de Ganadería, Agricultura e Industria se desarrollará durante tres jornadas en el predio del parque rural, con entrada libre para los socios y acceso gratuito para menores de 12 años.</p>
<p>El programa incluye juras de reproductores de las razas Aberdeen Angus, Hereford y Limousin, un remate de hacienda en el que se ofrecerán más de 400 cabezas y un pabellón de agroindustria con 120 expositores.</p>
<h2>Actividades paralelas</h2>
<ul>
<li>Charla técnica sobre manejo de pastizales y reservas forrajeras.</li>
<li>Demostración de agricultura de precisión y drones de monitoreo.</li>
<li>Espacio de educación agropecuaria para escuelas rurales del partido.</li>
<li>Peña folclórica y desfile de agrupaciones tradicionalistas.</li>
</ul>
<blockquote>“La muestra es la vidriera de lo que produce el partido. Este año esperamos superar los 20.000 visitantes”, señalaron desde la comisión directiva.</blockquote>
<p>La organización informó que el transporte público llegará hasta el ingreso principal y que habrá sectores de estacionamiento vigilado sobre la ruta de acceso.</p>`
  },
  {
    title: 'Corte de energía programado en Del Carril: cuadras y horarios afectados',
    summary:
      'La Cooperativa Eléctrica informó un corte programado para el martes por tareas de mantenimiento en la línea de media tensión que abastece a la localidad.',
    category: 'interes-general',
    priority: ArticlePriority.ALTA,
    hoursAgo: 30,
    tags: ['Del Carril', 'Cooperativa Eléctrica', 'Servicios', 'Saladillo'],
    tonality: AiTonality.INFORMATIVO_NEUTRAL,
    imagePrompt:
      'Operarios de cooperativa eléctrica trabajando en poste de media tensión en un pueblo argentino, camión grúa, líneas de energía, fotografía documental de día',
    content: `<p>La Cooperativa Eléctrica de Saladillo comunicó que el próximo martes se realizará un corte programado de energía en la localidad de Del Carril, entre las 8 y las 13 horas, por tareas de mantenimiento sobre la línea de media tensión.</p>
<p>El corte afectará las cuadras comprendidas entre las calles Rivadavia y Sarmiento, desde Alem hasta la avenida de circunvalación, incluyendo el sector del parque industrial local.</p>
<h2>Recomendaciones</h2>
<ul>
<li>Desenchufar artefactos sensibles antes del inicio del corte.</li>
<li>Evitar el uso de ascensores durante la franja afectada.</li>
<li>Prever conservación de alimentos refrigerados y medicación que requiera cadena de frío.</li>
</ul>
<p>La entidad advirtió que, si las condiciones climáticas no son adecuadas, la intervención se reprogramará para el miércoles en el mismo horario y que cualquier cambio se comunicará por los canales oficiales.</p>
<p>Los vecinos pueden consultar el estado del servicio o reportar emergencias a la línea de guardia de la cooperativa, disponible las 24 horas.</p>`
  },
  {
    title: 'El Hospital Zonal incorporó un nuevo tomógrafo y amplía el servicio de imágenes',
    summary:
      'El equipamiento permitirá reducir los traslados a otras ciudades. La puesta en funcionamiento está prevista para la próxima semana, con turnos programados.',
    category: 'interes-general',
    priority: ArticlePriority.ALTA,
    hoursAgo: 38,
    tags: ['Hospital Posadas', 'Salud', 'Saladillo', 'Obras Públicas'],
    tonality: AiTonality.INFORMATIVO_NEUTRAL,
    imagePrompt:
      'Sala de diagnóstico por imágenes de un hospital público argentino con tomógrafo moderno, profesionales de salud con guardapolvo, fotografía institucional limpia',
    content: `<p>El Hospital Zonal de Saladillo recibió un nuevo tomógrafo computado que reemplaza al equipo que funcionaba desde hacía más de una década. La inversión fue financiada con fondos provinciales y aportes del municipio.</p>
<p>Con el nuevo equipamiento, el servicio de diagnóstico por imágenes podrá realizar estudios de mayor complejidad y reducir la cantidad de derivaciones a ciudades vecinas, que hasta ahora obligaban a los pacientes a trasladarse.</p>
<h2>Turnos y funcionamiento</h2>
<p>La puesta en funcionamiento está prevista para la próxima semana. Los turnos se asignarán por derivación médica y se coordinarán desde el área de Admisión del hospital, en el horario de 7 a 13.</p>
<blockquote>“Esto significa que un vecino con un cuadro agudo no tiene que viajar para hacerse el estudio. Es una mejora enorme en tiempos de atención”, explicó el director del nosocomio.</blockquote>
<p>Desde el hospital recordaron que el servicio de guardia funciona las 24 horas y que las consultas por turnos pueden realizarse personalmente o por teléfono.</p>`
  },
  {
    title: 'Vecinos de Cazón reclaman la repavimentación del acceso principal',
    summary:
      'Un grupo de frentistas presentó una nota en la delegación municipal pidiendo obras en el camino de ingreso, deteriorado por el tránsito de camiones.',
    category: 'politica',
    hoursAgo: 46,
    tags: ['Cazón', 'Obras Públicas', 'Comunidad', 'Saladillo'],
    tonality: AiTonality.CERCANO_LOCAL,
    imagePrompt:
      'Camino de acceso de tierra deteriorado en un pueblo rural argentino, con pozos y huellas de camiones, campo y casas al fondo, fotografía documental de día nublado',
    content: `<p>Un grupo de vecinos de Cazón presentó una nota en la delegación municipal para solicitar la repavimentación del camino de acceso principal, que presentó un deterioro significativo en los últimos meses por el tránsito constante de camiones de carga.</p>
<p>Los frentistas señalaron que en días de lluvia el ingreso se vuelve intransitable para vehículos particulares y que la ambulancia del servicio de emergencias ya tuvo demoras en llegar a la localidad en dos oportunidades.</p>
<h2>Qué piden</h2>
<ol>
<li>Repavimentación completa del tramo de ingreso, unos tres kilómetros.</li>
<li>Señalización horizontal y vertical, incluida la zona escolar.</li>
<li>Un plan de mantenimiento periódico con riego y perfilado.</li>
</ol>
<blockquote>“No estamos pidiendo una autopista, pedimos que se pueda entrar al pueblo cuando llueve”, resumió una de las vecinas firmantes.</blockquote>
<p>Desde la delegación confirmaron la recepción de la nota y señalaron que el expediente será girado al área de Obras Públicas para su evaluación técnica y presupuestaria. Se comprometieron a dar respuesta en el plazo de dos semanas.</p>`
  },
  {
    title: 'Bomberos Voluntarios de Saladillo suman un nuevo móvil para incendios forestales',
    summary:
      'El vehículo fue adquirido con fondos de una colecta comunitaria y aportes de empresas locales. Permitirá atender siniestros en la zona rural con mayor rapidez.',
    category: 'interes-general',
    hoursAgo: 54,
    tags: ['Bomberos Voluntarios', 'Saladillo', 'Comunidad', 'Prevención'],
    tonality: AiTonality.CERCANO_LOCAL,
    imagePrompt:
      'Camión de bomberos voluntarios argentinos con sirena y luces, cuartel de bomberos de pueblo, bomberos con uniforme de combate de incendios, fotografía institucional realista',
    content: `<p>El cuartel de Bomberos Voluntarios de Saladillo presentó un nuevo móvil equipado para el combate de incendios rurales y forestales. La unidad fue adquirida con el producido de una colecta comunitaria y el aporte de empresas de la zona.</p>
<p>El vehículo cuenta con tanque de 3.000 litros, bomba de alta presión, motobomba auxiliar y equipamiento de protección personal para una dotación de seis bomberos.</p>
<h2>Por qué importa</h2>
<p>Durante la última temporada, el cuartel atendió más de 40 incendios de pastizales en la zona rural del partido, varios de ellos en sectores de difícil acceso, donde la demora de los móviles tradicionales complicaba el trabajo.</p>
<blockquote>“Esto nos cambia la logística. Antes teníamos que hacer base con camionetas y esperar el apoyo. Ahora salimos con autonomía real”, contó el jefe del cuerpo activo.</blockquote>
<p>La institución agradeció a los vecinos y recordó que las donaciones siguen abiertas para completar el equipamiento de comunicaciones. También pidió extremar los recaudos con fuegos al aire libre durante los meses de mayor riesgo.</p>`
  },
  {
    title: 'Comenzó el ciclo de cine argentino en el Centro Cultural de Saladillo',
    summary:
      'La propuesta gratuita proyectará ocho películas nacionales durante los próximos dos meses, con debate posterior a cargo de docentes locales.',
    category: 'interes-general',
    hoursAgo: 62,
    tags: ['Cultura', 'Saladillo', 'Centro Cultural', 'Cine'],
    tonality: AiTonality.CERCANO_LOCAL,
    imagePrompt:
      'Sala de cine pequeña en un centro cultural argentino, butacas rojas, pantalla iluminada y público variado, ambiente cálido y comunitario, fotografía realista',
    content: `<p>Con una función inaugural a sala llena, comenzó el ciclo de cine argentino organizado por el Centro Cultural de Saladillo. La propuesta es libre y gratuita y contempla ocho proyecciones a lo largo de los próximos dos meses.</p>
<p>Cada función incluye un espacio de debate posterior coordinado por docentes de la Escuela de Artes y por integrantes de la biblioteca popular, que aportan material complementario sobre cada film.</p>
<h2>Programación</h2>
<ul>
<li>Funciones todos los jueves a las 20 horas en la sala principal.</li>
<li>Entrada libre por orden de llegada, con capacidad limitada a 180 butacas.</li>
<li>Ciclo paralelo de cortos realizados por estudiantes de Saladillo.</li>
</ul>
<blockquote>“La idea es que la gente vuelva a ver cine en comunidad, en pantalla grande y después se quede a charlar de lo que vio”, explicó la coordinadora del área de Cultura.</blockquote>
<p>Las instituciones educativas interesadas en asistir con cursos completos pueden reservar turnos especiales en la mañana comunicándose con el Centro Cultural.</p>`
  },
  {
    title: 'Un camión de carga volcó en la Ruta 51 sin heridos de gravedad',
    summary:
      'El hecho ocurrió a la altura del cruce con el camino a Polvaredas. El conductor fue asistido en el lugar y trasladado al hospital por control.',
    category: 'policiales',
    hoursAgo: 70,
    tags: ['Polvaredas', 'Ruta 51', 'Policiales', 'Tránsito'],
    tonality: AiTonality.INFORMATIVO_NEUTRAL,
    fromScraper: {
      source: 'Diario Regional Zona Sur',
      url: 'https://ejemplo-regional.com.ar/policiales/volco-camion-ruta-51'
    },
    imagePrompt:
      'Ruta argentina con un camión de carga volcado sobre la banquina, patrullero y bomberos asistiendo, paisaje rural pampeano, fotografía periodística realista de día',
    content: `<p>Un camión de carga que transportaba granos volcó esta mañana en el kilómetro 34 de la Ruta Provincial 51, a la altura del cruce con el camino que conecta con Polvaredas. El conductor, de 44 años, resultó con heridas leves y fue trasladado al hospital zonal por control.</p>
<p>Según las primeras pericias, el siniestro se habría producido por una pérdida de control del rodado en una curva de la traza, agravada por el estado de la banquina. No hubo otros vehículos involucrados.</p>
<h2>Estado de la ruta</h2>
<p>Personal de Vialidad y Bomberos Voluntarios trabajaron durante tres horas para retirar la carga y liberar un carril. La circulación se restableció por completo al mediodía, con control de velocidad en la zona.</p>
<p>Las autoridades recomiendan transitar el tramo con precaución durante los próximos días, en especial con vehículos de gran porte, y respetar la señalización provisoria colocada en el lugar.</p>`
  }
];

async function main() {
  console.log('🌱 Sembrando datos de Saladillo Noticias...');

  // ------------------------------------------------------------------ usuario
  const passwordHash = await bcrypt.hash('Saladillo2026!', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@saladillonoticias.com.ar' },
    update: {},
    create: {
      email: 'admin@saladillonoticias.com.ar',
      name: 'Dirección Periodística',
      passwordHash,
      role: 'ADMIN'
    }
  });
  console.log(`   ✓ Usuario admin: ${admin.email}`);

  // --------------------------------------------------------------- categorias
  const categorias: Record<string, string> = {};
  for (const cat of CATEGORIAS) {
    const row = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, color: cat.color, iconName: cat.iconName, position: cat.position, description: cat.description },
      create: cat
    });
    categorias[cat.slug] = row.id;
  }
  console.log(`   ✓ ${CATEGORIAS.length} categorías`);

  // ----------------------------------------------------------------- keywords
  for (const kw of KEYWORDS) {
    await prisma.keyword.upsert({ where: { word: kw.word }, update: { weight: kw.weight, type: kw.type }, create: kw });
  }
  console.log(`   ✓ ${KEYWORDS.length} palabras clave locales`);

  // ------------------------------------------------------- farmacias de turno
  const farmacias = [
    { name: 'Farmacia Del Pueblo', address: 'Av. San Martín 2345, Saladillo', phone: '2344-451234' },
    { name: 'Farmacia Central', address: 'Belgrano 1120, Saladillo', phone: '2344-452345' },
    { name: 'Farmacia Rivadavia', address: 'Rivadavia 890, Saladillo', phone: '2344-453456' },
    { name: 'Farmacia Del Carril', address: 'Sarmiento 145, Del Carril', phone: '2344-454567' }
  ];
  const farmaciaIds: string[] = [];
  for (const f of farmacias) {
    const existing = await prisma.pharmacy.findFirst({ where: { name: f.name } });
    const row = existing ?? (await prisma.pharmacy.create({ data: f }));
    farmaciaIds.push(row.id);
  }
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  for (let i = 0; i < 14; i++) {
    const fecha = new Date(hoy);
    fecha.setDate(hoy.getDate() + i);
    const pharmacyId = farmaciaIds[i % farmaciaIds.length];
    await prisma.pharmacyShift.upsert({
      where: { pharmacyId_date: { pharmacyId, date: fecha } },
      update: {},
      create: { pharmacyId, date: fecha, note: i % 4 === 0 ? 'Turno de 24 horas' : null }
    });
  }
  console.log('   ✓ Farmacias de turno (14 días)');

  // ------------------------------------------------------------------ fuentes
  const fuente1 = await prisma.source.upsert({
    where: { id: 'seed-source-regional' },
    update: {},
    create: {
      id: 'seed-source-regional',
      name: 'Diario Regional Zona Sur',
      baseUrl: 'https://ejemplo-regional.com.ar',
      isActive: true,
      rotateUserAgent: true,
      requestDelayMs: 2000,
      maxItemsPerRun: 15,
      crawlSelector: 'article a.titulo',
      articleSelector: 'div.entry-content',
      titleSelector: 'h1.post-title',
      imageSelector: 'figure img',
      scheduleCron: '0 */3 * * *'
    }
  });
  const fuente2 = await prisma.source.upsert({
    where: { id: 'seed-source-provincia' },
    update: {},
    create: {
      id: 'seed-source-provincia',
      name: 'Portal Provincia de Buenos Aires',
      baseUrl: 'https://ejemplo-provincia.gob.ar',
      isActive: true,
      rotateUserAgent: true,
      requestDelayMs: 1500,
      maxItemsPerRun: 20,
      usePuppeteer: false,
      scheduleCron: '0 */6 * * *'
    }
  });

  await prisma.sourceCategoryMapping.upsert({
    where: { sourceId_externalCategoryUrl: { sourceId: fuente1.id, externalCategoryUrl: 'https://ejemplo-regional.com.ar/seguridad' } },
    update: {},
    create: {
      sourceId: fuente1.id,
      externalCategoryName: 'Seguridad',
      externalCategoryUrl: 'https://ejemplo-regional.com.ar/seguridad',
      localCategoryId: categorias['policiales']
    }
  });
  await prisma.sourceCategoryMapping.upsert({
    where: { sourceId_externalCategoryUrl: { sourceId: fuente1.id, externalCategoryUrl: 'https://ejemplo-regional.com.ar/politica' } },
    update: {},
    create: {
      sourceId: fuente1.id,
      externalCategoryName: 'Política',
      externalCategoryUrl: 'https://ejemplo-regional.com.ar/politica',
      localCategoryId: categorias['politica']
    }
  });
  await prisma.sourceCategoryMapping.upsert({
    where: { sourceId_externalCategoryUrl: { sourceId: fuente2.id, externalCategoryUrl: 'https://ejemplo-provincia.gob.ar/noticias/rural' } },
    update: {},
    create: {
      sourceId: fuente2.id,
      externalCategoryName: 'Rural',
      externalCategoryUrl: 'https://ejemplo-provincia.gob.ar/noticias/rural',
      localCategoryId: categorias['agro']
    }
  });
  console.log('   ✓ 2 fuentes de scraping con mapeo de categorías');

  // ------------------------------------------------------------------- notas
  const allTags = new Map<string, string>();
  let creadas = 0;

  for (const nota of NOTAS) {
    const existing = await prisma.article.findUnique({ where: { slug: slug(nota.title) } });
    if (existing) continue;

    const publishedAt = new Date(Date.now() - nota.hoursAgo * 3600 * 1000);
    const tagIds: string[] = [];
    for (const t of nota.tags) {
      const tagSlug = slug(t);
      let tagId = allTags.get(tagSlug);
      if (!tagId) {
        const tagRow = await prisma.tag.upsert({ where: { slug: tagSlug }, update: {}, create: { name: t, slug: tagSlug } });
        tagId = tagRow.id;
        allTags.set(tagSlug, tagId);
      }
      tagIds.push(tagId);
    }

    const coverImage = img(nota.imagePrompt);
    const words = countWords(nota.content);

    const created = await prisma.article.create({
      data: {
        title: nota.title,
        slug: slug(nota.title),
        summary: nota.summary,
        content: nota.content,
        coverImage,
        coverImageAlt: nota.title,
        status: ArticleStatus.PUBLISHED,
        priority: nota.priority ?? ArticlePriority.NORMAL,
        metaTitle: nota.title.length > 60 ? `${nota.title.slice(0, 57)}...` : nota.title,
        metaDescription: nota.summary.slice(0, 158),
        socialSummary: `${nota.summary.slice(0, 140)} Leé la nota completa en Saladillo Noticias.`,
        focusKeyword: nota.tags[0],
        ogImage: coverImage,
        readingTime: Math.max(1, Math.round(words / 200)),
        wordCount: words,
        views: 120 + creadas * 37,
        isFeatured: Boolean(nota.featured),
        isBreaking: Boolean(nota.breaking),
        publishedAt,
        aiTonality: nota.tonality ?? AiTonality.INFORMATIVO_NEUTRAL,
        aiRewritten: Boolean(nota.fromScraper),
        aiModel: nota.fromScraper ? 'gpt-4o-mini (simulado)' : null,
        aiCitesSource: Boolean(nota.fromScraper),
        categoryId: categorias[nota.category],
        authorId: admin.id,
        tags: { connect: tagIds.map((id) => ({ id })) }
      }
    });

    if (nota.fromScraper) {
      await prisma.scrapedItem.create({
        data: {
          sourceId: fuente1.id,
          title: nota.title,
          url: nota.fromScraper.url,
          rawContent: nota.content,
          rawImageUrl: coverImage,
          externalCategory: 'Seguridad',
          matchedKeywords: ['Saladillo', 'Polvaredas'],
          priority: ArticlePriority.ALTA,
          status: 'PROCESSED',
          contentHash: `seed-${slug(nota.title)}`,
          processedAt: new Date(),
          article: { connect: { id: created.id } }
        }
      });
    }
    creadas++;
  }
  console.log(`   ✓ ${creadas} notas publicadas`);

  // ---------------------------------------------------------------- banners
  const bannerSeed = [
    {
      name: 'Panadería La Espiga — Home superior',
      advertiser: 'Panadería La Espiga',
      zone: BannerZone.HOME_TOP,
      imageUrl: img('Banner publicitario horizontal para una panadería artesanal argentina, panes y facturas sobre mesa de madera, tonos cálidos, diseño limpio con espacio para texto, estilo comercial', 'landscape_16_9'),
      targetUrl: 'https://ejemplo-comercio.com.ar',
      weight: 2
    },
    {
      name: 'Ferretería Central — Barra lateral',
      advertiser: 'Ferretería Central',
      zone: BannerZone.SIDEBAR,
      imageUrl: img('Banner publicitario vertical para una ferretería de barrio, herramientas y pintura ordenadas, fondo azul oscuro, diseño corporativo moderno, espacio para texto', 'square'),
      targetUrl: 'https://ejemplo-comercio.com.ar',
      weight: 1
    },
    {
      name: 'Seguros Saladillo — dentro de la nota',
      advertiser: 'Seguros Saladillo',
      zone: BannerZone.INLINE_ARTICLE,
      imageUrl: img('Banner publicitario horizontal para una aseguradora local argentina, íconos de auto y hogar, paleta azul institucional, diseño limpio y profesional', 'landscape_16_9'),
      targetUrl: 'https://ejemplo-comercio.com.ar',
      weight: 1
    },
    {
      name: 'Google AdSense — cabecera',
      advertiser: 'Google AdSense',
      zone: BannerZone.HEADER,
      type: BannerType.ADSENSE,
      adSlot: '1234567890',
      weight: 1
    }
  ];
  for (const b of bannerSeed) {
    const exists = await prisma.banner.findFirst({ where: { name: b.name } });
    if (!exists) {
      await prisma.banner.create({
        data: { ...b, type: b.type ?? BannerType.IMAGE, isActive: true }
      });
    }
  }
  console.log(`   ✓ ${bannerSeed.length} banners publicitarios`);

  // --------------------------------------------------------------- canales RRSS
  const canales = [
    { network: SocialNetwork.FACEBOOK, name: 'Página de Facebook — Saladillo Noticias', chatId: 'pagina-fb-001', autoPublish: true },
    { network: SocialNetwork.INSTAGRAM, name: 'Instagram — @saladillonoticias', chatId: 'ig-001', autoPublish: false },
    { network: SocialNetwork.TELEGRAM, name: 'Canal de Telegram — Saladillo Al Instante', chatId: '@saladilloalinstante', autoPublish: true },
    { network: SocialNetwork.WHATSAPP, name: 'WhatsApp Canal — Comunidad', chatId: 'canal-wa-001', autoPublish: false }
  ];
  for (const c of canales) {
    const exists = await prisma.socialChannel.findFirst({ where: { name: c.name } });
    if (!exists) {
      await prisma.socialChannel.create({
        data: { ...c, isActive: true, webhookUrl: 'https://hook.ejemplo.com/saladillo-noticias' }
      });
    }
  }
  console.log(`   ✓ ${canales.length} canales de difusión`);

  // ------------------------------------------------------------ clasificados
  const clasificados = [
    {
      title: 'Se busca oficial de albañilería con experiencia',
      description: 'Empresa constructora de Saladillo busca oficial de albañilería con experiencia mínima de 3 años. Trabajo en obra en el casco urbano. Se ofrece obra social y presentismo.',
      section: 'Empleos',
      price: null,
      contactName: 'Constructora del Centro',
      contactPhone: '2344-456789',
      imagePrompt: 'Obrero de la construcción argentino colocando ladrillos en una obra en construcción, casco y herramientas, luz de día, fotografía documental realista'
    },
    {
      title: 'Alquilo casa 3 dormitorios en Del Carril',
      description: 'Casa de 3 dormitorios, living comedor, cocina equipada, patio con parrilla y cochera. Muy luminosa, a cuatro cuadras de la plaza. Contrato por 24 meses.',
      section: 'Inmuebles',
      price: 380000,
      contactName: 'María Fernández',
      contactPhone: '2344-457890',
      imagePrompt: 'Frente de una casa de barrio argentina con jardín y cochera, rejas y árboles, día soleado, fotografía inmobiliaria realista'
    },
    {
      title: 'Vendo Fiat Cronos 2021 con 42.000 km',
      description: 'Fiat Cronos Drive 1.3, 2021, 42.000 km reales, único dueño, service oficial al día, cubiertas nuevas, aire acondicionado, financiación con tarjeta.',
      section: 'Vehículos',
      price: 16500000,
      contactName: 'Javier Ruiz',
      contactPhone: '2344-458901',
      imagePrompt: 'Automóvil sedán gris estacionado en una calle de ciudad argentina, vista tres cuartos delantera, luz natural, fotografía de venta de auto realista'
    },
    {
      title: 'Clases particulares de matemática y física',
      description: 'Profesor con 10 años de experiencia ofrece clases de apoyo para nivel secundario y preuniversitario. Modalidad presencial en Saladillo o virtual. Preparación de exámenes de ingreso.',
      section: 'Servicios',
      price: 8000,
      contactName: 'Prof. Lucas Ibáñez',
      contactPhone: '2344-459012',
      imagePrompt: 'Profesor dando clases particulares de matemática en un escritorio con cuaderno y calculadora, apuntes y gráficos, luz cálida, fotografía realista'
    }
  ];
  for (const c of clasificados) {
    const exists = await prisma.classified.findFirst({ where: { title: c.title } });
    if (!exists) {
      const portada = img(c.imagePrompt);
      await prisma.classified.create({
        data: {
          title: c.title,
          description: c.description,
          section: c.section,
          price: c.price,
          contactName: c.contactName,
          contactPhone: c.contactPhone,
          status: 'PUBLISHED',
          currency: 'ARS',
          expiresAt: new Date(Date.now() + 30 * 86400000),
          imageUrl: portada,
          images: { create: [{ url: portada, position: 0 }] }
        }
      });
    }
  }
  console.log(`   ✓ ${clasificados.length} clasificados`);

  // --------------------------------------------------------------- settings
  const settingsSeed: { key: string; value: unknown; group: string }[] = [
    { key: 'ai.defaultTonality', value: 'CERCANO_LOCAL', group: 'ia' },
    { key: 'ai.citeSource', value: true, group: 'ia' },
    { key: 'ai.rewriteEnabled', value: true, group: 'ia' },
    { key: 'ai.temperature', value: 0.75, group: 'ia' },
    { key: 'ai.provider', value: 'openai', group: 'ia' },
    { key: 'ai.model', value: 'gpt-4o-mini', group: 'ia' },
    {
      key: 'image.watermark',
      value: { enabled: true, text: 'Saladillo Noticias', opacity: 0.35, position: 'southeast', logoUrl: null },
      group: 'imagenes'
    },
    { key: 'image.maxWidth', value: 1600, group: 'imagenes' },
    { key: 'image.quality', value: 82, group: 'imagenes' },
    {
      key: 'scraper.defaults',
      value: { requestDelayMs: 1500, maxItemsPerRun: 20, rotateUserAgent: true, respectRobots: true },
      group: 'scraping'
    },
    { key: 'social.autoPublish', value: false, group: 'difusion' }
  ];
  for (const s of settingsSeed) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: {},
      create: { key: s.key, value: s.value as object, group: s.group, isSecret: false }
    });
  }
  console.log(`   ✓ ${settingsSeed.length} ajustes de configuración`);

  // ------------------------------------------------------------ paginas legales
  const paginasLegales = [
    {
      slug: 'privacidad',
      title: 'Política de Privacidad',
      content: `<h1>Política de Privacidad</h1><p>En ${SITE.name} respetamos tu privacidad. Esta política explica qué información recopilamos, cómo la usamos y cómo la protegemos.</p><h2>Información que recopilamos</h2><p>Podemos recopilar datos personales como nombre, correo electrónico y teléfono cuando te contactás a través de nuestros formularios.</p><h2>Uso de la información</h2><p>La información se usa para responder consultas, enviarte noticias y mejorar nuestros servicios.</p><h2>Derechos del usuario</h2><p>Podés acceder, rectificar o solicitar la eliminación de tus datos escribiendo a ${SITE.email}.</p>`,
      metaTitle: 'Política de Privacidad — Saladillo Noticias',
      metaDescription: 'Conocé cómo recopilamos, usamos y protegemos tus datos personales en Saladillo Noticias.',
      isActive: true
    },
    {
      slug: 'terminos',
      title: 'Términos y Condiciones',
      content: `<h1>Términos y Condiciones</h1><p>Al acceder y usar ${SITE.name} aceptás los siguientes términos y condiciones.</p><h2>Uso del sitio</h2><p>El contenido de este portal es de carácter informativo y pertenece a sus respectivos autores.</p><h2>Responsabilidad</h2><p>No nos hacemos responsable por el uso indebido de la información publicada.</p>`,
      metaTitle: 'Términos y Condiciones — Saladillo Noticias',
      metaDescription: 'Términos y condiciones de uso del sitio Saladillo Noticias.',
      isActive: true
    },
    {
      slug: 'cookies',
      title: 'Política de Cookies',
      content: `<h1>Política de Cookies</h1><p>Este sitio usa cookies para mejorar tu experiencia y analizar el tráfico.</p><h2>Tipos de cookies</h2><ul><li><strong>Esenciales:</strong> necesarias para el funcionamiento del sitio.</li><li><strong>Analíticas:</strong> para entender cómo nos visitan y mejorar el sitio.</li><li><strong>Marketing:</strong> para mostrar publicidad relevante.</li></ul><h2>Gestión de cookies</h2><p>Podés aceptar o rechazar cookies desde el banner de consentimiento o configurar tu navegador.</p>`,
      metaTitle: 'Política de Cookies — Saladillo Noticias',
      metaDescription: 'Conocé nuestra política de cookies y cómo gestionar tu consentimiento en Saladillo Noticias.',
      isActive: true
    },
    {
      slug: 'contacto',
      title: 'Contacto',
      content: `<h1>Contacto</h1><p>Podés escribirnos a la redacción de ${SITE.name} a través de los siguientes medios.</p><p><strong>Email:</strong> ${SITE.email}<br /><strong>Teléfono:</strong> ${SITE.phone}<br /><strong>Dirección:</strong> ${SITE.city}, ${SITE.province}, ${SITE.country}</p>`,
      metaTitle: 'Contacto — Saladillo Noticias',
      metaDescription: 'Contactá con la redacción de Saladillo Noticias.',
      isActive: true
    }
  ];
  for (const p of paginasLegales) {
    await prisma.legalPage.upsert({
      where: { slug: p.slug },
      update: { title: p.title, content: p.content, metaTitle: p.metaTitle, metaDescription: p.metaDescription, isActive: p.isActive },
      create: p
    });
  }
  console.log(`   ✓ ${paginasLegales.length} páginas legales`);

  console.log('\n✅ Listo.');
  console.log('   Panel de administración: http://localhost:3000/admin/login');
  console.log('   Usuario:    admin@saladillonoticias.com.ar');
  console.log('   Contraseña: Saladillo2026!');
  console.log('   Portal público: http://localhost:3000\n');
}

main()
  .catch((e) => {
    console.error('❌ Error en el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
