import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { Check, Pencil, X } from 'lucide-react';
import type { ClassifiedStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { vencimientoAviso } from '@/lib/classifieds';
import { formatFechaCorta, formatPrecio } from '@/lib/utils';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { ConfirmDeleteButton } from '@/components/admin/ConfirmDeleteButton';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Clasificados | Panel de administración'
};

type SearchParams = { [key: string]: string | string[] | undefined };

function single(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value && value.length > 0 ? value : undefined;
}

function asString(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Aprueba un aviso: lo publica con la vigencia estándar. */
async function approveClassified(formData: FormData) {
  'use server';
  const id = asString(formData.get('id'));
  if (!id) return;
  await prisma.classified.update({
    where: { id },
    data: { status: 'PUBLISHED', expiresAt: vencimientoAviso() }
  });
  revalidatePath('/admin/clasificados');
  revalidatePath('/clasificados');
  revalidatePath(`/clasificados/${id}`);
}

/** Rechaza un aviso. */
async function rejectClassified(formData: FormData) {
  'use server';
  const id = asString(formData.get('id'));
  if (!id) return;
  await prisma.classified.update({ where: { id }, data: { status: 'REJECTED' } });
  revalidatePath('/admin/clasificados');
  revalidatePath('/clasificados');
  revalidatePath(`/clasificados/${id}`);
}

const ESTADOS = [
  { value: 'PENDING', label: 'Pendientes' },
  { value: 'PUBLISHED', label: 'Publicados' },
  { value: 'REJECTED', label: 'Rechazados' },
  { value: 'EXPIRED', label: 'Expirados' }
];

/** Moderación de clasificados: aprobar, rechazar y eliminar avisos. */
export default async function AdminClasificadosPage({ searchParams }: { searchParams: SearchParams }) {
  const estado = single(searchParams.estado);

  const where = estado ? { status: estado as ClassifiedStatus } : {};

  const [total, classifieds] = await Promise.all([
    prisma.classified.count({ where }),
    prisma.classified.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100
    })
  ]);

  return (
    <div className="space-y-6">
      <div className="admin-card">
        <div className="admin-card-header">
          <div>
            <h2 className="admin-title">Clasificados</h2>
            <p className="mt-0.5 text-xs text-news-500">{total} aviso(s)</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/clasificados/nuevo"
            className="btn-primary btn-sm"
          >
            Nuevo
          </Link>
          <Link
            href="/admin/clasificados"
            className={!estado ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
          >
            Todos
          </Link>
          {ESTADOS.map((item) => (
            <Link
              key={item.value}
              href={`/admin/clasificados?estado=${item.value}`}
              className={estado === item.value ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="admin-card">
        {classifieds.length === 0 ? (
          <p className="text-sm text-news-500">No hay clasificados para mostrar.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-admin">
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Sección</th>
                  <th>Localidad</th>
                  <th>Precio</th>
                  <th>Contacto</th>
                  <th>Estado</th>
                  <th>Vigencia</th>
                  <th>Fecha</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {classifieds.map((item) => (
                  <tr key={item.id} className={item.status === 'PENDING' ? 'bg-amber-50' : undefined}>
                    <td className="max-w-[260px]">
                      <p className="font-semibold text-brand-900 line-clamp-2-custom">{item.title}</p>
                      <p className="mt-0.5 line-clamp-2-custom text-xs text-news-500">{item.description}</p>
                    </td>
                    <td>{item.section}</td>
                    <td>{item.locality}</td>
                    <td className="whitespace-nowrap">{formatPrecio(item.price ? Number(item.price) : null)}</td>
                    <td className="text-xs">
                      <p className="font-semibold text-news-700">{item.contactName}</p>
                      <p className="text-news-500">{item.contactPhone}</p>
                    </td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="whitespace-nowrap text-xs text-news-500">
                      {item.expiresAt ? formatFechaCorta(item.expiresAt) : '—'}
                    </td>
                    <td className="whitespace-nowrap text-xs text-news-500">
                      {formatFechaCorta(item.createdAt)}
                    </td>
                    <td>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Link href={`/admin/clasificados/${item.id}`} className="btn-secondary btn-sm" title="Editar aviso">
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </Link>
                        {item.status !== 'PUBLISHED' ? (
                          <form action={approveClassified}>
                            <input type="hidden" name="id" value={item.id} />
                            <button type="submit" className="btn-primary btn-sm" title="Aprobar y publicar">
                              <Check className="h-3.5 w-3.5" />
                              Aprobar
                            </button>
                          </form>
                        ) : null}
                        {item.status !== 'REJECTED' ? (
                          <form action={rejectClassified}>
                            <input type="hidden" name="id" value={item.id} />
                            <button type="submit" className="btn-secondary btn-sm" title="Rechazar">
                              <X className="h-3.5 w-3.5" />
                              Rechazar
                            </button>
                          </form>
                        ) : null}
                        <ConfirmDeleteButton
                          url={`/api/clasificados/${item.id}`}
                          label="Eliminar"
                          confirmText={`¿Eliminar el clasificado "${item.title}"?`}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
