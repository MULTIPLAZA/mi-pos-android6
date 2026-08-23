// 22 — Regression: fpConfirmar() (js/turno.js, emitir una factura post-cobro
// para una venta ya registrada sin factura) marcaba tiene_factura/factura_*
// solo en IndexedDB local -- nunca en Supabase. El número de factura SÍ se
// consumía del timbrado (avanzarNroFactura sincroniza correctamente) y se
// imprimía para el cliente, pero pos_ventas.tiene_factura/factura_numero/
// factura_timbrado en Supabase nunca reflejaban que esa venta tenía factura
// -- un hueco de cumplimiento fiscal real (Libro IVA/RG90 y cualquier
// reporte armado desde Supabase no verían esta factura), no solo de
// reporting interno. Mismo patrón ya arreglado en _anularVentaConfirmarInterno()
// (v1.16.102).
const { test, expect } = require('@playwright/test');

test.describe('fpConfirmar() persiste tiene_factura/factura_* en Supabase', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(
      () => typeof window.fpConfirmar === 'function' && typeof window.db !== 'undefined',
      { timeout: 8000 }
    );
  });

  test('llama supaPatch a pos_ventas con tiene_factura:true y los datos de la factura', async ({ page }) => {
    const result = await page.evaluate(async () => {
      localStorage.setItem('lic_email', 'test@test.com');

      const fechaVenta = '2026-08-23T15:30:00.000Z';
      const ventaId = await db.ventas.add({
        fecha: fechaVenta,
        total: 75000,
        metodo_pago: 'EFECTIVO',
        comprobante: 'TEST-0002',
        items: '[]',
        tiene_factura: false,
      });

      // DOM mínimo que fpConfirmar() lee directamente.
      document.body.insertAdjacentHTML('beforeend',
        '<input id="fpRuc" value="4123456-7">' +
        '<input id="fpNombre" value="Cliente de Prueba">' +
        '<input id="fpDir" value="">'
      );

      const originalGetTim = window.getTimbradoActivo;
      const originalAvanzar = window.avanzarNroFactura;
      const originalPatch = window.supaPatch;
      window.getTimbradoActivo = function () {
        return { nro: '12345678', sucursal: 1, punto_exp: 1, nro_actual: 42, tipo: 'autoimpresor' };
      };
      window.avanzarNroFactura = function () { return Promise.resolve(); }; // no es el foco de este test
      const patchCalls = [];
      window.supaPatch = function (tabla, filtro, data) { patchCalls.push({ tabla, filtro, data }); return Promise.resolve([]); };

      await window.fpConfirmar(ventaId);

      window.getTimbradoActivo = originalGetTim;
      window.avanzarNroFactura = originalAvanzar;
      window.supaPatch = originalPatch;

      const ventaLocal = await db.ventas.get(ventaId);
      return { patchCalls, tieneFacturaLocal: ventaLocal.tiene_factura };
    });

    expect(result.tieneFacturaLocal).toBe(1); // el fix no debe romper la parte local que ya funcionaba

    const facCall = result.patchCalls.find(c => c.tabla === 'pos_ventas' && c.data && c.data.tiene_factura === true);
    expect(facCall).toBeTruthy();
    expect(facCall.filtro).toContain('fecha=eq.');
    expect(facCall.filtro).toContain('2026-08-23');
    expect(facCall.data.factura_ruc).toBe('4123456-7');
    expect(facCall.data.factura_nombre).toBe('Cliente de Prueba');
    expect(facCall.data.factura_numero).toContain('001-001-0000042');
    expect(facCall.data.factura_timbrado).toBe('12345678');
  });
});
