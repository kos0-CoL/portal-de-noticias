import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const pagoSchema = z.object({
  referenciaExterna: z.string().min(1, 'referenciaExterna es requerida'),
  estado: z.enum(['APROBADO', 'RECHAZADO', 'REEMBOLSADO']),
});

/**
 * POST /api/paywall/pago
 * Confirma el estado de un pago (webhook de proveedor / retorno de checkout).
 * Solo el dueño de la suscripcion puede confirmar el pago, y solo si el pago
 * esta en estado PENDIENTE. Nunca se confia ciegamente en el estado enviado
 * por el cliente sin verificacion externa del proveedor de pagos.
 * Requiere sesion de usuario autenticada.
 */
export async function POST(req: Request) {
  try {
    const session = await requireApiSession();

    const body = await req.json();
    const parsed = pagoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos invalidos', detalles: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { referenciaExterna, estado } = parsed.data;

    const pago = await prisma.payment.findUnique({
      where: { id: referenciaExterna },
      include: { subscription: { include: { plan: true } } },
    });

    // Buscar tambien por referenciaExterna si no se encontro por id
    if (!pago) {
      const pagoPorRef = await prisma.payment.findFirst({
        where: { referenciaExterna },
        include: { subscription: { include: { plan: true } } },
      });
      if (!pagoPorRef) {
        return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 });
      }
      // Usar el pago encontrado por referencia
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const p = pagoPorRef!;
      // Verificar que el usuario sea dueño de la suscripcion
      if (p.subscription.userId !== session.sub) {
        return NextResponse.json({ error: 'No autorizado para este pago' }, { status: 403 });
      }

      const ahora = new Date();

      if (estado === 'APROBADO' && p.estado === 'PENDIENTE') {
        await prisma.payment.update({
          where: { id: p.id },
          data: { estado: 'APROBADO', fechaPago: ahora },
        });

        if (p.subscription.status === 'PENDIENTE_PAGO') {
          const fechaVencimiento = new Date(ahora);
          fechaVencimiento.setDate(fechaVencimiento.getDate() + p.subscription.plan.diasDuracion);

          await prisma.userSubscription.update({
            where: { id: p.subscription.id },
            data: {
              status: 'ACTIVA',
              startedAt: ahora,
              expiresAt: fechaVencimiento,
            },
          });
        }
      } else if (estado === 'RECHAZADO' && p.estado === 'PENDIENTE') {
        await prisma.payment.update({
          where: { id: p.id },
          data: { estado: 'RECHAZADO' },
        });

        await prisma.userSubscription.update({
          where: { id: p.subscription.id },
          data: { status: 'CANCELADA', canceladoEn: ahora },
        });
      } else if (estado === 'REEMBOLSADO' && p.estado === 'APROBADO') {
        await prisma.payment.update({
          where: { id: p.id },
          data: { estado: 'REEMBOLSADO', fechaPago: ahora },
        });

        await prisma.userSubscription.update({
          where: { id: p.subscription.id },
          data: { status: 'CANCELADA', canceladoEn: ahora },
        });
      }

      return NextResponse.json({ ok: true, estado });
    }

    // Verificar que el usuario sea dueño de la suscripcion
    if (pago.subscription.userId !== session.sub) {
      return NextResponse.json({ error: 'No autorizado para este pago' }, { status: 403 });
    }

    const ahora = new Date();

    if (estado === 'APROBADO' && pago.estado === 'PENDIENTE') {
      await prisma.payment.update({
        where: { id: pago.id },
        data: { estado: 'APROBADO', fechaPago: ahora },
      });

      if (pago.subscription.status === 'PENDIENTE_PAGO') {
        const fechaVencimiento = new Date(ahora);
        fechaVencimiento.setDate(fechaVencimiento.getDate() + pago.subscription.plan.diasDuracion);

        await prisma.userSubscription.update({
          where: { id: pago.subscription.id },
          data: {
            status: 'ACTIVA',
            startedAt: ahora,
            expiresAt: fechaVencimiento,
          },
        });
      }
    } else if (estado === 'RECHAZADO' && pago.estado === 'PENDIENTE') {
      await prisma.payment.update({
        where: { id: pago.id },
        data: { estado: 'RECHAZADO' },
      });

      await prisma.userSubscription.update({
        where: { id: pago.subscription.id },
        data: { status: 'CANCELADA', canceladoEn: ahora },
      });
    } else if (estado === 'REEMBOLSADO' && pago.estado === 'APROBADO') {
      await prisma.payment.update({
        where: { id: pago.id },
        data: { estado: 'REEMBOLSADO', fechaPago: ahora },
      });

      await prisma.userSubscription.update({
        where: { id: pago.subscription.id },
        data: { status: 'CANCELADA', canceladoEn: ahora },
      });
    }

    return NextResponse.json({ ok: true, estado });
  } catch (error) {
    if ((error as { name?: string }).name === 'UnauthorizedError') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    console.error('[paywall/pago]', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
