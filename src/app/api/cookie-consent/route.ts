import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const session = await getSession();
    const body = await req.json();

    const { essential, analytics, marketing } = body;

    await prisma.cookieConsent.create({
      data: {
        userId: session?.sub ?? null,
        sessionId: body.sessionId ?? crypto.randomUUID(),
        essential: essential ?? true,
        analytics: analytics ?? false,
        marketing: marketing ?? false,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[cookie-consent]', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
