import { Cross } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import PharmacyManager, { type PharmacyDTO } from '@/components/admin/PharmacyManager';

/**
 * /admin/farmacias — Altas y edición de farmacias.
 * Es la base de todo lo demás: sin farmacias cargadas no hay organigrama
 * que generar ni importación que mapear.
 */

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Farmacias' };

export default async function AdminFarmaciasPage() {
  const farmacias = await prisma.pharmacy.findMany({
    orderBy: [{ position: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { shifts: true } } }
  });

  const datos: PharmacyDTO[] = farmacias.map((farmacia) => ({
    id: farmacia.id,
    slug: farmacia.slug,
    name: farmacia.name,
    alias: farmacia.alias,
    address: farmacia.address,
    zone: farmacia.zone,
    phone: farmacia.phone,
    whatsapp: farmacia.whatsapp,
    email: farmacia.email,
    latitude: farmacia.latitude,
    longitude: farmacia.longitude,
    notes: farmacia.notes,
    position: farmacia.position,
    isActive: farmacia.isActive,
    shifts: farmacia._count.shifts
  }));

  const activas = datos.filter((farmacia) => farmacia.isActive).length;
  const conTurnos = datos.filter((farmacia) => farmacia.shifts > 0).length;
  const sinCoordenadas = datos.filter(
    (farmacia) => farmacia.isActive && (farmacia.latitude === null || farmacia.longitude === null)
  ).length;

  return (
    <div className="space-y-6">
      <header>
        <p className="kicker text-brand-600">Panel</p>
        <h1 className="admin-title flex items-center gap-2 text-xl">
          <Cross className="h-5 w-5 text-brand-700" aria-hidden />
          Farmacias
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-news-500">
          Cargá las farmacias de turno con sus datos de contacto, dirección y ubicación. Los alias permiten reconocerlas
          en el organigrama del Colegio de Farmacéuticos.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="admin-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-news-500">Farmacias</p>
          <p className="mt-1 font-editorial text-2xl font-bold text-brand-900">{datos.length}</p>
        </div>
        <div className="admin-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-news-500">Activas</p>
          <p className="mt-1 font-editorial text-2xl font-bold text-brand-900">{activas}</p>
        </div>
        <div className="admin-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-news-500">Con turnos cargados</p>
          <p className="mt-1 font-editorial text-2xl font-bold text-brand-900">{conTurnos}</p>
        </div>
        <div className="admin-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-news-500">Activas sin coordenadas</p>
          <p className="mt-1 font-editorial text-2xl font-bold text-brand-900">{sinCoordenadas}</p>
          <p className="mt-1 text-xs text-news-500">Sin latitud y longitud el mapa usa la dirección.</p>
        </div>
      </section>

      <PharmacyManager pharmacies={datos} />
    </div>
  );
}
