// 05 — Validacion del form de licencia
const { test, expect } = require('@playwright/test');

test.describe('Validacion form licencia', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.clear(); } catch (e) {}
    });
  });

  test('Clave vacia muestra error sin llamar a Supabase (post-click)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#scActivacion', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(1500); // dar tiempo a que licInit termine sus llamadas iniciales

    // Contar SOLO los requests que ocurren despues del click (no las llamadas de licInit)
    let supabaseCallsAfterClick = 0;
    page.on('request', (req) => {
      if (/supabase\.co|supabase\.in/.test(req.url())) supabaseCallsAfterClick++;
    });

    await page.fill('#licEmail', 'test@example.com');
    await page.fill('#licClave', '');
    await page.click('#licActivarBtn');
    await page.waitForTimeout(700);

    await expect(page.locator('#licError')).toBeVisible();
    expect(supabaseCallsAfterClick).toBe(0);
  });

  test('Email invalido + clave: tambien valida client-side', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#scActivacion', { state: 'visible', timeout: 8000 });

    await page.fill('#licEmail', 'no-es-email');
    await page.fill('#licClave', 'DEMO-2025-XXXX');
    await page.click('#licActivarBtn');
    await page.waitForTimeout(800);

    // Debe quedarse en activacion (error visible) — no debe haber navegado
    await expect(page.locator('#scActivacion')).toBeVisible();
  });

  test('Input clave fuerza UPPERCASE y filtra caracteres invalidos', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#licClave', { state: 'visible', timeout: 8000 });

    await page.fill('#licClave', 'abc!@#$%-xy z9');
    const val = await page.inputValue('#licClave');

    // El oninput convierte a uppercase y filtra a [A-Z0-9-]
    expect(val).toMatch(/^[A-Z0-9-]+$/);
    expect(val).toContain('ABC');
  });
});
