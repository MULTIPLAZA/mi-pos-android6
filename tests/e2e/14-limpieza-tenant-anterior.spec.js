// 14 — Regression: limpiarCacheTenantAnterior() (js/licencia.js) debe vaciar
// TODAS las colas de reintento offline, no solo las que existían cuando se
// armó la lista original. Bug real arreglado en v1.16.60: 5 colas
// (costo/stock/pedidos/credito/hospedaje) se fueron agregando en commits
// posteriores sin que nadie volviera a esta función para sumarlas — un
// dispositivo reasignado de una licencia a otra seguía drenando en segundo
// plano, bajo la sesión del tenant nuevo, datos sin sincronizar del tenant
// anterior. Este test asegura que esas 5 (+ 4 ya existentes, de control)
// sigan en la lista.
const { test, expect } = require('@playwright/test');

const CLAVES_A_VERIFICAR = [
  // Las 5 que faltaban (el bug real de v1.16.60)
  'pos_costo_sync_fallback',
  'pos_stock_sync_fallback',
  'pos_pedidos_sync_fallback',
  'pos_cred_sync_fallback',
  'pos_hosp_sync_fallback',
  // 4 ya existentes desde antes, de control — si estas fallan también,
  // el problema es más grave que las 5 de arriba (la función completa
  // dejó de limpiar algo).
  'pos_sync_fallback',
  'pos_productos_sync_fallback',
  'fe_cola',
  'pos_turno_creacion_pendiente',
];

test.describe('limpiarCacheTenantAnterior (fix v1.16.60)', () => {
  test('Vacía las 5 colas de reintento agregadas después de la lista original', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.limpiarCacheTenantAnterior === 'function', { timeout: 8000 });

    const resultado = await page.evaluate(async (claves) => {
      claves.forEach((k) => localStorage.setItem(k, '[{"tabla":"x","data":{}}]'));
      await window.limpiarCacheTenantAnterior();
      return claves.map((k) => ({ clave: k, quedó: localStorage.getItem(k) }));
    }, CLAVES_A_VERIFICAR);

    for (const { clave, quedó } of resultado) {
      expect(quedó, `${clave} debería quedar null después de limpiarCacheTenantAnterior()`).toBeNull();
    }
  });
});
