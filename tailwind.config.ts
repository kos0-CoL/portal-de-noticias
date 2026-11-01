import type { Config } from 'tailwindcss';

/**
 * Paleta "Azul Periodistico".
 * brand    -> azul institucional (cabeceras, sidebar del backoffice, elementos de marca)
 * news     -> grises limpios de fondo y bordes editoriales
 * accent   -> rojo de urgencia / indicadores de ultimo momento
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F4F7FB',
          100: '#E6EDF7',
          200: '#C4D5EC',
          300: '#96B2DA',
          400: '#5E88BE',
          500: '#3566A4',
          600: '#234E86',
          700: '#1A3C69',
          800: '#122A4D',
          900: '#0B1C36',
          950: '#071223'
        },
        news: {
          50: '#FBFBFD',
          100: '#F4F5F7',
          200: '#E8EAEE',
          300: '#D6D9E0',
          400: '#9AA0AC',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          900: '#111827'
        },
        accent: {
          500: '#C62828',
          600: '#A81E1E'
        }
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        editorial: ['var(--font-editorial)', 'Georgia', 'serif']
      },
      boxShadow: {
        card: '0 1px 2px rgba(11,28,54,.06), 0 6px 18px -8px rgba(11,28,54,.18)',
        header: '0 2px 12px rgba(11,28,54,.16)'
      },
      maxWidth: {
        news: '1240px'
      },
      keyframes: {
        ticker: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' }
        }
      },
      animation: {
        ticker: 'ticker 38s linear infinite'
      }
    }
  },
  plugins: []
};

export default config;
