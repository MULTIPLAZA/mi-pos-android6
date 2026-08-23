// 24 — Regression: loadHotelDashData()/loadHotelDashDataPeriodo() (js/admin-
// dashboard.js, Hotel Dashboard -- la primera pantalla que ve el admin al
// loguearse) insertaban hab.numero/h.numero sin escapar en 2 lugares, aunque
// el propio archivo YA escapaba huesped_nombre en la misma línea (listaHtml()).
// numero es texto libre tipeado en guardarHabitacion() (js/hospedaje.js), sin
// ninguna restricción de caracteres -- mismo campo/mismo hueco ya arreglado en
// impresion.js (ver memoria project_mipos_habitacion_numero_xss_impresion),
// pero en un sink distinto (este dashboard) que no había sido revisado.
const { test, expect } = require('@playwright/test');

test.describe('Hotel Dashboard escapa hab.numero/h.numero', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin-negocio.html');
    await page.waitForFunction(
      () => typeof window.loadHotelDashData === 'function'
         && typeof window.loadHotelDashDataPeriodo === 'function'
         && typeof window._esc === 'function',
      { timeout: 8000 }
    );
  });

  test('loadHotelDashData() escapa hab.numero en la lista de check-ins (listaHtml)', async ({ page }) => {
    const html = await page.evaluate(async () => {
      SE = 'test@test.com'; // identificador suelto de admin-negocio.html, no window.SE

      document.body.insertAdjacentHTML('beforeend',
        '<div id="hkListaCheckin"></div><div id="hkListaCheckout"></div><div id="hkHabEstados"></div>');

      const originalSg = window.sg;
      window.sg = function(tabla){
        if (tabla === 'pos_habitaciones') {
          return Promise.resolve([{ id: 1, numero: '<img src=x onerror=window.__xss_hab=true>', tipo: 'individual', estado: 'libre', precio_noche: 100000 }]);
        }
        if (tabla === 'pos_estadias') {
          const hoy = new Date();
          const hoyStr = hoy.getFullYear() + '-' + String(hoy.getMonth()+1).padStart(2,'0') + '-' + String(hoy.getDate()).padStart(2,'0');
          return Promise.resolve([{ id: 10, habitacion_id: 1, huesped_nombre: 'Huesped Normal', checkin: hoyStr, checkout_previsto: hoyStr, tarifa_noche: 100000, estado: 'en_estadia' }]);
        }
        return Promise.resolve([]);
      };

      await window.loadHotelDashData();

      window.sg = originalSg;
      return document.getElementById('hkListaCheckin').innerHTML;
    });

    expect(html).not.toContain('<img src=x onerror');
    expect(html).toContain('&lt;img');
  });

  test('loadHotelDashDataPeriodo() escapa h.numero en el ranking de habitaciones', async ({ page }) => {
    const html = await page.evaluate(async () => {
      SE = 'test@test.com';

      document.body.insertAdjacentHTML('beforeend',
        '<div id="hkIngresoWrap"></div><div id="hkRankHab"></div><div id="hkDiaSemana"></div><div id="hkCanceladas"></div>');

      const originalSg = window.sg;
      const originalGetFD = window.getFD;
      window.getFD = function(){
        const hoy = new Date().toISOString().substring(0,10);
        return { d: hoy, h: hoy };
      };
      window.sg = function(tabla){
        if (tabla === 'pos_ventas') return Promise.resolve([]);
        if (tabla === 'pos_estadias') {
          return Promise.resolve([{ habitacion_id: 1, checkin: new Date().toISOString().substring(0,10), estado: 'en_estadia' }]);
        }
        if (tabla === 'pos_habitaciones') {
          return Promise.resolve([{ id: 1, numero: '<img src=y onerror=window.__xss_hab2=true>', tipo: 'individual' }]);
        }
        return Promise.resolve([]);
      };

      await window.loadHotelDashDataPeriodo('hoy');

      window.sg = originalSg;
      window.getFD = originalGetFD;
      return document.getElementById('hkRankHab').innerHTML;
    });

    expect(html).not.toContain('<img src=y onerror');
    expect(html).toContain('&lt;img');
  });
});
