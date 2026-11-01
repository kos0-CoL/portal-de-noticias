import { format } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Datos necesarios para renderizar la plantilla del boletín.
 */
export interface ResumenDiarioData {
  fecha: string; // ISO string
  titulo: string;
  subtitulo?: string;
  articles: Array<{
    id: string;
    slug: string;
    title: string;
    summary?: string;
    category?: string;
    url: string;
    coverImage?: string;
  }>;
  siteName: string;
  siteUrl: string;
  unsubscribeUrl: string;
}

/**
 * Plantilla HTML del boletín de resumen diario.
 * Diseño limpio, responsive, apto para la mayoría de clientes de email.
 */
export function plantillaResumenDiario(data: ResumenDiarioData): string {
  const fechaFormateada = format(new Date(data.fecha), "dd 'de' MMMM 'de' yyyy", {
    locale: es,
  });

  const listaArticulos = data.articles
    .map(
      (a) => `
    <tr>
      <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
        ${a.coverImage ? `<img src="${a.coverImage}" alt="${a.title}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 6px; float: left; margin: 0 12px 12px 0;" />` : ''}
        <strong style="display: block; font-size: 16px; color: #111827; margin-bottom: 4px;">
          <a href="${a.url}" style="color: #111827; text-decoration: none;">${a.title}</a>
        </strong>
        ${a.category ? `<span style="display: inline-block; background: #e5e7eb; color: #374151; font-size: 11px; padding: 2px 8px; border-radius: 12px; margin-bottom: 6px;">${a.category}</span>` : ''}
        ${a.summary ? `<p style="margin: 0 0 8px 0; font-size: 14px; color: #4b5563; line-height: 1.5;">${a.summary}</p>` : ''}
        <a href="${a.url}" style="display: inline-block; background: #122A4D; color: #ffffff; text-decoration: none; padding: 8px 16px; border-radius: 6px; font-size: 14px; font-weight: 600;">Leer nota</a>
      </td>
    </tr>
  `
    )
    .join('');

  return `
<!DOCTYPE html>
<html lang="es-AR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${data.titulo}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; color: #111827;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f3f4f6; padding: 24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 640px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Encabezado -->
          <tr>
            <td align="center" style="background-color: #122A4D; padding: 24px 32px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; color: #ffffff; font-weight: 700; letter-spacing: -0.02em;">
                ${data.siteName}
              </h1>
              <p style="margin: 6px 0 0; font-size: 14px; color: #93c5fd; font-weight: 400;">
                Resumen diario - ${fechaFormateada}
              </p>
            </td>
          </tr>

          <!-- Cuerpo -->
          <tr>
            <td style="padding: 24px 32px;">
              ${data.subtitulo ? `
              <p style="font-size: 16px; color: #4b5563; line-height: 1.6; margin: 0 0 20px 0;">
                ${data.subtitulo}
              </p>
              ` : ''}

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                ${listaArticulos || `
                <tr>
                  <td style="padding: 24px 0; text-align: center; color: #6b7280;">
                    No hay noticias nuevas hoy.
                  </td>
                </tr>
                `}
              </table>

              ${data.articles.length > 0 ? `
              <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center;">
                <p style="font-size: 13px; color: #6b7280; margin: 0 0 16px 0;">
                  Ver todas las noticias en <a href="${data.siteUrl}" style="color: #122A4D; text-decoration: none; font-weight: 600;">${data.siteName}</a>
                </p>
              </div>
              ` : ''}
            </td>
          </tr>

          <!-- Pie -->
          <tr>
            <td align="center" style="background-color: #f9fafb; padding: 20px 32px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 12px 0; font-size: 12px; color: #9ca3af;">
                Recibís este boletín porque te suscribiste en ${data.siteName}.
              </p>
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                <a href="${data.unsubscribeUrl}" style="color: #9ca3af; text-decoration: underline;">Dar de baja</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}
