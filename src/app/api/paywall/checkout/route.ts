import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { rateLimit, getRateLimitKey } from '@/lib/rate-limit';

const checkoutSchema = z.object({
  planId: z.string().min(1, 'planId es requerido'),
});

/**
 * POST /api/paywall/checkout
 * Crea una suscripcion en estado PENDIENTE_PAGO y un pago asociado.
 * Devuelve una referencia de pago para completar el checkout con el proveedor (Mercado Pago).
 * Requiere sesion de usuario autenticado.
 */
export async function POST(req: Request) {
  // Rate limiting: 5 intentos de checkout por hora por IP+endpoint
  const key = getRateLimitKey(req, 'paywall:checkout');
  const limit = rateLimit(key, { limit: 5, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Demasiados intentos de suscripción. Intentá nuevamente más tarde.' },
      { status: 429 }
    );
  }

  try {
    const session = await requireApiSession();

    const body = await req.json();
    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos invalidos', detalles: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { planId } = parsed.data;

    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!plan || !plan.activo) {
      return NextResponse.json(
        { error: 'Plan no encontrado o inactivo' },
        { status: 404 }
      );
    }

    // Cancelar suscripciones pendientes previas del mismo usuario para este plan
    await prisma.userSubscription.updateMany({
      where: {
        userId: session.sub,
        status: 'PENDIENTE_PAGO',
      },
      data: { status: 'CANCELADA' },
    });

    const fechaVencimiento = new Date();
    fechaVencimiento.setDate(fechaVencimiento.getDate() + plan.diasDuracion);

    const suscripcion = await prisma.userSubscription.create({
      data: {
        userId: session.sub,
        planId,
        status: 'PENDIENTE_PAGO',
        startedAt: new Date(),
        expiresAt: fechaVencimiento,
        renovacionAuto: true,
      },
    });

    const pago = await prisma.payment.create({
      data: {
        subscriptionId: suscripcion.id,
        monto: plan.precio,
        moneda: 'ARS',
        estado: 'PENDIENTE',
        proveedor: 'mercadopago',
        referenciaExterna: `mp_${suscripcion.id}_${Date.now()}`,
      },
    });

    // Referencia de pago para el proveedor (Mercado Pago).
    // En produccion, se integra el SDK oficial para generar la URL de checkout real.
    const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
    const checkoutUrl = `${SITE_URL}/suscripciones/pago?reference=${pago.referenciaExterna}`;

    return NextResponse.json({
      checkoutUrl,
      paymentId: pago.id,
      subscriptionId: suscripcion.id,
      referenciaExterna: pago.referenciaExterna,
      monto: Number(plan.precio),
      moneda: 'ARS',
      estado: 'PENDIENTE',
    });
  } catch (error) {
    if ((error as { name?: string }).name === 'UnauthorizedError') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    console.error('[paywall/checkout]', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
