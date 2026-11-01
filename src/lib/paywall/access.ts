/**
 * Utilidades del módulo de paywall / suscripciones premium.
 *
 * Lógica de acceso:
 * - Si el artículo NO está marcado como premium (isPremium = false), cualquier usuario puede leerlo.
 * - Si el artículo ES premium, solo usuarios autenticados con una suscripción ACTIVA y vigente pueden leerlo.
 */

import { prisma } from '@/lib/prisma';

/**
 * Verifica si un usuario tiene acceso a un artículo premium.
 *
 * @param userId - ID del usuario autenticado (puede ser null si no hay sesión)
 * @param articleId - ID del artículo a verificar
 * @returns true si tiene acceso, false si no
 */
export async function hasPremiumAccess(
  userId: string | null,
  articleId: string
): Promise<boolean> {
  // Si el artículo no es premium, acceso abierto
  const articulo = await prisma.article.findUnique({
    where: { id: articleId },
    select: { isPremium: true },
  });

  if (!articulo) return false;
  if (!articulo.isPremium) return true;

  // Si es premium y no hay usuario autenticado, sin acceso
  if (!userId) return false;

  // Verificar suscripción activa y vigente
  const suscripcion = await prisma.userSubscription.findFirst({
    where: {
      userId,
      status: 'ACTIVA',
      expiresAt: { gt: new Date() },
    },
  });

  return !!suscripcion;
}

/**
 * Obtiene la suscripción activa de un usuario, si existe.
 */
export async function getActiveSubscription(userId: string) {
  return prisma.userSubscription.findFirst({
    where: {
      userId,
      status: 'ACTIVA',
      expiresAt: { gt: new Date() },
    },
    include: { plan: true },
  });
}

/**
 * Verifica si un usuario tiene una suscripción activa (para usar en el panel de admin o UI).
 */
export async function userHasActiveSubscription(userId: string): Promise<boolean> {
  const sub = await getActiveSubscription(userId);
  return !!sub;
}

/**
 * Planes de suscripción activos, ordenados por precio.
 */
export async function getActivePlans() {
  return prisma.subscriptionPlan.findMany({
    where: { activo: true },
    orderBy: { precio: 'asc' },
  });
}
