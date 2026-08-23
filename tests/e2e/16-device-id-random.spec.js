// 16 — Regression: licGetDeviceId()/licGetDeviceIdAsync() (js/licencia.js) deben
// usar un generador criptografico para el device_id nuevo, incluso en navegadores
// sin crypto.randomUUID() (Chrome 92+, 2021) -- que es EXACTAMENTE la situacion real
// de este fork, pensado para Android 6 / Chrome 55. Antes del fix, cualquier
// navegador sin randomUUID caia directo en Math.random()+Date.now() (no
// criptografico, Date.now() ademas 100% predecible) para armar el device_id, que
// junto con el email alcanza para pedir un token valido via verificar_licencia
// (mipos-gateway) sin pasar por el rate-limit de activar_licencia. Este test
// confirma que, cuando randomUUID no esta disponible pero SI getRandomValues
// (el caso real de Chrome 55), se usa _randomHexId() (crypto.getRandomValues) y
// no el fallback debil.
const { test, expect } = require('@playwright/test');

test.describe('device_id usa CSPRNG incluso sin crypto.randomUUID (fix Chrome 55)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(
      () => typeof window.licGetDeviceId === 'function' && typeof window._randomHexId === 'function',
      { timeout: 8000 }
    );
  });

  test('_randomHexId() devuelve hex de la longitud correcta y no repite', async ({ page }) => {
    const result = await page.evaluate(() => {
      const a = window._randomHexId(16);
      const b = window._randomHexId(16);
      return { a, b };
    });
    expect(result.a).toMatch(/^[0-9a-f]{32}$/);
    expect(result.b).toMatch(/^[0-9a-f]{32}$/);
    expect(result.a).not.toBe(result.b);
  });

  test('licGetDeviceId() usa _randomHexId (getRandomValues) cuando no hay randomUUID', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.removeItem('lic_device_id');
      document.cookie = 'pos_device_id=; Max-Age=0; path=/';
      sessionStorage.removeItem('lic_device_id');

      const originalRandomHexId = window._randomHexId;
      let calledWithBytes = null;
      window._randomHexId = function (bytes) {
        calledWithBytes = bytes;
        return originalRandomHexId(bytes);
      };

      const originalRandomUUID = crypto.randomUUID;
      crypto.randomUUID = undefined; // simular Chrome 55 / Android 6

      const id = window.licGetDeviceId();

      crypto.randomUUID = originalRandomUUID;
      window._randomHexId = originalRandomHexId;

      return { id, calledWithBytes };
    });

    expect(result.calledWithBytes).toBe(16);
    expect(result.id).toMatch(/^dev_[0-9a-f]{20}$/);
  });

  test('licGetDeviceIdAsync() usa el mismo fallback seguro cuando no hay randomUUID', async ({ page }) => {
    const result = await page.evaluate(async () => {
      localStorage.removeItem('lic_device_id');
      document.cookie = 'pos_device_id=; Max-Age=0; path=/';
      sessionStorage.removeItem('lic_device_id');
      if (typeof db !== 'undefined' && db && db.config) {
        try { await db.config.delete('device_id'); } catch (e) {}
      }

      const originalRandomHexId = window._randomHexId;
      let calledWithBytes = null;
      window._randomHexId = function (bytes) {
        calledWithBytes = bytes;
        return originalRandomHexId(bytes);
      };

      const originalRandomUUID = crypto.randomUUID;
      crypto.randomUUID = undefined;

      const id = await window.licGetDeviceIdAsync();

      crypto.randomUUID = originalRandomUUID;
      window._randomHexId = originalRandomHexId;

      return { id, calledWithBytes };
    });

    expect(result.calledWithBytes).toBe(16);
    expect(result.id).toMatch(/^dev_[0-9a-f]{20}$/);
  });
});
