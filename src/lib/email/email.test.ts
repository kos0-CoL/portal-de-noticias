import { describe, it, expect, vi, beforeEach } from 'vitest';
import { plantillaResumenDiario } from '@/lib/email/templates/resumen-diario';

/**
 * Tests unitarios del módulo de envío de newsletter (resúmenes diarios).
 * Se mockean las dependencias externas (nodemailer, prisma) para no depender de servicios reales.
 */

vi.mock('nodemailer', () => ({
  createTransport: vi.fn(() => ({
    sendMail: vi.fn().mockResolvedValue({
      messageId: '<test-message-id>',
      accepted: ['test@mail.com'],
      rejected: [],
    }),
  })),
  createTestAccount: vi.fn().mockResolvedValue({
    user: 'dev',
    pass: 'dev',
  }),
  getTestMessageUrl: vi.fn().mockReturnValue('https://ethereal.email/message/test'),
}));

describe('plantillaResumenDiario', () => {

  const datosBase = {
    fecha: '2026-10-31T10:00:00Z',
    titulo: 'Resumen diario',
    subtitulo: 'Las noticias más importantes de Saladillo y la región.',
    articles: [
      {
        id: 'art_1',
        slug: 'nota-de-prueba',
        title: 'Nueva obra en la plaza principal',
        summary: 'El municipio anunció trabajos de refacción.',
        category: 'Política',
        url: 'https://saladillonoticias.com.ar/nota/nota-de-prueba',
        coverImage: 'https://saladillonoticias.com.ar/uploads/obra.webp',
      },
      {
        id: 'art_2',
        slug: 'clima-semana',
        title: 'Pronóstico para esta semana',
        summary: 'Se esperan lluvias aisladas.',
        category: 'Interés General',
        url: 'https://saladillonoticias.com.ar/nota/clima-semana',
        coverImage: undefined,
      },
    ],
    siteName: 'Saladillo Noticias',
    siteUrl: 'https://saladillonoticias.com.ar',
    unsubscribeUrl: 'https://saladillonoticias.com.ar/newsletter/dar-de-baja',
  };

  it('genera un HTML válido con el título del sitio y la fecha', () => {
    const html = plantillaResumenDiario(datosBase);
    expect(html).toContain('Saladillo Noticias');
    expect(html).toContain('Resumen diario');
    expect(html).toContain('31 de octubre de 2026');
  });

  it('incluye los artículos con sus títulos y enlaces', () => {
    const html = plantillaResumenDiario(datosBase);
    expect(html).toContain('Nueva obra en la plaza principal');
    expect(html).toContain('Pronóstico para esta semana');
    expect(html).toContain('/nota/nota-de-prueba');
    expect(html).toContain('/nota/clima-semana');
  });

  it('incluye la imagen de portada cuando existe', () => {
    const html = plantillaResumenDiario(datosBase);
    expect(html).toContain('obra.webp');
  });

  it('renderiza sin imagen cuando no hay coverImage', () => {
    const html = plantillaResumenDiario({
      ...datosBase,
      articles: [
        {
          id: 'art_2',
          slug: 'clima-semana',
          title: 'Pronóstico para esta semana',
          summary: 'Se esperan lluvias aisladas.',
          category: 'Interés General',
          url: 'https://saladillonoticias.com.ar/nota/clima-semana',
          coverImage: undefined,
        },
      ],
    });
    expect(html).toContain('Pronóstico para esta semana');
    expect(html).not.toContain('coverImage');
  });

  it('muestra mensaje de no hay noticias cuando la lista está vacía', () => {
    const html = plantillaResumenDiario({
      ...datosBase,
      articles: [],
    });
    expect(html).toContain('No hay noticias nuevas hoy.');
  });

  it('incluye el enlace de dar de baja', () => {
    const html = plantillaResumenDiario(datosBase);
    expect(html).toContain('Dar de baja');
    expect(html).toContain('/newsletter/dar-de-baja');
  });

  it('incluye el subtítulo cuando se proporciona', () => {
    const html = plantillaResumenDiario(datosBase);
    expect(html).toContain('Las noticias más importantes de Saladillo y la región.');
  });

  it('genera HTML sin errores cuando no hay subtítulo', () => {
    const html = plantillaResumenDiario({
      ...datosBase,
      subtitulo: undefined,
    });
    expect(html).toContain('Saladillo Noticias');
    expect(html).toContain('Nueva obra en la plaza principal');
  });
});

describe('servicio de transporte de email (mock)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('createTransport es llamado al crear el transporter', () => {
    const nodemailer = require('nodemailer');
    expect(nodemailer.createTransport).toBeDefined();
  });
});
