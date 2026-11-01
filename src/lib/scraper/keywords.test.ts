import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: { keyword: { findMany: vi.fn(() => Promise.resolve([])) } }
}));

import { matchLocalKeywords } from './keywords';

const keywordsBase = [
  { word: 'Saladillo', weight: 10 },
  { word: 'Del Carril', weight: 10 },
  { word: 'Hospital Posadas', weight: 9 },
  { word: 'intendente', weight: 5 },
];

describe('matchLocalKeywords', () => {
  it('detecta una sola coincidencia y calcula score', () => {
    const resultado = matchLocalKeywords('Ocurrió un hecho en Saladillo', keywordsBase);
    expect(resultado.matches).toContain('Saladillo');
    expect(resultado.score).toBe(10);
    expect(resultado.priority).toBe('ALTA');
  });

  it('es insensible a mayúsculas y acentos', () => {
    const resultado = matchLocalKeywords('SALADILLO y café en Del Carril', keywordsBase);
    expect(resultado.matches).toContain('Saladillo');
    expect(resultado.matches).toContain('Del Carril');
    expect(resultado.score).toBe(20);
  });

  it('detecta frases de varias palabras como Hospital Posadas', () => {
    const resultado = matchLocalKeywords('El Hospital Posadas atendió a vecinos', keywordsBase);
    expect(resultado.matches).toContain('Hospital Posadas');
    expect(resultado.score).toBe(9);
    expect(resultado.priority).toBe('ALTA');
  });

  it('marca URGENTE con 3 o más coincidencias distintas', () => {
    const texto = 'Saladillo, Del Carril y el intendente anunciaron obras';
    const resultado = matchLocalKeywords(texto, keywordsBase);
    expect(resultado.priority).toBe('URGENTE');
  });

  it('marca URGENTE con score >= 25', () => {
    const texto = 'Saladillo Saladillo Saladillo Saladillo Saladillo';
    const resultado = matchLocalKeywords(texto, keywordsBase);
    expect(resultado.score).toBe(50);
    expect(resultado.priority).toBe('URGENTE');
  });

  it('devuelve NORMAL sin coincidencias', () => {
    const resultado = matchLocalKeywords('Noticia nacional de política', keywordsBase);
    expect(resultado.matches).toEqual([]);
    expect(resultado.score).toBe(0);
    expect(resultado.priority).toBe('NORMAL');
  });

  it('maneja texto vacío o undefined', () => {
    expect(matchLocalKeywords('', keywordsBase).matches).toEqual([]);
    expect(matchLocalKeywords(undefined as any, keywordsBase).matches).toEqual([]);
  });
});
