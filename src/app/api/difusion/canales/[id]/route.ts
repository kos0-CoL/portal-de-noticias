import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import type { SocialNetwork } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireApiSession, UnauthorizedError } from '@/lib/auth';
import { encryptSecret, maskSecret } from '@/lib/crypto';

/**
 * Edición y borrado de canales de difusión. Requiere sesión del panel.
 */

const REDES = ['FACEBOOK', 'INSTAGRAM', 'TELEGRAM', 'X', 'WHATSAPP'] as const;

const patchSchema = z
  .object({
    network: z.enum(REDES).optional(),
    name: z.string().trim().min(1).optional(),
    webhookUrl: z.string().trim().url('La URL del webhook no es válida.').nullable().optional().or(z.literal('')),
    accessToken: z.string().nullable().optional(),
    chatId: z.string().trim().nullable().optional(),
    autoPublish: z.boolean().optional(),
    isActive: z.boolean().optional()
  })
  .partial();

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

    // Solo se re-cifra el token si el usuario escribió uno nuevo.
    let accessTokenData: { accessToken?: string | null } = {};
    if (data.accessToken !== undefined) {
      accessTokenData = { accessToken: data.accessToken && data.accessToken.trim() ? encryptSecret(data.accessToken.trim()) : null };
    }

    const canal = await prisma.socialChannel.update({
      where: { id: params.id },
      data: {
        network: data.network as SocialNetwork | undefined,
        name: data.name,
        webhookUrl: data.webhookUrl !== undefined ? (data.webhookUrl ? data.webhookUrl : null) : undefined,
        chatId: data.chatId,
        autoPublish: data.autoPublish,
        isActive: data.isActive,
        ...accessTokenData
      }
    });

    return NextResponse.json({
      ok: true,
      canal: {
        id: canal.id,
        network: canal.network,
        name: canal.name,
        webhookUrl: canal.webhookUrl,
        chatId: canal.chatId,
        autoPublish: canal.autoPublish,
        isActive: canal.isActive,
        accessTokenMasked: canal.accessToken ? maskSecret(canal.accessToken) : '',
        hasAccessToken: Boolean(canal.accessToken)
      }
    });
  } catch (error) {
    console.error('[api/difusion/canales/:id] Error al actualizar el canal.', error);
    return NextResponse.json({ ok: false, error: 'No se pudo actualizar el canal.' }, { status: 500 });
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
    await prisma.socialChannel.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[api/difusion/canales/:id] Error al eliminar el canal.', error);
    return NextResponse.json({ ok: false, error: 'No se pudo eliminar el canal.' }, { status: 500 });
  }
}
