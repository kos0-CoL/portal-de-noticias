import { NextResponse, type NextRequest } from 'next/server';
import { requireApiSession, UnauthorizedError } from '@/lib/auth';
import { testAiConnection } from '@/lib/ai/provider';
import { getAiSettings, type AiProvider, type AiSettings } from '@/lib/settings';

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

    // Diagnóstico preciso: distinguimos entre "no se envió override" (normal) y
    // "la clave guardada no se pudo descifrar" (ENCRYPTION_KEY distinta a la de cifrado).
    if (!overrides.apiKey) {
      const guardada = await getAiSettings();
      if (!guardada.hasApiKey || !guardada.apiKey) {
        console.warn(
          '[api/ia/probar] La API Key guardada no está disponible o no se pudo descifrar. ' +
          'Verificá que ENCRYPTION_KEY sea idéntica a la usada al guardarla en Supabase.'
        );
      } else {
        console.info(
          `[api/ia/probar] Probando con clave guardada. provider=${guardada.provider} ` +
          `model=${guardada.model} baseUrl=${guardada.baseUrl} keyLen=${guardada.apiKey.length}`
        );
      }
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
