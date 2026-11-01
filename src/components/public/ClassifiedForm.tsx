'use client';

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, ImagePlus, Loader2, X } from 'lucide-react';
import { LOCALIDADES, MAX_FOTOS_CLASIFICADO, SECCIONES_CLASIFICADOS } from '@/lib/constants';

const TIPOS_ACEPTADOS = ['image/jpeg', 'image/png', 'image/webp'];
const ACCEPT_ATTR = TIPOS_ACEPTADOS.join(',');
const MAX_BYTES_FOTO = 6 * 1024 * 1024;

type Estado = 'idle' | 'enviando' | 'ok' | 'error';

interface FotoElegida {
  file: File;
  url: string;
}

/** Formulario publico para enviar un aviso clasificado (queda en moderacion). */
export function ClassifiedForm() {
  const [estado, setEstado] = useState<Estado>('idle');
  const [mensaje, setMensaje] = useState('');
  const [fotos, setFotos] = useState<FotoElegida[]>([]);

  // Referencia viva para liberar las previsualizaciones al desmontar.
  const fotosRef = useRef<FotoElegida[]>([]);
  fotosRef.current = fotos;
  useEffect(
    () => () => {
      fotosRef.current.forEach((foto) => URL.revokeObjectURL(foto.url));
    },
    []
  );

  /** Valida las fotos elegidas antes de mandarlas: tipo, peso y cantidad. */
  function elegirFotos(evento: ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(evento.target.files ?? []);
    evento.target.value = ''; // permite volver a elegir el mismo archivo
    if (archivos.length === 0) return;

    const aceptadas: FotoElegida[] = [];
    const rechazos: string[] = [];

    for (const file of archivos) {
      if (fotos.length + aceptadas.length >= MAX_FOTOS_CLASIFICADO) {
        rechazos.push(`el máximo es ${MAX_FOTOS_CLASIFICADO} fotos`);
        break;
      }
      if (!TIPOS_ACEPTADOS.includes(file.type)) {
        rechazos.push('formato no permitido');
        continue;
      }
      if (file.size > MAX_BYTES_FOTO) {
        rechazos.push('pesa más de 6 MB');
        continue;
      }
      aceptadas.push({ file, url: URL.createObjectURL(file) });
    }

    if (aceptadas.length > 0) setFotos((previas) => [...previas, ...aceptadas]);

    if (rechazos.length > 0) {
      setEstado('error');
      setMensaje(`No agregamos ${rechazos.length} foto(s): ${rechazos.join(', ')}.`);
    } else {
      setEstado('idle');
      setMensaje('');
    }
  }

  function quitarFoto(indice: number) {
    const foto = fotos[indice];
    if (foto) URL.revokeObjectURL(foto.url);
    setFotos(fotos.filter((_, posicion) => posicion !== indice));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const datos = new FormData(form);
    for (const foto of fotos) datos.append('photos', foto.file);

    setEstado('enviando');
    setMensaje('');

    try {
      const res = await fetch('/api/clasificados', { method: 'POST', body: datos });
      const json = (await res.json()) as { ok: boolean; error?: string };

      if (res.ok && json.ok) {
        setEstado('ok');
        setMensaje('¡Listo! Tu aviso fue enviado y quedará publicado tras la moderación del equipo.');
        form.reset();
        fotos.forEach((foto) => URL.revokeObjectURL(foto.url));
        setFotos([]);
      } else {
        setEstado('error');
        setMensaje(json.error ?? 'No pudimos enviar el aviso. Revisá los datos e intentá de nuevo.');
      }
    } catch {
      setEstado('error');
      setMensaje('Hubo un problema de conexión. Intentá nuevamente en unos minutos.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="cl-title" className="label">
          Título del aviso *
        </label>
        <input id="cl-title" name="title" required minLength={3} maxLength={120} className="input" placeholder="Ej: Vendo bicicleta rodado 28 en buen estado" />
      </div>

      <div>
        <label htmlFor="cl-description" className="label">
          Descripción *
        </label>
        <textarea id="cl-description" name="description" required minLength={10} maxLength={2000} className="textarea" placeholder="Contá los detalles: estado, condiciones, disponibilidad…" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="cl-section" className="label">
            Sección *
          </label>
          <select id="cl-section" name="section" required defaultValue="Comunidad" className="select">
            {SECCIONES_CLASIFICADOS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="cl-price" className="label">
            Precio (opcional, en pesos)
          </label>
          <input id="cl-price" name="price" type="number" min={0} step={1} inputMode="numeric" className="input" placeholder="0" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="cl-name" className="label">
            Tu nombre *
          </label>
          <input id="cl-name" name="contactName" required minLength={2} maxLength={80} className="input" placeholder="Nombre y apellido" />
        </div>
        <div>
          <label htmlFor="cl-locality" className="label">
            Localidad *
          </label>
          <select id="cl-locality" name="locality" required defaultValue="Saladillo" className="select">
            {LOCALIDADES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="cl-phone" className="label">
            Teléfono / WhatsApp *
          </label>
          <input id="cl-phone" name="contactPhone" required minLength={6} maxLength={30} className="input" placeholder="2344 45-0000" />
        </div>
        <div>
          <label htmlFor="cl-email" className="label">
            Correo (opcional)
          </label>
          <input id="cl-email" name="contactEmail" type="email" className="input" placeholder="tu@correo.com" />
        </div>
      </div>

      <div>
        <span className="label">Fotos (opcional, hasta {MAX_FOTOS_CLASIFICADO})</span>
        <label
          htmlFor="cl-photos"
          className="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-news-300 bg-news-50 px-4 py-5 text-sm font-semibold text-brand-700 transition hover:border-brand-300 hover:bg-brand-50"
        >
          <ImagePlus className="h-4 w-4" aria-hidden="true" />
          Elegir fotos
        </label>
        <input
          id="cl-photos"
          name="photos"
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          onChange={elegirFotos}
          className="sr-only"
        />
        <p className="mt-1 text-xs text-news-500">JPG, PNG o WebP. Se convierten a WebP automáticamente.</p>

        {fotos.length > 0 ? (
          <ul className="mt-3 grid grid-cols-3 gap-2">
            {fotos.map((foto, indice) => (
              <li key={foto.url} className="relative overflow-hidden rounded-md border border-news-200 bg-news-100">
                {/* Vista previa local: next/image no trabaja con URLs blob: */}
                <img src={foto.url} alt={`Foto ${indice + 1} del aviso`} className="h-20 w-full object-cover" />
                <button
                  type="button"
                  onClick={() => quitarFoto(indice)}
                  aria-label={`Quitar foto ${indice + 1}`}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-brand-900/80 text-white transition hover:bg-accent-500"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <button type="submit" className="btn-primary w-full sm:w-auto" disabled={estado === 'enviando'}>
        {estado === 'enviando' ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Enviando…
          </>
        ) : (
          'Publicá tu aviso'
        )}
      </button>

      {estado === 'ok' ? (
        <p role="status" className="flex items-start gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {mensaje}
        </p>
      ) : null}

      {estado === 'error' ? (
        <p role="alert" className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {mensaje}
        </p>
      ) : null}

      <p className="text-xs text-news-500">
        Tu aviso queda en revisión antes de publicarse y tiene 30 días de vigencia. No publicamos datos sensibles ni avisos
        que incumplan las normas de la comunidad.
      </p>
    </form>
  );
}
