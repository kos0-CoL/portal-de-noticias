import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireApiSession } from '@/lib/auth';
import { createTransporter } from '@/lib/email/transport';
import { plantillaResumenDiario } from '@/lib/email/templates/resumen-diario';
import { SITE } from '@/lib/constants';

const crearSchema = z.object({
  titulo: z.string().min(3).max(200),
  asunto: z.string().min(3).max(200),
  tipo: z.enum(['resumen_diario', 'breaking', 'especial']).default('resumen_diario'),
  contenido: z.string().optional(),
  enviarAhora: z.boolean().default(false),
  programadoPara: z.string().datetime().optional(),
});

/**
 * POST /api/admin/newsletter/campañas
 * Crea una campaña de newsletter y opcionalmente la envía.
 */
export async function POST(request: Request) {
  try {
    await requireApiSession();

    const body = await request.json();
    const datos = crearSchema.parse(body);

    // Si no hay contenido personalizado, generar resumen diario con las últimas notas publicadas
    let contenidoHtml = datos.contenido;
    let titulo = datos.titulo;
    let asunto = datos.asunto;

    if (!contenidoHtml && datos.tipo === 'resumen_diario') {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const ayer = new Date(hoy);
      ayer.setDate(ayer.getDate() - 1);

      const articulosRecientes = await prisma.article.findMany({
        where: {
          status: 'PUBLISHED',
          publishedAt: { gte: ayer, lte: hoy },
        },
        include: { category: true },
        orderBy: { publishedAt: 'desc' },
        take: 10,
      });

      const fecha = new Date().toISOString();
      const urlBase = process.env.NEXTAUTH_URL ?? 'https://saladillonoticias.com.ar';

      contenidoHtml = plantillaResumenDiario({
        fecha,
        titulo: datos.titulo || 'Resumen diario',
        subtitulo: 'Las noticias más importantes de Saladillo y la región.',
        articles: articulosRecientes.map((a) => ({
          id: a.id,
          slug: a.slug,
          title: a.title,
          summary: a.summary ?? undefined,
          category: a.category.name,
          url: `${urlBase}/nota/${a.slug}`,
          coverImage: a.coverImage ?? undefined,
        })),
        siteName: SITE.name,
        siteUrl: urlBase,
        unsubscribeUrl: `${urlBase}/newsletter/dar-de-baja`,
      });

      titulo = datos.titulo || `Resumen diario - ${new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
      asunto = datos.asunto || `Resumen diario - ${new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}`;
    }

    const suscriptoresActivos = await prisma.newsletterSubscriber.findMany({
      where: { status: 'ACTIVO' },
      select: { id: true, email: true },
    });

    const campaign = await prisma.newsletterCampaign.create({
      data: {
        titulo,
        asunto,
        contenido: contenidoHtml ?? '',
        tipo: datos.tipo,
        status: datos.enviarAhora ? 'ENVIADA' : 'BORRADOR',
        totalSuscriptores: suscriptoresActivos.length,
        enviadoPor: 'admin', // TODO: reemplazar por el ID del usuario autenticado
        enviadoAt: datos.enviarAhora ? new Date() : null,
        programadoPara: datos.programadoPara ? new Date(datos.programadoPara) : null,
      },
    });

    // Si se pide enviar ahora, procesar envío a los suscriptores activos
    if (datos.enviarAhora) {
      await procesarEnvío(campaign.id, suscriptoresActivos, asunto, contenidoHtml ?? '');
    }

    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    if ((error as { name?: string }).name === 'UnauthorizedError') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

/**
 * GET /api/admin/newsletter/campañas
 * Listado de campañas de newsletter (paginado).
 */
export async function GET(request: Request) {
  try {
    await requireApiSession();

    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get('page') ?? '1');
    const pageSize = Number(searchParams.get('pageSize') ?? '25');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      prisma.newsletterCampaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: { select: { envíos: true } },
        },
      }),
      prisma.newsletterCampaign.count({ where }),
    ]);

    return NextResponse.json({
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    if ((error as { name?: string }).name === 'UnauthorizedError') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

/**
 * Procesa el envío de una campaña a una lista de suscriptores.
 */
async function procesarEnvío(
  campaignId: string,
  suscriptores: Array<{ id: string; email: string }>,
  asunto: string,
  contenidoHtml: string
) {
  const { transporter, from, isDev } = createTransporter();

  let enviados = 0;
  let fallidos = 0;

  for (const sub of suscriptores) {
    try {
      await transporter.sendMail({
        from,
        to: sub.email,
        subject: asunto,
        html: contenidoHtml,
      });

      await prisma.newsletterSend.create({
        data: {
          campaignId,
          subscriberId: sub.id,
          email: sub.email,
          estado: 'enviado',
          enviadoAt: new Date(),
        },
      });
      enviados++;
    } catch (err) {
      fallidos++;
      await prisma.newsletterSend.create({
        data: {
          campaignId,
          subscriberId: sub.id,
          email: sub.email,
          estado: 'fallido',
          error: err instanceof Error ? err.message : 'Error desconocido',
        },
      });
    }
  }

  await prisma.newsletterCampaign.update({
    where: { id: campaignId },
    data: {
      status: fallidos > 0 && enviados === 0 ? 'ERROR' : 'ENVIADA',
      enviados,
      fallidos,
    },
  });

  if (isDev) {
    console.log(`[Newsletter dev] Campaña ${campaignId}: ${enviados} enviados, ${fallidos} fallidos`);
  }
}
