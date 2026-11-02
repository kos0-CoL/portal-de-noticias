# Extracción del cuerpo de notas con IA (alternativa al parser por selectores)

Fecha: 2026-11-02

## Objetivo

Permitir que, para una fuente concreta, la extracción del **cuerpo de la nota** (título,
contenido, imágenes y fecha) la haga un modelo de IA en lugar del parser por selectores
CSS. La nota resultante se guarda como borrador `PENDING_REVIEW` y el editor la acomoda
con el flujo de redacción que ya existe.

## Alcance

**Dentro del alcance**

- Un segundo modelo de IA, configurable en `/admin/ia`, dedicado a la extracción.
- Un extractor que toma el HTML ya descargado de una nota y devuelve la nota estructurada.
- Un toggle por fuente que activa la extracción por IA.
- Integración en el pipeline de scraping y en el preview de fuentes.

**Fuera del alcance**

- Descubrimiento de links por IA: sigue con los selectores actuales (funciona bien).
- Entrada multimodal / screenshot: la entrada es HTML en texto plano.
- Edición de la nota extraída: la revisa el editor con las herramientas actuales.
- Reescritura por IA de las notas extraídas por IA: se saltea (ver Decisiones).

## Decisiones

1. **Contrato compartido.** El extractor devuelve el mismo tipo `ParsedArticle` que ya
   devuelve `parseArticle`, para no tocar el resto del pipeline.
2. **Entrada = HTML limpio.** Se le manda al modelo el HTML de la nota ya reducido
   (sin `script`, `style`, `nav`, `footer`, `header`, `aside`, `form`) y con solo los
   atributos `src`, `href` y `alt`. Es más barato y más preciso que un screenshot, y
   permite resolver las URLs exactas de las imágenes.
3. **Un segundo modelo.** `ai.extractModel` en `/admin/ia`. Si queda vacío, se usa el
   modelo general (`ai.model`).
4. **Toggle por fuente.** `Source.useAiExtraction`. Las fuentes sin el toggle siguen
   usando `parseArticle`.
5. **Sin reescritura cuando hay extracción por IA.** Con el toggle activo, la nota se
   guarda tal cual la extrajo la IA y se saltea `rewriteArticleById`. Son 1 llamada por
   nota en vez de 2. El editor puede reescribir a mano si hace falta.
6. **Fallback a selectores.** Si la extracción por IA falla, se registra el motivo y se
   cae a `parseArticle`, para no perder la nota.

## Arquitectura

Se agrega un módulo aislado (`ai/extract.ts`) con una única responsabilidad: convertir
HTML de nota en `ParsedArticle`. El pipeline sólo decide qué implementación usar.

```
pipeline.ts
  └─ si source.useAiExtraction
        └─ ai/extract.ts  ──> chatComplete() (provider.ts) ──> OpenRouter/proveedor
     si no
        └─ scraper/parser.ts (parseArticle)
```

## Componentes y cambios

### 1. Configuración de IA

- `src/lib/settings.ts`
  - Nueva clave `SETTING_KEYS.aiExtractModel = 'ai.extractModel'`.
  - `AiSettings.extractModel: string`.
  - Default `''` (cadena vacía = usar el modelo general).
  - `getAiSettings()` la lee; `getAiSettingsForClient()` ya propaga el objeto.
  - Helper `resolveExtractModel(settings): string` → `settings.extractModel || settings.model`.
- `src/app/api/ia/config/route.ts`
  - Agregar `extractModel: z.string().trim().optional()` al schema y persistirlo.
- `src/components/admin/IaSettingsForm.tsx`
  - Campo "Modelo de extracción (scraping)" reutilizando la carga de modelos de
    OpenRouter ya existente. Placeholder: "Si se deja vacío, usa el modelo general".

### 2. Extractor

Nuevo archivo `src/lib/ai/extract.ts`:

- `export async function extractArticleWithAi(html, url, opts): Promise<ParsedArticle>`
- Pasos:
  1. Reducir el HTML con cheerio:
     - Eliminar `CONTENEDORES_DESCARTE` (se exporta desde `parser.ts` para reusar la lista).
     - Quedarse sólo con `src`, `href` y `alt` como atributos.
     - Truncar a ~40.000 caracteres.
  2. `chatComplete(messages, { json: true, model: resolveExtractModel(settings), temperature: 0, maxTokens: 8000 })`.
  3. Parsear con `extractJsonObject` + zod:
     `{ title, content, summary, images: string[], publishedAt: string | null }`.
  4. Sanitizar el `content` con `sanitizeHtml`, resolver las URLs de imágenes contra
     `url` (relativas incluidas) y armar el `ParsedArticle`.
- Errores en español, con el mismo estilo que `parser.ts`.
- Validación mínima de texto del cuerpo: 40 palabras, igual que el umbral actual de
  `parseArticle`.

### 3. Modelo de datos

- `prisma/schema.prisma`: `Source.useAiExtraction Boolean @default(false)`.
- Migración Prisma correspondiente.
- `src/app/api/scraping/fuentes/route.ts` (POST): aceptar y persistir el campo.
- `src/app/api/scraping/fuentes/[id]/route.ts` (PATCH): aceptar y persistir el campo.
- `src/components/admin/SourceForm.tsx`: checkbox "Extraer el cuerpo con IA" + incluirlo en
  el payload.

### 4. Pipeline

- `src/lib/scraper/pipeline.ts`:
  - Helper que elige el extractor según `source.useAiExtraction`.
  - Envolver la extracción por IA en `try/catch`: si falla, `registrar('!', ...)` y caer a
    `parseArticle`.
  - Cuando `source.useAiExtraction` es true, **no** llamar a `rewriteArticleById`.

### 5. Preview

- `src/app/api/scraping/preview/route.ts`: usar el extractor cuando la fuente tenga el
  toggle activo, para poder validar la calidad con una URL antes de correr el job.

## Manejo de errores

- La IA falla (red, JSON inválido, respuesta vacía, límite de tokens): se registra el
  motivo y se reintenta con `parseArticle`.
- Si también falla `parseArticle`, el comportamiento es el actual: la nota se cuenta como
  fallida y el job continúa.
- Nunca se guarda una nota sin título ni sin cuerpo.

## Testing

- Test unitario de `extract.ts` con un HTML de fixture y un `chatComplete` mockeado:
  - JSON válido → `ParsedArticle` correcto.
  - JSON con ```json ... ``` → se extrae igual.
  - Respuesta sin JSON → lanza error en español.
  - Imágenes relativas → URLs absolutas.
- Test del helper de selección de extractor en el pipeline (IA on/off y fallback).

## Riesgos y límites

- **Costo en tokens**: el HTML reducido puede rondar los 10k tokens por nota; con
  `maxItemsPerRun = 20` son ~200k tokens por corrida.
- **Modelos `:free`**: tienen tope diario y los de razonamiento pueden cortar el JSON;
  conviene usar un modelo de texto que no razone para la extracción.
- **Calidad variable**: el modelo puede resumir en vez de transcribir; el prompt debe
  pedir fidelidad y el editor revisa antes de publicar.
- El toggle por fuente permite probar en InfoSaladillo sin afectar otras fuentes.
