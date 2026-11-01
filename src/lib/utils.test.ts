import { describe, it, expect } from 'vitest';
import {
  slugify,
  stripHtml,
  countWords,
  estimateReadingTime,
  sanitizeHtml,
  textToHtml,
  escapeHtml,
  formatFecha,
  tiempoRelativo,
  formatPrecio,
  stableHash,
  truncate,
  similarity,
  extractImageUrls,
} from './utils';

describe('slugify', () => {
  it('convierte a minúsculas, quita acentos y reemplaza espacios por guiones', () => {
    expect(slugify('Nueva Zelanda: ¡Hola Mundo!')).toBe('nueva-zelanda-hola-mundo');
  });

  it('colapsa múltiples guiones y respeta el límite de 90 caracteres', () => {
    const input = 'a   b---c d';
    expect(slugify(input)).toBe('a-b-c-d');
  });

  it('devuelve cadena vacía para entrada vacía', () => {
    expect(slugify('')).toBe('');
  });
});

describe('stripHtml', () => {
  it('elimina todas las etiquetas HTML y decodifica entidades comunes', () => {
    expect(stripHtml('<p>Hola <strong>mundo</strong></p>')).toBe('Hola mundo');
    expect(stripHtml('&amp; &quot; &#39;')).toBe('& " \'');
  });

  it('devuelve cadena vacía para entrada vacía', () => {
    expect(stripHtml('')).toBe('');
  });
});

describe('countWords', () => {
  it('cuenta palabras ignorando markup HTML', () => {
    expect(countWords('<p>Uno dos tres</p>')).toBe(3);
  });

  it('devuelve 0 para entrada vacía o solo HTML', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('<br><br>')).toBe(0);
  });
});

describe('estimateReadingTime', () => {
  it('devuelve al menos 1 minuto', () => {
    expect(estimateReadingTime('Hola mundo')).toBe(1);
  });

  it('calcula minutos basado en 200 palabras por minuto', () => {
    const texto = 'palabra '.repeat(600);
    expect(estimateReadingTime(texto)).toBe(3);
  });
});

describe('escapeHtml', () => {
  it('escapa caracteres especiales HTML', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });
});

describe('sanitizeHtml', () => {
  it('elimina scripts, estilos e iframes', () => {
    const sucio = '<p>Texto</p><script>alert(1)</script><iframe src="x"></iframe>';
    const limpio = sanitizeHtml(sucio);
    expect(limpio).not.toContain('<script>');
    expect(limpio).not.toContain('<iframe>');
  });

  it('mantiene etiquetas permitidas como p, strong, ul', () => {
    const limpio = sanitizeHtml('<p><strong>negrita</strong></p><ul><li>item</li></ul>');
    expect(limpio).toContain('<p>');
    expect(limpio).toContain('<strong>');
    expect(limpio).toContain('<ul>');
  });
});

describe('textToHtml', () => {
  it('convierte párrafos separados por líneas en etiquetas <p>', () => {
    const resultado = textToHtml('Párrafo uno.\n\nPárrafo dos.');
    expect(resultado).toContain('<p>Párrafo uno.</p>');
    expect(resultado).toContain('<p>Párrafo dos.</p>');
  });
});

describe('formatFecha', () => {
  it('formatea fecha en español de Argentina', () => {
    const fecha = new Date('2026-10-31T09:40:00-03:00');
    const resultado = formatFecha(fecha);
    expect(resultado).toContain('31');
    expect(resultado).toContain('octubre');
    expect(resultado).toContain('2026');
    expect(resultado).toContain('09:40');
  });
});

describe('tiempoRelativo', () => {
  it('devuelve "Ahora mismo" para fechas muy cercanas', () => {
    expect(tiempoRelativo(new Date())).toBe('Ahora mismo');
  });

  it('devuelve "Hace X min" para fechas recientes', () => {
    const hace30min = new Date(Date.now() - 30 * 60000);
    expect(tiempoRelativo(hace30min)).toBe('Hace 30 min');
  });
});

describe('formatPrecio', () => {
  it('devuelve "Consultar" para null o undefined', () => {
    expect(formatPrecio(null)).toBe('Consultar');
    expect(formatPrecio(undefined)).toBe('Consultar');
  });

  it('formatea precio en pesos argentinos', () => {
    const resultado = formatPrecio(1500);
    expect(resultado).toContain('1.500');
  });
});

describe('stableHash', () => {
  it('devuelve el mismo hash para la misma entrada', () => {
    expect(stableHash('hola')).toBe(stableHash('hola'));
  });

  it('devuelve hashes diferentes para entradas diferentes', () => {
    expect(stableHash('hola')).not.toBe(stableHash('mundo'));
  });
});

describe('truncate', () => {
  it('corta texto largo y agrega puntos suspensivos', () => {
    expect(truncate('Hola mundo cruel', 8)).toBe('Hola mu…');
  });

  it('devuelve el texto sin cambios si es corto', () => {
    expect(truncate('corto', 10)).toBe('corto');
  });
});

describe('similarity', () => {
  it('devuelve 1 para textos idénticos', () => {
    expect(similarity('hola mundo', 'hola mundo')).toBe(1);
  });

  it('devuelve 0 para textos sin similitud', () => {
    expect(similarity('abc', 'xyz')).toBe(0);
  });

  it('es insensible a mayúsculas y acentos', () => {
    expect(similarity('Saladillo', 'saladillo')).toBe(1);
    expect(similarity('café', 'cafe')).toBe(1);
  });
});

describe('extractImageUrls', () => {
  it('extrae URLs de etiquetas img', () => {
    const html = '<img src="https://ejemplo.com/foto.jpg"><img src="/local.png">';
    const urls = extractImageUrls(html);
    expect(urls).toContain('https://ejemplo.com/foto.jpg');
    expect(urls).toContain('/local.png');
  });

  it('ignora imágenes data:', () => {
    const html = '<img src="data:image/png;base64,abc">';
    expect(extractImageUrls(html)).toEqual([]);
  });
});
