import { prisma } from '@/lib/prisma';
import { countWords, estimateReadingTime, slugify, stableHash } from '@/lib/utils';
import { getAiSettings, getWatermarkSettings } from '@/lib/settings';
import { fetchHtml, isAllowedByRobots } from '@/lib/scraper/fetcher';
import { discoverArticleLinks, parseArticle } from '@/lib/scraper/parser';
import { loadLocalKeywords, matchLocalKeywords } from '@/lib/scraper/keywords';
import { rewriteArticleById } from '@/lib/ai/rewrite';

/**
 * Orquestador del scraping.
 *
 * Flujo: una `Source` tiene mapeos (sección externa -> categoría local). Por cada
 * mapeo se descarga el listado, se descubren los links a notas y, por cada nota
 * nueva, se guarda un `ScrapedItem` y se crea de inmediato un `Article` en estado
 * PENDING_REVIEW (borrador que espera revisión humana antes de publicarse).
 *
 * Principios: un fallo individual nunca aborta el job completo; se respeta
 * robots.txt cuando la fuente lo pide; hay delay entre pedidos y todo queda
 * trazado en el log del job.
 */

export interface RunResult {
  jobId: string;
  sourceName: string;
  found: number;
  created: number;
  skipped: number;
  failed: number;
  log: string[];
}

export interface RunSourceOptions {
  trigger?: 'manual' | 'cron';
  userId?: string;
  maxItems?: number;
}

const MAX_LOG_CHARS = 20_000;

function ahora(): string {
  return new Date().toLocaleTimeString('es-AR', {
    hour12: false,
    hourCycle: 'h23',
    timeZone: 'America/Argentina/Buenos_Aires'
  });
}

/** Genera un slug único para el artículo nuevo. */
async function slugUnico(titulo: string): Promise<string> {
  const raiz = slugify(titulo) || `nota-${Date.now().toString(36)}`;
  let candidato = raiz.slice(0, 90);
  let intento = 1;
  while (await prisma.article.findUnique({ where: { slug: candidato }, select: { id: true } })) {
    intento += 1;
    candidato = `${raiz}-${intento}`.slice(0, 95);
    if (intento > 50) {
      candidato = `${raiz}-${Date.now().toString(36)}`.slice(0, 95);
      break;
    }
  }
  return candidato;
}

/**
 * Ejecuta una fuente completa: descarga los listados, extrae notas nuevas y las
 * guarda como borradores pendientes de revisión.
 */
export async function runSource(sourceId: string, opts: RunSourceOptions = {}): Promise<RunResult> {
  const source = await prisma.source.findUnique({
    where: { id: sourceId },
    include: { mappings: { where: { isActive: true } } }
  });
  if (!source) {
    throw new Error('No se encontró la fuente solicitada.');
  }

  const log: string[] = [];
  const registrar = (icono: string, mensaje: string) => {
    log.push(`[${ahora()}] ${icono} ${mensaje}`);
  };

  registrar('→', `Iniciando scraping de «${source.name}» (${source.baseUrl}).`);

  await prisma.source.update({ where: { id: source.id }, data: { status: 'RUNNING' } });
  const job = await prisma.scrapeJob.create({
    data: {
      sourceId: source.id,
      status: 'RUNNING',
      trigger: opts.trigger ?? 'manual',
      startedAt: new Date(),
      userId: opts.userId ?? null
    }
  });

  let found = 0;
  let created = 0;
  let skipped = 0;
  let failed = 0;
  const creadosConImagenes: { articleId: string; images: string[] }[] = [];

  try {
    if (source.mappings.length === 0) {
      registrar('!', 'La fuente no tiene mapeos de categoría activos. Agregá al menos uno para poder extraer notas.');
    }

    const keywords = await loadLocalKeywords();
    registrar('·', `Filtro local cargado con ${keywords.length} palabras clave.`);

    const maxItems = opts.maxItems ?? source.maxItemsPerRun ?? 20;

    for (const mapping of source.mappings) {
      if (created >= maxItems) break;

      const listadoUrl = mapping.externalCategoryUrl;
      registrar('·', `Revisando sección «${mapping.externalCategoryName}» (${listadoUrl}).`);

      // Respeto ético de robots.txt cuando la fuente lo tiene activado.
      if (source.respectRobots) {
        const permitido = await isAllowedByRobots(listadoUrl, source.baseUrl);
        if (!permitido) {
          throw new Error(
            `El robots.txt del sitio prohíbe acceder a ${listadoUrl}. Se cancela la ejecución de esta fuente.`
          );
        }
      }

      let listadoHtml: string;
      try {
        listadoHtml = await fetchHtml(listadoUrl, {
          rotateUserAgent: source.rotateUserAgent,
          delayMs: source.requestDelayMs,
          usePuppeteer: source.usePuppeteer
        });
      } catch (error) {
        const mensaje = error instanceof Error ? error.message : 'Error desconocido';
        registrar('✗', `No se pudo descargar el listado: ${mensaje}`);
        failed += 1;
        continue;
      }

      const links = await discoverArticleLinks(listadoHtml, listadoUrl, source.crawlSelector);
      found += links.length;
      registrar('✓', `Se encontraron ${links.length} links candidatos en «${mapping.externalCategoryName}».`);

      for (const link of links) {
        if (created >= maxItems) {
          registrar('!', `Se alcanzó el límite de ${maxItems} notas nuevas por ejecución.`);
          break;
        }

        try {
          const hash = stableHash(link.url);

          // Deduplicación: por hash de contenido, por URL de origen o por slug.
          const slugPosible = slugify(link.title);
          const [itemExistente, articuloPorUrl, articuloPorSlug] = await Promise.all([
            prisma.scrapedItem.findUnique({ where: { contentHash: hash }, select: { id: true } }),
            prisma.article.findFirst({ where: { sourceUrl: link.url }, select: { id: true } }),
            slugPosible
              ? prisma.article.findFirst({ where: { slug: slugPosible }, select: { id: true } })
              : Promise.resolve(null)
          ]);
          if (itemExistente || articuloPorUrl || articuloPorSlug) {
            skipped += 1;
            continue;
          }

          const notaHtml = await fetchHtml(link.url, {
            rotateUserAgent: source.rotateUserAgent,
            delayMs: source.requestDelayMs,
            usePuppeteer: source.usePuppeteer
          });

          const parsed = await parseArticle(notaHtml, link.url, {
            articleSelector: source.articleSelector,
            titleSelector: source.titleSelector,
            imageSelector: source.imageSelector
          });

          const coincidencia = matchLocalKeywords(`${parsed.title}\n${parsed.content}`, keywords);

          const item = await prisma.scrapedItem.create({
            data: {
              jobId: job.id,
              sourceId: source.id,
              externalCategory: mapping.externalCategoryName,
              title: parsed.title,
              url: link.url,
              rawContent: parsed.contentHtml,
              rawImageUrl: parsed.images[0] ?? null,
              publishedAt: parsed.publishedAt,
              matchedKeywords: coincidencia.matches,
              priority: coincidencia.priority,
              status: 'PENDING',
              contentHash: hash
            }
          });

          // Borrador inmediato para revisión humana (nunca se publica solo).
          const article = await prisma.article.create({
            data: {
              title: parsed.title,
              slug: await slugUnico(parsed.title),
              summary: parsed.excerpt || null,
              content: parsed.contentHtml,
              coverImage: parsed.images[0] ?? null,
              status: 'PENDING_REVIEW',
              priority: coincidencia.priority,
              sourceName: source.name,
              sourceUrl: link.url,
              sourcePublishedAt: parsed.publishedAt,
              scrapedItemId: item.id,
              categoryId: mapping.localCategoryId,
              authorId: opts.trigger === 'manual' ? opts.userId ?? null : null,
              wordCount: countWords(parsed.contentHtml),
              readingTime: estimateReadingTime(parsed.contentHtml)
            }
          });

          await prisma.scrapedItem.update({
            where: { id: item.id },
            data: { status: 'PROCESSED', articleId: article.id, processedAt: new Date() }
          });

          // Reescritura automática con IA si está habilitada en la configuración.
          // Usa el tono por defecto definido en /admin/ia (ai.defaultTonality).
          const ai = await getAiSettings();
          if (ai.rewriteEnabled && ai.hasApiKey) {
            try {
              await rewriteArticleById(article.id, {
                tonality: (ai.defaultTonality as import('@/lib/ai/tones').AiTonalityValue) ?? 'INFORMATIVO_NEUTRAL',
                citeSource: ai.citeSource,
                save: true
              });
              registrar('✓', `Nota reescrita por IA con tono ${ai.defaultTonality}: «${parsed.title}»`);
            } catch (error) {
              const mensaje = error instanceof Error ? error.message : 'Error desconocido';
              registrar('!', `La IA no pudo reescribir «${parsed.title}»: ${mensaje}. Queda como borrador sin reescribir.`);
            }
          }

          if (parsed.images.length > 0) {
            creadosConImagenes.push({ articleId: article.id, images: parsed.images });
          }

          created += 1;
          const etiqueta =
            coincidencia.matches.length > 0
              ? ` [local: ${coincidencia.matches.slice(0, 4).join(', ')}]`
              : '';
          registrar('✓', `Nota guardada como borrador: «${parsed.title}»${etiqueta}`);
        } catch (error) {
          const mensaje = error instanceof Error ? error.message : 'Error desconocido';
          failed += 1;
          registrar('✗', `Falló «${link.title.slice(0, 70)}» (${link.url}): ${mensaje}`);
        }
      }
    }

    // Procesamiento opcional de imágenes (descarga + WebP + marca de agua).
    // Va en try/catch y con import dinámico: si el módulo no existe, el scraping igual terminó bien.
    try {
      if (creadosConImagenes.length > 0) {
        // @ts-ignore — el módulo de imágenes lo implementa otro agente; si todavía no existe, el scraping sigue funcionando.
        const modImagenes = (await import('@/lib/images/process').catch(() => null)) as
          | { replaceArticleImages?: (articleId: string, urls: string[]) => Promise<unknown[]> }
          | null;

        if (modImagenes && typeof modImagenes.replaceArticleImages === 'function') {
          const [ai, marca] = await Promise.all([getAiSettings(), getWatermarkSettings()]);
          if (ai.hasApiKey || marca.enabled) {
            for (const item of creadosConImagenes) {
              try {
                await modImagenes.replaceArticleImages(item.articleId, item.images);
                registrar('✓', `Imágenes optimizadas para el artículo ${item.articleId}.`);
              } catch (error) {
                const mensaje = error instanceof Error ? error.message : 'Error desconocido';
                registrar('!', `No se pudieron optimizar las imágenes del artículo ${item.articleId}: ${mensaje}`);
              }
            }
          }
        }
      }
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'Error desconocido';
      registrar('!', `El procesamiento de imágenes se omitió: ${mensaje}`);
    }
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error desconocido';
    registrar('✗', `La ejecución se interrumpió: ${mensaje}`);
    failed += 1;

    await finalizarJob(job.id, { found, created, skipped, failed, log, estado: 'ERROR' });
    await prisma.source.update({
      where: { id: source.id },
      data: { lastRunAt: new Date(), status: 'ERROR', lastError: mensaje }
    });

    return {
      jobId: job.id,
      sourceName: source.name,
      found,
      created,
      skipped,
      failed,
      log
    };
  }

  const estado = failed > 0 ? (created > 0 ? 'PARTIAL' : 'ERROR') : 'SUCCESS';
  registrar('→', `Fin: ${created} nuevas, ${skipped} omitidas, ${failed} con error.`);
  await finalizarJob(job.id, { found, created, skipped, failed, log, estado });
  await prisma.source.update({
    where: { id: source.id },
    data: {
      lastRunAt: new Date(),
      status: estado === 'ERROR' ? 'ERROR' : 'OK',
      lastError: estado === 'SUCCESS' ? null : log.filter((l) => l.includes('✗')).slice(-3).join(' | ') || null
    }
  });

  return { jobId: job.id, sourceName: source.name, found, created, skipped, failed, log };
}

/** Cierra el job con sus contadores y el log truncado. */
async function finalizarJob(
  jobId: string,
  data: {
    found: number;
    created: number;
    skipped: number;
    failed: number;
    log: string[];
    estado: 'SUCCESS' | 'PARTIAL' | 'ERROR';
  }
): Promise<void> {
  await prisma.scrapeJob.update({
    where: { id: jobId },
    data: {
      status: data.estado,
      finishedAt: new Date(),
      itemsFound: data.found,
      itemsCreated: data.created,
      itemsSkipped: data.skipped,
      itemsFailed: data.failed,
      log: data.log.join('\n').slice(0, MAX_LOG_CHARS)
    }
  });
}

export interface RunAllOptions {
  trigger?: 'manual' | 'cron';
  userId?: string;
  /** Si es true, solo corre las fuentes cuyo scheduleCron ya venció. */
  dueOnly?: boolean;
}

/**
 * Corre en serie todas las fuentes activas. Un error en una fuente no afecta a
 * las demás: cada una se envuelve en try/catch.
 */
export async function runAllActiveSources(opts: RunAllOptions = {}): Promise<RunResult[]> {
  const fuentes = await prisma.source.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' }
  });

  const resultados: RunResult[] = [];
  for (const fuente of fuentes) {
    if (opts.dueOnly && !isSourceDue(fuente)) continue;

    try {
      const resultado = await runSource(fuente.id, {
        trigger: opts.trigger ?? 'cron',
        userId: opts.userId
      });
      resultados.push(resultado);
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'Error desconocido';
      resultados.push({
        jobId: '',
        sourceName: fuente.name,
        found: 0,
        created: 0,
        skipped: 0,
        failed: 1,
        log: [`✗ No se pudo ejecutar «${fuente.name}»: ${mensaje}`]
      });
    }
  }
  return resultados;
}

/** Descarta un item de la cola (el artículo asociado queda como estaba). */
export async function discardScrapedItem(itemId: string): Promise<void> {
  await prisma.scrapedItem.update({
    where: { id: itemId },
    data: { status: 'DISCARDED' }
  });
}

/** Re-encola un item para que la IA lo vuelva a procesar. */
export async function reprocessScrapedItem(itemId: string): Promise<void> {
  await prisma.scrapedItem.update({
    where: { id: itemId },
    data: { status: 'PENDING', processedAt: null, error: null }
  });
}

// -------------------------------------------------------------------------
// Programación (cron mínimo de 5 campos)
// -------------------------------------------------------------------------

interface PartesFecha {
  minuto: number;
  hora: number;
  dia: number;
  mes: number;
  anio: number;
}

/** Partes de fecha/hora en la zona de Buenos Aires (donde está el portal). */
function partesBuenosAires(fecha: Date): PartesFecha {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
  const partes = formatter.formatToParts(fecha);
  const leer = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value ?? 0);
  return {
    minuto: leer('minute'),
    hora: leer('hour'),
    dia: leer('day'),
    mes: leer('month'),
    anio: leer('year')
  };
}

/** Evalúa un campo de cron (soporta asterisco, paso, listas y rangos). */
function campoCoincide(campo: string, valor: number): boolean {
  const field = campo.trim();
  if (field === '*' || field === '?') return true;

  for (const parte of field.split(',')) {
    const p = parte.trim();
    if (!p) continue;

    if (p.includes('/')) {
      const [rango, pasoStr] = p.split('/');
      const paso = Number(pasoStr);
      if (!Number.isFinite(paso) || paso <= 0) continue;
      let inicio = 0;
      if (rango !== '*' && rango !== '') {
        const inicioStr = rango.split('-')[0];
        const n = Number(inicioStr);
        if (Number.isFinite(n)) inicio = n;
      }
      if (valor >= inicio && (valor - inicio) % paso === 0) return true;
      continue;
    }

    if (p.includes('-')) {
      const [a, b] = p.split('-').map((n) => Number(n));
      if (Number.isFinite(a) && Number.isFinite(b) && valor >= a && valor <= b) return true;
      continue;
    }

    const exacto = Number(p);
    if (Number.isFinite(exacto) && exacto === valor) return true;
  }
  return false;
}

/**
 * Indica si corresponde ejecutar la fuente ahora según su expresión cron.
 * Chequeo mínimo: mira minuto y hora, y evita volver a correr si la fuente ya
 * se ejecutó en esta misma hora.
 */
export function isSourceDue(source: {
  lastRunAt: Date | null;
  scheduleCron: string | null;
  requestDelayMs: number;
}): boolean {
  const cron = (source.scheduleCron ?? '').trim();
  if (!cron) return false;

  const campos = cron.split(/\s+/);
  if (campos.length < 5) return false;

  const ahoraFecha = new Date();
  const ahora = partesBuenosAires(ahoraFecha);

  if (!campoCoincide(campos[0], ahora.minuto)) return false;
  if (!campoCoincide(campos[1], ahora.hora)) return false;

  if (source.lastRunAt) {
    const ultima = partesBuenosAires(new Date(source.lastRunAt));
    if (
      ultima.anio === ahora.anio &&
      ultima.mes === ahora.mes &&
      ultima.dia === ahora.dia &&
      ultima.hora === ahora.hora
    ) {
      return false;
    }
  }

  return true;
}
