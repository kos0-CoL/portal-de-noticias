import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { Check, X, Trash2, MessageCircle } from 'lucide-react';
import type { CommentStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { ConfirmDeleteButton } from '@/components/admin/ConfirmDeleteButton';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Comentarios | Panel de administración'
};

type SearchParams = { [key: string]: string | string[] | undefined };

function single(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value && value.length > 0 ? value : undefined;
}

async function aprobarComentario(formData: FormData) {
  'use server';
  const id = formData.get('id') as string;
  if (!id) return;
  await prisma.comment.update({ where: { id }, data: { status: 'APPROVED' } });
  revalidatePath('/admin/comentarios');
}

async function rechazarComentario(formData: FormData) {
  'use server';
  const id = formData.get('id') as string;
  if (!id) return;
  await prisma.comment.update({ where: { id }, data: { status: 'REJECTED' } });
  revalidatePath('/admin/comentarios');
}

async function marcarSpam(formData: FormData) {
  'use server';
  const id = formData.get('id') as string;
  if (!id) return;
  await prisma.comment.update({ where: { id }, data: { status: 'SPAM' } });
  revalidatePath('/admin/comentarios');
}

const ESTADOS: { value: CommentStatus; label: string }[] = [
  { value: 'PENDING', label: 'Pendientes' },
  { value: 'APPROVED', label: 'Aprobados' },
  { value: 'REJECTED', label: 'Rechazados' },
  { value: 'SPAM', label: 'Spam' }
];

export default async function AdminComentariosPage({ searchParams }: { searchParams: SearchParams }) {
  const estado = single(searchParams.estado);
  const where = estado ? { status: estado as CommentStatus } : {};

  const [total, comentarios] = await Promise.all([
    prisma.comment.count({ where }),
    prisma.comment.findMany({
      where,
      include: {
        article: { select: { id: true, title: true, slug: true } },
        parent: { select: { id: true, authorName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    })
  ]);

  return (
    <div className="space-y-6">
      <div className="admin-card">
        <div className="admin-card-header">
          <div>
            <h2 className="admin-title">Comentarios</h2>
            <p className="mt-0.5 text-xs text-news-500">{total} comentario(s)</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/admin/comentarios" className={!estado ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}>
            Todos
          </Link>
          {ESTADOS.map((item) => (
            <Link
              key={item.value}
              href={`/admin/comentarios?estado=${item.value}`}
              className={estado === item.value ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="admin-card">
        {comentarios.length === 0 ? (
          <p className="text-sm text-news-500">No hay comentarios para mostrar.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-admin">
              <thead>
                <tr>
                  <th>Nota</th>
                  <th>Autor</th>
                  <th>Comentario</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {comentarios.map((c) => (
                  <tr key={c.id} className="border-b border-news-100">
                    <td className="py-3">
                      <Link href={`/nota/${c.article.slug}`} className="text-sm font-semibold text-brand-700 hover:underline">
                        {c.article.title}
                      </Link>
                      {c.parent ? (
                        <div className="mt-1 text-xs text-news-400">Respuesta a: {c.parent.authorName}</div>
                      ) : null}
                    </td>
                    <td className="py-3 text-sm">{c.authorName}</td>
                    <td className="py-3 text-sm text-news-700 max-w-xs truncate" title={c.content}>
                      {c.content}
                    </td>
                    <td className="py-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="py-3 text-xs text-news-500">{c.createdAt.toLocaleDateString('es-AR')}</td>
                    <td className="py-3 text-right">
                      {c.status === 'PENDING' && (
                        <>
                          <form action={aprobarComentario} className="inline" method="POST">
                            <input type="hidden" name="id" value={c.id} />
                            <button className="btn-success btn-sm text-xs" type="submit">
                              <Check className="w-3 h-3 mr-1" /> Aprobar
                            </button>
                          </form>
                          <form action={rechazarComentario} className="inline ml-1" method="POST">
                            <input type="hidden" name="id" value={c.id} />
                            <button className="btn-secondary btn-sm text-xs" type="submit">
                              <X className="w-3 h-3 mr-1" /> Rechazar
                            </button>
                          </form>
                          <form action={marcarSpam} className="inline ml-1" method="POST">
                            <input type="hidden" name="id" value={c.id} />
                            <button className="btn-danger btn-sm text-xs" type="submit">
                              Spam
                            </button>
                          </form>
                        </>
                      )}
                      {c.status !== 'PENDING' && (
                        <ConfirmDeleteButton
                          url={`/api/comentarios/${c.id}`}
                          label="Eliminar"
                          confirmText="¿Eliminar este comentario?"
                        />
                      )}
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
