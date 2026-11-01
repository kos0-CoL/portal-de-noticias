import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import type { BannerZone } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireApiSession, UnauthorizedError } from '@/lib/auth';

/**
 * API de banners/publicidad.
 * GET es publico (lo consume el sitio); POST requiere sesion del panel.
 */

const ZONAS = ['HEADER', 'HOME_TOP', 'INLINE_ARTICLE', 'SIDEBAR', 'FOOTER', 'MOBILE_STICKY'] as const;
const TIPOS = ['IMAGE', 'ADSENSE', 'HTML', 'ROTATING'] as const;

const bannerSchema = z
  .object({
    name: z.string().trim().min(1, 'El nombre es obligatorio.'),
    advertiser: z.string().trim().optional().nullable(),
    type: z.enum(TIPOS),
    zone: z.enum(ZONAS),
    imageUrl: z.string().trim().optional().nullable(),
    targetUrl: z.string().trim().optional().nullable(),
    htmlCode: z.string().optional().nullable(),
    adSlot: z.string().trim().optional().nullable(),
    weight: z.number().int().min(1).max(100).optional(),
    isActive: z.boolean().optional(),
    startsAt: z.string().optional().nullable(),
    endsAt: z.string().optional().nullable()
  })
  .superRefine((data, ctx) => {
    if ((data.type === 'IMAGE' || data.type === 'ROTATING') && !data.imageUrl) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['imageUrl'], message: 'Este tipo de banner requiere una URL de imagen.' });
    }
    if (data.type === 'ADSENSE' && !data.adSlot) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['adSlot'], message: 'AdSense requiere el ID del bloque (ad slot).' });
    }
    if (data.type === 'HTML' && !data.htmlCode?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['htmlCode'], message: 'Este tipo de banner requiere el código HTML.' });
    }
  });

/** Fecha de vigencia opcional; devuelve null si viene vacia o invalida. */
function parseFecha(value: string | null | undefined): Date | null {
  if (!value) return null;
  const fecha = new Date(value);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

export async function GET(request: NextRequest) {
  try {
    const zoneParam = request.nextUrl.searchParams.get('zone');
    if (zoneParam && !ZONAS.includes(zoneParam as (typeof ZONAS)[number])) {
      return NextResponse.json({ ok: false, error: 'Zona de banner inválida.' }, { status: 400 });
    }

    const now = new Date();
    const banners = await prisma.banner.findMany({
      where: {
        isActive: true,
        ...(zoneParam ? { zone: zoneParam as BannerZone } : {}),
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }
        ]
      },
      orderBy: [{ zone: 'asc' }, { weight: 'desc' }]
    });

    // No se expone el htmlCode salvo en el tipo HTML (es contenido para mostrar).
    const serializados = banners.map((banner) => ({
      id: banner.id,
      name: banner.name,
      advertiser: banner.advertiser,
      type: banner.type,
      zone: banner.zone,
      imageUrl: banner.imageUrl,
      targetUrl: banner.targetUrl,
      adSlot: banner.adSlot,
      weight: banner.weight,
      htmlCode: banner.type === 'HTML' ? banner.htmlCode : null
    }));

    const byZone: Record<string, typeof serializados> = {};
    for (const banner of serializados) {
      const lista = byZone[banner.zone] ?? [];
      lista.push(banner);
      byZone[banner.zone] = lista;
    }

    return NextResponse.json({ ok: true, banners: serializados, byZone });
  } catch (error) {
    console.error('[api/banners] Error al listar banners.', error);
    return NextResponse.json({ ok: false, error: 'No se pudieron obtener los banners.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireApiSession();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: 'Error de autenticación.' }, { status: 500 });
  }

  try {
    const body = await request.json().catch(() => null);
    const parsed = bannerSchema.safeParse(body);
    if (!parsed.success) {
      const errores = parsed.error.issues.map((i) => i.message);
      return NextResponse.json({ ok: false, error: errores[0] ?? 'Datos inválidos.', errores }, { status: 400 });
    }

    const data = parsed.data;
    const banner = await prisma.banner.create({
      data: {
        name: data.name,
        advertiser: data.advertiser ?? null,
        type: data.type,
        zone: data.zone,
        imageUrl: data.imageUrl ?? null,
        targetUrl: data.targetUrl ?? null,
        htmlCode: data.htmlCode ?? null,
        adSlot: data.adSlot ?? null,
        weight: data.weight ?? 1,
        isActive: data.isActive ?? true,
        startsAt: parseFecha(data.startsAt),
        endsAt: parseFecha(data.endsAt)
      }
    });

    return NextResponse.json({ ok: true, banner }, { status: 201 });
  } catch (error) {
    console.error('[api/banners] Error al crear el banner.', error);
    return NextResponse.json({ ok: false, error: 'No se pudo crear el banner.' }, { status: 500 });
  }
}
