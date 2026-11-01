import { describe, it, expect } from 'vitest';
import {
  buildMetaTitle,
  buildMetaDescription,
  buildKeywords,
  twitterCardType,
  absoluteUrl,
} from './seo';

describe('buildMetaTitle', () => {
  it('usa metaTitle si está disponible', () => {
    expect(buildMetaTitle({ title: 'Título largo', metaTitle: 'SEO corto' })).toBe('SEO corto');
  });

  it('usa title si no hay metaTitle', () => {
    expect(buildMetaTitle({ title: 'Título corto' })).toBe('Título corto');
  });

  it('trunca a 60 caracteres si excede', () => {
    const largo = 'A'.repeat(80);
    const resultado = buildMetaTitle({ title: largo });
    expect(resultado.length).toBeLessThanOrEqual(60);
  });
});

describe('buildMetaDescription', () => {
  it('usa metaDescription si está disponible', () => {
    const resultado = buildMetaDescription({
      title: 'T',
      content: 'contenido',
      metaDescription: 'Descripción SEO',
    });
    expect(resultado).toBe('Descripción SEO');
  });

  it('usa summary si no hay metaDescription', () => {
    const resultado = buildMetaDescription({
      title: 'T',
      content: 'contenido',
      summary: 'Resumen de la nota',
    });
    expect(resultado).toBe('Resumen de la nota');
  });

  it('usa contenido si no hay ni metaDescription ni summary', () => {
    const resultado = buildMetaDescription({
      title: 'T',
      content: 'Este es el contenido de la nota de prueba',
    });
    expect(resultado).toContain('Este es el contenido');
  });
});

describe('buildKeywords', () => {
  it('incluye palabras base y la categoría si se pasa', () => {
    const resultado = buildKeywords(['policiales'], 'Sucesos');
    expect(resultado).toContain('Saladillo');
    expect(resultado).toContain('Sucesos');
    expect(resultado).toContain('policiales');
  });

  it('no duplica palabras', () => {
    const resultado = buildKeywords(['Saladillo', 'noticias']);
    expect(resultado.filter((k) => k === 'Saladillo')).toHaveLength(1);
  });
});

describe('twitterCardType', () => {
  it('devuelve summary_large_image si hay imagen de portada', () => {
    expect(twitterCardType('https://ejemplo.com/foto.jpg')).toBe('summary_large_image');
  });

  it('devuelve summary si no hay imagen', () => {
    expect(twitterCardType(undefined)).toBe('summary');
    expect(twitterCardType(null)).toBe('summary');
  });
});

describe('absoluteUrl', () => {
  it('devuelve URLs absolutas tal cual', () => {
    expect(absoluteUrl('https://ejemplo.com/nota')).toBe('https://ejemplo.com/nota');
  });

  it('antepone el SITE.url a rutas relativas', () => {
    expect(absoluteUrl('/nota/slug')).toContain('/nota/slug');
  });
});
