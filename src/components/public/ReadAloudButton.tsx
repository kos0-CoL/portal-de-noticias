'use client';

import { useEffect, useRef, useState } from 'react';
import { Volume2, Square } from 'lucide-react';

interface ReadAloudButtonProps {
  title: string;
  text: string;
}

/**
 * Lee la nota en voz alta con la Web Speech API.
 * Si el navegador no la soporta, el boton no se renderiza.
 */
export function ReadAloudButton({ title, text }: ReadAloudButtonProps) {
  const [soportado, setSoportado] = useState(false);
  const [leyendo, setLeyendo] = useState(false);
  const [pausado, setPausado] = useState(false);
  const vocesRef = useRef<SpeechSynthesisVoice[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Detectar soporte y limpiar cualquier lectura al desmontar.
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    setSoportado(true);

    function cargarVoces() {
      vocesRef.current = window.speechSynthesis.getVoices();
    }
    cargarVoces();
    window.speechSynthesis.addEventListener('voiceschanged', cargarVoces);

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', cargarVoces);
      window.speechSynthesis.cancel();
    };
  }, []);

  function elegirVozEs(): SpeechSynthesisVoice | undefined {
    const voces = vocesRef.current.length ? vocesRef.current : window.speechSynthesis.getVoices();
    return (
      voces.find((v) => v.lang === 'es-AR') ??
      voces.find((v) => v.lang.toLowerCase().startsWith('es')) ??
      undefined
    );
  }

  function detener() {
    window.speechSynthesis.cancel();
    setLeyendo(false);
    setPausado(false);
  }

  function iniciar() {
    window.speechSynthesis.cancel();

    const texto = `${title}. ${text}`.replace(/\s+/g, ' ').trim();
    if (!texto) return;

    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = 'es-AR';
    utterance.rate = 1;
    utterance.pitch = 1;
    const voz = elegirVozEs();
    if (voz) utterance.voice = voz;

    utterance.onend = () => {
      setLeyendo(false);
      setPausado(false);
    };
    utterance.onerror = () => {
      setLeyendo(false);
      setPausado(false);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setLeyendo(true);
    setPausado(false);
  }

  function alternarPausa() {
    if (pausado) {
      window.speechSynthesis.resume();
      setPausado(false);
    } else {
      window.speechSynthesis.pause();
      setPausado(true);
    }
  }

  if (!soportado) return null;

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex items-center gap-2">
        <button type="button" onClick={iniciar} className="btn-secondary btn-sm" disabled={leyendo} aria-label="Escuchar la nota en voz alta">
          <Volume2 className="h-4 w-4" aria-hidden="true" />
          Escuchar la nota
        </button>

        {leyendo ? (
          <>
            <button type="button" onClick={alternarPausa} className="btn-secondary btn-sm" aria-label={pausado ? 'Reanudar lectura' : 'Pausar lectura'}>
              {pausado ? 'Reanudar' : 'Pausar'}
            </button>
            <button type="button" onClick={detener} className="btn-ghost btn-sm" aria-label="Detener lectura">
              <Square className="h-4 w-4" aria-hidden="true" />
              Detener
            </button>
          </>
        ) : null}
      </div>

      {leyendo ? (
        <p className="flex items-center gap-2 text-xs font-medium text-brand-700" role="status">
          <span className="inline-flex h-3 w-3 animate-pulse rounded-full bg-accent-500" aria-hidden="true" />
          {pausado ? 'Lectura en pausa' : 'Leyendo…'}
          <span className="block h-1 w-24 overflow-hidden rounded-full bg-news-200" aria-hidden="true">
            <span className={pausado ? 'block h-full w-1/2 bg-brand-600' : 'block h-full w-full origin-left animate-pulse bg-brand-600'} />
          </span>
        </p>
      ) : null}
    </div>
  );
}
