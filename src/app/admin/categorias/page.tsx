import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Pencil, Plus, Tags } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/utils';
import { ConfirmDeleteButton } from '@/components/admin/ConfirmDeleteButton';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Categorías y etiquetas | Panel de administración'
};

type SearchParams = { [key: string]: string | string[] | undefined };

function single(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function asString(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Crea o actualiza una categoría según venga o no el id oculto. */
async function saveCategory(formData: FormData) {
  'use server';
  const id = asString(formData.get('id'));
  const name = asString(formData.get('name'));
  if (!name) redirect('/admin/categorias?error=' + encodeURIComponent('El nombre es obligatorio.'));

  const payload = {
    name,
    description: asString(formData.get('description')) || null,
    color: asString(formData.get('color')) || '#122A4D',
    position: Number(formData.get('position')) || 0,
    isMenu: formData.get('isMenu') === 'on',
    isActive: formData.get('isActive') === 'on'
  };

  try {
    if (id) {
      await prisma.category.update({ where: { id }, data: payload });
    } else {
      const baseSlug = slugify(name) || 'categoria';
      let slug = baseSlug;
      let counter = 2;
      while (await prisma.category.findUnique({ where: { slug }, select: { id: true } })) {
        slug = `${baseSlug}-${counter++}`;
      }
      await prisma.category.create({ data: { ...payload, slug } });
    }
  } catch {
    redirect('/admin/categorias?error=' + encodeURIComponent('No se pudo guardar: el nombre ya existe.'));
  }

  revalidatePath('/admin/categorias');
  redirect('/admin/categorias');
}

/** Crea una etiqueta. */
async function createTag(formData: FormData) {
  'use server';
  const name = asString(formData.get('name'));
  if (!name) redirect('/admin/categorias?error=' + encodeURIComponent('El nombre de la etiqueta es obligatorio.'));

  const baseSlug = slugify(name) || name.toLowerCase();
  let slug = baseSlug;
  let counter = 2;
  while (await prisma.tag.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${baseSlug}-${counter++}`;
  }

  try {
    await prisma.tag.create({ data: { name, slug } });
  } catch {
    redirect('/admin/categorias?error=' + encodeURIComponent('Ya existe una etiqueta con ese nombre.'));
  }

  revalidatePath('/admin/categorias');
  redirect('/admin/categorias');
}

/** Elimina una etiqueta solo si no tiene notas asociadas. */
async function deleteTag(formData: FormData) {
  'use server';
  const id = asString(formData.get('id'));
  if (!id) return;

  const tag = await prisma.tag.findUnique({ where: { id }, include: { _count: { select: { articles: true } } } });
  if (!tag) return;
  if (tag._count.articles > 0) {
    redirect('/admin/categorias?error=' + encodeURIComponent('La etiqueta tiene notas asociadas y no se puede eliminar.'));
  }

  await prisma.tag.delete({ where: { id } });
  revalidatePath('/admin/categorias');
  redirect('/admin/categorias');
}

/** CRUD de categorías y etiquetas en una sola pantalla. */
export default async function AdminCategoriasPage({ searchParams }: { searchParams: SearchParams }) {
  const editarId = single(searchParams.editar);
  const errorMsg = single(searchParams.error);

  const [categories, tags, editing] = await Promise.all([
    prisma.category.findMany({
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { articles: true } } }
    }),
    prisma.tag.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { articles: true } } }
    }),
    editarId ? prisma.category.findUnique({ where: { id: editarId } }) : Promise.resolve(null)
  ]);

  return (
    <div className="space-y-6">
      {errorMsg ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {errorMsg}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Formulario de categoría */}
        <section className="admin-card xl:col-span-1">
          <div className="admin-card-header">
            <h2 className="admin-title">{editing ? 'Editar categoría' : 'Nueva categoría'}</h2>
          </div>
          <form action={saveCategory} className="space-y-3">
            <input type="hidden" name="id" value={editing?.id ?? ''} />

            <div>
              <label htmlFor="name" className="label">
                Nombre
              </label>
              <input id="name" name="name" required defaultValue={editing?.name ?? ''} className="input" />
            </div>

            <div>
              <label htmlFor="description" className="label">
                Descripción
              </label>
              <textarea
                id="description"
                name="description"
                defaultValue={editing?.description ?? ''}
                className="textarea min-h-[80px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="color" className="label">
                  Color
                </label>
                <input
                  id="color"
                  name="color"
                  type="color"
                  defaultValue={editing?.color ?? '#122A4D'}
                  className="h-10 w-full cursor-pointer rounded-md border border-news-300 bg-white p-1"
                />
              </div>
              <div>
                <label htmlFor="position" className="label">
                  Posición
                </label>
                <input
                  id="position"
                  name="position"
                  type="number"
                  defaultValue={editing?.position ?? 0}
                  className="input"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm font-medium text-news-700">
                <input type="checkbox" name="isMenu" defaultChecked={editing?.isMenu ?? true} className="checkbox" />
                Mostrar en el menú
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-news-700">
                <input type="checkbox" name="isActive" defaultChecked={editing?.isActive ?? true} className="checkbox" />
                Activa
              </label>
            </div>

            <div className="flex gap-2 pt-1">
              <button type="submit" className="btn-primary btn-sm">
                {editing ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                {editing ? 'Guardar cambios' : 'Crear categoría'}
              </button>
              {editing ? (
                <Link href="/admin/categorias" className="btn-ghost btn-sm">
                  Cancelar
                </Link>
              ) : null}
            </div>
          </form>
        </section>

        {/* Tabla de categorías */}
        <section className="admin-card xl:col-span-2">
          <div className="admin-card-header">
            <h2 className="admin-title">Categorías</h2>
            <span className="badge-gray">{categories.length}</span>
          </div>

          {categories.length === 0 ? (
            <p className="text-sm text-news-500">Todavía no hay categorías.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-admin">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Slug</th>
                    <th className="w-12">Color</th>
                    <th className="w-16">Orden</th>
                    <th className="w-20">Menú</th>
                    <th className="w-20">Activa</th>
                    <th className="w-20">Notas</th>
                    <th className="text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((category) => (
                    <tr key={category.id}>
                      <td className="font-semibold text-brand-900">{category.name}</td>
                      <td className="text-xs text-news-500">{category.slug}</td>
                      <td>
                        <span
                          className="inline-block h-5 w-5 rounded border border-news-200"
                          style={{ backgroundColor: category.color }}
                          title={category.color}
                        />
                      </td>
                      <td>{category.position}</td>
                      <td>{category.isMenu ? 'Sí' : 'No'}</td>
                      <td>
                        {category.isActive ? (
                          <span className="badge-green">Activa</span>
                        ) : (
                          <span className="badge-gray">Inactiva</span>
                        )}
                      </td>
                      <td>{category._count.articles}</td>
                      <td>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Link
                            href={`/admin/categorias?editar=${category.id}`}
                            className="btn-secondary btn-sm"
                            title="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </Link>
                          {category._count.articles > 0 ? (
                            <span
                              className="btn-ghost btn-sm cursor-not-allowed opacity-60"
                              title={`No se puede eliminar: tiene ${category._count.articles} nota(s)`}
                            >
                              {category._count.articles} nota(s)
                            </span>
                          ) : (
                            <ConfirmDeleteButton
                              url={`/api/categorias/${category.id}`}
                              label="Eliminar"
                              confirmText={`¿Eliminar la categoría "${category.name}"?`}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Etiquetas */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="admin-card xl:col-span-1">
          <div className="admin-card-header">
            <h2 className="admin-title">Nueva etiqueta</h2>
          </div>
          <form action={createTag} className="space-y-3">
            <div>
              <label htmlFor="tag-name" className="label">
                Nombre
              </label>
              <input id="tag-name" name="name" required className="input" placeholder="Ej: obras públicas" />
            </div>
            <button type="submit" className="btn-primary btn-sm">
              <Plus className="h-3.5 w-3.5" />
              Crear etiqueta
            </button>
          </form>
        </section>

        <section className="admin-card xl:col-span-2">
          <div className="admin-card-header">
            <h2 className="flex items-center gap-2 admin-title">
              <Tags className="h-4 w-4" />
              Etiquetas
            </h2>
            <span className="badge-gray">{tags.length}</span>
          </div>

          {tags.length === 0 ? (
            <p className="text-sm text-news-500">Todavía no hay etiquetas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-admin">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Slug</th>
                    <th className="w-20">Notas</th>
                    <th className="text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {tags.map((tag) => (
                    <tr key={tag.id}>
                      <td className="font-semibold text-brand-900">{tag.name}</td>
                      <td className="text-xs text-news-500">{tag.slug}</td>
                      <td>{tag._count.articles}</td>
                      <td>
                        <div className="flex justify-end">
                          {tag._count.articles > 0 ? (
                            <span
                              className="btn-ghost btn-sm cursor-not-allowed opacity-60"
                              title={`No se puede eliminar: tiene ${tag._count.articles} nota(s)`}
                            >
                              {tag._count.articles} nota(s)
                            </span>
                          ) : (
                            <form action={deleteTag}>
                              <input type="hidden" name="id" value={tag.id} />
                              <button type="submit" className="btn-danger btn-sm">
                                Eliminar
                              </button>
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
