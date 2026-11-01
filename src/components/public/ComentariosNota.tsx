'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatFecha } from '@/lib/utils';

interface Comentario {
  id: string;
  authorName: string;
  content: string;
  status: string;
  createdAt: Date;
  replies: Comentario[];
}

interface ComentariosNotaProps {
  articleId: string;
  initialComentarios: Comentario[];
}

export default function ComentariosNota({ articleId, initialComentarios }: ComentariosNotaProps) {
  const [comentarios, setComentarios] = useState<Comentario[]>(initialComentarios);
  const [autor, setAutor] = useState('');
  const [contenido, setContenido] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    setComentarios(initialComentarios);
  }, [initialComentarios]);

  const manejarEnvio = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMensaje(null);

    if (!autor.trim() || !contenido.trim()) {
      setError('Completá nombre y comentario.');
      return;
    }

    setEnviando(true);
    try {
      const res = await fetch('/api/comentarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId,
          authorName: autor.trim(),
          content: contenido.trim()
        })
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error ?? 'No se pudo enviar el comentario.');
        return;
      }

      setMensaje('Comentario enviado. Queda pendiente de aprobación antes de publicarse.');
      setAutor('');
      setContenido('');

      // Refrescar lista: agregar como pendiente (no visible hasta que lo apruebe un admin).
      setComentarios((prev) => [
        ...prev,
        {
          id: data?.id ?? 'pendiente',
          authorName: autor.trim(),
          content: contenido.trim(),
          status: 'PENDING',
          createdAt: new Date(),
          replies: []
        }
      ]);
    } catch {
      setError('Error inesperado al enviar.');
    } finally {
      setEnviando(false);
    }
  }, [articleId, autor, contenido]);

  return (
    <section className="mt-12 border-t border-news-200 pt-8">
      <h2 className="mb-6 text-lg font-bold text-brand-900">Comentarios</h2>

      <form onSubmit={manejarEnvio} className="mb-8 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Tu nombre"
            value={autor}
            onChange={(e) => setAutor(e.target.value)}
            required
            minLength={2}
            maxLength={80}
            className="block w-full rounded border border-news-300 bg-white px-3 py-2 text-sm text-news-800 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
          />
          <input
            type="email"
            placeholder="Correo electrónico (opcional)"
            className="block w-full rounded border border-news-300 bg-white px-3 py-2 text-sm text-news-800 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
          />
        </div>
        <textarea
          placeholder="Escribí tu comentario..."
          value={contenido}
          onChange={(e) => setContenido(e.target.value)}
          required
          minLength={5}
          maxLength={2000}
          rows={4}
          className="block w-full rounded border border-news-300 bg-white px-3 py-2 text-sm text-news-800 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
        />
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : null}
        {mensaje ? (
          <p className="text-sm text-green-600">{mensaje}</p>
        ) : null}
        <button
          type="submit"
          disabled={enviando}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {enviando ? 'Enviando...' : 'Enviar comentario'}
        </button>
        <p className="text-xs text-news-500">
          Tu comentario será revisado por el equipo editorial antes de publicarse.
        </p>
      </form>

      {comentarios.length > 0 ? (
        <>
          <h3 className="mb-4 text-sm font-bold text-news-600 uppercase tracking-wider">
            {comentarios.length} comentario{comentarios.length !== 1 ? 's' : ''}
          </h3>
          <div className="space-y-4">
            {comentarios.map((c) => (
              <div key={c.id} className="border border-news-200 rounded-lg p-4 bg-white">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-brand-900">{c.authorName}</span>
                  <span className="text-xs text-news-500">
                    {formatFecha(c.createdAt, false)}
                  </span>
                </div>
                <p className="text-sm text-news-700 leading-relaxed">{c.content}</p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-news-500">Aún no hay comentarios. Sé el primero en dejar el tuyo.</p>
      )}
    </section>
  );
}
