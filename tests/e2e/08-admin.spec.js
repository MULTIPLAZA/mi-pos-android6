// 08 — Admin page carga sin errores criticos
const { test, expect } = require('@playwright/test');

test.describe('Admin Page', () => {
  test('admin-negocio.html responde y tiene shell', async ({ page, request }) => {
    const res = await request.get('/admin-negocio.html');
    expect(res.ok()).toBe(true);
    const html = await res.text();
    expect(html).toMatch(/<html/i);
    expect(html.length).toBeGreaterThan(1000);
  });

  test('admin se carga en navegador sin errores criticos', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/admin-negocio.html');
    await page.waitForLoadState('domcontentloaded');

    const criticals = errors.filter(
      (e) => !/Service Worker|workbox|Failed to register|favicon|chrome-extension|401|403|JWT|supabase/i.test(e)
    );
    expect(criticals).toEqual([]);
  });

  test('admin tiene service worker propio (sw-admin.js)', async ({ request }) => {
    const res = await request.get('/sw-admin.js');
    expect(res.ok()).toBe(true);
    const body = await res.text();
    expect(body).toMatch(/CACHE|cache/);
  });

  test('PERF-001: admin solo carga admin-dashboard.js up-front (lazy-loader presente)', async ({ request }) => {
    const res = await request.get('/admin-negocio.html');
    const html = await res.text();
    // El dashboard debe estar precargado
    expect(html).toMatch(/<script src=["']js\/admin-dashboard\.js/);
    // Los otros 4 NO deben estar como <script src> directos
    const directScripts = [
      /<script\s+src=["']js\/admin-productos\.js["']/,
      /<script\s+src=["']js\/admin-inventario\.js["']/,
      /<script\s+src=["']js\/admin-finanzas\.js["']/,
      /<script\s+src=["']js\/admin-tutoriales\.js["']/,
    ];
    for (const re of directScripts) {
      expect(html).not.toMatch(re);
    }
    // El loader dinamico debe estar
    expect(html).toMatch(/ensureAdminModule/);
    expect(html).toMatch(/_adminModules/);
  });
});
