// 11 — ARCH-001: ES Modules
// Verifica que el modulo ESM js/lib/index.mjs carga correctamente
// y re-expone NodoIco en window para compat con codigo legacy.
const { test, expect } = require('@playwright/test');

test.describe('ARCH-001: ES Modules', () => {
  test('js/lib/index.mjs responde 200 y es un modulo ESM valido', async ({ request }) => {
    const res = await request.get('/js/lib/index.mjs');
    expect(res.ok()).toBe(true);
    const body = await res.text();
    expect(body).toMatch(/^import\s+/m);
    expect(body).toMatch(/window\.NodoIco\s*=\s*NodoIco/);
  });

  test('js/lib/icons.mjs responde 200 y exporta NodoIco', async ({ request }) => {
    const res = await request.get('/js/lib/icons.mjs');
    expect(res.ok()).toBe(true);
    const body = await res.text();
    expect(body).toMatch(/export\s+function\s+NodoIco/);
    expect(body).toMatch(/export\s+const\s+PATHS/);
    expect(body).toMatch(/export\s+default\s+NodoIco/);
  });

  test('Tras cargar index.html, window.NodoIco esta disponible y funciona', async ({ page }) => {
    await page.goto('/');
    // El modulo ESM es defer por default — esperamos al evento listo
    await page.waitForFunction(() => window.__nodoLibLoaded === true, { timeout: 8000 });

    const result = await page.evaluate(() => {
      return {
        isFn: typeof window.NodoIco === 'function',
        svg: window.NodoIco('check', 16),
      };
    });
    expect(result.isFn).toBe(true);
    expect(result.svg).toContain('<svg');
    expect(result.svg).toContain('class="ni-svg"');
    expect(result.svg).toContain('width="16"');
  });

  test('Tras cargar admin-negocio.html, window.NodoIco esta disponible', async ({ page }) => {
    await page.goto('/admin-negocio.html');
    await page.waitForFunction(() => window.__nodoLibLoaded === true, { timeout: 8000 });

    const isFn = await page.evaluate(() => typeof window.NodoIco === 'function');
    expect(isFn).toBe(true);
  });

  test('js/nodo-ico.js viejo ya NO existe (404)', async ({ request }) => {
    const res = await request.get('/js/nodo-ico.js');
    expect(res.status()).toBe(404);
  });

  test('index.html ya NO referencia nodo-ico.js (script src directo)', async ({ request }) => {
    const res = await request.get('/index.html');
    const html = await res.text();
    expect(html).not.toMatch(/<script\s+src=["'][^"']*nodo-ico\.js/);
    expect(html).toMatch(/<script\s+type=["']module["']\s+src=["'][^"']*lib\/index\.mjs/);
  });

  test('lib/escape.mjs exporta escapeHtml y esc', async ({ request }) => {
    const res = await request.get('/js/lib/escape.mjs');
    expect(res.ok()).toBe(true);
    const body = await res.text();
    expect(body).toMatch(/export\s+function\s+escapeHtml/);
    expect(body).toMatch(/export\s+const\s+esc\s*=\s*escapeHtml/);
  });

  test('selectors.js viejo ya NO existe (404) — era codigo muerto', async ({ request }) => {
    const res = await request.get('/js/selectors.js');
    expect(res.status()).toBe(404);
  });

  test('state.js ya NO define escapeHtml (vive en lib/escape.mjs)', async ({ request }) => {
    const res = await request.get('/js/state.js');
    const body = await res.text();
    // No debe definir la funcion (puede mencionarla en comentarios)
    expect(body).not.toMatch(/function\s+escapeHtml\s*\(/);
    expect(body).not.toMatch(/var\s+esc\s*=\s*escapeHtml/);
  });

  test('Tras cargar POS, window.esc proviene del modulo ESM (mismo escape)', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__nodoLibLoaded === true, { timeout: 8000 });

    const result = await page.evaluate(() => {
      return {
        isFn: typeof window.esc === 'function',
        isAlias: window.esc === window.escapeHtml,
        escaped: window.esc('<script>alert(1)</script>'),
      };
    });
    expect(result.isFn).toBe(true);
    expect(result.isAlias).toBe(true);
    expect(result.escaped).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  test('lib/log.mjs exporta _log, _warn, _err', async ({ request }) => {
    const res = await request.get('/js/lib/log.mjs');
    expect(res.ok()).toBe(true);
    const body = await res.text();
    expect(body).toMatch(/export\s+function\s+_log/);
    expect(body).toMatch(/export\s+function\s+_warn/);
    expect(body).toMatch(/export\s+function\s+_err/);
  });

  test('state.js ya NO define _log/_warn/_err (vive en lib/log.mjs)', async ({ request }) => {
    const res = await request.get('/js/state.js');
    const body = await res.text();
    expect(body).not.toMatch(/function\s+_log\s*\(/);
    expect(body).not.toMatch(/function\s+_warn\s*\(/);
    expect(body).not.toMatch(/function\s+_err\s*\(/);
  });

  test('Tras cargar POS, window._log/_warn/_err vienen del modulo ESM', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__nodoLibLoaded === true, { timeout: 8000 });
    const fns = await page.evaluate(() => ({
      log: typeof window._log === 'function',
      warn: typeof window._warn === 'function',
      err: typeof window._err === 'function',
    }));
    expect(fns.log).toBe(true);
    expect(fns.warn).toBe(true);
    expect(fns.err).toBe(true);
  });

  test('lib/format.mjs exporta gs (formato guaranies)', async ({ request }) => {
    const res = await request.get('/js/lib/format.mjs');
    expect(res.ok()).toBe(true);
    const body = await res.text();
    expect(body).toMatch(/export\s+function\s+gs/);
    expect(body).toMatch(/es-PY/);
  });

  test('ui.js ya NO define gs (vive en lib/format.mjs)', async ({ request }) => {
    const res = await request.get('/js/ui.js');
    const body = await res.text();
    expect(body).not.toMatch(/function\s+gs\s*\(/);
  });

  test('Tras cargar POS, window.gs formatea bien guaranies', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__nodoLibLoaded === true, { timeout: 8000 });
    const result = await page.evaluate(() => ({
      isFn: typeof window.gs === 'function',
      a: window.gs(15000),
      b: window.gs(0),
      c: window.gs(null),
      d: window.gs(1500000),
    }));
    expect(result.isFn).toBe(true);
    expect(result.a).toMatch(/^₲15[.,]000$/);
    expect(result.b).toBe('₲0');
    expect(result.c).toBe('₲0');
    expect(result.d).toMatch(/^₲1[.,]500[.,]000$/);
  });
});
