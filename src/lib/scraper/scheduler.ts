import { prisma } from '@/lib/prisma';
import { isSourceDue, runSource } from '@/lib/scraper/pipeline';

/**
 * Planificador interno.
 *
 * Corre un tick cada 60 segundos y, si `ENABLE_INTERNAL_SCHEDULER === 'true'`,
 * ejecuta las fuentes activas que ya vencieron según su `scheduleCron`.
 *
 * Es idempotente: la instancia vive en `globalThis` para que las recargas de
 * desarrollo no levanten múltiples intervalos. Nunca corre en build time ni en
 * el runtime de Edge.
 */

interface SchedulerState {
  timer: NodeJS.Timeout | null;
  lastTickAt: string | null;
  ticking: boolean;
}

const globalKey = '__saladillo_scraper_scheduler__';
const globalScope = globalThis as unknown as Record<string, SchedulerState | undefined>;

function estado(): SchedulerState {
  if (!globalScope[globalKey]) {
    globalScope[globalKey] = { timer: null, lastTickAt: null, ticking: false };
  }
  return globalScope[globalKey] as SchedulerState;
}

/** Un tick: revisa qué fuentes vencieron y las ejecuta en serie. */
async function tick(): Promise<void> {
  const state = estado();
  if (state.ticking) return; // evita solapamiento si una corrida se demora
  state.ticking = true;
  state.lastTickAt = new Date().toISOString();

  try {
    const fuentes = await prisma.source.findMany({ where: { isActive: true } });
    const vencidas = fuentes.filter((fuente) => isSourceDue(fuente));

    for (const fuente of vencidas) {
      try {
        await runSource(fuente.id, { trigger: 'cron' });
      } catch {
        // Un error en una fuente no debe cortar el tick ni las demás.
      }
    }
  } catch {
    // Sin base disponible o error transitorio: se reintenta en el próximo tick.
  } finally {
    state.ticking = false;
  }
}

/** Arranca el planificador (idempotente y seguro en build time). */
export function startScheduler(): void {
  try {
    // No arrancar durante el build ni en runtime Edge.
    if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== 'nodejs') return;
    if (process.env.NEXT_PHASE === 'phase-production-build') return;

    const state = estado();
    if (state.timer) return; // ya está corriendo

    state.timer = setInterval(() => {
      if (process.env.ENABLE_INTERNAL_SCHEDULER !== 'true') return;
      void tick();
    }, 60_000);

    // No mantener vivo el proceso solo por este intervalo.
    if (typeof state.timer.unref === 'function') state.timer.unref();
  } catch {
    // Nunca tumbar el proceso por el planificador.
  }
}

/** Detiene el planificador. */
export function stopScheduler(): void {
  const state = estado();
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
}

/** Estado actual del planificador, para mostrarlo en el panel. */
export function getSchedulerState(): { running: boolean; lastTickAt: string | null } {
  const state = estado();
  return { running: state.timer !== null, lastTickAt: state.lastTickAt };
}
