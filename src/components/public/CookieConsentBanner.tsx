'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, Mail } from 'lucide-react';

const COOKIE_KEY = 'sn_cookie_consent';

interface CookieConsent {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
  timestamp: number;
}

/**
 * Componente de banner de consentimiento de cookies (GDPR).
 * Se renderiza solo del lado del cliente para evitar hidratación diferente.
 * Al aceptar, guarda el consentimiento en localStorage y lo envía al servidor.
 */
export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(COOKIE_KEY);
    if (!stored) {
      setVisible(true);
    }
  }, []);

  const aceptar = (opciones: CookieConsent) => {
    localStorage.setItem(COOKIE_KEY, JSON.stringify({ ...opciones, timestamp: Date.now() }));
    setVisible(false);
    // Enviar al servidor para registro (opcional, si hay sesión)
    fetch('/api/cookie-consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opciones)
    }).catch(() => {}); // No bloquear si falla
  };

  const aceptarTodo = () => {
    aceptar({ essential: true, analytics: true, marketing: true, timestamp: Date.now() });
  };

  const aceptarSoloEsenciales = () => {
    aceptar({ essential: true, analytics: false, marketing: false, timestamp: Date.now() });
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] bg-brand-900 text-white shadow-2xl" role="dialog" aria-modal="true" aria-label="Consentimiento de cookies">
      <div className="max-w-5xl mx-auto px-6 py-6 sm:flex sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 text-sm sm:text-base">
          <ShieldAlert className="h-5 w-5 shrink-0 text-brand-400" aria-hidden="true" />
          <div>
            <p className="font-semibold">Usamos cookies y tecnologías similares</p>
            <p className="text-sm text-brand-200 mt-1">
              Este sitio usa cookies esenciales para funcionar. Con tu consentimiento, también usamos
              cookies de análisis para entender cómo nos visitan y mejorar el sitio, y de marketing
              para mostrarte publicidad relevante. Puedes aceptar todo o solo lo esencial.
            </p>
            <p className="mt-2 text-xs text-brand-300">
              <a href="/legales/cookies" className="underline hover:text-white">Ver política de cookies</a>
              ·
              <a href="/legales/privacidad" className="underline hover:text-white">Ver política de privacidad</a>
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:justify-end sm:items-center">
          <button
            onClick={aceptarSoloEsenciales}
            className="flex items-center gap-2 px-4 py-2 rounded-md border border-white/20 bg-white/10 text-sm font-medium hover:bg-white/20 transition"
          >
            <ShieldCheck className="h-4 w-4 shrink-0 text-brand-300" aria-hidden="true" />
            Solo esenciales
          </button>
          <button
            onClick={aceptarTodo}
            className="flex items-center gap-2 px-6 py-2 rounded-md bg-brand-600 text-sm font-semibold text-white hover:bg-brand-500 transition"
          >
            Aceptar todo
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook para leer el consentimiento de cookies desde localStorage.
 * Útil para condicionar scripts de análisis/marketing.
 */
export function useCookieConsent() {
  const [consent, setConsent] = useState<CookieConsent | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(COOKIE_KEY);
    if (stored) {
      try {
        setConsent(JSON.parse(stored));
      } catch {
        setConsent(null);
      }
    }
  }, []);

  return consent;
}
