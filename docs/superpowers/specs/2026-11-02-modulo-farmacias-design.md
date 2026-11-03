# Módulo de Farmacias: altas reales, organigrama mensual e importación desde el Colegio

Fecha: 2026-11-02

## Objetivo

Reemplazar el módulo de farmacias actual —que sólo lee de la base sin ninguna vía de carga
desde el panel— por un módulo completo: alta y edición de farmacias, armado y corrección del
organigrama mensual de turnos, importación desde la página del Colegio de Farmacéuticos de
Saladillo y una página pública útil (mapa, cómo llegar, turno vigente).

## Estado actual

- `Pharmacy` sólo tiene `name`, `address`, `phone`, `isActive`, `createdAt`. No hay panel: los
  datos salen de `prisma/seed.ts`.
- `PharmacyShift` tiene `@@unique([pharmacyId, date])`, que permite **dos turnos el mismo día**;
  la aplicación lo esquiva con `findFirst`.
- Público: `src/app/farmacias/page.tsx` (tabla de próximos 14 días + listado), el widget de la
  home `src/components/public/PharmacyWidget.tsx` (que consulta Prisma directo) y el JSON en
  `src/app/api/farmacias/route.ts`, un endpoint público documentado en el README. No hay mapa ni
  forma de llegar.
- La lógica de "hoy en Saladillo" está duplicada en los tres archivos, como `hoyEnSaladillo()`.

## La fuente externa

`https://acasaladillo.com.ar/?page_id=3080` (URL configurable, porque puede cambiar).

Contenido, en este orden:

1. Aclaración de horario: *"Los turnos son desde 8:00 hs. AM hasta las 8:00 hs AM. del día
   siguiente."*
2. **Directorio**: 9 farmacias con nombre, dirección y teléfono.
3. **Organigrama del mes**: lista numerada `1..31` con `APELLIDO – DIRECCIÓN`.

Observaciones que condicionan el diseño:

- La rotación es un **ciclo de 10 días**, no el orden del directorio:
  `ORIANDA → MARCOS → LIBERTAD → FUILLERAT → JUAN MARTIN → ABELENDA → CARTELLE → MANZANO →
  ORIANDA → ABELENDA II`. ORIANDA aparece dos veces por ciclo.
- Hay **correcciones manuales** sobre el ciclo (en octubre 2026 el día 26 el ciclo se saltea
  ABELENDA). Es decir: generar + corregir, no sólo generar.
- Las dos listas **se contradicen**: `ABELENDA II` sólo existe en el organigrama, `DEMARIA` sólo
  en el directorio, y MANZANO figura con dos direcciones distintas (`Rivadavia 2003` y `2103`).
- El organigrama usa **apellidos** (`ORIANDA`) y el directorio **nombres completos**
  (`ABELENDA CABRAL`).

Conclusión: la importación **nunca escribe a ciegas**. Siempre hay un paso de revisión.

## Alcance

**Dentro del alcance**

- CRUD completo de farmacias desde el panel, con slug, alias, coordenadas opcionales y contacto.
- Un turno por día, con origen identificado (`MANUAL`, `ROTACION`, `IMPORT`).
- Generación del organigrama de un mes a partir del ciclo de rotación, con edición día por día.
- Importación de la página del Colegio con preview, diferencia contra lo cargado y confirmación.
- Página pública nueva: turno vigente, mapa embebido, cómo llegar, teléfono, WhatsApp y ficha por
  farmacia con datos estructurados.
- Consulta pública de turnos de cualquier fecha (historial), no sólo los próximos 14 días.
- Exportación del organigrama del mes como imagen para redes.

**Fuera del alcance**

- Dos turnos por día (diurno/nocturno). Ya se decidió uno por día.
- Geocodificación automática de direcciones (requiere API key paga). Las coordenadas se cargan a
  mano y son opcionales.
- Importación automática por cron: la importación la dispara una persona desde el panel.
- Notificaciones push o por WhatsApp a las farmacias.
- Administración de la guardia del hospital o de otros servicios de urgencia.

## Decisiones

1. **Un turno por día.** `PharmacyShift` pasa a `@@unique([date])`. Se elimina
   `@@unique([pharmacyId, date])`, que queda contenido en el anterior bajo este modelo.
2. **La rotación es un ciclo configurable, no un orden fijo.** Se guarda una lista ordenada de
   farmacias (con repeticiones) y una fecha de referencia. El turno de una fecha es
   `orden[(días desde la referencia) mod len(orden)]`. Esto reproduce el ciclo de 10 días real y
   permite que ORIANDA aparezca dos veces.
3. **Generar no pisa lo corregido a mano.** Al generar un mes, los días con `source = MANUAL` se
   conservan salvo que el usuario pida explícitamente reemplazarlos.
4. **El origen del turno se guarda.** `source` distingue lo generado, lo importado y lo corregido;
   es lo que permite el punto 3 y da trazabilidad en el panel.
5. **La importación es en dos pasos.** `preview` (no escribe nada, devuelve el diff) y `confirmar`
   (aplica). El mapeo de nombres es una decisión del usuario, no una heurística silenciosa.
6. **Los alias viven en la farmacia.** `Pharmacy.alias String[]` permite que `ORIANDA`,
   `ABELENDA` y `ABELENDA II` resuelvan a la farmacia correcta sin renombrar nada.
7. **El mapa no usa API key.** Se embebe con
   `https://www.google.com/maps?q=<consulta>&output=embed`, donde la consulta es `lat,lng` si están
   cargadas o la dirección completa si no. El botón "Cómo llegar" abre
   `https://www.google.com/maps/dir/?api=1&destination=<misma consulta>`.
8. **La configuración va en `Setting`, no en tablas nuevas.** Son cinco valores escalares o listas
   cortas; no justifican un modelo propio. Sigue el patrón de `scraper.defaults`.
9. **El horario es configurable.** La fuente dice 8:00; se guarda en configuración para poder
   corregirlo sin tocar código.
10. **La imagen se genera con Puppeteer, no con SVG.** Ya hay Puppeteer en el proyecto y
    `sharp`+librsvg depende de las fuentes instaladas, que en Vercel no están garantizadas.

## Modelo de datos

```prisma
model Pharmacy {
  id        String   @id @default(cuid())
  slug      String   @unique
  name      String
  alias     String[] @default([])     // "ORIANDA", "ABELENDA II", ...
  address   String
  zone      String?                   // localidad o zona
  phone     String?
  whatsapp  String?
  email     String?
  latitude  Float?
  longitude Float?
  notes     String?                   // horarios, observaciones
  position  Int      @default(0)      // orden del listado público
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  shifts PharmacyShift[]

  @@index([isActive, position])
  @@map("pharmacies")
}

enum PharmacyShiftSource {
  MANUAL
  ROTACION
  IMPORT
}

model PharmacyShift {
  id         String              @id @default(cuid())
  pharmacyId String
  date       DateTime            @db.Date
  note       String?
  source     PharmacyShiftSource @default(MANUAL)
  createdAt  DateTime            @default(now())
  updatedAt  DateTime            @updatedAt

  pharmacy Pharmacy @relation(fields: [pharmacyId], references: [id], onDelete: Cascade)

  @@unique([date])
  @@index([date])
  @@map("pharmacy_shifts")
}
```

**Chequeo previo obligatorio**: `@@unique([date])` falla en `db push` si ya hay dos filas con la
misma fecha. Antes de aplicarlo hay que contar duplicados y resolverlos (quedarse con la de menor
`createdAt`) con un script de un solo uso.

## Configuración (tabla `Setting`, grupo `pharmacy`)

| Clave | Tipo | Default |
|---|---|---|
| `pharmacy.importUrl` | `string` | `https://acasaladillo.com.ar/?page_id=3080` |
| `pharmacy.rotationOrder` | `string[]` (ids de farmacia) | vacío (se arma desde el panel) |
| `pharmacy.rotationAnchorDate` | `string` `YYYY-MM-DD` | fecha del primer elemento del ciclo |
| `pharmacy.shiftStart` | `string` `HH:mm` | `08:00` |
| `pharmacy.shiftEnd` | `string` `HH:mm` | `08:00` |

Se leen y escriben con `getSetting` / `setSetting`, con un helper `getPharmacySettings()` en
`src/lib/settings.ts` que espeja `getAiSettings()` y `getStorageSettings()`.

## Arquitectura

Toda la lógica de cálculo vive en módulos puros y testeables; las rutas y los componentes sólo
orquestan.

```
src/lib/pharmacy/
  ├─ rotation.ts        ← generarMes(), turnoDeFecha(), normalizarOrden()     (puro)
  ├─ schedule.ts        ← hoyEnSaladillo(), semanasDelMes(), turnoVigente()   (puro)
  ├─ import.ts          ← parsearPaginaColegio(html)                          (puro, recibe HTML)
  └─ schedule-image.ts  ← renderOrganigramaHtml()                             (puro, etapa 5)

src/lib/scraper/
  └─ screenshot.ts      ← renderScreenshot(html, { width, height })           (etapa 5)

src/app/admin/farmacias/
  ├─ page.tsx                  (etapa 1)
  ├─ organigrama/page.tsx      (etapa 2)
  └─ importar/page.tsx         (etapa 3)

src/app/api/admin/farmacias/
  ├─ route.ts + [id]/route.ts
  ├─ organigrama/route.ts
  ├─ importar/route.ts + importar/confirmar/route.ts
  └─ organigrama/imagen/route.ts

src/components/admin/
  ├─ PharmacyManager.tsx
  ├─ PharmacyScheduleCalendar.tsx
  ├─ RotationOrderEditor.tsx
  ├─ PharmacyImportPreview.tsx
  └─ OrganigramaPrint.tsx      (etapa 5, estilos inline)

src/components/public/
  ├─ PharmacyMap.tsx
  └─ PharmacyDirections.tsx
```

Se **extrae a `src/lib/pharmacy/schedule.ts`** el `hoyEnSaladillo()` duplicado en
`src/app/farmacias/page.tsx`, `src/app/api/farmacias/route.ts` y
`src/components/public/PharmacyWidget.tsx`, y se agrega allí `turnoVigente()` para el badge.

## Etapa 1 — CRUD de farmacias

**Queda funcionando**: dar de alta, editar, activar/desactivar y ordenar farmacias desde el panel.

- `prisma/schema.prisma`: campos nuevos de `Pharmacy` y el enum. Sin cambios en `PharmacyShift`
  todavía (esa migración es de la etapa 2), para que esta etapa no dependa del deduplicado.
- `uniqueSlug(base, excludeId?)` declarada dentro de cada ruta que la usa, igual que
  `uniqueCategorySlug` en `src/app/api/categorias/route.ts` y `[id]/route.ts` (hoy está duplicada
  en los dos archivos; se sigue ese mismo criterio, sin módulo nuevo).
- `GET/POST /api/admin/farmacias` y `PATCH/DELETE /api/admin/farmacias/[id]`, con
  `requireApiSession()` y validación zod. Se crean bajo `/api/admin/` para **no tocar** el
  `GET /api/farmacias` público, que ya está documentado en el README y consumen terceros.
- `DELETE` es baja lógica (`isActive = false`) si la farmacia tiene turnos; borrado real sólo si
  no tiene ninguno.
- `src/app/admin/farmacias/page.tsx` server component + `PharmacyManager.tsx` cliente, espejando
  `BannerManager.tsx`. Campos: nombre, slug (editable, autogenerado), alias (chips), dirección,
  zona, teléfono, WhatsApp, email, latitud, longitud, notas, orden, activa.
- `src/components/admin/AdminShell.tsx`: ítem **Farmacias** y su título de sección.
- Validación: teléfono y WhatsApp con formato argentino tolerante (`+54 2344 45-0000`,
  `02344-452240`); lat/lng dentro de rango; alias normalizados a mayúsculas.
- Tests: slug único y derivado; rechazo de lat/lng fuera de rango; que `DELETE` con turnos haga
  baja lógica.

## Etapa 2 — Organigrama mensual

**Queda funcionando**: generar un mes entero, revisarlo en un calendario y corregir días.

- **Migración**: `PharmacyShift` con `source`, `updatedAt` y `@@unique([date])`, con el chequeo de
  duplicados previo.
- `src/lib/pharmacy/rotation.ts`:
  - `turnoDeFecha(date, { orden, ancla }): number` → índice del ciclo.
  - `generarMes(anio, mes, { orden, ancla })` → `{ fecha, pharmacyId }[]` para cada día del mes.
  - `normalizarOrden(ids)` → elimina ids inactivos o inexistentes, conservando repeticiones.
- `src/app/api/admin/farmacias/organigrama/route.ts`:
  - `GET ?mes=YYYY-MM` → turnos del mes + farmacias + orden + ancla.
  - `POST { mes, modo }` → genera. `modo = 'respetar-manual'` (default) o `'reemplazar-todo'`.
  - `PATCH { cambios: [{ date, pharmacyId | null }] }` → alta/edición/borrado de días individuales,
    marcando `source = MANUAL`.
  - `DELETE ?mes=YYYY-MM` → limpia el mes completo.
- `src/components/admin/PharmacyScheduleCalendar.tsx`: grilla del mes, cada día muestra la
  farmacia asignada o "sin asignar". Selección múltiple para pintar un rango con la misma farmacia.
  Distingue visualmente `MANUAL` de `ROTACION` e `IMPORT`.
- `src/components/admin/RotationOrderEditor.tsx`: panel plegable para editar el ciclo (agregar,
  quitar, reordenar, permitir repeticiones) y fijar la fecha de referencia. Muestra una vista
  previa de los próximos 20 días para verificar que el ciclo quedó bien.
- `src/app/admin/farmacias/organigrama/page.tsx`: mes actual con navegación anterior/siguiente,
  botón **Generar mes**, **Copiar mes anterior** y **Limpiar mes**.
- Tests (funciones puras, sin base): ciclo de 10 días reproducido sobre octubre 2026 con la lista
  real; arranque de mes que no cae en el índice 0; `normalizarOrden` con farmacias borradas;
  `modo: 'respetar-manual'` no pisa un día `MANUAL`.

## Etapa 3 — Importar desde el Colegio

**Queda funcionando**: traer el mes del sitio del Colegio, ver qué cambia y confirmarlo.

- `src/lib/pharmacy/import.ts`:
  - `parsearPaginaColegio(html)` → `{ mes, anio, turnos: { dia, nombre, direccion }[], directorio:
    { nombre, direccion, telefono }[] }`.
  - Reglas: el título del mes con `/Farmacias de Turno Mes\s+(\p{L}+)\s+(\d{4})/u`; el organigrama
    con líneas `/^\s*(\d{1,2})\.\s*(.+?)\s*[–-]\s*(.+)$/`; el directorio con
    `/Dirección:\s*(.+?)\s*[–-]\s*Tel\.?\s*([\d\s\-()]+)/`.
  - Si no reconoce el mes o no encuentra al menos 20 días, falla con un mensaje claro en vez de
    devolver datos parciales.
- Descarga: `fetchHtml()` de `src/lib/scraper/fetcher.ts` (nativo con fallback a Puppeteer), con
  la URL de `pharmacy.importUrl`.
- `POST /api/admin/farmacias/importar` → descarga, parsea y devuelve **sin escribir**:
  - el mes detectado y los turnos encontrados;
  - el diff contra lo que ya hay: días iguales, días que cambian, días nuevos, días que la
    importación dejaría vacíos;
  - los nombres sin mapear, con una sugerencia (`ABELENDA` → `ABELENDA CABRAL` por prefijo), y las
    farmacias del directorio que no existen.
- `POST /api/admin/farmacias/importar/confirmar` → aplica con `source = IMPORT`. Los días que el
  usuario destildó no se tocan. Las farmacias del organigrama que no matchean se crean inactivas,
  con el apellido como alias, para completarlas desde la etapa 1.
- `src/components/admin/PharmacyImportPreview.tsx`: tabla del diff con casilleros por día, el paso
  de mapeo de nombres y el botón **Confirmar importación**.
- `src/app/admin/farmacias/importar/page.tsx` con el campo de URL editable y las últimas 3
  respuestas de error, para diagnosticar cuando el sitio cambie de estructura.
- Tests: parseo de un HTML real de octubre 2026 (fixture guardado en el repo); mes con 31 días;
  HTML que no matchea → error explícito; sugerencia de mapeo por prefijo.

## Etapa 4 — Página pública

**Queda funcionando**: `/farmacias` con turno vigente y mapa, ficha por farmacia y consulta de
cualquier fecha.

- `src/lib/pharmacy/schedule.ts`: `turnoVigente(ahora)` calcula con `shiftStart`/`shiftEnd` y la
  zona horaria cuál es el turno activo y a qué hora cambia. Como el turno es 8:00 → 8:00, entre
  las 00:00 y las 08:00 el turno vigente es el del **día anterior**.
- `/farmacias` renovada:
  - Tarjeta destacada del turno vigente con **"de turno ahora"** y la hora de relevo.
  - Tabla de los próximos 14 días (se conserva) con botón de cómo llegar por fila.
  - Listado de farmacias con mapa embebido y botón **Cómo llegar**.
- `src/components/public/PharmacyMap.tsx`: iframe `?output=embed` con `loading="lazy"`,
  `referrerPolicy="no-referrer-when-downgrade"` y título accesible. Se muestra sólo después del
  consentimiento de cookies, reutilizando el estado que ya maneja
  `src/components/public/CookieConsentBanner.tsx` (persistido vía `/api/cookie-consent`). Si el
  usuario no aceptó, se muestra un botón "Ver mapa" que lo carga a demanda.
- `src/components/public/PharmacyDirections.tsx`: botón que abre
  `https://www.google.com/maps/dir/?api=1&destination=<lat,lng | dirección>` más enlaces `tel:` y
  `https://wa.me/`.
- `/farmacias/[slug]/page.tsx`: ficha con dirección, teléfono, WhatsApp, notas, mapa, botón de
  indicaciones y sus próximos turnos. Incluye JSON-LD `Pharmacy` con `address`, `geo`, `openingHours`
  y `telephone` cuando están disponibles.
- Historial: `GET /api/farmacias?desde=YYYY-MM-DD&hasta=YYYY-MM-DD` (rango máximo de 366 días) y
  `?date=YYYY-MM-DD`, que ya existe y se mantiene. En la página, un selector de fecha y un enlace
  "ver turnos de otra fecha".
- `src/app/sitemap.ts`: agregar las URLs de `/farmacias/[slug]`.
- `next.config.mjs`: no hace falta tocar nada; los iframes no pasan por el optimizador.
- Tests: `turnoVigente` a las 7:59, 8:00 y 23:00 sobre un turno de fecha conocida; rango del
  endpoint público acotado.

## Etapa 5 — Exportar el organigrama como imagen

**Queda funcionando**: un PNG del mes listo para redes y WhatsApp.

La vista a capturar **no se navega con un browser**: se renderiza del lado del servidor y se le
pasa el HTML ya armado a Puppeteer con `page.setContent()`. Así se evitan dos problemas de una vez:
no hay que pasarle la cookie de sesión del panel a Chromium, y no hay ninguna URL interna que
proteger.

- `src/components/admin/OrganigramaPrint.tsx`: componente React puro que recibe el mes, las
  farmacias, los turnos y el formato, y devuelve el gráfico. Usa **estilos inline** (no clases de
  Tailwind), porque `setContent()` no tiene el CSS compilado de Next. Es el único componente del
  panel pensado para capturarse, no para navegarse.
- `src/lib/pharmacy/schedule-image.ts`: `renderOrganigramaHtml(datos, formato)` usa
  `renderToStaticMarkup` de `react-dom/server` y devuelve `{ html, width, height }`. Formatos:
  1080×1350 (historia) y 1080×1080 (post). Es una función pura y testeable.
- `src/lib/scraper/screenshot.ts`: `renderScreenshot(html, { width, height })`. Reutiliza el mismo
  `launch()` con `puppeteer-extra` + stealth que hoy está en `renderWithPuppeteer()` dentro de
  `src/lib/scraper/fetcher.ts`, pero con viewport propio y `setContent()` en lugar de `goto()`. Hoy
  `fetcher.ts` abre y cierra un Chromium por llamada; este helper sigue el mismo criterio. Hace
  falta declarar una interfaz mínima propia, porque `HeadlessPage` en `fetcher.ts` no expone
  `setContent`.
- `POST /api/admin/farmacias/organigrama/imagen` → `{ mes, formato }`, devuelve `{ ok, url }`.
  Sube el PNG con la capa de almacenamiento existente (`src/lib/storage`), respetando el proveedor
  por defecto. Si no hay proveedor configurado, devuelve el PNG en base64 para descarga directa, sin
  fallar.
- `maxDuration = 60` en la ruta.
- Tests: `renderOrganigramaHtml` genera los 31 días del mes pedido, el título correcto y las
  dimensiones de cada formato; el endpoint rechaza un `mes` sin turnos cargados con un mensaje
  claro en lugar de generar una imagen vacía.

## Orden de implementación

Cada etapa se entrega y se commitea por separado; el portal queda usable después de cada una.

1. **Etapa 1** — sin ella no hay nada que rotar ni importar.
2. **Etapa 2** — depende de las farmacias; el ciclo se arma a mano al principio.
3. **Etapa 3** — depende de 1 y 2 (necesita el calendario para mostrar el diff).
4. **Etapa 4** — depende de 2 (necesita turnos reales); puede ir en paralelo con 3.
5. **Etapa 5** — depende de 2 y de la capa de almacenamiento, ya implementada.

## Riesgos y notas

- **Unicidad de fecha**: verificar duplicados antes del `db push` de la etapa 2.
- **La fuente puede cambiar de estructura o de URL**: por eso la URL es configurable y el import
  falla con un mensaje explícito en vez de escribir datos dudosos. Vale guardar el HTML de la
  primera importación como fixture de test y como referencia.
- **Datos contradictorios en la fuente**: `ABELENDA II` sin dirección en el directorio, MANZANO con
  dos direcciones. La importación crea esas farmacias inactivas y con nota, nunca activas por
  defecto.
- **Puppeteer en la etapa 5**: `renderScreenshot` abre y cierra su propio Chromium, igual que hoy
  hace `renderWithPuppeteer()` en `fetcher.ts` (un navegador por llamada). No se toca el scraper de
  noticias. Como lanzar Chromium es lento y depende de que el binario exista en el entorno de
  deploy (ya es requisito del scraper), la ruta lleva `maxDuration = 60` y, si falla, devuelve un
  error claro en vez de una imagen rota.
- **Cookies del mapa embebido**: el iframe de Google carga cookies de terceros; queda detrás del
  consentimiento existente.
- **Zona horaria**: todo el cálculo de fechas sigue usando `America/Argentina/Buenos_Aires` y
  medianoche UTC, igual que hoy, para no introducir corrimientos de un día.
