# Saladillo Noticias

Portal de noticias local para **Saladillo, Buenos Aires, Argentina**, con sitio público para lectores y un backoffice completo con automatización, IA y scraping.

Incluye las secciones **Inicio, Policiales, Política, Deportes, Interés General, Agro y Clasificados/Comunidad**, cobertura de las localidades del partido (Del Carril, Cazón, Polvaredas, Juan José Paso, Álvarez de Toledo, La Barrancosa) y el diseño **"Azul Periodístico"**: azul marino institucional en cabeceras y elementos de marca, grises limpios de fondo y tarjetas blancas. 100% responsive y mobile-first.

---

## Índice

- [Demo sin instalar nada](#demo-sin-instalar-nada)
- [Stack](#stack)
- [Requisitos](#requisitos)
- [Puesta en marcha](#puesta-en-marcha)
- [Variables de entorno](#variables-de-entorno)
- [Cómo acceder al Panel de Administración](#cómo-acceder-al-panel-de-administración)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Módulos y funcionalidad](#módulos-y-funcionalidad)
- [Flujo completo del scraper + IA](#flujo-completo-del-scraper--ia)
- [Referencia de la API](#referencia-de-la-api)
- [Modelo de datos](#modelo-de-datos)
- [Seguridad](#seguridad)
- [Despliegue](#despliegue)
- [Ética del scraping](#ética-del-scraping)

---

## Demo sin instalar nada

La carpeta [`preview/`](./preview) contiene una **maqueta estática** (HTML + CSS + JS, sin build ni Node) que reproduce el diseño terminado del portal y del panel. Sirve para ver el resultado al instante.

```powershell
cd preview
python -m http.server 8000
```

Y abrí:

| Archivo | Contenido |
|---|---|
| `http://localhost:8000/index.html` | Portal público — home completa |
| `http://localhost:8000/nota.html` | Página de la noticia (con "Escuchar" funcionando de verdad) |
| `http://localhost:8000/admin.html` | Panel de administración navegable |

> También podés abrir los `.html` con doble clic. La demo usa Tailwind desde CDN, así que necesita conexión a internet.

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend / Backend | **Next.js 14** (App Router) + **TypeScript** estricto |
| Estilos | **Tailwind CSS 3** con paleta personalizada (`brand-*`, `news-*`, `accent-*`) |
| Base de datos | **PostgreSQL** con **Prisma ORM** (compatible con Supabase, Neon o Postgres local) |
| Scraping | **Cheerio** + `fetch` nativo, con **Puppeteer** opcional para sitios con JavaScript |
| Imágenes | **Sharp** (redimensión, marca de agua y conversión a **WebP**) |
| IA | Cliente propio compatible con la API de *Chat Completions* de OpenAI: sirve para **OpenAI, OpenRouter, Groq, Anthropic, Gemini** o cualquier endpoint propio |
| Autenticación | JWT firmado (`jose`) en cookie httpOnly + `bcryptjs` |
| Iconos | **lucide-react** |
| Validación | **Zod** |

---

## Requisitos

- **Node.js 18.18 o superior** ([nodejs.org](https://nodejs.org) o `winget install OpenJS.NodeJS.LTS`)
- **PostgreSQL 14+** — podés usar Docker (recomendado), Supabase o Neon
- **Docker Desktop** (solo si vas a usar el `docker-compose.yml` incluido)

---

## Puesta en marcha

```powershell
# 1. Dependencias
npm install

# 2. Configuración: copiar el archivo de ejemplo y editarlo
Copy-Item .env.example .env

# 3. Levantar PostgreSQL en local (saltea este paso si usás Supabase o Neon)
docker compose up -d

# 4. Crear las tablas
npm run db:push

# 5. Cargar el contenido de ejemplo (12 notas de Saladillo, categorías, farmacias, banners, etc.)
npm run db:seed

# 6. Arrancar
npm run dev
```

| URL | Qué es |
|---|---|
| http://localhost:3000 | Portal público |
| http://localhost:3000/admin | Panel de administración |

### Scripts disponibles

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga en caliente |
| `npm run build` | Build de producción (incluye `prisma generate`) |
| `npm start` | Servidor de producción |
| `npm run typecheck` | Verificación de tipos sin emitir |
| `npm run lint` | ESLint de Next.js |
| `npm run db:push` | Sincroniza el schema con la base sin crear migraciones |
| `npm run db:migrate` | Crea una migración versionada |
| `npm run db:seed` | Carga los datos de ejemplo |
| `npm run db:studio` | Abre Prisma Studio para ver y editar la base |

---

## Variables de entorno

Todas se configuran en el archivo `.env` (hay una plantilla comentada en [`.env.example`](./.env.example)).

| Variable | Obligatoria | Descripción |
|---|---|---|
| `DATABASE_URL` | Sí | Cadena de conexión a PostgreSQL |
| `SESSION_SECRET` | Sí | Firma del JWT del panel. Mínimo 24 caracteres |
| `ENCRYPTION_KEY` | Sí | Cifra la API Key de IA y los tokens de redes. 32 bytes en hex (64 caracteres) |
| `NEXT_PUBLIC_SITE_URL` | Sí | URL pública, para meta tags, sitemap y difusión |
| `AI_PROVIDER` | No | `openai`, `openrouter`, `groq`, `anthropic`, `gemini` o `custom`. También se configura desde el panel |
| `AI_MODEL` | No | Modelo por defecto (ej. `gpt-4o-mini`) |
| `AI_API_KEY` | No | Clave del proveedor. **Se puede cargar desde `/admin/ia`** y queda cifrada en la base |
| `AI_BASE_URL` | No | Solo si usás `custom` |
| `WEATHER_LAT` / `WEATHER_LON` | No | Coordenadas para el clima. Por defecto, las de Saladillo |
| `CRON_SECRET` | No | Protege `/api/cron` (Bearer token). Vacío = deshabilitado |
| `ENABLE_INTERNAL_SCHEDULER` | No | `true` activa el planificador de scraping interno |
| `TELEGRAM_BOT_TOKEN` | No | Para publicar automáticamente en el canal de Telegram |

Generar secretos:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> **El portal funciona sin API Key de IA.** Solo queda deshabilitada la reescritura automática, con un aviso claro en el panel.

---

## Cómo acceder al Panel de Administración

### Paso a paso

1. Con el servidor corriendo (`npm run dev`), entrá a:

   ```
   http://localhost:3000/admin
   ```

2. El [middleware](./src/middleware.ts) detecta que no hay sesión y te redirige automáticamente a:

   ```
   http://localhost:3000/admin/login
   ```

   También podés ir directo a esa URL.

3. Ingresá las credenciales que crea el seed:

   | Campo | Valor |
   |---|---|
   | **Email** | `admin@saladillonoticias.com.ar` |
   | **Contraseña** | `Saladillo2026!` |

   Las credenciales se imprimen también al final de `npm run db:seed`.

4. Al ingresar se guarda una cookie `sn_session` (httpOnly, SameSite=Lax, 8 horas de duración) y entrás al **Dashboard**.

5. **Cerrar sesión:** botón "Cerrar sesión" arriba a la derecha del panel. Borra la cookie y vuelve al login.

### Cambiar la contraseña

Editá el hash en `prisma/seed.ts` (la línea que llama a `bcrypt.hash('Saladillo2026!', 10)`) con la clave que quieras y volvé a correr `npm run db:seed`. También podés generarla suelta:

```powershell
node -e "console.log(require('bcryptjs').hashSync('TU_NUEVA_CLAVE', 10))"
```

y actualizar el campo `passwordHash` del usuario desde Prisma Studio (`npm run db:studio`).

### Secciones del panel

| Sección | URL | Qué se hace ahí |
|---|---|---|
| Dashboard | `/admin` | Métricas, accesos rápidos, últimas notas y pendientes de revisión |
| Noticias | `/admin/noticias` | CRUD completo, filtros por estado/categoría/prioridad y buscador |
| Editor de nota | `/admin/noticias/[id]` | Contenido, SEO, generación con IA, publicación y difusión |
| Categorías | `/admin/categorias` | Alta, edición y baja de categorías y etiquetas |
| Clasificados | `/admin/clasificados` | Moderación de avisos de la comunidad |
| Editar aviso | `/admin/clasificados/[id]` | Datos, estado, vigencia y galería de fotos del aviso |
| **Scraping** | `/admin/scraping` | Ejecución manual, métricas y estado de las fuentes |
| Fuentes | `/admin/scraping/fuentes` | Alta/edición de fuentes, selectores y mapeo de categorías |
| Bandeja de revisión | `/admin/scraping/cola` | Notas traídas por el scraper, pendientes de aprobación |
| Palabras clave | `/admin/scraping/keywords` | Filtro de prioridad local |
| **Configuración de IA** | `/admin/ia` | API Key, modelo, tono de redacción, marca de agua |
| **Banners / Monetización** | `/admin/banners` | Publicidad de comercios locales por zona |
| **Difusión en redes** | `/admin/difusion` | Canales, cola de publicaciones y reintentos |

### Está protegido de verdad

- El **middleware corre en Edge runtime** y valida la firma del JWT antes de dejar pasar cualquier request a `/admin/*` (salvo el login).
- Las **API routes del panel** usan `requireApiSession()` y devuelven `401` si no hay sesión válida.
- La API Key de IA se guarda **cifrada con AES-256-GCM** y nunca se devuelve al navegador: el panel solo recibe una versión enmascarada (`sk-p••••••••9f2a`).

---

## Estructura del proyecto

```
saladillo-noticias/
├── prisma/
│   ├── schema.prisma            # 20 modelos, 14 enums
│   └── seed.ts                  # Contenido de ejemplo de Saladillo
├── public/
│   └── uploads/                 # Imágenes procesadas (WebP) — se crea en runtime
├── preview/                     # Maqueta estática de demostración (sin Node)
├── src/
│   ├── app/
│   │   ├── layout.tsx           # Layout raíz, fuentes y metadata global
│   │   ├── globals.css          # Paleta y clases del sistema de diseño
│   │   ├── page.tsx             # HOME del portal
│   │   ├── categoria/[slug]/    # Listado por categoría
│   │   ├── nota/[slug]/         # Página de la noticia
│   │   ├── etiqueta/[slug]/     # Listado por etiqueta
│   │   ├── buscar/              # Buscador
│   │   ├── clasificados/        # Comunidad / avisos
│   │   ├── farmacias/           # Farmacias de turno (14 días)
│   │   ├── clima/               # Clima y pronóstico de 7 días
│   │   ├── sitemap.ts           # Sitemap dinámico
│   │   ├── robots.ts            # robots.txt
│   │   ├── admin/               # Backoffice (protegido por middleware)
│   │   └── api/                 # 25 Route Handlers
│   ├── components/
│   │   ├── public/              # Cabecera, clima, farmacias, tarjetas, banners, TTS
│   │   └── admin/               # Shell, editor, formularios de IA/scraping/banners
│   ├── lib/
│   │   ├── ai/                  # Proveedor de IA, prompts por tono, reescritura
│   │   ├── scraper/             # Fetcher, parser, keywords, pipeline, scheduler
│   │   ├── images/              # Sharp: resize, marca de agua, WebP
│   │   ├── social/              # Difusión en redes
│   │   ├── auth.ts              # Sesiones y contraseñas
│   │   ├── crypto.ts            # AES-256-GCM para credenciales
│   │   ├── settings.ts          # Configuración persistente
│   │   ├── seo.ts               # Metadatos y JSON-LD
│   │   ├── weather.ts           # Open-Meteo (sin API key)
│   │   └── utils.ts             # Helpers de texto, fechas y sanitizado
│   ├── instrumentation.ts       # Arranca el planificador de scraping
│   └── middleware.ts            # Protección de /admin
├── docker-compose.yml           # PostgreSQL para desarrollo
└── .env.example
```

---

## Módulos y funcionalidad

### 1. Portal público

- **Cabecera institucional** sticky en azul marino, con logotipo tipográfico, navegación, buscador y menú mobile.
- **Widget del clima de Saladillo** (Open-Meteo, sin API key) con temperatura, sensación térmica, humedad, viento y máxima/mínima. Si la API falla, muestra un fallback y **nunca rompe la home**.
- **Farmacias de turno del día**, con nombre, dirección y teléfono; hay una página con la programación de 14 días.
- **Franja de "ÚLTIMO MOMENTO"** con ticker animado.
- **Tiempo de lectura estimado** en cada nota ("3 min de lectura"), calculado a 200 palabras por minuto.
- **Lectura en voz alta**: el botón "Escuchar la nota" usa la Web Speech API con voz en español (`es-AR`).
- **Compartir** en Facebook, X, WhatsApp y Telegram, más "Copiar enlace".
- **Clasificados de la comunidad** con buscador, filtro por sección y paginación. Cada aviso tiene su propia página de detalle (`/clasificados/[id]`) con galería de hasta 3 fotos, botón de compartir, contacto directo por WhatsApp o teléfono y datos estructurados **JSON-LD `Product`**.
- **Carga pública de avisos** con hasta 3 fotos (JPG/PNG/WebP de 6 MB, convertidas a WebP automáticamente). Los avisos entran como `PENDING` para moderación y tienen **30 días de vigencia**: vencido el plazo dejan de mostrarse y pasan a `EXPIRED`.
- **SEO completo**: metadatos por nota, Open Graph, Twitter Card, canonical, `sitemap.xml` dinámico, `robots.txt` y datos estructurados **JSON-LD `NewsArticle`**.

### 2. Gestión de contenido

CRUD completo de noticias con editor por pestañas (Contenido / SEO y redes / Procesamiento IA / Avanzado), categorías, etiquetas y moderación de clasificados. Incluye slug automático, contadores de caracteres para meta título y meta descripción, gestión de etiquetas tipo chips y vista previa de la portada.

### 3. Configuración de IA

- Guarda la **API Key cifrada con AES-256-GCM**; el navegador solo ve la versión enmascarada.
- Selector de proveedor (OpenAI, OpenRouter, Groq, Anthropic, Gemini, personalizado) que autocompleta la URL base.
- Selector de modelo, temperatura y botón **"Probar conexión"** con latencia medida.
- **Selector de tono de redacción** con cuatro opciones:

  | Tono | Para qué sirve |
  |---|---|
  | **Informativo y Neutral** | Estilo periodístico clásico: hechos, fuentes y cierre |
  | **Cercano y Local** | Adaptado a la comunidad de Saladillo, lenguaje cotidiano |
  | **Llamativo y Clickbait** | Alto impacto para redes, sin perder veracidad |
  | **Formal y Serio** | Registro protocolar para política, economía y actos oficiales |

- Checkboxes de "citar siempre la fuente original" y "reescribir automáticamente las notas del scraper".
- **Marca de agua**: activación, texto, opacidad, posición, logo opcional, ancho máximo y calidad de WebP, con previsualización.

### 4. Monetización / Banner Manager

Seis zonas publicitarias (`HEADER`, `HOME_TOP`, `INLINE_ARTICLE`, `SIDEBAR`, `FOOTER`, `MOBILE_STICKY`) y cuatro tipos de banner: **imagen propia** de un comercio local, **Google AdSense** (por `adSlot`), **HTML/JS libre** y **rotativos** que se alternan por peso. Incluye vigencia por fechas, métricas de impresiones y clics, y CTR calculado.

### 5. Difusión automática en redes

Al publicar una nota se puede difundir a **Facebook, Instagram, Telegram, X y WhatsApp**. Con `webhookUrl` configurada se envía un `POST` firmado con **HMAC-SHA256** (header `X-Saladillo-Signature`) a Make, Zapier o n8n. Con Telegram funciona nativo contra la API de bots. Cada envío queda registrado en una **cola de publicaciones** con su estado y botón de reintento.

---

## Flujo completo del scraper + IA

```
Fuente externa
      ↓  (crawlSelector / descubrimiento heurístico de links)
   Nota detectada
      ↓  (rotación de User-Agents + delay con jitter + robots.txt)
   Extracción: título, cuerpo, imágenes, fecha
      ↓  (filtro de palabras clave locales)
   Prioridad NORMAL / ALTA / URGENTE
      ↓
   Article en estado PENDING_REVIEW   ← NUNCA se publica solo
      ↓
   Bandeja de revisión: original vs. reescrito, lado a lado
      ↓  (adaptación de imágenes a WebP + marca de agua)
      ↓  (reescritura por IA según el tono elegido)
      ↓  (metadatos SEO + resumen para redes)
   Revisión humana y aprobación
      ↓
   PUBLICADA → difusión automática a las redes configuradas
```

### Anti-bloqueo

Más de 12 User-Agents reales rotativos, cabeceras coherentes (`Sec-Fetch-*`, `Accept-Language`, `Referer`), delay configurable entre pedidos con variación aleatoria de ±40% y respeto de `robots.txt` con caché por host.

### Filtro de palabras clave locales

Si la noticia contiene **Saladillo, Del Carril, Cazón, Polvaredas, Juan José Paso, Álvarez de Toledo, La Barrancosa** o términos institucionales (Intendencia, Concejo Deliberante, Hospital Posadas, Bomberos Voluntarios, Sociedad Rural...), el sistema marca el ítem como **Prioridad Alta** o **Urgente** según un puntaje ponderado. La lista se administra desde `/admin/scraping/keywords`.

### Programación

- **Planificador interno**: se activa con `ENABLE_INTERNAL_SCHEDULER=true`. Revisa cada 60 segundos qué fuentes están vencidas según su expresión cron (5 campos).
- **Cron externo**: `GET /api/cron` con `Authorization: Bearer $CRON_SECRET`. Sirve para Vercel Cron, cron-job.org o GitHub Actions.

---

## Referencia de la API

Todas las rutas del panel requieren sesión válida y responden `401` si no la hay.

### Públicas

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/clima` | Clima actual de Saladillo (cacheado 15 min) |
| `GET` | `/api/farmacias` | Farmacia de turno del día + próximos 14 días (`?date=`) |
| `POST` | `/api/clasificados` | Carga pública de un aviso en `multipart/form-data` (campos del formulario + `photos`, hasta 3). Queda en `PENDING` |
| `GET` | `/api/banners` | Banners activos agrupados por zona (`?zone=`) |

### Autenticación

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/auth/login` | `{ email, password }` → setea la cookie de sesión |
| `POST` | `/api/auth/logout` | Borra la sesión |

### Contenido

| Método | Ruta | Descripción |
|---|---|---|
| `GET` `POST` | `/api/noticias` | Listado paginado con filtros · Alta de nota |
| `GET` `PATCH` `DELETE` | `/api/noticias/[id]` | Obtener · Actualizar · Eliminar |
| `POST` | `/api/noticias/[id]/publicar` | Publicar / despublicar y difundir |
| `GET` `POST` | `/api/categorias` | Listado · Alta |
| `PATCH` `DELETE` | `/api/categorias/[id]` | Editar · Eliminar (`409` si tiene notas) |
| `GET` `POST` | `/api/etiquetas` | Listado con conteo · Alta |
| `PATCH` `DELETE` | `/api/clasificados/[id]` | Moderar · Eliminar |

### IA

| Método | Ruta | Descripción |
|---|---|---|
| `GET` `PATCH` | `/api/ia/config` | Leer · Guardar configuración (`apiKey` cifrada) |
| `POST` | `/api/ia/probar` | Probar la conexión con el proveedor |
| `POST` | `/api/ia/reescribir` | `{ articleId, tonality, citeSource, save }` → reescritura + metadatos |

### Scraping

| Método | Ruta | Descripción |
|---|---|---|
| `GET` `POST` | `/api/scraping/fuentes` | Listado · Alta de fuente |
| `GET` `PATCH` `DELETE` | `/api/scraping/fuentes/[id]` | Detalle · Editar · Eliminar |
| `GET` `POST` `DELETE` | `/api/scraping/fuentes/[id]/mapeos` | Mapeo categoría externa → local |
| `POST` | `/api/scraping/ejecutar` | `{ sourceId }` o `{ all: true }` |
| `GET` `PATCH` | `/api/scraping/cola` | Cola de ítems extraídos |
| `GET` `PATCH` `DELETE` | `/api/scraping/cola/[id]` | Detalle · Reprocesar/descartar · Eliminar |
| `POST` | `/api/scraping/preview` | Probar una URL o un selector sin guardar nada |
| `GET` `POST` `PATCH` `DELETE` | `/api/keywords` | Palabras clave locales |
| `GET` `POST` | `/api/cron` | Ejecución programada (Bearer `CRON_SECRET`). Corre el scraping vencido y expira los clasificados fuera de vigencia |

### Banners y difusión

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/banners` | Alta de banner |
| `PATCH` `DELETE` | `/api/banners/[id]` | Editar · Eliminar |
| `POST` | `/api/banners/[id]/track` | Registrar impresión o clic |
| `GET` `POST` | `/api/difusion/canales` | Canales de redes |
| `PATCH` `DELETE` | `/api/difusion/canales/[id]` | Editar · Eliminar |
| `POST` | `/api/difusion/publicar` | `{ articleId, channelIds? }` |
| `POST` | `/api/difusion/reintentar` | Reintentar un envío fallido |

---

## Modelo de datos

Definido en [`prisma/schema.prisma`](./prisma/schema.prisma).

| Modelo | Para qué |
|---|---|
| `User` | Usuarios del panel (ADMIN / EDITOR) |
| `Category` · `Tag` | Taxonomía editorial |
| `Article` | Notas, con estado, prioridad, SEO, métricas y trazabilidad del scraper |
| `ArticleImage` | Imágenes procesadas de cada nota |
| `Classified` | Avisos de la comunidad, con sección, vigencia (`expiresAt`) y estado de moderación |
| `ClassifiedImage` | Galería de hasta 3 fotos por aviso (WebP), con orden de aparición |
| `Pharmacy` · `PharmacyShift` | Farmacias y turnos |
| `Banner` | Publicidad por zona, con métricas |
| `Source` · `SourceCategoryMapping` | Fuentes de scraping y mapeo de categorías |
| `ScrapeJob` · `ScrapedItem` | Ejecuciones y material extraído |
| `Keyword` | Filtro de prioridad local |
| `SocialChannel` · `SocialPost` | Redes y cola de publicaciones |
| `Setting` | Configuración persistente (los secretos van cifrados) |

Enums: `Role`, `ArticleStatus`, `ArticlePriority`, `AiTonality`, `BannerType`, `BannerZone`, `SourceStatus`, `JobStatus`, `ScrapedItemStatus`, `SocialNetwork`, `SocialPostStatus`, `ClassifiedStatus`, `KeywordType`.

### Estados de una nota

`DRAFT` → `PENDING_REVIEW` → `PUBLISHED` → `ARCHIVED`

Toda nota que entra por el scraper nace en **`PENDING_REVIEW`** y requiere aprobación humana.

### Estados de un clasificado

`PENDING` → `PUBLISHED` → `EXPIRED` (o `REJECTED` si no cumple las normas).

Al aprobar un aviso se le asignan **30 días de vigencia**. Las consultas públicas filtran por estado **y** por fecha, por lo que un aviso vencido desaparece del sitio aunque su estado todavía diga `PUBLISHED`; el cron (`/api/cron`) se encarga además de pasarlo a `EXPIRED`.

---

## Seguridad

- Sesiones con **JWT firmado** en cookie **httpOnly**, `SameSite=Lax` y `Secure` en producción.
- Contraseñas con **bcrypt** (10 rondas).
- **Cifrado AES-256-GCM** con IV aleatorio por registro para la API Key de IA y los tokens de redes.
- Secretos **nunca** se envían al navegador: solo versiones enmascaradas.
- **Sanitizado de HTML** con lista blanca de etiquetas en todo el contenido que viene de fuentes externas o de la IA.
- Cabeceras `X-Content-Type-Options`, `X-Frame-Options` y `Referrer-Policy`.
- Enlaces externos con `rel="noopener nofollow"`.

---

## Despliegue

### Vercel + Supabase (o Neon)

1. Subí el repositorio a GitHub e importalo en Vercel.
2. Configurá las variables de entorno del panel de Vercel.
3. Aplicá el schema contra la base remota: `npx prisma migrate deploy` (o `db push` la primera vez).
4. Cargá los datos iniciales: `npm run db:seed`, apuntando `DATABASE_URL` a la base remota.
5. **Importante:** en Vercel **no** actives `ENABLE_INTERNAL_SCHEDULER` (las funciones serverless no mantienen procesos vivos). Usá el **Vercel Cron** apuntando a `/api/cron`:

   ```json
   {
     "crons": [{ "path": "/api/cron", "schedule": "0 */2 * * *" }]
   }
   ```

6. Para el almacenamiento de imágenes en producción, reemplazá el guardado en `public/uploads` por Supabase Storage o S3 (Vercel tiene el sistema de archivos de solo lectura).

### Docker

El `docker-compose.yml` incluido solo levanta PostgreSQL para desarrollo. Para dockerizar la app entera hay que agregar un `Dockerfile` con el build de Next.js.

---

## Ética del scraping

El módulo respeta `robots.txt` cuando la opción está activa, aplica delays entre pedidos para no sobrecargar los servidores de origen y registra la fuente original de cada nota. Toda nota extraída queda en borrador: **nada se publica sin intervención humana**. Cuando la opción "citar la fuente original" está activa, la IA cierra el cuerpo con el enlace al medio original.

Antes de usar el scraper en producción, revisá los términos de uso de cada sitio de origen.

---

## Licencia

Proyecto de ejemplo. El contenido de las notas del seed es ficticio y se usa solo como demostración.
