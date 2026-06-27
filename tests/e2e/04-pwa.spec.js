// 04 — PWA: Service Worker registra, manifest valido, iconos accesibles
const { test, expect } = require('@playwright/test');

test.describe('PWA', () => {
  test('manifest.json es valido y tiene campos obligatorios', async ({ page, request }) => {
    const res = await request.get('/manifest.json');
    expect(res.ok()).toBe(true);
    const m = await res.json();
    expect(m.name || m.short_name).toBeTruthy();
    expect(m.start_url).toBeTruthy();
    expect(m.display).toBeTruthy();
    expect(Array.isArray(m.icons)).toBe(true);
    expect(m.icons.length).toBeGreaterThan(0);
  });

  test('Service worker sw.js responde 200', async ({ request }) => {
    const res = await request.get('/sw.js');
    expect(res.ok()).toBe(true);
    const body = await res.text();
    expect(body).toMatch(/const CACHE\s*=\s*['"][\w.\-]+['"]/);
  });

  test('Iconos PWA accesibles', async ({ request }) => {
    const r1 = await request.get('/icon-192.png');
    const r2 = await request.get('/icon-512.png');
    expect(r1.ok()).toBe(true);
    expect(r2.ok()).toBe(true);
  });

  test('Service Worker se registra al cargar la app', async ({ page }) => {
    await page.goto('/');
    // Esperar a que el navegador registre el SW
    const registered = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      for (let i = 0; i < 20; i++) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) return true;
        await new Promise((r) => setTimeout(r, 250));
      }
      return false;
    });
    expect(registered).toBe(true);
  });
});
