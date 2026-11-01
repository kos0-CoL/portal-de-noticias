/**
 * Rate limiter en memoria para proteger endpoints críticos contra
 * fuerza bruta, spam y abuso de recursos.
 *
 * Nota: En entornos de producción con múltiples instancias, se debe
 * reemplazar por un almacén compartido (Redis, Upstash, etc.).
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const store = new Map<string, RateLimitEntry>();

/**
 * Verifica si una clave ha excedido el límite de peticiones en una ventana de tiempo.
 * @param key - Identificador único (ej: IP + endpoint)
 * @param options - { limit: número máximo de peticiones, windowMs: ventana en ms }
 * @returns { allowed, remaining, resetTime }
 */
export function rateLimit(
  key: string,
  options: { limit: number; windowMs: number }
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const entry = store.get(key);

  // Limpiar entradas expiradas
  if (entry && now > entry.resetTime) {
    store.delete(key);
  }

  const current = store.get(key);

  if (!current) {
    store.set(key, { count: 1, resetTime: now + options.windowMs });
    return {
      allowed: true,
      remaining: options.limit - 1,
      resetTime: now + options.windowMs,
    };
  }

  if (current.count >= options.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: current.resetTime,
    };
  }

  current.count++;
  return {
    allowed: true,
    remaining: options.limit - current.count,
    resetTime: current.resetTime,
  };
}

/**
 * Extrae una clave de identificación del request (IP + user agent parcial).
 */
export function getRateLimitKey(request: Request, endpoint: string): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  const ua = request.headers.get('user-agent') ?? 'unknown';
  return `${endpoint}:${ip}:${ua}`;
}
