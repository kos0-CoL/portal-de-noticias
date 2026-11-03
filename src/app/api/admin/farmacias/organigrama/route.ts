import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { UnauthorizedError, requireApiSession } from '@/lib/auth';
import { getPharmacySettings, setSetting, SETTING_KEYS } from '@/lib/settings';
import { generarMes, normalizarOrden } from '@/lib/pharmacy/rotation';
import { diasDelMes, isoDeFecha, mesEnSaladillo, parseMes, rangoDeMes } from '@/lib/pharmacy/schedule';

/**
 * Organigrama mensual de turnos.
 *
 * GET    ?mes=YYYY-MM              → turnos del mes, farmacias y ciclo configurado.
 * POST   { mes, modo }             → genera el mes a partir del ciclo de rotación.
 * PATCH  { cambios: [...] }        → alta, edición y borrado de días sueltos.
 * DELETE ?mes=YYYY-MM              → limpia el mes completo.
 * PUT    { orden, ancla }          → guarda el ciclo de rotación.
 *
 * Los turnos editados a mano quedan con `source = MANUAL`, que es lo que
 * permite regenerar el mes sin pisarlos.
 */

const MODOS = ['respetar-manual', 'reemplazar-todo', 'copiar-anterior'] as const;

const generarSchema = z.object({
  mes: z.string().trim().regex(/^\d{4}-\d{2}$/, 'Mes inválido'),
  modo: z.enum(MODOS).default('respetar-manual')
});

const cambiosSchema = z.object({
  cambios: z
    .array(
      z.object({
        date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
        pharmacyId: z.string().trim().min(1).nullable(),
        note: z.string().trim().max(200, 'La nota es demasiado larga').nullable().optional()
      })
    )
    .min(1, 'No hay cambios para aplicar')
    .max(62, 'Se pueden tocar hasta 62 días por vez')
});

const rotacionSchema = z.object({
  /** Ids de farmacia, en orden. Se permiten repeticiones: son parte del ciclo. */
  orden: z.array(z.string().trim().min(1)).max(60, 'El ciclo es demasiado largo'),
  ancla: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha de referencia no es válida')
    .nullable()
});

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
}

/** Mes pedido por query, o el mes en curso en Saladillo si no viene o es inválido. */
function mesDeRequest(request: Request): { anio: number; mes: number; clave: string } {
  const pedido = new URL(request.url).searchParams.get('mes');
  const parsed = pedido ? parseMes(pedido) : null;
  if (parsed) return { ...parsed, clave: `${parsed.anio}-${String(parsed.mes).padStart(2, '0')}` };

  const actual = mesEnSaladillo();
  const { anio, mes } = parseMes(actual)!;
  return { anio, mes, clave: actual };
}

export async function GET(request: Request) {
  try {
    await requireApiSession();
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }

  const { anio, mes, clave } = mesDeRequest(request);
  const { inicio, fin } = rangoDeMes(anio, mes);

  const [turnos, farmacias, settings] = await Promise.all([
    prisma.pharmacyShift.findMany({
      where: { date: { gte: inicio, lt: fin } },
      include: { pharmacy: { select: { id: true, name: true, isActive: true } } },
      orderBy: { date: 'asc' }
    }),
    prisma.pharmacy.findMany({
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, alias: true, isActive: true }
    }),
    getPharmacySettings()
  ]);

  return NextResponse.json({
    ok: true,
    mes: clave,
    turnos: turnos.map((turno) => ({
      id: turno.id,
      fecha: isoDeFecha(turno.date),
      pharmacyId: turno.pharmacyId,
      pharmacyName: turno.pharmacy.name,
      pharmacyActiva: turno.pharmacy.isActive,
      note: turno.note,
      source: turno.source
    })),
    farmacias,
    orden: settings.rotationOrder,
    ancla: settings.rotationAnchorDate,
    horas: { shiftStart: settings.shiftStart, shiftEnd: settings.shiftEnd }
  });
}

export async function POST(request: Request) {
  try {
    await requireApiSession();
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }

  const body = await request.json().catch(() => null);
  const parsed = generarSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
  }
  const pedido = parseMes(parsed.data.mes);
  if (!pedido) {
    return NextResponse.json({ ok: false, error: 'Mes inválido' }, { status: 400 });
  }

  const { inicio, fin } = rangoDeMes(pedido.anio, pedido.mes);
  const existentes = await prisma.pharmacyShift.findMany({
    where: { date: { gte: inicio, lt: fin } },
    select: { date: true, source: true }
  });

  // Los días corregidos a mano no se pisan salvo que se pida reemplazar todo.
  const aMano = new Set(existentes.filter((turno) => turno.source === 'MANUAL').map((turno) => isoDeFecha(turno.date)));
  const reemplazar = parsed.data.modo === 'reemplazar-todo';
  const sePuede = (fechaISO: string) => reemplazar || !aMano.has(fechaISO);

  if (parsed.data.modo === 'copiar-anterior') {
    const anterior = pedido.mes === 1 ? { anio: pedido.anio - 1, mes: 12 } : { anio: pedido.anio, mes: pedido.mes - 1 };
    const rangoAnterior = rangoDeMes(anterior.anio, anterior.mes);
    const previos = await prisma.pharmacyShift.findMany({
      where: { date: { gte: rangoAnterior.inicio, lt: rangoAnterior.fin } },
      select: { date: true, pharmacyId: true, note: true }
    });

    // Se copia el mismo día del mes anterior: el 5 de este mes toma el turno del 5 anterior.
    const porDia = new Map(previos.map((turno) => [isoDeFecha(turno.date).slice(8, 10), turno]));
    const operaciones = [];
    let sinCopiar = 0;

    for (let dia = 1; dia <= diasDelMes(pedido.anio, pedido.mes); dia += 1) {
      const fecha = new Date(Date.UTC(pedido.anio, pedido.mes - 1, dia));
      if (!sePuede(isoDeFecha(fecha))) continue;

      const previo = porDia.get(String(dia).padStart(2, '0'));
      if (!previo) {
        sinCopiar += 1;
        continue;
      }

      operaciones.push(
        prisma.pharmacyShift.upsert({
          where: { date: fecha },
          update: { pharmacyId: previo.pharmacyId, source: 'MANUAL', note: previo.note },
          create: { pharmacyId: previo.pharmacyId, date: fecha, source: 'MANUAL', note: previo.note }
        })
      );
    }

    if (operaciones.length) await prisma.$transaction(operaciones);

    return NextResponse.json({
      ok: true,
      mes: parsed.data.mes,
      copiados: operaciones.length,
      sinCopiar
    });
  }

  const [settings, activas] = await Promise.all([
    getPharmacySettings(),
    prisma.pharmacy.findMany({ where: { isActive: true }, select: { id: true } })
  ]);

  // Un id borrado o desactivado no puede quedar en el ciclo: rompería la
  // relación y, además, correría la fase del ciclo sin aviso.
  const orden = normalizarOrden(settings.rotationOrder, activas.map((farmacia) => farmacia.id));
  if (!orden.length || !settings.rotationAnchorDate) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Antes de generar hay que armar el ciclo de rotación y fijar la fecha de referencia.'
      },
      { status: 400 }
    );
  }

  const generados = generarMes(pedido.anio, pedido.mes, { orden, ancla: settings.rotationAnchorDate });
  if (!generados.length) {
    return NextResponse.json({ ok: false, error: 'El ciclo no tiene farmacias válidas' }, { status: 400 });
  }

  const operaciones = generados
    .filter((dia) => sePuede(dia.fechaISO))
    .map((dia) =>
      prisma.pharmacyShift.upsert({
        where: { date: dia.fecha },
        update: { pharmacyId: dia.pharmacyId, source: 'ROTACION' },
        create: { pharmacyId: dia.pharmacyId, date: dia.fecha, source: 'ROTACION' }
      })
    );

  if (operaciones.length) await prisma.$transaction(operaciones);

  return NextResponse.json({
    ok: true,
    mes: parsed.data.mes,
    generados: operaciones.length,
    respetados: generados.length - operaciones.length
  });
}

export async function PATCH(request: Request) {
  try {
    await requireApiSession();
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }

  const body = await request.json().catch(() => null);
  const parsed = cambiosSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
  }

  const ids = [...new Set(parsed.data.cambios.map((cambio) => cambio.pharmacyId).filter(Boolean))] as string[];
  if (ids.length) {
    const existentes = await prisma.pharmacy.findMany({ where: { id: { in: ids } }, select: { id: true } });
    const faltantes = ids.filter((id) => !existentes.some((farmacia) => farmacia.id === id));
    if (faltantes.length) {
      return NextResponse.json({ ok: false, error: 'Alguna de las farmacias ya no existe' }, { status: 400 });
    }
  }

  const operaciones = parsed.data.cambios.map((cambio) => {
    const fecha = new Date(`${cambio.date}T00:00:00.000Z`);

    if (!cambio.pharmacyId) {
      return prisma.pharmacyShift.deleteMany({ where: { date: fecha } });
    }

    return prisma.pharmacyShift.upsert({
      where: { date: fecha },
      update: {
        pharmacyId: cambio.pharmacyId,
        source: 'MANUAL',
        ...(cambio.note !== undefined ? { note: cambio.note } : {})
      },
      create: {
        pharmacyId: cambio.pharmacyId,
        date: fecha,
        source: 'MANUAL',
        note: cambio.note ?? null
      }
    });
  });

  await prisma.$transaction(operaciones);

  return NextResponse.json({ ok: true, aplicados: parsed.data.cambios.length });
}

export async function DELETE(request: Request) {
  try {
    await requireApiSession();
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }

  const { anio, mes, clave } = mesDeRequest(request);
  const { inicio, fin } = rangoDeMes(anio, mes);

  const { count } = await prisma.pharmacyShift.deleteMany({ where: { date: { gte: inicio, lt: fin } } });

  return NextResponse.json({ ok: true, mes: clave, borrados: count });
}

/** PUT — guarda el ciclo de rotación y su fecha de referencia. */
export async function PUT(request: Request) {
  try {
    await requireApiSession();
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }

  const body = await request.json().catch(() => null);
  const parsed = rotacionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
  }

  const farmacias = await prisma.pharmacy.findMany({ select: { id: true, name: true, isActive: true } });
  const porId = new Map(farmacias.map((farmacia) => [farmacia.id, farmacia]));

  // Acá se rechaza en vez de limpiar en silencio: si el ciclo guardado no es el
  // que el usuario armó, la rotación sale corrida sin que se note.
  for (const id of parsed.data.orden) {
    const farmacia = porId.get(id);
    if (!farmacia) {
      return NextResponse.json({ ok: false, error: 'Alguna de las farmacias del ciclo ya no existe' }, { status: 400 });
    }
    if (!farmacia.isActive) {
      return NextResponse.json(
        { ok: false, error: `"${farmacia.name}" está inactiva: activala para poder usarla en el ciclo` },
        { status: 400 }
      );
    }
  }

  await Promise.all([
    setSetting(SETTING_KEYS.pharmacyRotationOrder, parsed.data.orden, { group: 'pharmacy' }),
    setSetting(SETTING_KEYS.pharmacyRotationAnchorDate, parsed.data.ancla ?? '', { group: 'pharmacy' })
  ]);

  return NextResponse.json({ ok: true, orden: parsed.data.orden, ancla: parsed.data.ancla });
}
