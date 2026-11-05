import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { AlertCircle, ArrowLeft, CheckCircle2, ImagePlus } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import {
  DIAS_VIGENCIA_CLASIFICADO,
  LOCALIDADES,
  MAX_FOTOS_CLASIFICADO,
  SECCIONES_CLASIFICADOS
} from '@/lib/constants';
import { formatPrecio } from '@/lib/utils';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { crearClasificado } from '../actions';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Nuevo clasificado | Panel de administración'
};

type SearchParams = { [key: string]: string | string[] | undefined };

const ESTADOS = [
  { value: 'PENDING', label: 'Pendiente' },
  { value: 'PUBLISHED', label: 'Publicado' },
  { value: 'REJECTED', label: 'Rechazado' },
  { value: 'EXPIRED', label: 'Expirado' }
];

/** Página para crear un aviso clasificado nuevo desde el panel de administración. */
export default function NuevoClasificadoPage({ searchParams }: { searchParams: SearchParams }) {
  const mensajeOk = searchParams?.ok ? String(searchParams.ok) : undefined;
  const mensajeError = searchParams?.error ? String(searchParams.error) : undefined;

  return (
    <div className="space-y-6">
      <div className="admin-card">
        <div className="admin-card-header">
          <div className="flex items-center gap-2">
            <ImagePlus className="h-5 w-5" aria-hidden="true" />
            <h1 className="admin-title">Nuevo clasificado</h1>
          </div>
          <p className="mt-0.5 text-xs text-news-500">
            Cargá un aviso nuevo que pasará por moderación antes de publicarse.
          </p>
        </div>

        <Link href="/admin/clasificados" className="btn-ghost btn-sm">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Volver al listado
        </Link>
      </div>

      {mensajeOk ? (
        <p role="status" className="flex items-start gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {mensajeOk}
        </p>
      ) : null}

      {mensajeError ? (
        <p role="alert" className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {mensajeError}
        </p>
      ) : null}

      <form action={crearClasificado} encType="multipart/form-data" className="admin-card space-y-4">
        <div>
          <label htmlFor="title" className="label">
            Título *
          </label>
          <input
            id="title"
            name="title"
            required
            minLength={3}
            maxLength={120}
            className="input"
            placeholder="Ej: Vendo bicicleta de montaña"
          />
        </div>

        <div>
          <label htmlFor="description" className="label">
            Descripción *
          </label>
          <textarea
            id="description"
            name="description"
            required
            minLength={10}
            maxLength={2000}
            rows={6}
            className="textarea"
            placeholder="Contá los detalles del aviso..."
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="section" className="label">
              Sección *
            </label>
            <select id="section" name="section" required className="select">
              {SECCIONES_CLASIFICADOS.map((seccion) => (
                <option key={seccion} value={seccion}>
                  {seccion}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="locality" className="label">
              Localidad *
            </label>
            <select id="locality" name="locality" required defaultValue="Saladillo" className="select">
              {LOCALIDADES.map((localidad) => (
                <option key={localidad} value={localidad}>
                  {localidad}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="price" className="label">
              Precio (opcional, en pesos)
            </label>
            <input
              id="price"
              name="price"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              className="input"
              placeholder="0"
            />
            <p className="mt-1 text-xs text-news-500">Dejalo vacío si no aplica.</p>
          </div>
          <div>
            <label htmlFor="contactEmail" className="label">
              Correo de contacto (opcional)
            </label>
            <input
              id="contactEmail"
              name="contactEmail"
              type="email"
              className="input"
              placeholder="vecino@correo.com"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="contactName" className="label">
              Nombre de contacto *
            </label>
            <input
              id="contactName"
              name="contactName"
              required
              minLength={2}
              maxLength={80}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="contactPhone" className="label">
              Teléfono / WhatsApp *
            </label>
            <input
              id="contactPhone"
              name="contactPhone"
              required
              minLength={6}
              maxLength={30}
              className="input"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="estado" className="label">
              Estado de moderación *
            </label>
            <select id="estado" name="estado" required defaultValue="PENDING" className="select">
              {ESTADOS.map((estado) => (
                <option key={estado.value} value={estado.value}>
                  {estado.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="expiresAt" className="label">
              Vigencia hasta (opcional)
            </label>
            <input
              id="expiresAt"
              name="expiresAt"
              type="date"
              className="input"
            />
            <p className="mt-1 text-xs text-news-500">
              Si lo publicás sin fecha, se asignan {DIAS_VIGENCIA_CLASIFICADO} días desde hoy.
            </p>
          </div>
        </div>

        <div>
          <label htmlFor="photos" className="label">
            Fotos (hasta {MAX_FOTOS_CLASIFICADO})
          </label>
          <input
            id="photos"
            name="photos"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="input file:mr-3 file:rounded file:border-0 file:bg-brand-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
          />
          <p className="mt-1 text-xs text-news-500">
            JPG, PNG o WebP de hasta 6 MB cada una. Se convierten a WebP automáticamente.
          </p>
        </div>

        <div className="flex justify-end border-t border-news-200 pt-4">
          <button type="submit" className="btn-primary">
            Crear clasificado
          </button>
        </div>
      </form>
    </div>
  );
}
