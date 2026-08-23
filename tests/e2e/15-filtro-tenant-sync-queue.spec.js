// 15 — Regression: _filtroDeleteSeguro()/_filtroUpdateSeguro() (js/sync.js)
// deben rechazar un item de la cola offline (sync_queue) sin licencia_email,
// y acotar el filtro DELETE/PATCH por id+licencia_email siempre. Bugs reales
// arreglados en v1.16.58 (DELETE) y v1.16.59 (PATCH): un item de la cola sin
// filtrar por tenant podía borrar/pisar la fila de OTRO tenant que tuviera
// el mismo id local (id es un contador por-dispositivo, no único global).
// Este test asegura que no vuelvan.
const { test, expect } = require('@playwright/test');

test.describe('Filtros tenant-seguros de la cola offline (fix v1.16.58/v1.16.59)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(
      () => typeof window._filtroDeleteSeguro === 'function' && typeof window._filtroUpdateSeguro === 'function',
      { timeout: 8000 }
    );
  });

  test('_filtroDeleteSeguro() rechaza un item sin licencia_email', async ({ page }) => {
    const lanzoError = await page.evaluate(() => {
      try {
        window._filtroDeleteSeguro({ id: 5 });
        return false;
      } catch (e) {
        return e.message.includes('licencia_email');
      }
    });
    expect(lanzoError).toBe(true);
  });

  test('_filtroDeleteSeguro() acota por id Y licencia_email cuando el dato es válido', async ({ page }) => {
    const filtro = await page.evaluate(() => window._filtroDeleteSeguro({ id: 5, licencia_email: 'tenant@ejemplo.com' }));
    expect(filtro).toEqual({ id: 'eq.5', licencia_email: 'eq.tenant%40ejemplo.com' });
  });

  test('_filtroUpdateSeguro() rechaza un item sin licencia_email', async ({ page }) => {
    const lanzoError = await page.evaluate(() => {
      try {
        window._filtroUpdateSeguro({ estado: 'cerrado' }, 5);
        return false;
      } catch (e) {
        return e.message.includes('licencia_email');
      }
    });
    expect(lanzoError).toBe(true);
  });

  test('_filtroUpdateSeguro() acota por id Y licencia_email cuando el dato es válido', async ({ page }) => {
    const filtro = await page.evaluate(() =>
      window._filtroUpdateSeguro({ estado: 'cerrado', licencia_email: 'tenant@ejemplo.com' }, 5)
    );
    expect(filtro).toEqual({ id: 'eq.5', licencia_email: 'eq.tenant%40ejemplo.com' });
  });
});
