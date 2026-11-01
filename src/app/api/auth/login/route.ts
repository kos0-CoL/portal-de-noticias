import { NextResponse } from 'next/server';
import { z } from 'zod';
import { SESSION_COOKIE, authenticate, sessionCookieOptions, signSession } from '@/lib/auth';
import { rateLimit, getRateLimitKey } from '@/lib/rate-limit';

/**
 * POST /api/auth/login
 * Entrada: { email: string, password: string }
 * Salida ok:  { ok: true, user: { id, email, name, role } }  (+ cookie de sesión)
 * Salida err: 400 { ok: false, error } | 401 { ok: false, error: 'Credenciales inválidas' }
 *             429 { ok: false, error: 'Demasiados intentos. Intentá nuevamente más tarde.' }
 */

const loginSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(1, 'La contraseña es obligatoria')
});

export async function POST(request: Request) {
  // Rate limiting: 5 intentos por minuto por IP+endpoint
  const key = getRateLimitKey(request, 'auth:login');
  const limit = rateLimit(key, { limit: 5, windowMs: 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: 'Demasiados intentos de inicio de sesión. Intentá nuevamente más tarde.' },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Datos de acceso inválidos' }, { status: 400 });
  }

  const user = await authenticate(parsed.data.email, parsed.data.password);
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Credenciales inválidas' }, { status: 401 });
  }

  const token = await signSession({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role
  });

  const response = NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, name: user.name, role: user.role }
  });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return response;
}
