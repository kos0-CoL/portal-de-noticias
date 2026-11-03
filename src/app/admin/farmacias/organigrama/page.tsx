import Link from 'next/link';
import { ArrowLeft, CalendarDays, Download } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getPharmacySettings } from '@/lib/settings';
import {
  hoyEnSaladillo,
  isoDeFecha,
  mesEnSaladillo,
  mesVecino,
  nombreDeMes,
  parseMes,
  rangoDeMes,
  semanasDelMes
} from '@/lib/pharmacy/schedule';
import PharmacyScheduleCalendar, { type DiaOrganigrama } from '@/components/admin/PharmacyScheduleCalendar';
import RotationOrderEditor, { type FarmaciaOpcion } from '@/components/admin/RotationOrderEditor';
import OrganigramaExportButton from '@/components/admin/OrganigramaExportButton';

/**
 * /admin/farmacias/organigrama — Armado y corrección del mes de turnos.
 *
 * El mes se genera desde el ciclo de rotación y después se corrige día por día:
 * en el organigrama real hay excepciones sobre el ciclo, así que generar y
 * editar son dos momentos distintos, no alternativas.
 */

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Organigrama de farmacias' };

export default async function OrganigramaPage({ searchParams }: { searchParams: { mes?: string } }) {
  const pedido = (typeof searchParams.mes === 'string' ? parseMes(searchParams.mes) : null) ?? parseMes(mesEnSaladillo())!;
  const { anio, mes } = pedido;
  const clave = `${anio}-${String(mes).padStart(2, '0')}`;
  const { inicio, fin } = rangoDeMes(anio, mes);

  const [turnos, farmacias, settings] = await Promise.all([
    prisma.pharmacyShift.findMany({
      where: { date: { gte: inicio, lt: fin } },
      include: { pharmacy: { select: { id: true, name: true, isActive: true } } },
      orderBy: { date: 'asc' }
    }),
    prisma.pharmacy.findMany({
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, isActive: true }
    }),
    getPharmacySettings()
  ]);

  const porFecha = new Map(turnos.map((turno) => [isoDeFecha(turno.date), turno]));

  const semanas: DiaOrganigrama[][] = semanasDelMes(anio, mes).map((semana) =>
    semana.map((fecha) => {
      const iso = isoDeFecha(fecha);
      const turno = porFecha.get(iso);
      return {
        fecha: iso,
        dia: fecha.getUTCDate(),
        delMes: iso.slice(0, 7) === clave,
        pharmacyId: turno?.pharmacyId ?? null,
        pharmacyName: turno?.pharmacy.name ?? null,
        note: turno?.note ?? null,
        source: turno?.source ?? null
      };
    })
  );

  const diasDelMes = semanas.flat().filter((dia) => dia.delMes);
  const sinAsignar = diasDelMes.filter((dia) => !dia.pharmacyId).length;
  const aMano = diasDelMes.filter((dia) => dia.source === 'MANUAL').length;
  const cicloListo = settings.rotationOrder.length > 0 && Boolean(settings.rotationAnchorDate);

  const opciones: FarmaciaOpcion[] = farmacias.map((farmacia) => ({
    id: farmacia.id,
    name: farmacia.name,
    isActive: farmacia.isActive
  }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="kicker text-brand-600">Panel</p>
          <h1 className="admin-title flex items-center gap-2 text-xl">
            <CalendarDays className="h-5 w-5 text-brand-700" aria-hidden />
            Organigrama de farmacias
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-news-500">
            Generá el mes desde el ciclo de rotación y después corregí los días que haga falta. Los días tocados a mano
            quedan marcados y no se pisan al volver a generar.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <OrganigramaExportButton mes={clave} />
          <Link className="btn-ghost btn-sm" href="/admin/farmacias/importar">
            <Download className="h-3.5 w-3.5" aria-hidden />
            Importar del Colegio
          </Link>
          <Link className="btn-ghost btn-sm" href="/admin/farmacias">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Farmacias
          </Link>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="admin-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-news-500">Mes</p>
          <p className="mt-1 font-editorial text-2xl font-bold text-brand-900">{nombreDeMes(anio, mes)}</p>
        </div>
        <div className="admin-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-news-500">Días con turno</p>
          <p className="mt-1 font-editorial text-2xl font-bold text-brand-900">{diasDelMes.length - sinAsignar}</p>
          <p className="mt-1 text-xs text-news-500">Sin asignar: {sinAsignar}</p>
        </div>
        <div className="admin-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-news-500">Corregidos a mano</p>
          <p className="mt-1 font-editorial text-2xl font-bold text-brand-900">{aMano}</p>
        </div>
        <div className="admin-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-news-500">Ciclo de rotación</p>
          <p className="mt-1 font-editorial text-2xl font-bold text-brand-900">
            {cicloListo ? `${settings.rotationOrder.length} posiciones` : 'Sin armar'}
          </p>
          <p className="mt-1 text-xs text-news-500">
            Turnos de {settings.shiftStart} a {settings.shiftEnd} del día siguiente.
          </p>
        </div>
      </section>

      <RotationOrderEditor
        farmacias={opciones}
        orden={settings.rotationOrder}
        ancla={settings.rotationAnchorDate}
        desde={isoDeFecha(hoyEnSaladillo())}
      />

      <PharmacyScheduleCalendar
        mes={clave}
        titulo={nombreDeMes(anio, mes)}
        mesAnterior={mesVecino(anio, mes, -1)}
        mesSiguiente={mesVecino(anio, mes, 1)}
        semanas={semanas}
        farmacias={opciones}
      />
    </div>
  );
}
