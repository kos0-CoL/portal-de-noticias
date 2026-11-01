import { PrismaClient } from '@prisma/client';

/**
 * Instancia unica de PrismaClient.
 * En desarrollo Next.js recarga los modulos en cada cambio de archivo; sin este
 * patron se abre una conexion nueva por recarga y Postgres se queda sin slots.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
