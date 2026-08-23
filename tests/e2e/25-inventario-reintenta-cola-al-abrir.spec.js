// 25 — Regression: renderInventarios() (js/admin-inventario.js, pantalla
// principal de Inventarios) no reintentaba las colas de respaldo
// pos_costo_sync_fallback/pos_stock_sync_fallback al abrirse -- esos
// reintentos solo se disparaban al GUARDAR un movimiento nuevo (movGuardar())
// o al anular uno (movEjecutarAnulacion()). Si un upsert de stock fallaba por
// un corte de red momentáneo y el dueño solo entraba a MIRAR el stock (sin
// cargar otro movimiento), la cantidad quedaba desincronizada indefinidamente
// y en silencio -- mismo patrón de "cola offline sin limpiar" ya arreglado en
// credito.js/hospedaje.js/pedidos.js.
const { test, expect } = require('@playwright/test');

test.describe('renderInventarios() reintenta colas de respaldo al abrir la pantalla', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin-negocio.html');
    await page.waitForFunction(
      () => typeof window.supaReintentarResilientes === 'function'
         && typeof window.supaReintentarResilientesPost === 'function',
      { timeout: 8000 }
    );
    // admin-inventario.js se carga lazy via ensureAdminModule -- inyectarlo
    // directo evita depender del router del panel para este test.
    await page.addScriptTag({ url: '/js/admin-inventario.js' });
    await page.waitForFunction(() => typeof window.renderInventarios === 'function', { timeout: 8000 });
  });

  test('llama a supaReintentarResilientes(pos_costo_sync_fallback) y supaReintentarResilientesPost(pos_stock_sync_fallback)', async ({ page }) => {
    const calls = await page.evaluate(async () => {
      SE = 'test@test.com'; // identificador suelto de admin-negocio.html, no window.SE
      document.body.insertAdjacentHTML('beforeend', '<div id="content"></div>');

      const originalRetryPatch = window.supaReintentarResilientes;
      const originalRetryPost = window.supaReintentarResilientesPost;
      const originalSg = window.sg;
      const seen = [];
      window.supaReintentarResilientes = function(key){ seen.push({ fn: 'patch', key }); return Promise.resolve(); };
      window.supaReintentarResilientesPost = function(key){ seen.push({ fn: 'post', key }); return Promise.resolve(); };
      // sg rechaza para que renderInventarios() corte rápido en su catch --
      // no es el foco de este test, solo confirmar que el reintento de las
      // colas se dispara ANTES de intentar traer datos frescos.
      window.sg = function(){ return Promise.reject(new Error('red caída (simulado)')); };

      await window.renderInventarios();

      window.supaReintentarResilientes = originalRetryPatch;
      window.supaReintentarResilientesPost = originalRetryPost;
      window.sg = originalSg;
      return seen;
    });

    expect(calls).toContainEqual({ fn: 'patch', key: 'pos_costo_sync_fallback' });
    expect(calls).toContainEqual({ fn: 'post', key: 'pos_stock_sync_fallback' });
  });
});
