import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireApiSession, UnauthorizedError } from '@/lib/auth';
import { esUrlDeProveedor, getProvider, proveedorPorDefecto } from '@/lib/storage';
import { processImageToProvider, processRemoteImageToProvider } from '@/lib/images/process';

/**
 * Aloja la portada de una nota en un proveedor de almacenamiento externo
 * (Supabase Storage). Lo dispara el boton "Alojar imagen" del editor.
 * Descarga (o lee) la imagen, la procesa con sharp y la sube.
 */

export const maxDuration = 60;

const schema = z.object({
  origen: z.string().trim().min(1, 'Falta la URL de la imagen.'),
  proveedor: z.string().trim().default('default')
});

/** Lee un archivo de /public/uploads, evitando salir del directorio. */
async function leerArchivoLocal(rutaPublica: string): Promise<Buffer> {
  if (!rutaPublica.startsWith('/uploads/') || rutaPublica.includes('..')) {
    throw new Error('La ruta local no es válida.');
  }
  const { readFile } = await import('fs/promises');
  const { join } = await import('path');
  return readFile(join(process.cwd(), 'public', rutaPublica.replace(/^\/+/, '')));
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

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' },
      { status: 400 }
    );
  }

  const { origen, proveedor: solicitado } = parsed.data;
  const esRemota = /^https?:\/\//i.test(origen);
  const esLocal = origen.startsWith('/uploads/');
  if (!esRemota && !esLocal) {
    return NextResponse.json(
      { ok: false, error: 'El origen debe ser una URL http(s) o una ruta /uploads/…' },
      { status: 400 }
    );
  }

  const proveedor = solicitado === 'default' ? await proveedorPorDefecto() : getProvider(solicitado);
  if (!proveedor) {
    return NextResponse.json(
      { ok: false, error: 'No hay proveedor de almacenamiento seleccionado o configurado.' },
      { status: 400 }
    );
  }

  if (esUrlDeProveedor(origen) === proveedor.id) {
    return NextResponse.json({ ok: true, url: origen, proveedor: proveedor.id, yaAlojada: true });
  }

  try {
    const resultado = esRemota
      ? await processRemoteImageToProvider(origen, proveedor)
      : await processImageToProvider(await leerArchivoLocal(origen), 'webp', proveedor);

    return NextResponse.json({
      ok: true,
      url: resultado.url,
      proveedor: proveedor.id,
      bytes: resultado.bytes,
      width: resultado.width,
      height: resultado.height
    });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error desconocido';
    console.error('[api/imagenes/alojar] No se pudo alojar la imagen.', error);
    return NextResponse.json({ ok: false, error: mensaje }, { status: 502 });
  }
}
