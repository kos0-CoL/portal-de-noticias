import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertCircle, ArrowLeft, CheckCircle2, ExternalLink, ImagePlus, Trash2 } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { DIAS_VIGENCIA_CLASIFICADO, LOCALIDADES, MAX_FOTOS_CLASIFICADO, SECCIONES_CLASIFICADOS } from '@/lib/constants';
import { formatFecha, formatPrecio } from '@/lib/utils';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { ConfirmDeleteButton } from '@/components/admin/ConfirmDeleteButton';
import { actualizarClasificado, agregarFotosClasificado, eliminarFotoClasificado } from '../actions';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Editar clasificado | Panel de administración'
};

type SearchParams = { [key: string]: string | string[] | undefined };

function single(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value && value.length > 0 ? value : undefined;
}

/** Formatea una fecha al valor que espera <input type="date"> (yyyy-mm-dd local). */
function paraInputFecha(fecha: Date | null): string {
  if (!fecha) return '';
  const dia = String(fecha.getDate()).padStart(2, '0');
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

const ESTADOS = [
  { value: 'PENDING', label: 'Pendiente' },
  { value: 'PUBLISHED', label: 'Publicado' },
  { value: 'REJECTED', label: 'Rechazado' },
  { value: 'EXPIRED', label: 'Expirado' }
];

/** Edición completa de un aviso: datos, estado, vigencia y galería de fotos. */
export default async function EditarClasificadoPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: SearchParams;
}) {
  const aviso = await prisma.classified.findUnique({
    where: { id: params.id },
    include: { images: { orderBy: { position: 'asc' } } }
  });

  if (!aviso) notFound();

  const mensajeOk = single(searchParams?.ok);
  const mensajeError = single(searchParams?.error);
  const puedeAgregarFotos = aviso.images.length < MAX_FOTOS_CLASIFICADO;

  return (
    <div className="space-y-6">
      <div className="admin-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={aviso.status} />
              <span className="badge badge-blue">{aviso.section}</span>
            </div>
            <h1 className="headline-md line-clamp-2-custom">{aviso.title}</h1>
            <p className="text-xs text-news-500">
              Creado el {formatFecha(aviso.createdAt, false)} · {aviso.locality}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href="/admin/clasificados" className="btn-ghost btn-sm">
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Volver al listado
            </Link>
            {aviso.status === 'PUBLISHED' ? (
              <Link href={`/clasificados/${aviso.id}`} target="_blank" className="btn-secondary btn-sm">
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                Ver en el sitio
              </Link>
            ) : null}
            <ConfirmDeleteButton
              url={`/api/clasificados/${aviso.id}`}
              label="Eliminar"
              confirmText={`¿Eliminar el clasificado "${aviso.title}"? Esta acción no se puede deshacer.`}
              redirectTo="/admin/clasificados"
            />
          </div>
        </div>
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <form action={actualizarClasificado} className="admin-card space-y-4">
          <input type="hidden" name="id" value={aviso.id} />

          <div>
            <label htmlFor="ed-title" className="label">
              Título *
            </label>
            <input
              id="ed-title"
              name="title"
              required
              minLength={3}
              maxLength={120}
              defaultValue={aviso.title}
              className="input"
            />
          </div>

          <div>
            <label htmlFor="ed-description" className="label">
              Descripción *
            </label>
            <textarea
              id="ed-description"
              name="description"
              required
              minLength={10}
              maxLength={2000}
              defaultValue={aviso.description}
              rows={6}
              className="textarea"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="ed-section" className="label">
                Sección *
              </label>
              <select id="ed-section" name="section" required defaultValue={aviso.section} className="select">
                {SECCIONES_CLASIFICADOS.map((seccion) => (
                  <option key={seccion} value={seccion}>
                    {seccion}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ed-locality" className="label">
                Localidad *
              </label>
              <select id="ed-locality" name="locality" required defaultValue={aviso.locality} className="select">
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
              <label htmlFor="ed-price" className="label">
                Precio (opcional, en pesos)
              </label>
              <input
                id="ed-price"
                name="price"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                defaultValue={aviso.price ? Number(aviso.price) : ''}
                className="input"
                placeholder="0"
              />
              <p className="mt-1 text-xs text-news-500">{formatPrecio(aviso.price ? Number(aviso.price) : null)}</p>
            </div>
            <div>
              <label htmlFor="ed-email" className="label">
                Correo de contacto (opcional)
              </label>
              <input
                id="ed-email"
                name="contactEmail"
                type="email"
                defaultValue={aviso.contactEmail ?? ''}
                className="input"
                placeholder="vecino@correo.com"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="ed-name" className="label">
                Nombre de contacto *
              </label>
              <input
                id="ed-name"
                name="contactName"
                required
                minLength={2}
                maxLength={80}
                defaultValue={aviso.contactName}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="ed-phone" className="label">
                Teléfono / WhatsApp *
              </label>
              <input
                id="ed-phone"
                name="contactPhone"
                required
                minLength={6}
                maxLength={30}
                defaultValue={aviso.contactPhone}
                className="input"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="ed-estado" className="label">
                Estado de moderación *
              </label>
              <select id="ed-estado" name="estado" required defaultValue={aviso.status} className="select">
                {ESTADOS.map((estado) => (
                  <option key={estado.value} value={estado.value}>
                    {estado.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ed-expires" className="label">
                Vigencia hasta (opcional)
              </label>
              <input
                id="ed-expires"
                name="expiresAt"
                type="date"
                defaultValue={paraInputFecha(aviso.expiresAt)}
                className="input"
              />
              <p className="mt-1 text-xs text-news-500">
                Si lo publicás sin fecha, se asignan {DIAS_VIGENCIA_CLASIFICADO} días desde hoy.
              </p>
            </div>
          </div>

          <div className="flex justify-end border-t border-news-200 pt-4">
            <button type="submit" className="btn-primary">
              Guardar cambios
            </button>
          </div>
        </form>

        <aside className="space-y-6">
          <div className="admin-card">
            <div className="admin-card-header">
              <div>
                <h2 className="admin-title">Fotos del aviso</h2>
                <p className="mt-0.5 text-xs text-news-500">
                  {aviso.images.length} de {MAX_FOTOS_CLASIFICADO}
                </p>
              </div>
            </div>

            {aviso.images.length > 0 ? (
              <ul className="grid grid-cols-3 gap-2">
                {aviso.images.map((foto, indice) => (
                  <li key={foto.id} className="relative overflow-hidden rounded-md border border-news-200 bg-news-100">
                    <Image
                      src={foto.url}
                      alt={`Foto ${indice + 1} de ${aviso.title}`}
                      width={foto.width ?? 480}
                      height={foto.height ?? 480}
                      className="h-20 w-full object-cover"
                    />
                    <form action={eliminarFotoClasificado} className="absolute right-1 top-1">
                      <input type="hidden" name="id" value={aviso.id} />
                      <input type="hidden" name="imageId" value={foto.id} />
                      <button
                        type="submit"
                        title={`Quitar foto ${indice + 1}`}
                        aria-label={`Quitar foto ${indice + 1}`}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-900/80 text-white transition hover:bg-accent-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-news-500">El aviso todavía no tiene fotos.</p>
            )}

            {puedeAgregarFotos ? (
              <form
                action={agregarFotosClasificado}
                encType="multipart/form-data"
                className="mt-4 space-y-3 border-t border-news-200 pt-4"
              >
                <input type="hidden" name="id" value={aviso.id} />
                <label htmlFor="ed-photos" className="label">
                  Agregar fotos (hasta {MAX_FOTOS_CLASIFICADO - aviso.images.length} más)
                </label>
                <input
                  id="ed-photos"
                  name="photos"
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  className="input file:mr-3 file:rounded file:border-0 file:bg-brand-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
                />
                <button type="submit" className="btn-secondary btn-sm">
                  <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                  Subir fotos
                </button>
                <p className="text-xs text-news-500">JPG, PNG o WebP de hasta 6 MB. Se convierten a WebP automáticamente.</p>
              </form>
            ) : (
              <p className="mt-4 border-t border-news-200 pt-3 text-xs text-news-500">
                El aviso ya alcanzó el máximo de {MAX_FOTOS_CLASIFICADO} fotos.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
