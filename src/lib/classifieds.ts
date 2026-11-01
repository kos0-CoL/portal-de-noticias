import { addDays } from 'date-fns';
import { prisma } from '@/lib/prisma';
import { DIAS_VIGENCIA_CLASIFICADO } from '@/lib/constants';

/**
 * Reglas de vigencia del módulo de Clasificados.
 * Un aviso aprobado vive 30 días; pasado ese plazo deja de mostrarse en el
 * sitio público aunque su estado todavía diga PUBLISHED, porque las consultas
 * filtran por fecha. El cron se encarga además de pasarlos a EXPIRED.
 */

/** Condición Prisma de los avisos visibles públicamente: publicados y vigentes. */
export function avisoVigenteWhere() {
  return {
    status: 'PUBLISHED' as const,
    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
  };
}

/** Fecha de vencimiento que se asigna a un aviso en el momento de aprobarlo. */
export function vencimientoAviso(desde: Date = new Date()): Date {
  return addDays(desde, DIAS_VIGENCIA_CLASIFICADO);
}

/** Marca como EXPIRED los avisos publicados cuya vigencia ya venció. Devuelve cuántos cambió. */
export async function expirarAvisosVencidos(): Promise<number> {
  const { count } = await prisma.classified.updateMany({
    where: { status: 'PUBLISHED', expiresAt: { lt: new Date() } },
    data: { status: 'EXPIRED' }
  });
  return count;
}

/**
 * Fotos de un aviso en orden de aparición.
 * Los avisos cargados antes de que existiera la galería solo tienen portada.
 */
export function fotosDelAviso(aviso: { images: { url: string }[]; imageUrl: string | null }): string[] {
  if (aviso.images.length > 0) return aviso.images.map((foto) => foto.url);
  return aviso.imageUrl ? [aviso.imageUrl] : [];
}
