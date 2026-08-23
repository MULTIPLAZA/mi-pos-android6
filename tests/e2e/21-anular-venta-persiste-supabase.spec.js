// 21 — Regression: _anularVentaConfirmarInterno() (js/init.js, anular una
// venta desde el POS) marcaba la venta como anulada en IndexedDB (local) y
// revertía el stock en Supabase, pero NUNCA marcaba `pos_ventas.anulada=true`
// en Supabase. admin-finanzas.js/admin-dashboard.js filtran SIEMPRE
// `anulada=is.false` en sus reportes de ingresos/débito fiscal -- así que una
// venta anulada desde el POS seguía contando como ingreso real de forma
// indefinida en todos los reportes, y en cualquier otro terminal seguía
// viéndose como venta activa. admin-dashboard.js ya tenía su propio flujo de
// anulación (vAnularVentaConfirmar) que SÍ persiste esto correctamente --
// este test confirma que el flujo del POS ahora hace lo mismo.
const { test, expect } = require('@playwright/test');

test.describe('_anularVentaConfirmarInterno() marca anulada=true en Supabase', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(
      () => typeof window._anularVentaConfirmarInterno === 'function' && typeof window.db !== 'undefined',
      { timeout: 8000 }
    );
  });

  test('llama supaPatch a pos_ventas con anulada:true, matcheando por fecha', async ({ page }) => {
    const result = await page.evaluate(async () => {
      localStorage.setItem('lic_email', 'test@test.com');

      const fechaVenta = '2026-08-23T12:00:00.000Z';
      const id = await db.ventas.add({
        fecha: fechaVenta,
        total: 50000,
        metodo_pago: 'EFECTIVO',
        comprobante: 'TEST-0001',
        items: '[]',
        tiene_factura: false,
        anulada: 0,
      });

      const originalPatch = window.supaPatch;
      const originalStockRevertir = window.stockRevertirVenta;
      const patchCalls = [];
      window.supaPatch = function (tabla, filtro, data) { patchCalls.push({ tabla, filtro, data }); return Promise.resolve([]); };
      window.stockRevertirVenta = function () { return Promise.resolve(); }; // evita red real, no es el foco de este test

      await window._anularVentaConfirmarInterno(id);

      window.supaPatch = originalPatch;
      window.stockRevertirVenta = originalStockRevertir;

      const ventaLocal = await db.ventas.get(id);
      return { patchCalls, anuladaLocal: ventaLocal.anulada };
    });

    expect(result.anuladaLocal).toBe(1); // el fix no debe romper la parte local que ya funcionaba

    const anulCall = result.patchCalls.find(c => c.tabla === 'pos_ventas' && c.data && c.data.anulada === true);
    expect(anulCall).toBeTruthy();
    expect(anulCall.filtro).toContain('fecha=eq.');
    expect(anulCall.filtro).toContain('2026-08-23');
    expect(anulCall.data.motivo_anulacion).toBeTruthy();
  });
});
