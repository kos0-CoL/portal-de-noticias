import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/constants';

/**
 * Cabeceras de seguridad aplicadas a todas las respuestas del portal.
 */
const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy':
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://pagead2.googlesyndication.com https://www.google.com; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https: blob:; " +
    "connect-src 'self'; " +
    "frame-src 'self' https://www.google.com; " +
    "frame-ancestors 'self';",
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

/**
 * Cabeceras CORS para permitir peticiones desde el mismo origen.
 */
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Agrega cabeceras de seguridad a una respuesta.
 */
function addSecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

/**
 * Protege todo /admin salvo /admin/login.
 * Solo verifica la FIRMA del JWT (compatible con Edge runtime); la validacion
 * completa contra la base se hace en el layout del panel.
 */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const isAdminArea = pathname.startsWith('/admin');
  const isLogin = pathname === '/admin/login';
  if (!isAdminArea || isLogin) {
    // Para rutas no-admin, solo agregar cabeceras de seguridad
    const response = NextResponse.next();
    return addSecurityHeaders(response);
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin/login';
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    const response = NextResponse.redirect(url);
    return addSecurityHeaders(response);
  }

  try {
    const { jwtVerify } = await import('jose');
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET ?? '');
    await jwtVerify(token, secret, { issuer: 'saladillo-noticias' });
    const response = NextResponse.next();
    return addSecurityHeaders(response);
  } catch {
    const url = request.nextUrl.clone();
    url.pathname = '/admin/login';
    url.search = '';
    const response = NextResponse.redirect(url);
    response.cookies.delete(SESSION_COOKIE);
    return addSecurityHeaders(response);
  }
}

export const config = {
  matcher: ['/admin/:path*', '/((?!_next/static|_next/image|favicon.ico).*)'],
};
