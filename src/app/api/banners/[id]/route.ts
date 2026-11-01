import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireApiSession, UnauthorizedError } from '@/lib/auth';

/**
 * Edicion y borrado de banners. Requiere sesion del panel.
 */

const ZONAS = ['HEADER', 'HOME_TOP', 'INLINE_ARTICLE', 'SIDEBAR', 'FOOTER', 'MOBILE_STICKY'] as const;
const TIPOS = ['IMAGE', 'ADSENSE', 'HTML', 'ROTATING'] as const;

const patchSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    advertiser: z.string().trim().nullable().optional(),
    type: z.enum(TIPOS).optional(),
    zone: z.enum(ZONAS).optional(),
    imageUrl: z.string().trim().nullable().optional(),
    targetUrl: z.string().trim().nullable().optional(),
    htmlCode: z.string().nullable().optional(),
    adSlot: z.string().trim().nullable().optional(),
    weight: z.number().int().min(1).max(100).optional(),
    isActive: z.boolean().optional(),
    startsAt: z.string().nullable().optional(),
    endsAt: z.string().nullable().optional()
  })
  .partial();

function parseFecha(value: string | null | undefined): Date | null {
  if (!value) return null;
  const fecha = new Date(value);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
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
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Datos inválidos.', errores: parsed.error.issues.map((i) => i.message) }, { status: 400 });
    }

    const data = parsed.data;
    const banner = await prisma.banner.update({
      where: { id: params.id },
      data: {
        // Prisma ignora las claves `undefined`: solo se actualiza lo enviado.
        name: data.name,
        advertiser: data.advertiser,
        type: data.type,
        zone: data.zone,
        imageUrl: data.imageUrl,
        targetUrl: data.targetUrl,
        htmlCode: data.htmlCode,
        adSlot: data.adSlot,
        weight: data.weight,
        isActive: data.isActive,
        ...(data.startsAt !== undefined ? { startsAt: parseFecha(data.startsAt) } : {}),
        ...(data.endsAt !== undefined ? { endsAt: parseFecha(data.endsAt) } : {})
      }
    });

    return NextResponse.json({ ok: true, banner });
  } catch (error) {
    console.error('[api/banners/:id] Error al actualizar el banner.', error);
    return NextResponse.json({ ok: false, error: 'No se pudo actualizar el banner.' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireApiSession();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: 'Error de autenticación.' }, { status: 500 });
  }

  try {
    await prisma.banner.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[api/banners/:id] Error al eliminar el banner.', error);
    return NextResponse.json({ ok: false, error: 'No se pudo eliminar el banner.' }, { status: 500 });
  }
}
