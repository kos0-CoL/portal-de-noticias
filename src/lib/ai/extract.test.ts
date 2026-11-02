import { describe, it, expect, vi, beforeEach } from 'vitest';

/** El proveedor de IA se mockea: los tests no salen a la red. */
const { chatComplete } = vi.hoisted(() => ({ chatComplete: vi.fn() }));

vi.mock('@/lib/ai/provider', () => ({ chatComplete }));

vi.mock('@/lib/settings', () => ({
  getAiSettings: vi.fn(() =>
    Promise.resolve({
      provider: 'openrouter',
      model: 'modelo-general',
      extractModel: 'modelo-extraccion',
      baseUrl: '',
      apiKey: 'clave',
      apiKeyMasked: 'cl***ve',
      hasApiKey: true,
      defaultTonality: 'CERCANO_LOCAL',
      citeSource: true,
      rewriteEnabled: false,
      temperature: 0.75,
      systemPrompt: ''
    })
  ),
  resolveExtractModel: (s: { extractModel: string; model: string }) => s.extractModel.trim() || s.model
}));

import { extractArticleWithAi, reducirHtml } from './extract';

const URL_NOTA = 'https://infosaladillo.com.ar/registro-de-lluvias/';

/** Cuerpo de más de 40 palabras para pasar la validación mínima. */
const CUERPO =
  '<p>El registro de lluvias de las últimas horas dejó un acumulado importante en Saladillo y en toda la región. ' +
  'Según el informe difundido por la comuna, las precipitaciones comenzaron por la madrugada y se extendieron durante ' +
  'buena parte de la mañana, con mayor intensidad en el casco urbano y en la zona rural. Los vecinos de Del Carril y ' +
  'de Cazón también reportaron lluvias constantes durante casi toda la jornada.</p>';

const HTML_NOTA = `<!doctype html>
<html>
  <head>
    <title>Registro de lluvias</title>
    <script>console.log('ruido')</script>
  </head>
  <body>
    <nav class="menu-principal"><a href="/seccion/sociedad/">Sociedad</a></nav>
    <article class="entry-content">
      <h1 class="titulo-post">Registro de lluvias en Saladillo</h1>
      <p class="parrafo">${'Texto de la nota. '.repeat(20)}</p>
      <img src="/fotos/lluvia.jpg" class="foto" alt="Lluvia en Saladillo" />
    </article>
    <aside class="publicidad">Espacio publicitario</aside>
    <footer class="pie"><a href="/contacto/">Contacto</a></footer>
  </body>
</html>`;

function respuesta(json: unknown): void {
  chatComplete.mockResolvedValueOnce(JSON.stringify(json));
}

describe('reducirHtml', () => {
  it('saca navegación, publicidad, scripts y atributos que no aportan', () => {
    const reducido = reducirHtml(HTML_NOTA);
    expect(reducido).not.toContain('console.log');
    expect(reducido).not.toContain('menu-principal');
    expect(reducido).not.toContain('publicidad');
    expect(reducido).not.toContain('class=');
    expect(reducido).not.toContain('<nav');
    // Los atributos útiles sobreviven.
    expect(reducido).toContain('src="/fotos/lluvia.jpg"');
    expect(reducido).toContain('alt="Lluvia en Saladillo"');
  });
});

describe('extractArticleWithAi', () => {
  beforeEach(() => {
    chatComplete.mockReset();
  });

  it('devuelve la nota extraída con los datos normalizados', async () => {
    respuesta({
      title: '  Registro de lluvias en Saladillo  ',
      content: CUERPO,
      summary: 'Las lluvias dejaron un acumulado importante en la región.',
      images: ['/fotos/lluvia.jpg', 'https://cdn.ejemplo.com/mapa.png'],
      publishedAt: '2026-11-01T09:40:00-03:00'
    });

    const nota = await extractArticleWithAi(HTML_NOTA, URL_NOTA);

    expect(nota.title).toBe('Registro de lluvias en Saladillo');
    expect(nota.contentHtml).toContain('<p>');
    expect(nota.excerpt).toBe('Las lluvias dejaron un acumulado importante en la región.');
    expect(nota.images).toEqual([
      'https://infosaladillo.com.ar/fotos/lluvia.jpg',
      'https://cdn.ejemplo.com/mapa.png'
    ]);
    expect(nota.publishedAt?.toISOString().slice(0, 10)).toBe('2026-11-01');
  });

  it('usa el modelo de extracción configurado y pide JSON con temperatura 0', async () => {
    respuesta({ title: 'Nota', content: CUERPO, summary: '', images: [], publishedAt: null });

    await extractArticleWithAi(HTML_NOTA, URL_NOTA);

    expect(chatComplete).toHaveBeenCalledTimes(1);
    const [, opciones] = chatComplete.mock.calls[0];
    expect(opciones).toMatchObject({ json: true, model: 'modelo-extraccion', temperature: 0 });
  });

  it('tolera la respuesta envuelta en un bloque de código', async () => {
    chatComplete.mockResolvedValueOnce(
      '```json\n' + JSON.stringify({ title: 'Nota', content: CUERPO, summary: '', images: [], publishedAt: null }) + '\n```'
    );

    const nota = await extractArticleWithAi(HTML_NOTA, URL_NOTA);
    expect(nota.title).toBe('Nota');
  });

  it('falla con un mensaje claro si la IA no devuelve JSON', async () => {
    chatComplete.mockResolvedValueOnce('No puedo ayudarte con eso.');

    await expect(extractArticleWithAi(HTML_NOTA, URL_NOTA)).rejects.toThrow(/JSON/);
  });

  it('falla si el cuerpo extraído tiene muy poco texto', async () => {
    respuesta({ title: 'Nota', content: '<p>Muy corto.</p>', summary: '', images: [], publishedAt: null });

    await expect(extractArticleWithAi(HTML_NOTA, URL_NOTA)).rejects.toThrow(/muy poco texto/);
  });

  it('descarta imágenes que no son fotos de la nota', async () => {
    respuesta({
      title: 'Nota',
      content: CUERPO,
      summary: '',
      images: ['data:image/png;base64,AAAA', 'https://infosaladillo.com.ar/logo.png', '/fotos/lluvia.jpg'],
      publishedAt: 'fecha inválida'
    });

    const nota = await extractArticleWithAi(HTML_NOTA, URL_NOTA);
    expect(nota.images).toEqual(['https://infosaladillo.com.ar/fotos/lluvia.jpg']);
    expect(nota.publishedAt).toBeNull();
  });
});
