'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Power,
  Save,
  Trash2,
  X
} from 'lucide-react';
import { LOCALIDADES } from '@/lib/constants';
import { cn } from '@/lib/utils';

/**
 * Gestor de farmacias del panel (/admin/farmacias).
 * Formulario de alta/edición + tabla con acciones. Tras cada mutación se
 * refresca el Server Component con router.refresh().
 */

export interface PharmacyDTO {
  id: string;
  slug: string;
  name: string;
  alias: string[];
  address: string;
  zone: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  position: number;
  isActive: boolean;
  shifts: number;
}

interface PharmacyManagerProps {
  pharmacies: PharmacyDTO[];
}

interface FormState {
  id: string | null;
  name: string;
  slug: string;
  alias: string[];
  address: string;
  zone: string;
  phone: string;
  whatsapp: string;
  email: string;
  latitude: string;
  longitude: string;
  notes: string;
  position: number;
  isActive: boolean;
}

const FORM_VACIO: FormState = {
  id: null,
  name: '',
  slug: '',
  alias: [],
  address: '',
  zone: 'Saladillo',
  phone: '',
  whatsapp: '',
  email: '',
  latitude: '',
  longitude: '',
  notes: '',
  position: 0,
  isActive: true
};

/** Texto libre -> número o null. Devuelve `undefined` si lo escrito no es un número. */
function aNumero(valor: string): number | null | undefined {
  const limpio = valor.trim().replace(',', '.');
  if (!limpio) return null;
  const numero = Number(limpio);
  return Number.isFinite(numero) ? numero : undefined;
}

export default function PharmacyManager({ pharmacies }: PharmacyManagerProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(FORM_VACIO);
  const [aliasNuevo, setAliasNuevo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  function editar(farmacia: PharmacyDTO) {
    setMensaje(null);
    setAliasNuevo('');
    setForm({
      id: farmacia.id,
      name: farmacia.name,
      slug: farmacia.slug,
      alias: [...farmacia.alias],
      address: farmacia.address,
      zone: farmacia.zone ?? '',
      phone: farmacia.phone ?? '',
      whatsapp: farmacia.whatsapp ?? '',
      email: farmacia.email ?? '',
      latitude: farmacia.latitude === null ? '' : String(farmacia.latitude),
      longitude: farmacia.longitude === null ? '' : String(farmacia.longitude),
      notes: farmacia.notes ?? '',
      position: farmacia.position,
      isActive: farmacia.isActive
    });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function agregarAlias() {
    const limpio = aliasNuevo.trim().replace(/\s+/g, ' ').toUpperCase();
    if (!limpio || form.alias.includes(limpio)) {
      setAliasNuevo('');
      return;
    }
    setForm({ ...form, alias: [...form.alias, limpio] });
    setAliasNuevo('');
  }

  function quitarAlias(alias: string) {
    setForm({ ...form, alias: form.alias.filter((item) => item !== alias) });
  }

  async function guardar() {
    const latitude = aNumero(form.latitude);
    const longitude = aNumero(form.longitude);
    if (latitude === undefined || longitude === undefined) {
      setMensaje({ tipo: 'error', texto: 'La latitud y la longitud tienen que ser números.' });
      return;
    }

    setGuardando(true);
    setMensaje(null);
    try {
      const payload = {
        name: form.name,
        slug: form.slug.trim() || undefined,
        alias: form.alias,
        address: form.address,
        zone: form.zone.trim() || null,
        phone: form.phone.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        email: form.email.trim() || null,
        latitude,
        longitude,
        notes: form.notes.trim() || null,
        position: Number(form.position) || 0,
        isActive: form.isActive
      };

      const response = await fetch(form.id ? `/api/admin/farmacias/${form.id}` : '/api/admin/farmacias', {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = (await response.json()) as { ok: boolean; error?: string };

      if (!response.ok || !data.ok) {
        setMensaje({ tipo: 'error', texto: data.error ?? 'No se pudo guardar la farmacia.' });
        return;
      }

      setMensaje({ tipo: 'ok', texto: form.id ? 'Farmacia actualizada.' : 'Farmacia creada.' });
      setForm(FORM_VACIO);
      setAliasNuevo('');
      router.refresh();
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo contactar al servidor.' });
    } finally {
      setGuardando(false);
    }
  }

  async function alternarActivo(farmacia: PharmacyDTO) {
    setOcupado(farmacia.id);
    try {
      await fetch(`/api/admin/farmacias/${farmacia.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !farmacia.isActive })
      });
      router.refresh();
    } finally {
      setOcupado(null);
    }
  }

  async function eliminar(farmacia: PharmacyDTO) {
    const aviso =
      farmacia.shifts > 0
        ? `"${farmacia.name}" tiene ${farmacia.shifts} turno(s) cargado(s). Se va a dar de baja (queda inactiva) para no perder el historial. ¿Seguir?`
        : `¿Eliminar la farmacia "${farmacia.name}"?`;
    if (typeof window !== 'undefined' && !window.confirm(aviso)) return;

    setOcupado(farmacia.id);
    try {
      const response = await fetch(`/api/admin/farmacias/${farmacia.id}`, { method: 'DELETE' });
      const data = (await response.json()) as { ok: boolean; error?: string; mensaje?: string };
      if (!response.ok || !data.ok) {
        setMensaje({ tipo: 'error', texto: data.error ?? 'No se pudo eliminar la farmacia.' });
        return;
      }
      setMensaje({ tipo: 'ok', texto: data.mensaje ?? 'Farmacia eliminada.' });
      if (form.id === farmacia.id) setForm(FORM_VACIO);
      router.refresh();
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* --- Formulario --- */}
      <section className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-title">{form.id ? 'Editar farmacia' : 'Nueva farmacia'}</h2>
          {form.id && (
            <button type="button" className="btn-ghost btn-sm" onClick={() => setForm(FORM_VACIO)}>
              <X className="h-3.5 w-3.5" aria-hidden />
              Cancelar edición
            </button>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="f-name">
              Nombre *
            </label>
            <input
              id="f-name"
              className="input"
              placeholder="Farmacia Del Pueblo"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="f-slug">
              Slug (URL)
            </label>
            <input
              id="f-slug"
              className="input"
              placeholder="se genera solo desde el nombre"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
            />
            <p className="mt-1 text-xs text-news-500">
              Se usa en la ficha pública <code>/farmacias/&lt;slug&gt;</code>. Si ya existe, se agrega un sufijo.
            </p>
          </div>

          <div className="sm:col-span-2">
            <label className="label" htmlFor="f-alias">
              Alias en el organigrama del Colegio
            </label>
            <div className="flex flex-wrap gap-2">
              {form.alias.map((alias) => (
                <span key={alias} className="badge-blue flex items-center gap-1">
                  {alias}
                  <button
                    type="button"
                    aria-label={`Quitar alias ${alias}`}
                    onClick={() => quitarAlias(alias)}
                    className="text-brand-700 hover:text-accent-500"
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                </span>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                id="f-alias"
                className="input"
                placeholder="ORIANDA (Enter para agregar)"
                value={aliasNuevo}
                onChange={(e) => setAliasNuevo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    agregarAlias();
                  }
                }}
              />
              <button type="button" className="btn-ghost" onClick={agregarAlias} disabled={!aliasNuevo.trim()}>
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Agregar
              </button>
            </div>
            <p className="mt-1 text-xs text-news-500">
              Tal como figura en el organigrama (por ejemplo ABELENDA II). Sirve para mapear la importación del Colegio.
            </p>
          </div>

          <div className="sm:col-span-2">
            <label className="label" htmlFor="f-address">
              Dirección *
            </label>
            <input
              id="f-address"
              className="input"
              placeholder="Av. San Martín 2345, Saladillo"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>

          <div>
            <label className="label" htmlFor="f-zone">
              Localidad / zona
            </label>
            <input
              id="f-zone"
              className="input"
              list="f-zone-opciones"
              value={form.zone}
              onChange={(e) => setForm({ ...form, zone: e.target.value })}
            />
            <datalist id="f-zone-opciones">
              {LOCALIDADES.map((localidad) => (
                <option key={localidad} value={localidad} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label" htmlFor="f-position">
              Orden en el listado
            </label>
            <input
              id="f-position"
              type="number"
              min={0}
              className="input"
              value={form.position}
              onChange={(e) => setForm({ ...form, position: Number(e.target.value) })}
            />
          </div>

          <div>
            <label className="label" htmlFor="f-phone">
              Teléfono
            </label>
            <input
              id="f-phone"
              className="input"
              placeholder="02344-452240"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="f-whatsapp">
              WhatsApp
            </label>
            <input
              id="f-whatsapp"
              className="input"
              placeholder="+54 2344 45-0000"
              value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="f-email">
              Email
            </label>
            <input
              id="f-email"
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div>
            <label className="label" htmlFor="f-lat">
              Latitud
            </label>
            <input
              id="f-lat"
              className="input"
              placeholder="-35.6386"
              value={form.latitude}
              onChange={(e) => setForm({ ...form, latitude: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="f-lng">
              Longitud
            </label>
            <input
              id="f-lng"
              className="input"
              placeholder="-59.7789"
              value={form.longitude}
              onChange={(e) => setForm({ ...form, longitude: e.target.value })}
            />
          </div>
          <p className="text-xs text-news-500 sm:col-span-2">
            <MapPin className="mr-1 inline h-3.5 w-3.5" aria-hidden />
            Opcionales. Si están cargadas, el mapa del sitio público apunta al punto exacto; si no, usa la dirección.
          </p>

          <div className="sm:col-span-2">
            <label className="label" htmlFor="f-notes">
              Notas internas
            </label>
            <textarea
              id="f-notes"
              className="textarea"
              placeholder="Horarios, observaciones, datos a revisar…"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <label className="flex items-center gap-3 sm:col-span-2">
            <input
              type="checkbox"
              className="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            <span className="text-sm text-news-700">Farmacia activa</span>
          </label>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn-primary"
            onClick={guardar}
            disabled={guardando || !form.name.trim() || !form.address.trim()}
          >
            {guardando ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : form.id ? (
              <Save className="h-4 w-4" aria-hidden />
            ) : (
              <Plus className="h-4 w-4" aria-hidden />
            )}
            {form.id ? 'Guardar cambios' : 'Crear farmacia'}
          </button>
        </div>

        {mensaje && (
          <p className={cn('mt-3 text-sm font-semibold', mensaje.tipo === 'ok' ? 'text-emerald-700' : 'text-accent-500')}>
            {mensaje.texto}
          </p>
        )}
      </section>

      {/* --- Tabla --- */}
      <section className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-title">Farmacias cargadas</h2>
        </div>
        {pharmacies.length === 0 ? (
          <p className="text-sm text-news-500">Todavía no hay farmacias. Creá la primera con el formulario de arriba.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-admin min-w-[900px]">
              <thead>
                <tr>
                  <th>Orden</th>
                  <th>Nombre</th>
                  <th>Alias</th>
                  <th>Dirección</th>
                  <th>Contacto</th>
                  <th>Coordenadas</th>
                  <th className="text-right">Turnos</th>
                  <th>Estado</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pharmacies.map((farmacia) => (
                  <tr key={farmacia.id}>
                    <td className="tabular-nums text-xs text-news-500">{farmacia.position}</td>
                    <td className="font-semibold text-brand-900">
                      {farmacia.name}
                      <span className="block text-xs font-normal text-news-500">/{farmacia.slug}</span>
                    </td>
                    <td>
                      {farmacia.alias.length === 0 ? (
                        <span className="text-xs text-news-400">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {farmacia.alias.map((alias) => (
                            <span key={alias} className="badge-gray text-[10px]">
                              {alias}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="text-xs">
                      {farmacia.address}
                      {farmacia.zone ? <span className="block text-news-500">{farmacia.zone}</span> : null}
                    </td>
                    <td className="text-xs">
                      {farmacia.phone || '—'}
                      {farmacia.whatsapp ? <span className="block text-news-500">WA {farmacia.whatsapp}</span> : null}
                    </td>
                    <td className="text-xs">
                      {farmacia.latitude !== null && farmacia.longitude !== null ? (
                        <span className="tabular-nums">
                          {farmacia.latitude}, {farmacia.longitude}
                        </span>
                      ) : (
                        <span className="text-news-400">sin cargar</span>
                      )}
                    </td>
                    <td className="text-right tabular-nums">{farmacia.shifts}</td>
                    <td>
                      <span className={farmacia.isActive ? 'badge-green' : 'badge-gray'}>
                        {farmacia.isActive ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" className="btn-ghost btn-sm" title="Editar" onClick={() => editar(farmacia)}>
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          className="btn-ghost btn-sm"
                          title={farmacia.isActive ? 'Desactivar' : 'Activar'}
                          disabled={ocupado === farmacia.id}
                          onClick={() => alternarActivo(farmacia)}
                        >
                          <Power className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          className="btn-ghost btn-sm text-accent-500"
                          title="Eliminar"
                          disabled={ocupado === farmacia.id}
                          onClick={() => eliminar(farmacia)}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 flex items-center gap-2 text-xs text-news-500">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          Una farmacia con turnos cargados no se borra: se da de baja para no perder el historial del organigrama.
        </p>
      </section>
    </div>
  );
}
