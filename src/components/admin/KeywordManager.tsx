'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Pencil, Plus, Save, Trash2, X } from 'lucide-react';

export interface KeywordRow {
  id: string;
  word: string;
  type: 'LOCALIDAD' | 'FUNCIONARIO' | 'TEMA';
  weight: number;
  isActive: boolean;
}

export interface KeywordManagerProps {
  keywords: KeywordRow[];
}

const TIPOS: { value: KeywordRow['type']; label: string }[] = [
  { value: 'LOCALIDAD', label: 'Localidad' },
  { value: 'FUNCIONARIO', label: 'Funcionario / institución' },
  { value: 'TEMA', label: 'Tema' }
];

const ETIQUETA_TIPO: Record<KeywordRow['type'], string> = {
  LOCALIDAD: 'Localidad',
  FUNCIONARIO: 'Funcionario',
  TEMA: 'Tema'
};

/** Gestión del filtro de palabras clave locales. */
export default function KeywordManager({ keywords }: KeywordManagerProps) {
  const router = useRouter();

  const [word, setWord] = useState('');
  const [tipo, setTipo] = useState<KeywordRow['type']>('LOCALIDAD');
  const [peso, setPeso] = useState(10);
  const [activa, setActiva] = useState(true);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editWord, setEditWord] = useState('');
  const [editTipo, setEditTipo] = useState<KeywordRow['type']>('LOCALIDAD');
  const [editPeso, setEditPeso] = useState(10);
  const [editActiva, setEditActiva] = useState(true);

  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function agregar() {
    if (word.trim().length < 2) {
      setError('La palabra debe tener al menos 2 caracteres.');
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const respuesta = await fetch('/api/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: word.trim(), type: tipo, weight: peso, isActive: activa })
      });
      const data = (await respuesta.json()) as { ok: boolean; error?: string };
      if (!respuesta.ok || !data.ok) {
        setError(data.error ?? 'No se pudo agregar la palabra.');
        return;
      }
      setWord('');
      setPeso(10);
      setActiva(true);
      router.refresh();
    } catch {
      setError('Hubo un problema de conexión.');
    } finally {
      setCargando(false);
    }
  }

  function comenzarEdicion(fila: KeywordRow) {
    setEditandoId(fila.id);
    setEditWord(fila.word);
    setEditTipo(fila.type);
    setEditPeso(fila.weight);
    setEditActiva(fila.isActive);
  }

  async function guardarEdicion(id: string) {
    setCargando(true);
    setError(null);
    try {
      const respuesta = await fetch(`/api/keywords?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: editWord.trim(), type: editTipo, weight: editPeso, isActive: editActiva })
      });
      const data = (await respuesta.json()) as { ok: boolean; error?: string };
      if (!respuesta.ok || !data.ok) {
        setError(data.error ?? 'No se pudo actualizar la palabra.');
        return;
      }
      setEditandoId(null);
      router.refresh();
    } catch {
      setError('Hubo un problema de conexión.');
    } finally {
      setCargando(false);
    }
  }

  async function eliminar(id: string, palabra: string) {
    if (!window.confirm(`¿Eliminar la palabra clave «${palabra}»?`)) return;
    setCargando(true);
    try {
      await fetch(`/api/keywords?id=${id}`, { method: 'DELETE' });
      router.refresh();
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {/* Formulario de alta */}
      <div className="admin-card">
        <h3 className="admin-title mb-4">Agregar palabra clave</h3>
        <div className="grid gap-3 sm:grid-cols-[2fr_1.5fr_1fr_auto_auto]">
          <input
            className="input"
            value={word}
            onChange={(evento) => setWord(evento.target.value)}
            placeholder="Ej: Saladillo"
          />
          <select className="select" value={tipo} onChange={(evento) => setTipo(evento.target.value as KeywordRow['type'])}>
            {TIPOS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <div>
            <label className="label" htmlFor="kw-peso">Peso (1-10)</label>
            <input
              id="kw-peso"
              type="number"
              min={1}
              max={10}
              className="input"
              value={peso}
              onChange={(evento) => setPeso(Number(evento.target.value))}
            />
          </div>
          <label className="flex items-end gap-2 pb-2 text-sm text-news-700">
            <input type="checkbox" className="checkbox" checked={activa} onChange={(evento) => setActiva(evento.target.checked)} />
            Activa
          </label>
          <button type="button" className="btn-primary self-end" onClick={agregar} disabled={cargando}>
            {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Agregar
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="admin-card overflow-x-auto">
        <table className="table-admin">
          <thead>
            <tr>
              <th>Palabra</th>
              <th>Tipo</th>
              <th>Peso</th>
              <th>Estado</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {keywords.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-news-500">
                  No hay palabras clave cargadas. Mientras tanto, el filtro usa la lista por defecto de localidades.
                </td>
              </tr>
            )}
            {keywords.map((fila) => {
              const enEdicion = editandoId === fila.id;
              return (
                <tr key={fila.id}>
                  <td>
                    {enEdicion ? (
                      <input className="input" value={editWord} onChange={(evento) => setEditWord(evento.target.value)} />
                    ) : (
                      <span className="font-medium text-brand-900">{fila.word}</span>
                    )}
                  </td>
                  <td>
                    {enEdicion ? (
                      <select
                        className="select"
                        value={editTipo}
                        onChange={(evento) => setEditTipo(evento.target.value as KeywordRow['type'])}
                      >
                        {TIPOS.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      ETIQUETA_TIPO[fila.type]
                    )}
                  </td>
                  <td>
                    {enEdicion ? (
                      <input
                        type="number"
                        min={1}
                        max={10}
                        className="input w-20"
                        value={editPeso}
                        onChange={(evento) => setEditPeso(Number(evento.target.value))}
                      />
                    ) : (
                      fila.weight
                    )}
                  </td>
                  <td>
                    {enEdicion ? (
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={editActiva}
                          onChange={(evento) => setEditActiva(evento.target.checked)}
                        />
                        Activa
                      </label>
                    ) : fila.isActive ? (
                      <span className="badge-green">Activa</span>
                    ) : (
                      <span className="badge-gray">Inactiva</span>
                    )}
                  </td>
                  <td className="text-right">
                    {enEdicion ? (
                      <div className="flex justify-end gap-2">
                        <button type="button" className="btn-primary btn-sm" onClick={() => guardarEdicion(fila.id)} disabled={cargando}>
                          <Save className="h-3.5 w-3.5" />
                          Guardar
                        </button>
                        <button type="button" className="btn-ghost btn-sm" onClick={() => setEditandoId(null)}>
                          <X className="h-3.5 w-3.5" />
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <button type="button" className="btn-secondary btn-sm" onClick={() => comenzarEdicion(fila)}>
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn-ghost btn-sm text-red-600"
                          onClick={() => eliminar(fila.id, fila.word)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Eliminar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
