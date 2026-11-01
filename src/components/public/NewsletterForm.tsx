'use client';

import { useState } from 'react';
import { Mail, Send, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface NewsletterFormProps {
  className?: string;
}

export default function NewsletterForm({ className }: NewsletterFormProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [enviando, setEnviando] = useState(false);
const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  async function manejarEnvio(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setEnviando(true);
    try {
      const res = await fetch('/api/newsletter/suscribirse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), name: name.trim() || undefined })
      });
      const data = await res.json();

      if (!res.ok) {
        setMensaje({ tipo: 'error', texto: data.error ?? 'No se pudo suscribir.' });
        return;
      }

      if (data.yaExistente) {
        setMensaje({
          tipo: 'ok',
          texto: data.status === 'ACTIVO' ? 'Ya estás suscripto al boletín.' : 'Se reactivó tu suscripción.'
        });
      } else {
        setMensaje({ tipo: 'ok', texto: '¡Te suscribiste al boletín con éxito!' });
      }

      setEmail('');
      setName('');
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error inesperado al suscribirte.' });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className={className}>
      <h2 className="kicker mb-2 text-brand-300">Boletín de noticias</h2>
      <p className="mb-4 text-sm text-brand-200">
        Recibí las últimas noticias de Saladillo en tu correo.
      </p>
      <form onSubmit={manejarEnvio} className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          placeholder="Tu email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="flex-1 min-w-0 rounded border border-white/20 bg-white/5 px-3 py-2 text-white text-sm placeholder-brand-200 focus:ring-1 focus:ring-brand-300 outline-none"
        />
        <input
          type="text"
          placeholder="Tu nombre (opcional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="hidden sm:flex-1 min-w-0 rounded border border-white/20 bg-white/5 px-3 py-2 text-white text-sm placeholder-brand-200 focus:ring-1 focus:ring-brand-300 outline-none"
        />
        <button
          type="submit"
          disabled={enviando}
          className="rounded bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {enviando ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Send className="h-4 w-4" aria-hidden />
          )}
        </button>
      </form>
    </section>
  );
}
