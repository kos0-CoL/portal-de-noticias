import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { rateLimit, getRateLimitKey } from '@/lib/rate-limit';

const suscripcionSchema = z.object({
  email: z.string().email('Email inválido'),
  name: z.string().min(1).max(80).optional()
});

/**
 * POST /api/newsletter/suscribirse
 * Registro público de un suscriptor al boletín.
 * Si el email ya existe, se reactiva (ACTIVO) si estaba dado de baja.
 */
export async function POST(request: Request) {
  // Rate limiting: 5 suscripciones por hora por IP+endpoint
  const key = getRateLimitKey(request, 'newsletter:suscribirse');
  const limit = rateLimit(key, { limit: 5, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Demasiadas solicitudes de suscripción. Intentá nuevamente más tarde.' },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const datos = suscripcionSchema.parse(body);

    const existente = await prisma.newsletterSubscriber.findUnique({
      where: { email: datos.email.trim().toLowerCase() }
    });

    if (existente) {
      // Si ya está dado de baja, se reactiva.
      if (existente.status === 'DADO_DE_BAJA') {
        await prisma.newsletterSubscriber.update({
          where: { id: existente.id },
          data: { status: 'ACTIVO', updatedAt: new Date() }
        });
      }
      return NextResponse.json(
        { id: existente.id, status: existente.status, yaExistente: true },
        { status: 200 }
      );
    }

    const suscriptor = await prisma.newsletterSubscriber.create({
      data: {
        email: datos.email.trim().toLowerCase(),
        name: datos.name?.trim() || null,
        status: 'ACTIVO',
        source: 'web'
      },
      select: { id: true, email: true, status: true, createdAt: true }
    });

    return NextResponse.json(suscriptor, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
