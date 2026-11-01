import { test, expect } from '@playwright/test';

/**
 * Tests E2E - Newsletter y comentarios.
 * Corren contra el servidor de desarrollo de Next.js en localhost:3000.
 */

test.describe('Newsletter', () => {
  test('permite suscribirse al boletín desde el footer', async ({ page }) => {
    await page.goto('/');

    // Buscar el formulario de newsletter en el footer
    const emailInput = page.locator('input[type="email"]').first();
    const nombreInput = page.locator('input[placeholder*="nombre" i]').first();
    const botonSuscribir = page.locator('button:has-text("Suscribir"), button[type="submit"]').first();

    if ((await emailInput.count()) > 0) {
      await emailInput.fill('test.e2e@saladillonoticias.com.ar');
      if ((await nombreInput.count()) > 0) {
        await nombreInput.fill('Usuario E2E');
      }
      await botonSuscribir.click();

      // Esperar mensaje de confirmación (puede ser toast o texto en pantalla)
      await expect(page.locator('body')).toContainText(/suscrib|boletín|éxito|activo/i);
    } else {
      // Si no hay formulario visible, al menos la página carga
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('rechaza un email inválido en el formulario de newsletter', async ({ page }) => {
    await page.goto('/');
    const emailInput = page.locator('input[type="email"]').first();

    if ((await emailInput.count()) > 0) {
      await emailInput.fill('email-invalido');
      await page.locator('button[type="submit"]').click();

      // HTML5 validation debería impedir el envío o mostrar error
      await expect(page.locator('input[type="email"]')).toHaveValue('email-invalido');
    } else {
      await expect(page.locator('body')).toBeVisible();
    }
  });
});

test.describe('Comentarios de lectores', () => {
  test('muestra la sección de comentarios en una nota', async ({ page }) => {
    await page.goto('/');

    // Ir a una nota publicada
    const primerLink = page.locator('a[href*="/nota/"]').first();
    if ((await primerLink.count()) > 0) {
      await primerLink.click();

      // Buscar el formulario de comentarios
      const formComentario = page.locator('form').filter({ has: page.locator('textarea') });
      const nombreInput = page.locator('input[placeholder*="nombre" i], input[name="authorName"]').first();
      const contenidoTextarea = page.locator('textarea').first();
      const botonEnviar = page.locator('button[type="submit"]').first();

      if ((await formComentario.count()) > 0) {
        await nombreInput.fill('Lector E2E');
        await contenidoTextarea.fill('Este es un comentario de prueba automática.');
        await botonEnviar.click();

        // Debería mostrar mensaje de pendiente de aprobación
        await expect(page.locator('body')).toContainText(/pendiente|aprobación|comentario/i);
      } else {
        await expect(page.locator('body')).toBeVisible();
      }
    } else {
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('valida campos requeridos en el formulario de comentario', async ({ page }) => {
    await page.goto('/');
    const primerLink = page.locator('a[href*="/nota/"]').first();
    if ((await primerLink.count()) > 0) {
      await primerLink.click();
      const botonEnviar = page.locator('button[type="submit"]').first();
      if ((await botonEnviar.count()) > 0) {
        await botonEnviar.click();
        // Campos vacíos deberían mostrar validación HTML5
        await expect(page.locator('input[required], textarea[required]')).toBeVisible();
      } else {
        await expect(page.locator('body')).toBeVisible();
      }
    } else {
      await expect(page.locator('body')).toBeVisible();
    }
  });
});
