// 14 — Regression: limpiarCacheTenantAnterior() (js/licencia.js) debe vaciar
// TODAS las colas de reintento offline, no solo las que existían cuando se
// armó la lista original. Bug real arreglado en v1.16.60: 5 colas
// (costo/stock/pedidos/credito/hospedaje) se fueron agregando en commits
// posteriores sin que nadie volviera a esta función para sumarlas — un
// dispositivo reasignado de una licencia a otra seguía drenando en segundo
// plano, bajo la sesión del tenant nuevo, datos sin sincronizar del tenant
// anterior. Este test asegura que esas 5 (+ 4 ya existentes, de control)
// sigan en la lista.
//
// v1.16.78 sumó otro hueco de la MISMA familia: pos_pendientes (tickets en
// espera con cart/items/cliente completos) y pos_cart_autosave (venta EN
// CURSO, autoguardada cada pocos segundos) tampoco se limpiaban — init.js
// las restaura al arrancar sin chequear de qué tenant son, así que una
// reasignación reciente de dispositivo podía mostrarle a la cajera nueva,
// en su primera pantalla, tickets en espera o un carrito con cliente/mesa
// de la cuenta anterior.
//
// Esta ronda (sin número de versión todavía al escribir el test) sumó el
// hueco más grave encontrado hasta ahora: fe_tenant_id/fe_api_key/fe_api_url/
// fe_activa (credenciales reales de FacturaSend/SIFEN) y pos_timbrado_activo/
// pos_timbrados/pos_timbrados_mapa (timbrado fiscal vigente) tampoco se
// limpiaban. app.js SÍ re-sincroniza esto desde Supabase al arrancar, pero
// es async (ventana real) y cargarTimbradoSesion() (cobro.js) usa el cache
// local como FALLBACK EXPLÍCITO si la RPC falla o no hay asignación para la
// terminal -- ese fallback asume que el cache es del tenant actual. Sin
// limpiar esto, un dispositivo reasignado podía emitir una factura
// electrónica real con el api_key/timbrado del cliente ANTERIOR.
const { test, expect } = require('@playwright/test');

const CLAVES_A_VERIFICAR = [
  // Las 5 que faltaban (el bug real de v1.16.60)
  'pos_costo_sync_fallback',
  'pos_stock_sync_fallback',
  'pos_pedidos_sync_fallback',
  'pos_cred_sync_fallback',
  'pos_hosp_sync_fallback',
  // Las 3 que faltaban (el bug real de v1.16.78)
  'pos_pendientes',
  'pos_ticket_counter',
  'pos_cart_autosave',
  // Las 7 que faltaban (credenciales FE + timbrado fiscal, hallazgo más grave)
  'fe_tenant_id',
  'fe_api_key',
  'fe_api_url',
  'fe_activa',
  'pos_timbrado_activo',
  'pos_timbrados',
  'pos_timbrados_mapa',
  // 4 ya existentes desde antes, de control — si estas fallan también,
  // el problema es más grave que las de arriba (la función completa
  // dejó de limpiar algo).
  'pos_sync_fallback',
  'pos_productos_sync_fallback',
  'fe_cola',
  'pos_turno_creacion_pendiente',
];

test.describe('limpiarCacheTenantAnterior (fix v1.16.60 + v1.16.78 + credenciales FE/timbrado)', () => {
  test('Vacía las colas de reintento y el carrito/pendientes del tenant anterior', async ({ page }) => {
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

  test('Vacía también el cart y pendientes EN MEMORIA (no solo localStorage)', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.limpiarCacheTenantAnterior === 'function', { timeout: 8000 });

    const resultado = await page.evaluate(async () => {
      // Simular una cajera con un carrito y un pendiente cargados
      if (typeof window.setCart === 'function') window.setCart([{ name: 'Producto viejo', qty: 1, price: 10000 }]);
      if (typeof window.setPendientes === 'function') window.setPendientes([{ nro: 5, cart: [{ name: 'x', qty: 1 }], total: 1000 }]);
      if (typeof window.setTicketCounter === 'function') window.setTicketCounter(42);

      await window.limpiarCacheTenantAnterior();

      return {
        cartLen: typeof window.cart !== 'undefined' ? window.cart.length : null,
        pendientesLen: typeof window.pendientes !== 'undefined' ? window.pendientes.length : null,
        ticketCounter: typeof window.ticketCounter !== 'undefined' ? window.ticketCounter : null,
      };
    });

    expect(resultado.cartLen).toBe(0);
    expect(resultado.pendientesLen).toBe(0);
    expect(resultado.ticketCounter).toBe(0);
  });

  test('Vacía timbradoSession/_timbradoCache EN MEMORIA (getTimbradoActivo no debe devolver el timbrado del tenant anterior)', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.limpiarCacheTenantAnterior === 'function' && typeof window.getTimbradoActivo === 'function', { timeout: 8000 });

    const resultado = await page.evaluate(async () => {
      // Simular un timbrado ya cargado en sesión (el estado real que deja
      // cargarTimbradoSesion() tras un cobro exitoso)
      window.timbradoSession = { nro: '12345678', sucursal: 1, punto_exp: 1, nro_actual: 42 };
      window._timbradoCache   = window.timbradoSession;
      localStorage.setItem('pos_timbrado_activo', JSON.stringify(window.timbradoSession));
      localStorage.setItem('pos_timbrados', JSON.stringify([{ ...window.timbradoSession, asignaciones: [{ terminal: 'Terminal 1', punto_exp: 1, nro_actual: 42 }] }]));
      localStorage.setItem('pos_timbrados_mapa', JSON.stringify({ 'Terminal 1': { timIdx: 0, asigIdx: 0 } }));

      await window.limpiarCacheTenantAnterior();

      return {
        timbradoSession: window.timbradoSession,
        timbradoCache: window._timbradoCache,
        // getTimbradoActivo() es el fallback real que usa cargarTimbradoSesion()
        // si la RPC falla -- debe devolver null, no el timbrado del tenant viejo.
        getTimbradoActivo: window.getTimbradoActivo(),
      };
    });

    expect(resultado.timbradoSession).toBeNull();
    expect(resultado.timbradoCache).toBeNull();
    expect(resultado.getTimbradoActivo).toBeNull();
  });
});
