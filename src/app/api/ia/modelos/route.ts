import { NextResponse, type NextRequest } from 'next/server';
import { requireApiSession, UnauthorizedError } from '@/lib/auth';
import { getSetting, SETTING_KEYS } from '@/lib/settings';

/**
 * Listado de modelos disponibles segun el proveedor configurado.
 *
 * Para OpenRouter consulta el endpoint publico /api/v1/models y permite
 * filtrar solo los gratuitos con el query param ?free=true.
 * Para los demas proveedores devuelve la lista sugerida estatica.
 * Requiere sesion del panel.
 */

const MODELOS_SUGERIDOS: Record<string, string[]> = {
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'o4-mini'],
  openrouter: ['openai/gpt-4o-mini', 'anthropic/claude-3.5-sonnet', 'meta-llama/llama-3.3-70b-instruct'],
  groq: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
  gemini: ['gemini-2.0-flash', 'gemini-1.5-pro'],
  custom: []
};

export async function GET(request: NextRequest) {
  try {
    await requireApiSession();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: 'Error de autenticacion.' }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider') ?? 'openrouter';
    const soloGratuitos = searchParams.get('free') === 'true';

    if (provider === 'openrouter') {
      const apiKey = (await getSetting<string>(SETTING_KEYS.aiApiKey)) ?? '';

      let headers: Record<string, string> = {
        Accept: 'application/json'
      };

      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      // Headers recomendados por OpenRouter para identificar el origen de las peticiones.
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
      if (siteUrl) {
        headers['HTTP-Referer'] = siteUrl;
        headers['X-Title'] = new URL(siteUrl).hostname;
      }

      const response = await fetch('https://openrouter.ai/api/v1/models', { headers });

      if (!response.ok) {
        const texto = await response.text();
        return NextResponse.json(
          { ok: false, error: `OpenRouter respondio con error ${response.status}`, detalle: texto },
          { status: 502 }
        );
      }

      const data: { data?: Array<{ id: string; name?: string; pricing?: { prompt?: string; completion?: string } }> } = await response.json();

      const modelos = (data.data ?? []).map((m: { id: string; name?: string; pricing?: { prompt?: string; completion?: string } }) => ({
        id: m.id,
        name: m.name ?? m.id,
        gratuito: m.pricing?.prompt === '0' && m.pricing?.completion === '0'
      }))
        .filter((m) => !soloGratuitos || m.gratuito)
        .sort((a, b) => a.id.localeCompare(b.id));

      return NextResponse.json({ ok: true, provider, modelos, gratuitos: modelos.filter((m) => m.gratuito).length });
    }

    const sugeridos = MODELOS_SUGERIDOS[provider] ?? [];
    return NextResponse.json({ ok: true, provider, modelos: sugeridos.map((id) => ({ id, name: id, gratuito: false })), gratuitos: 0 });
  } catch (error) {
    console.error('[api/ia/modelos] Error inesperado.', error);
    return NextResponse.json(
      { ok: false, error: 'No se pudieron listar los modelos.' },
      { status: 500 }
    );
  }
}
