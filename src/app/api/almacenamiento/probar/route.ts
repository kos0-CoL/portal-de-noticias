import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireApiSession, UnauthorizedError } from '@/lib/auth';
import { getProvider, proveedorPorDefecto } from '@/lib/storage';

/**
 * Prueba de credenciales de almacenamiento (/admin/almacenamiento).
 * Sube un PNG minimo y devuelve la URL publica resultante.
 */

export const maxDuration = 60;

/** PNG 1x1 transparente: alcanza para validar bucket, permisos y URL publica. */
const PNG_MINIMO = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

const schema = z.object({ proveedor: z.string().trim().optional() });

export async function POST(request: NextRequest) {
  try {
    await requireApiSession();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: 'Error de autenticación.' }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Datos inválidos.' }, { status: 400 });
  }

  const id = parsed.data.proveedor;
  const proveedor = id && id !== 'default' ? getProvider(id) : await proveedorPorDefecto();

  if (!proveedor) {
    return NextResponse.json(
      { ok: false, error: 'No hay proveedor de almacenamiento seleccionado o configurado.' },
      { status: 400 }
    );
  }

  if (!(await proveedor.disponible())) {
    return NextResponse.json(
      { ok: false, error: `Faltan credenciales para ${proveedor.nombre}.` },
      { status: 400 }
    );
  }

  try {
    const resultado = await proveedor.subir(PNG_MINIMO, {
      nombre: `pruebas/${Date.now()}-ping.png`,
      contentType: 'image/png'
    });
    return NextResponse.json({ ok: true, proveedor: proveedor.id, url: resultado.url });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ ok: false, error: mensaje }, { status: 502 });
  }
}
