// 01 — Smoke test: la app carga sin errores criticos
const { test, expect } = require('@playwright/test');

test.describe('Smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.clear(); } catch (e) {}
      try { sessionStorage.clear(); } catch (e) {}
    });
  });

  test('index.html carga y tiene el titulo correcto', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    await expect(page).toHaveTitle(/POS|NODO|mi-pos/i);

    // Ningun error JS critico al arrancar
    const criticals = errors.filter(
      (e) => !/Service Worker|workbox|Failed to register|favicon|chrome-extension/i.test(e)
    );
    expect(criticals).toEqual([]);
  });

  test('CSS principal se carga (al menos un <link rel=stylesheet>)', async ({ page }) => {
    await page.goto('/');
    const stylesheets = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
      return links.map((l) => l.href).filter(Boolean);
    });
    expect(stylesheets.length).toBeGreaterThan(0);

    // Al menos una hoja debe haber cargado realmente (sheet.cssRules accesible o el href es local)
    const localCss = stylesheets.find((h) => h.includes('/css/'));
    expect(localCss).toBeTruthy();
  });

  test('Helpers globales de seguridad existen (_log, escapeHtml, esc)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const helpers = await page.evaluate(() => ({
      hasLog: typeof window._log === 'function',
      hasEscapeHtml: typeof window.escapeHtml === 'function',
      hasEsc: typeof window.esc === 'function',
    }));
    expect(helpers.hasLog).toBe(true);
    expect(helpers.hasEscapeHtml).toBe(true);
    expect(helpers.hasEsc).toBe(true);
  });
});
