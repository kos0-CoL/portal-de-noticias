import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import type { SocialNetwork } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireApiSession, UnauthorizedError } from '@/lib/auth';
import { encryptSecret, maskSecret } from '@/lib/crypto';

/**
 * Canales de difusión en redes sociales.
 * El accessToken se cifra antes de guardarse y nunca se devuelve en claro.
 */

const REDES = ['FACEBOOK', 'INSTAGRAM', 'TELEGRAM', 'X', 'WHATSAPP'] as const;

const canalSchema = z.object({
  network: z.enum(REDES),
  name: z.string().trim().min(1, 'El nombre del canal es obligatorio.'),
  webhookUrl: z.string().trim().url('La URL del webhook no es válida.').optional().nullable().or(z.literal('')),
  accessToken: z.string().optional().nullable(),
  chatId: z.string().trim().optional().nullable(),
  autoPublish: z.boolean().optional(),
  isActive: z.boolean().optional()
});

export async function GET() {
  try {
    await requireApiSession();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: 'Error de autenticación.' }, { status: 500 });
  }

  try {
    const canales = await prisma.socialChannel.findMany({ orderBy: { createdAt: 'desc' } });
    const serializados = canales.map((canal) => ({
      id: canal.id,
      network: canal.network,
      name: canal.name,
      webhookUrl: canal.webhookUrl,
      chatId: canal.chatId,
      autoPublish: canal.autoPublish,
      isActive: canal.isActive,
      // Solo se expone la versión enmascarada.
      accessTokenMasked: canal.accessToken ? maskSecret(canal.accessToken) : '',
      hasAccessToken: Boolean(canal.accessToken)
    }));

    return NextResponse.json({ ok: true, canales: serializados });
  } catch (error) {
    console.error('[api/difusion/canales] Error al listar los canales.', error);
    return NextResponse.json({ ok: false, error: 'No se pudieron obtener los canales.' }, { status: 500 });
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
    const parsed = canalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const canal = await prisma.socialChannel.create({
      data: {
        network: data.network as SocialNetwork,
        name: data.name,
        webhookUrl: data.webhookUrl ? data.webhookUrl : null,
        accessToken: data.accessToken?.trim() ? encryptSecret(data.accessToken.trim()) : null,
        chatId: data.chatId ?? null,
        autoPublish: data.autoPublish ?? false,
        isActive: data.isActive ?? true
      }
    });

    return NextResponse.json(
      {
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
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[api/difusion/canales] Error al crear el canal.', error);
    return NextResponse.json({ ok: false, error: 'No se pudo crear el canal.' }, { status: 500 });
  }
}
