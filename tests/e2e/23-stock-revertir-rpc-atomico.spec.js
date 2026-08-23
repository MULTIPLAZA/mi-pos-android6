// 23 — Regression: stockRevertirVenta() (js/turno.js, repone stock al anular
// una venta) hacía SIEMPRE lectura+cálculo en JS y después un upsert -- sin
// ninguna vía atómica, a diferencia de stockDescontarVenta() (venta normal),
// que ya usa la RPC atómica descontar_stock_venta con ese mismo upsert solo
// como fallback. Dos reversiones del mismo producto (o una reversión
// concurrente con una venta en otra terminal) podían pisarse el resultado
// (clásica race condition read-modify-write). Este test confirma que ahora
// stockRevertirVenta() intenta primero la RPC atómica revertir_stock_venta
// (supabase-migrations/stock_atomic_increment.sql), y que sigue funcionando
// por el camino de fallback si la RPC no está disponible.
const { test, expect } = require('@playwright/test');

test.describe('stockRevertirVenta() usa RPC atómica con fallback', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(
      () => typeof window.stockRevertirVenta === 'function',
      { timeout: 8000 }
    );
  });

  test('llama supaRPC revertir_stock_venta con los items correctos', async ({ page }) => {
    const result = await page.evaluate(async () => {
      localStorage.setItem('lic_email', 'test@test.com');
      localStorage.setItem('pos_deposito_id', '1');
      localStorage.setItem('pos_sucursal_id', '1');
      localStorage.setItem('ali', '5');
      window.PRODS = [{ id: 42, inventario: true }];

      const originalGet  = window.supaGet;
      const originalPost = window.supaPost;
      const originalRpc  = window.supaRPC;
      const rpcCalls = [];
      window.supaGet  = function(){ return Promise.resolve([{ producto_id: 42, cantidad: 3 }]); };
      window.supaPost = function(tabla){
        if (tabla === 'stock_comprobantes') return Promise.resolve({ id: 1 });
        return Promise.resolve([]);
      };
      window.supaRPC = function(nombre, params){ rpcCalls.push({ nombre, params }); return Promise.resolve(); };

      await window.stockRevertirVenta([{ id: 42, qty: 2, name: 'Producto Test' }], 'ANUL-TEST-0001');

      window.supaGet  = originalGet;
      window.supaPost = originalPost;
      window.supaRPC  = originalRpc;

      return { rpcCalls };
    });

    const call = result.rpcCalls.find(c => c.nombre === 'revertir_stock_venta');
    expect(call).toBeTruthy();
    expect(call.params.p_deposito_id).toBe(1);
    expect(Array.isArray(call.params.p_items)).toBe(true);
    expect(call.params.p_items[0].producto_id).toBe(42);
    expect(call.params.p_items[0].cantidad).toBe(2);
  });

  test('si la RPC falla, cae al fallback de upsert clásico', async ({ page }) => {
    const result = await page.evaluate(async () => {
      localStorage.setItem('lic_email', 'test@test.com');
      localStorage.setItem('pos_deposito_id', '1');
      localStorage.setItem('pos_sucursal_id', '1');
      localStorage.setItem('ali', '5');
      window.PRODS = [{ id: 42, inventario: true }];

      const originalGet  = window.supaGet;
      const originalPost = window.supaPost;
      const originalRpc  = window.supaRPC;
      const postCalls = [];
      window.supaGet  = function(){ return Promise.resolve([{ producto_id: 42, cantidad: 3 }]); };
      window.supaPost = function(tabla, data){
        if (tabla === 'stock_comprobantes') return Promise.resolve({ id: 1 });
        if (tabla === 'stock') postCalls.push(data);
        return Promise.resolve([]);
      };
      window.supaRPC = function(){ return Promise.reject(new Error('RPC no disponible (simulado)')); };

      await window.stockRevertirVenta([{ id: 42, qty: 2, name: 'Producto Test' }], 'ANUL-TEST-0002');

      window.supaGet  = originalGet;
      window.supaPost = originalPost;
      window.supaRPC  = originalRpc;

      return { postCalls };
    });

    expect(result.postCalls.length).toBe(1);
    expect(result.postCalls[0].producto_id).toBe(42);
    expect(result.postCalls[0].cantidad).toBe(5); // antes(3) + qty(2), camino de fallback no atómico
  });
});
