// 13 — Regression: _timbradoEstaVigente() (js/cobro.js) debe chequear AMBOS
// extremos del rango de vigencia de un timbrado no electrónico, no solo
// vig_fin. Bug real arreglado en v1.16.56: un timbrado cargado con
// anticipación (vig_ini en el futuro) se consideraba "vigente" y el POS lo
// dejaba facturar YA — documento fuera de vigencia, rechazable por la SET
// en una fiscalización. Este test asegura que no vuelva.
const { test, expect } = require('@playwright/test');

test.describe('Timbrado vigencia (fix v1.16.56)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window._timbradoEstaVigente === 'function', { timeout: 8000 });
  });

  test('Rechaza un timbrado cuya vigencia todavía no empezó', async ({ page }) => {
    const vigente = await page.evaluate(() => {
      const hoy = new Date('2026-08-23T12:00:00');
      // vig_ini el mes que viene — cargado con anticipación, como el caso real.
      const t = { vig_ini: '2026-09-01', vig_fin: '2027-08-31' };
      return window._timbradoEstaVigente(t, hoy);
    });
    expect(vigente).toBe(false);
  });

  test('Rechaza un timbrado ya vencido (caso que ya funcionaba antes del fix)', async ({ page }) => {
    const vigente = await page.evaluate(() => {
      const hoy = new Date('2026-08-23T12:00:00');
      const t = { vig_ini: '2025-01-01', vig_fin: '2026-01-01' };
      return window._timbradoEstaVigente(t, hoy);
    });
    expect(vigente).toBe(false);
  });

  test('Acepta un timbrado dentro de su rango de vigencia', async ({ page }) => {
    const vigente = await page.evaluate(() => {
      const hoy = new Date('2026-08-23T12:00:00');
      const t = { vig_ini: '2026-01-01', vig_fin: '2027-01-01' };
      return window._timbradoEstaVigente(t, hoy);
    });
    expect(vigente).toBe(true);
  });

  test('Acepta un timbrado sin vig_ini cargado (fallback nombres vig_inicio/fecha_desde)', async ({ page }) => {
    const resultado = await page.evaluate(() => {
      const hoy = new Date('2026-08-23T12:00:00');
      // Ninguno de los 2 extremos cargado — no debe romper, y sin límites
      // conocidos se considera vigente (mismo comportamiento pre-fix para
      // datos incompletos, no algo que este fix haya cambiado a propósito).
      const t = {};
      return window._timbradoEstaVigente(t, hoy);
    });
    expect(resultado).toBe(true);
  });
});
