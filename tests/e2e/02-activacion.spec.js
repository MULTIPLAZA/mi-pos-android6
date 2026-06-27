// 02 — Pantalla de activacion se muestra para licencia nueva (sin localStorage previo)
const { test, expect } = require('@playwright/test');

test.describe('Activacion de licencia', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.clear(); } catch (e) {}
    });
  });

  test('Sin licencia, scActivacion se vuelve visible eventualmente', async ({ page }) => {
    await page.goto('/');
    // licInit tarda en correr — esperar hasta 6s a que aparezca scActivacion
    await expect(page.locator('#scActivacion')).toBeVisible({ timeout: 8000 });
  });

  test('Inputs de email + clave existen', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#licEmail')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#licClave')).toBeVisible();
    await expect(page.locator('#licActivarBtn')).toBeVisible();
  });

  test('Validacion: clave corta dispara error (no llama a Supabase)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#scActivacion', { state: 'visible', timeout: 8000 });

    await page.fill('#licEmail', 'test@example.com');
    await page.fill('#licClave', 'AB'); // < 5 chars

    // Interceptar llamadas a Supabase para verificar que NO se llamen
    let supabaseCalls = 0;
    page.on('request', (req) => {
      if (/supabase\.co|supabase\.in/.test(req.url())) supabaseCalls++;
    });

    await page.click('#licActivarBtn');
    await page.waitForTimeout(800);

    const errorVisible = await page.locator('#licError').isVisible();
    expect(errorVisible).toBe(true);
    expect(supabaseCalls).toBe(0);
  });
});
