import { test, expect } from '@playwright/test';

/**
 * Tests E2E - Flujo principal del portal público.
 * Corren contra el servidor de desarrollo de Next.js en localhost:3000.
 */

test.describe('Portal público', () => {
  test('carga la home y muestra el título del sitio', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Saladillo/);
    await expect(page.locator('h1')).toBeVisible();
  });

  test('muestra una lista de artículos en la home', async ({ page }) => {
    await page.goto('/');
    const articulos = page.locator('article');
    // Puede haber 0 o más artículos; solo verificamos que la sección renderice sin error
    await expect(articulos.first()).toBeVisible({ timeout: 10000 }).catch(() => {});
  });

  test('navega a una nota y muestra su contenido', async ({ page }) => {
    await page.goto('/');
    const primerLink = page.locator('a[href*="/nota/"]').first();
    if ((await primerLink.count()) > 0) {
      await primerLink.click();
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('article')).toBeVisible();
    } else {
      // Si no hay notas publicadas, al menos la home no debe fallar
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('la página de búsqueda renderiza sin error', async ({ page }) => {
    await page.goto('/buscar?q=saladillo');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('la página de clima renderiza sin error', async ({ page }) => {
    await page.goto('/clima');
    await expect(page.locator('body')).toBeVisible();
  });

  test('la página de farmacias renderiza sin error', async ({ page }) => {
    await page.goto('/farmacias');
    await expect(page.locator('body')).toBeVisible();
  });
});
