import { NextResponse, type NextRequest } from 'next/server';
import { requireApiSession, UnauthorizedError } from '@/lib/auth';
import { testAiConnection } from '@/lib/ai/provider';
import type { AiProvider, AiSettings } from '@/lib/settings';

/**
 * Prueba de conexión con el proveedor de IA.
 * Acepta overrides en el body para poder probar sin guardar la configuración.
 */

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
    const body = (await request.json().catch(() => ({}))) as Partial<AiSettings> & { provider?: AiProvider };

    const overrides: Partial<AiSettings> = {};
    if (body.provider) overrides.provider = body.provider;
    if (typeof body.model === 'string' && body.model.trim()) overrides.model = body.model.trim();
    if (typeof body.baseUrl === 'string') overrides.baseUrl = body.baseUrl.trim();
    if (typeof body.apiKey === 'string' && body.apiKey.trim()) overrides.apiKey = body.apiKey.trim();

    // Log claro si no hay API Key configurada (posible problema de ENCRYPTION_KEY)
    if (!overrides.apiKey) {
      console.warn(
        '[api/ia/probar] No se recibió API Key. Posible causa: ENCRYPTION_KEY no coincide ' +
        'con la usada al cifrar la clave guardada en Supabase, o no hay clave configurada.'
      );
    }

    const result = await testAiConnection(overrides);
    return NextResponse.json({ ok: result.ok, result });
  } catch (error) {
    console.error('[api/ia/probar] Error inesperado al probar la conexión.', error);
    return NextResponse.json(
      { ok: false, error: 'No se pudo probar la conexión con la IA.' },
      { status: 500 }
    );
  }
}
