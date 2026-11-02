# Almacenamiento externo de portadas (Supabase Storage / Google Drive)

Fecha: 2026-11-02

## Objetivo

Poder guardar la **imagen de portada** de una nota en un proveedor de almacenamiento
externo (Supabase Storage o Google Drive) en lugar de `/public/uploads`, que en Vercel no
persiste (sistema de archivos de solo lectura) y obliga a dejar la portada apuntando al
sitio de origen. El proveedor se elige **por nota** desde el editor, con un **proveedor por
defecto** global que también usa el scraper.

## Alcance

**Dentro del alcance**

- Dos proveedores: Supabase Storage y Google Drive.
- Subida **solo de la portada** (una imagen por nota).
- Selector de proveedor por nota en el editor + botón "Alojar imagen".
- Proveedor por defecto configurable en una sección nueva `/admin/almacenamiento`.
- Uso automático del proveedor por defecto en las notas que trae el scraper.
- Procesamiento previo con sharp (resize + marca de agua + WebP), reutilizando lo actual.

**Fuera del alcance**

- GitHub como proveedor (queda para una segunda vuelta).
- Migración de las imágenes ya existentes.
- Subir las imágenes del cuerpo de la nota (siguen apuntando al origen).
- Volver a activar el optimizador de `next/image`.
- Borrado/limpieza de archivos en los proveedores.

## Decisiones

1. **Disparo manual desde el editor.** La subida la dispara un botón en el editor, no el
   guardado. Así el guardado no se alarga ni puede fallar por el storage, y el editor ve
   la URL final antes de publicar.
2. **Proveedor inferido por la URL.** No se agrega ningún campo a la base ni migración: la
   portada ya alojada se reconoce por su host (Supabase o `lh3.googleusercontent.com`).
3. **Solo la portada.** El resto de las imágenes de la nota sigue con el comportamiento
   actual.
4. **Degradación elegante.** Si el proveedor falla, se informa en el editor y queda la URL
   original. En el scraper nunca se aborta el job por esto.
5. **Credenciales cifradas.** La service role key de Supabase y el JSON de la service
   account de Drive se guardan como secretos (mismo AES-256-GCM que la API key de IA).
6. **Sin dependencias nuevas.** Supabase por REST con `fetch`; Drive con JWT firmado con
   `jose` (ya está en `package.json`).

## Arquitectura

```
Editor (selector + botón "Alojar imagen")
  └─ POST /api/imagenes/alojar { origen, proveedor, articleId? }
        └─ lib/storage/index.ts  (resuelve el proveedor)
              ├─ storage/supabase.ts ──> REST /storage/v1/object/...
              └─ storage/drive.ts    ──> JWT(jose) -> OAuth -> upload multipart
        └─ lib/images/process.ts   (descarga + sharp + WebP + marca de agua)

Scraper (pipeline)
  └─ replaceArticleImages(articleId, urls, providerId?)
        └─ porta la portada al proveedor por defecto (si está configurado)
```

## Componentes y cambios

### 1. Capa de almacenamiento (`src/lib/storage/`)

Nuevo módulo con interfaz común:

```ts
export type StorageProviderId = 'supabase' | 'drive';

export interface StorageProvider {
  id: StorageProviderId;
  nombre: string;
  disponible(): Promise<boolean>;
  subir(buffer: Buffer, opts: { nombre: string; contentType: string }): Promise<{ url: string; path: string }>;
}
```

- **`supabase.ts`** — `POST {projectUrl}/storage/v1/object/{bucket}/{ruta}` con
  `Authorization: Bearer <service key>` y `x-upsert: true`. URL pública resultante:
  `{projectUrl}/storage/v1/object/public/{bucket}/{ruta}`. Requiere **bucket público**.
- **`drive.ts`** — firma el JWT de la service account con `jose` (RS256), lo canjea por un
  access token en `https://oauth2.googleapis.com/token`, sube con
  `upload/drive/v3/files?uploadType=multipart`, da permiso `anyone/reader` y devuelve
  `https://lh3.googleusercontent.com/d/<fileId>`.
- **`index.ts`** — `getProvider(id)`, `proveedorPorDefecto()`, `proveedoresDisponibles()`,
  y `esUrlDeProveedor(url)` para saber si una URL ya está alojada.

### 2. Configuración

- `src/lib/settings.ts`
  - Claves nuevas: `storage.defaultProvider`, `storage.supabaseUrl`,
    `storage.supabaseBucket`, `storage.supabaseServiceKey`, `storage.driveServiceAccount`,
    `storage.driveFolderId`.
  - `SECRET_KEYS` suma `storage.supabaseServiceKey` y `storage.driveServiceAccount`.
  - `DEFAULTS` con fallback a variables de entorno (`STORAGE_PROVIDER`, `SUPABASE_URL`,
    `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET`, `GOOGLE_SERVICE_ACCOUNT_JSON`,
    `GDRIVE_FOLDER_ID`), igual que la configuración de IA.
  - `getStorageSettings()` con la versión enmascarada para el cliente.
- `src/app/api/almacenamiento/config/route.ts` — GET/POST con zod, espejo de
  `/api/ia/config`.
- `src/app/api/almacenamiento/probar/route.ts` — POST `{ proveedor }` que sube una imagen
  mínima y devuelve `{ ok, url }` o el error, para validar credenciales.

### 3. Endpoint de subida

`src/app/api/imagenes/alojar/route.ts` — POST, requiere sesión:

- Body: `{ origen: string, proveedor: 'supabase' | 'drive' | 'default', articleId?: string }`.
- Flujo: resolver el proveedor → descargar `origen` → procesar con sharp (reusando
  `processWithSharp`) → subir → devolver `{ ok, url, proveedor, bytes, width, height }`.
- Validaciones: `origen` debe ser `http(s)` o una ruta `/uploads/...`; si ya está alojada
  en el proveedor elegido, se devuelve la misma URL sin volver a subir.

### 4. Procesamiento (`src/lib/images/process.ts`)

- Extraer el destino de `processRemoteImage` / `processUploadedImage`: hoy llaman
  directamente a `saveBuffer` (que escribe en `/public/uploads`). Se agrega una variante
  que recibe un `StorageProvider` y sube el buffer procesado, devolviendo la URL pública.
- El resto de la lógica (sharp, marca de agua, modo degradado) no se toca.

### 5. Editor (`src/components/admin/ArticleEditor.tsx`)

En el bloque de "Imagen de portada":

- `select` "Alojar portada en" con `Por defecto` + los proveedores disponibles.
- Botón "Alojar imagen" que llama a `/api/imagenes/alojar` y, si responde bien,
  reemplaza `form.coverImage` por la URL devuelta y muestra "Alojada en <proveedor> ✓".
- Si la URL ya es del proveedor o `/uploads/`, el estado lo indica y el botón queda
  deshabilitado.
- El error del endpoint se muestra con el mismo patrón de error del editor.

### 6. Scraper (`src/lib/scraper/pipeline.ts` + `images/process.ts`)

- `replaceArticleImages(articleId, urls, providerId?)`: cuando hay `providerId`, la
  **portada (index 0)** se sube a ese proveedor y `Article.coverImage` se actualiza con la
  URL pública. El resto de las imágenes mantiene el comportamiento actual.
- En el pipeline se pasa el proveedor por defecto resuelto; si no hay ninguno configurado,
  el comportamiento es exactamente el de hoy.

### 7. Panel

- `src/app/admin/almacenamiento/page.tsx` — página de configuración.
- `src/components/admin/StorageSettingsForm.tsx` — formulario (proveedor por defecto,
  credenciales, botones "Probar").
- `src/components/admin/AdminShell.tsx` — ítem nuevo en `NAV_ITEMS` y su `SECTION_TITLES`.

## Manejo de errores

- **Proveedor no configurado:** el endpoint responde 400 con un mensaje claro; el editor lo
  muestra y no cambia la portada.
- **Falla la descarga o el procesamiento:** se devuelve la URL original y se avisa.
- **Falla la subida:** se devuelve el motivo; la portada queda como estaba.
- **Scraper:** la subida de la portada va en `try/catch`; si falla, la nota se guarda igual
  con la URL original y se registra en el log del job.

## Testing

- `storage/supabase.test.ts` — con `fetch` mockeado: forma del request (URL, headers,
  path) y armado de la URL pública.
- `storage/drive.test.ts` — con `fetch` mockeado: canje del token, multipart, permiso
  público y URL final.
- `storage/index.test.ts` — resolución de proveedor, `esUrlDeProveedor` y proveedor por
  defecto.
- Test del endpoint `/api/imagenes/alojar` con zod: `origen` inválido y proveedor
  desconocido.

## Riesgos y límites

- **Google Drive** es el eslabón frágil: la URL pública es un endpoint no oficial que
  Google puede limitar, y hay cuotas de subida/permisos. Con volumen alto de scraping
  puede rebotar; por eso todo va con `try/catch` y la nota nunca se pierde.
- **Supabase Storage** es el confiable, pero el bucket debe ser **público** y su capa
  gratuita es de 1 GB: conviene bajar `imageMaxWidth`/`imageQuality` si el volumen crece.
- **Latencia:** descargar + sharp + subir puede tardar unos segundos; la función del
  endpoint necesita `maxDuration` holgado.
- **Credenciales:** son secretos de escritura sobre el storage; se cifran y nunca se
  devuelven al navegador (solo enmascaradas).
