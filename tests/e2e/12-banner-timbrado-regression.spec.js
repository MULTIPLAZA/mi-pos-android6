// 12 — Regresion: el banner persistente del BUG-09 no debe tapar el header
// Caso reportado por cliente real (2026-05-26): cliente nuevo sin timbrado
// veia un banner ambar fixed top que cubria el header de scSale y bloqueaba
// los clicks. Se revirtio en cobro.js (commit 0e3d92a) + cache bump en sw.js.
// Este test asegura que NO vuelva.
const { test, expect } = require('@playwright/test');

test.describe('BUG-09 regresion — banner sin timbrado no tapa scSale', () => {
  test.beforeEach(async ({ page }) => {
    // Cliente nuevo: sin timbrado en localStorage
    await page.addInitScript(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
        // Asegurar que NO hay timbrado pre-cargado
        localStorage.removeItem('pos_timbrados');
        localStorage.removeItem('pos_timbrado_activo');
        localStorage.removeItem('pos_timbrados_mapa');
      } catch (e) {}
    });
  });

  test('Polyfills mostrar/ocultarBannerSinTimbrado existen y son no-op', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const result = await page.evaluate(() => {
      const before = document.body.innerHTML.length;
      // Si quedara codigo viejo cacheado o un script externo que llame a esto,
      // NO debe inyectar nada en el DOM.
      if (typeof window.mostrarBannerSinTimbrado === 'function') {
        window.mostrarBannerSinTimbrado();
      }
      const after = document.body.innerHTML.length;
      return {
        existe: typeof window.mostrarBannerSinTimbrado === 'function',
        diffDom: after - before,
      };
    });

    expect(result.existe).toBe(true);
    // No debe modificar el DOM (no-op polyfill)
    expect(result.diffDom).toBe(0);
  });

  test('No hay banner fixed top que tape el header de scSale', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Buscar cualquier elemento position:fixed con top:0 y z-index alto
    // que NO sea un overlay legitimo (npOverlay, scActivado, scBloqueado, etc).
    const tapadores = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('body *'));
      return all
        .filter((el) => {
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden') return false;
          if (cs.position !== 'fixed') return false;
          const top = parseFloat(cs.top);
          if (isNaN(top) || top > 5) return false;
          const z = parseInt(cs.zIndex);
          if (isNaN(z) || z < 100) return false;
          // Mencionar timbrado en el texto = sospechoso
          const txt = (el.textContent || '').toLowerCase();
          return txt.includes('timbrado') || txt.includes('punto de exped');
        })
        .map((el) => ({
          id: el.id || '(sin id)',
          tag: el.tagName,
          texto: (el.textContent || '').trim().substring(0, 80),
        }));
    });

    expect(tapadores).toEqual([]);
  });

  test('cargarTimbradoSesion no inyecta banner que tape el header', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Forzar el flujo "sin timbrado" llamando a cargarTimbradoSesion
    await page.evaluate(() => {
      if (typeof window.cargarTimbradoSesion === 'function') {
        return window.cargarTimbradoSesion();
      }
    });
    await page.waitForTimeout(500);

    // Verificar que ningun elemento NUEVO fixed top con texto timbrado aparecio
    const tapadores = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('body *'))
        .filter((el) => {
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden') return false;
          if (cs.position !== 'fixed') return false;
          const top = parseFloat(cs.top);
          if (isNaN(top) || top > 5) return false;
          const txt = (el.textContent || '').toLowerCase();
          return txt.includes('sin timbrado') || txt.includes('configura un punto');
        })
        .map((el) => ({ id: el.id, texto: (el.textContent || '').substring(0, 60) }));
    });

    expect(tapadores).toEqual([]);
  });

  test('Service Worker registrado tiene la nueva version del CACHE', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Leer la constante CACHE del sw.js servido
    const swText = await page.evaluate(async () => {
      const r = await fetch('/sw.js');
      return r.text();
    });

    // Debe ser la version del revert (v1.14.24+), no la vieja v1.14.23
    expect(swText).toMatch(/CACHE\s*=\s*['"]ampersand-pos-v1\.14\.(2[4-9]|[3-9]\d)/);
    expect(swText).not.toContain('v1.14.23-20260524-arch001d-format');
  });
});
