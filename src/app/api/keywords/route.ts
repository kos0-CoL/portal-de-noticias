import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireApiSession, UnauthorizedError } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const keywordSchema = z.object({
  word: z.string().min(2, 'La palabra debe tener al menos 2 caracteres.').max(80),
  type: z.enum(['LOCALIDAD', 'FUNCIONARIO', 'TEMA']).optional(),
  weight: z.coerce.number().int().min(1).max(10).optional(),
  isActive: z.boolean().optional()
});

async function sesionValida() {
  try {
    await requireApiSession();
    return null;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
    }
    throw error;
  }
}

/** GET: lista de palabras clave locales con su tipo y peso. */
export async function GET() {
  const rechazo = await sesionValida();
  if (rechazo) return rechazo;

  const keywords = await prisma.keyword.findMany({
    orderBy: [{ weight: 'desc' }, { word: 'asc' }]
  });
  return NextResponse.json({ ok: true, keywords });
}

/** POST: crea una palabra clave. */
export async function POST(request: NextRequest) {
  const rechazo = await sesionValida();
  if (rechazo) return rechazo;

  try {
    const datos = keywordSchema.parse(await request.json());
    const keyword = await prisma.keyword.create({
      data: {
        word: datos.word.trim(),
        type: datos.type ?? 'LOCALIDAD',
        weight: datos.weight ?? 10,
        isActive: datos.isActive ?? true
      }
    });
    return NextResponse.json({ ok: true, keyword }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: error.errors[0]?.message ?? 'Datos inválidos.' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { ok: false, error: 'No se pudo crear la palabra clave (¿ya existe?).' },
      { status: 500 }
    );
  }
}

/** PATCH: edita una palabra clave por ?id=. */
export async function PATCH(request: NextRequest) {
  const rechazo = await sesionValida();
  if (rechazo) return rechazo;

  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ ok: false, error: 'Falta el parámetro id.' }, { status: 400 });
  }

  try {
    const datos = keywordSchema.partial().parse(await request.json());
    const keyword = await prisma.keyword.update({
      where: { id },
      data: {
        ...(datos.word !== undefined ? { word: datos.word.trim() } : {}),
        ...(datos.type !== undefined ? { type: datos.type } : {}),
        ...(datos.weight !== undefined ? { weight: datos.weight } : {}),
        ...(datos.isActive !== undefined ? { isActive: datos.isActive } : {})
      }
    });
    return NextResponse.json({ ok: true, keyword });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: error.errors[0]?.message ?? 'Datos inválidos.' },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: false, error: 'No se pudo actualizar la palabra clave.' }, { status: 500 });
  }
}

/** DELETE: elimina una palabra clave por ?id=. */
export async function DELETE(request: NextRequest) {
  const rechazo = await sesionValida();
  if (rechazo) return rechazo;

  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ ok: false, error: 'Falta el parámetro id.' }, { status: 400 });
  }

  try {
    await prisma.keyword.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'No se pudo eliminar la palabra clave.' }, { status: 500 });
  }
}
