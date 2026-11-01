# Saladillo Noticias — Maqueta estática de demostración

Esta carpeta contiene una **maqueta estática (HTML + CSS + JavaScript, sin build ni Node.js)**
del portal de noticias de Saladillo, Buenos Aires. Sirve para **ver el diseño terminado** del
portal público y del panel de administración sin necesidad de instalar nada.

> ⚠️ **Es una demo de diseño.** Los datos son de ejemplo y las acciones (scraping, IA,
> publicación en redes, guardado) están **simuladas en el navegador**. La aplicación real,
> con base de datos, motor de IA y scraping, es el proyecto **Next.js que está en la raíz del
> repositorio** (`prisma/`, `src/`, `tailwind.config.ts`, etc.).

## Cómo abrirla

Opción A — la más simple: **doble clic en `index.html`** y se abre en el navegador.

Opción B — servirla con Python (recomendado, evita restricciones del navegador):

```bash
cd preview
python -m http.server 8000
```

y luego entrar a `http://localhost:8000`.

> Para que la función **“Escuchar”** (lectura por voz) ande bien en todos los navegadores,
> conviene usar la Opción B. El botón **“Copiar enlace”** también funciona mejor servido.

## Qué muestra cada archivo

| Archivo | Qué es |
|---|---|
| `index.html` | **Portal público — Home.** Barra superior con fecha, cabecera institucional con logo, buscador y navegación, widgets de clima y farmacias de turno, franja de “ÚLTIMO MOMENTO” con ticker animado, nota principal + secundarias, banner publicitario, “Últimas noticias”, sidebar (lo más leído, farmacias, banner, etiquetas), franjas por categoría (Policiales, Política, Deportes, Interés General), bloque de Clasificados y pie de página. |
| `nota.html` | **Página de la noticia.** La cobertura del operativo vial en la Ruta 205: breadcrumb, chip de categoría, titular, copete, metadatos, barra de herramientas de lectura (**🔊 Escuchar** por voz, compartir en Facebook / X / WhatsApp / Telegram y **Copiar enlace**), imagen con epígrafe, cuerpo con letra capital, subtítulos, cita destacada, banner intercalado, recuadro de atribución a la fuente, “Más de Policiales” y nube de etiquetas. |
| `admin.html` | **Panel de administración (maqueta navegable).** Sidebar azul marino y secciones que se muestran/ocultan con JavaScript: Dashboard, Noticias, Nueva noticia, Categorías, Clasificados, **Scraping** (con botón que simula la ejecución y muestra el log), **Configuración de IA** (proveedor, API key protegida, modelo, temperatura, selector de tono, marca de agua y muestra del flujo de reescritura con metadatos SEO), **Banners / Monetización** y **Difusión en redes**. |
| `styles.css` | Hoja de estilos compartida (paleta “Azul Periodístico”, tarjetas, badges, tablas, cuerpo de nota, ticker, etc.). |
| `app.js` | JavaScript de la demo: navegación entre secciones del panel, lectura por voz (Web Speech API), simulador de scraping con su log, botón “Probar conexión” de la IA y “Copiar enlace”. |

## Funciones interactivas de la demo

- **🔊 Escuchar**: usa `speechSynthesis` con idioma `es-AR`. En el home lee el copete de cada tarjeta;
  en la nota lee el cuerpo completo. El botón cambia a “⏹ Detener” y vuelve solo al terminar.
- **Scraping (admin)**: al pulsar “▶ Ejecutar scraping ahora” se muestra un spinner ~1,5 s y luego
  un panel de log en fondo oscuro con las líneas de la corrida simulada.
- **Probar conexión (admin → IA)**: simula la verificación y muestra “✓ Conexión exitosa — gpt-4o-mini
  respondió en 780 ms”.
- **Copiar enlace (nota)**: copia la URL de la nota al portapapeles.

## Paleta y tipografía

- Azul institucional `#0B1C36` / `#122A4D`, azules medios `#234E86`, `#1A3C69`, `#3566A4`.
- Grises `#F4F5F7` (fondo), `#E8EAEE` (bordes), `#6B7280` (texto secundario), `#1F2937` (texto principal).
- Rojo `#C62828` para “ÚLTIMO MOMENTO”.
- Titulares en serif (Georgia), resto en sans del sistema. Mobile-first y 100% responsive.

Las imágenes se generan con el servicio `coresg-normal.trae.ai/api/ide/v1/text_to_image`. Si alguna
no carga, el `<img>` muestra un fondo gris (no un ícono roto).
