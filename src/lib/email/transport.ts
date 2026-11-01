import nodemailer from 'nodemailer';

/**
 * Configuración del transporte de email.
 *
 * Variables de entorno requeridas:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_FROM_NAME
 *
 * Si no se configuran, se usa un transporte de prueba (ethereal.email) que solo
 * escribe a consola y no envía emails reales. Útil para desarrollo/local.
 */
export function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;
  const fromName = process.env.SMTP_FROM_NAME ?? 'Saladillo Noticias';

  if (!host || !user || !pass) {
    // Modo desarrollo: transporte de prueba que imprime a consola
    const testTransport = nodemailer.createTestAccount();
    return {
      transporter: nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: 'dev',
          pass: 'dev',
        },
      }),
      from: `"${fromName}" <${from ?? 'newsletter@saladillonoticias.com.ar'}>`,
      isDev: true,
    };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return {
    transporter,
    from: `"${fromName}" <${from}>`,
    isDev: false,
  };
}

/**
 * Envía un email individual.
 */
export async function enviarEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  const { transporter, from, isDev } = createTransporter();

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    html,
    text: text ?? stripHtml(html),
  });

  if (isDev) {
    // En modo dev, nodemailer devuelve una URL de preview en ethereal
    console.log(`[Newsletter dev] Email a ${to}: ${nodemailer.getTestMessageUrl(info)}`);
  }

  return {
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
  };
}

/**
 * Elimina etiquetas HTML para generar una versión de texto plano.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
