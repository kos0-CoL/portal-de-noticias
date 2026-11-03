import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireApiSession, UnauthorizedError } from '@/lib/auth';
import { getStorageSettingsForClient, setSetting, SETTING_KEYS } from '@/lib/settings';

/**
 * Configuracion del almacenamiento externo (/admin/almacenamiento).
 * GET nunca devuelve la service role key en claro. Requiere sesion del panel.
 */

const PROVEEDORES = ['supabase'] as const;

const configSchema = z.object({
  defaultProvider: z.enum(PROVEEDORES).or(z.literal('')).optional(),
  supabaseUrl: z.string().trim().optional(),
  supabaseBucket: z.string().trim().optional(),
  supabaseServiceKey: z.string().optional(),
  clearSupabaseServiceKey: z.boolean().optional()
});

async function guardarConfiguracion(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = configSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Configuración inválida.', errores: parsed.error.issues.map((i) => i.message) },
      { status: 400 }
    );
  }

  const data = parsed.data;

  if (data.clearSupabaseServiceKey) {
    await setSetting(SETTING_KEYS.storageSupabaseServiceKey, '', { secret: true, group: 'storage' });
  } else if (typeof data.supabaseServiceKey === 'string' && data.supabaseServiceKey.trim() !== '') {
    // Solo se sobreescribe si el usuario escribio una clave nueva.
    await setSetting(SETTING_KEYS.storageSupabaseServiceKey, data.supabaseServiceKey.trim(), {
      secret: true,
      group: 'storage'
    });
  }

  const grupo = { group: 'storage' };
  const tareas: Promise<unknown>[] = [];

  if (data.defaultProvider !== undefined) {
    tareas.push(setSetting(SETTING_KEYS.storageDefaultProvider, data.defaultProvider, grupo));
  }
  if (data.supabaseUrl !== undefined) tareas.push(setSetting(SETTING_KEYS.storageSupabaseUrl, data.supabaseUrl, grupo));
  if (data.supabaseBucket !== undefined) {
    tareas.push(setSetting(SETTING_KEYS.storageSupabaseBucket, data.supabaseBucket, grupo));
  }

  await Promise.all(tareas);

  const settings = await getStorageSettingsForClient();
  return NextResponse.json({ ok: true, settings });
}

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
    const settings = await getStorageSettingsForClient();
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    console.error('[api/almacenamiento/config] Error al leer la configuración.', error);
    return NextResponse.json({ ok: false, error: 'No se pudo leer la configuración de almacenamiento.' }, { status: 500 });
  }
}

async function conSesion(request: NextRequest) {
  try {
    await requireApiSession();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: 'Error de autenticación.' }, { status: 500 });
  }
  try {
    return await guardarConfiguracion(request);
  } catch (error) {
    console.error('[api/almacenamiento/config] Error al guardar la configuración.', error);
    return NextResponse.json({ ok: false, error: 'No se pudo guardar la configuración de almacenamiento.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  return conSesion(request);
}

export async function POST(request: NextRequest) {
  return conSesion(request);
}
