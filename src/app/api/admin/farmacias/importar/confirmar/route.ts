import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { UnauthorizedError, requireApiSession } from '@/lib/auth';
import { normalizarAlias, primerError, primerSlugLibre } from '@/lib/pharmacy/validation';
import { normalizarNombre, nombrePropio, resolverFarmacia, type FarmaciaMapeable } from '@/lib/pharmacy/import';
import { parseMes, rangoDeMes } from '@/lib/pharmacy/schedule';

/**
 * POST /api/admin/farmacias/importar/confirmar — aplica la importación.
 *
 * Recibe la decisión ya tomada en el panel: los días tildados (con la farmacia
 * que les corresponde) y las farmacias nuevas que hay que dar de alta. Los días
 * que no vienen en la lista no se tocan, y tampoco se borra nada.
 *
 * Las farmacias que el Colegio publica y no están cargadas se crean **inactivas**
 * y con el nombre del Colegio como alias: así el mapeo queda resuelto para la
 * próxima importación, pero no aparecen en el sitio hasta completarlas y
 * activarlas a mano.
 */

const fecha = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida');

const confirmarSchema = z.object({
  mes: z.string().trim().regex(/^\d{4}-\d{2}$/, 'Mes inválido'),
  dias: z
    .array(
      z.object({
        fecha,
        /** Nombre tal como lo publica el Colegio: es la clave del mapeo. */
        nombre: z.string().trim().min(1),
        /** Solo cuando el usuario eligió a mano una farmacia distinta. */
        pharmacyId: z.string().trim().min(1).nullable().optional()
      })
    )
    .max(62, 'Se pueden aplicar hasta 62 días por vez')
    .default([]),
  crear: z
    .array(
      z.object({
        nombre: z.string().trim().min(1),
        name: z.string().trim().min(2).optional(),
        address: z.string().trim().min(3, 'La dirección es obligatoria'),
        phone: z.string().trim().max(40).nullable().optional()
      })
    )
    .max(20, 'Son demasiadas farmacias nuevas para crear de una vez')
    .default([])
});

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
}

export async function POST(request: Request) {
  try {
    await requireApiSession();
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }

  const body = await request.json().catch(() => null);
  const parsed = confirmarSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: primerError(parsed.error) }, { status: 400 });
  }

  const pedido = parseMes(parsed.data.mes);
  if (!pedido) {
    return NextResponse.json({ ok: false, error: 'Mes inválido' }, { status: 400 });
  }

  const { inicio, fin } = rangoDeMes(pedido.anio, pedido.mes);

  // Un día fuera del mes importado casi siempre es un error del cliente, y
  // escribirlo dejaría un turno suelto imposible de rastrear desde esta pantalla.
  const pedidos = new Map(parsed.data.dias.map((dia) => [dia.fecha, dia]));
  for (const fechaPedida of pedidos.keys()) {
    const momento = new Date(`${fechaPedida}T00:00:00.000Z`);
    if (momento < inicio || momento >= fin) {
      return NextResponse.json(
        { ok: false, error: `El día ${fechaPedida} no pertenece al mes que se está importando` },
        { status: 400 }
      );
    }
  }

  const filas = await prisma.pharmacy.findMany({ select: { id: true, name: true, alias: true } });
  const farmacias: FarmaciaMapeable[] = filas.map((farmacia) => ({
    id: farmacia.id,
    name: farmacia.name,
    alias: farmacia.alias
  }));

  const idsPedidos = [...new Set(parsed.data.dias.map((dia) => dia.pharmacyId).filter(Boolean))] as string[];
  const faltantes = idsPedidos.filter((id) => !farmacias.some((farmacia) => farmacia.id === id));
  if (faltantes.length) {
    return NextResponse.json({ ok: false, error: 'Alguna de las farmacias elegidas ya no existe' }, { status: 400 });
  }

  const conSlug = await prisma.pharmacy.findMany({ select: { slug: true } });
  const slugs = conSlug.map((fila) => fila.slug);
  const creadas: { id: string; name: string }[] = [];

  for (const nueva of parsed.data.crear) {
    if (resolverFarmacia(nueva.nombre, farmacias)) continue;

    const name = nueva.name?.trim() || nombrePropio(nueva.nombre);
    const slug = primerSlugLibre(name, slugs);
    slugs.push(slug);

    const farmacia = await prisma.pharmacy.create({
      data: {
        slug,
        name,
        alias: normalizarAlias([normalizarNombre(nueva.nombre)]),
        address: nueva.address,
        phone: nueva.phone ?? null,
        isActive: false,
        notes: 'Creada desde la importación del Colegio. Completá los datos y activala para que aparezca en el sitio.'
      },
      select: { id: true, name: true, alias: true }
    });

    farmacias.push({ id: farmacia.id, name: farmacia.name, alias: farmacia.alias });
    creadas.push({ id: farmacia.id, name: farmacia.name });
  }

  const operaciones = [];
  let sinMapear = 0;

  for (const dia of pedidos.values()) {
    const pharmacyId = dia.pharmacyId ?? resolverFarmacia(dia.nombre, farmacias);
    if (!pharmacyId) {
      sinMapear += 1;
      continue;
    }

    const momento = new Date(`${dia.fecha}T00:00:00.000Z`);
    operaciones.push(
      prisma.pharmacyShift.upsert({
        where: { date: momento },
        update: { pharmacyId, source: 'IMPORT' },
        create: { pharmacyId, date: momento, source: 'IMPORT' }
      })
    );
  }

  if (operaciones.length) await prisma.$transaction(operaciones);

  return NextResponse.json({
    ok: true,
    mes: parsed.data.mes,
    aplicados: operaciones.length,
    sinMapear,
    creadas
  });
}
