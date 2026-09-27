// 26 — Reservas: calendario mensual (js/hospedaje.js).
// Punto de entrada nuevo pedido por Hotel Nico: reservar por FECHA primero
// (calendario del mes con % de ocupación por día) en vez de tener que
// encontrar antes la habitación libre. Complementa al calendario semanal
// ya existente (habitación x día), no lo reemplaza.
const { test, expect } = require('@playwright/test');

test.describe('Reservas — calendario mensual', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.clear(); } catch (e) {}
      try { sessionStorage.clear(); } catch (e) {}
    });
    await page.goto('/');
    await page.waitForFunction(() =>
      typeof window.abrirReservasMes === 'function'
      && typeof window.renderReservasMes === 'function'
      && typeof window.abrirHospDiaModal === 'function'
      && typeof window.abrirCheckIn === 'function'
    );
  });

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function hoyStr() {
    const d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  test('el grid del mes muestra la ocupación y abre el modal del día', async ({ page }) => {
    const hoy = hoyStr();
    await page.evaluate((hoy) => {
      window.hospHabitaciones = [
        { id: 1, numero: '101', tipo: 'individual', estado: 'libre' },
        { id: 2, numero: '102', tipo: 'individual', estado: 'libre' },
      ];
      window.hospEstadias = [
        { id: 'e1', habitacion_id: 1, huesped_nombre: 'Juan Perez', checkin: hoy, checkout_previsto: null, estado: 'en_estadia', tarifa_noche: 100000, cargos: [] },
      ];
      window.abrirReservasMes();
    }, hoy);

    await expect(page.locator('#scHospReservasMes')).toHaveClass(/active/);
    await expect(page.locator('#hospMesGrid button')).not.toHaveCount(0);

    // Abrir el día de hoy: 1 de 2 ocupadas
    await page.evaluate((hoy) => window.abrirHospDiaModal(hoy), hoy);
    await expect(page.locator('#hospDiaOv')).toBeVisible();
    await expect(page.locator('#hospDiaSub')).toContainText('1 de 2');

    const habCells = page.locator('#hospDiaGrid button');
    await expect(habCells).toHaveCount(2);
    await expect(habCells.nth(0)).toContainText('Juan Perez'); // 101 ocupada
    await expect(habCells.nth(1)).toContainText('Libre');      // 102 libre
  });

  test('tocar una habitación libre en el modal del día abre check-in con esa fecha prellenada', async ({ page }) => {
    const hoy = hoyStr();
    await page.evaluate((hoy) => {
      window.hospHabitaciones = [{ id: 1, numero: '101', tipo: 'individual', estado: 'libre' }];
      window.hospEstadias = [];
      window.abrirReservasMes();
      window.abrirHospDiaModal(hoy);
    }, hoy);

    await page.locator('#hospDiaGrid button').first().click();

    await expect(page.locator('#hospCheckinOv')).toBeVisible();
    await expect(page.locator('#hospDiaOv')).toBeHidden();
    await expect(page.locator('#hospCkCheckin')).toHaveValue(hoy);
    // Ambos botones disponibles: reservar para esa fecha, o check-in ya mismo
    await expect(page.locator('#hospCkBtnReservar')).toBeVisible();
    await expect(page.locator('#hospCkBtnGuardar')).toBeVisible();
  });

  test('tocar una habitación reservada en el modal del día abre el detalle de la reserva', async ({ page }) => {
    const hoy = hoyStr();
    await page.evaluate((hoy) => {
      window.hospHabitaciones = [{ id: 1, numero: '101', tipo: 'individual', estado: 'libre' }];
      window.hospEstadias = [
        { id: 'r1', habitacion_id: 1, huesped_nombre: 'Maria Gomez', checkin: hoy, checkout_previsto: null, estado: 'reservado', tarifa_noche: 150000, cargos: [] },
      ];
      window.abrirReservasMes();
      window.abrirHospDiaModal(hoy);
    }, hoy);

    await page.locator('#hospDiaGrid button').first().click();

    await expect(page.locator('#hospReservaOv')).toBeVisible();
    await expect(page.locator('#hospResTitulo')).toContainText('Maria Gomez');
  });

  // Regresión (Hotel Nico, reporte 2026-09-27): al reservar del 1/10 al
  // 30/10 desde el modal de día, el grid del mes quedaba con el conteo de
  // ANTES de guardar hasta salir y reentrar a la pantalla — _hospRefrescarVista()
  // no repintaba #hospMesGrid. Ver fix en _hospRefrescarVista() (js/hospedaje.js).
  test('crear una reserva larga desde el modal de día actualiza el grid del mes sin reentrar a la pantalla', async ({ page }) => {
    const r = await page.evaluate(async () => {
      localStorage.setItem('lic_email', 'test@test.com');
      localStorage.setItem('ali', '1');
      window.hospHabitaciones = [{ id: 1, numero: '101', tipo: 'individual', estado: 'libre', precio_noche: 200000 }];
      window.hospEstadias = [];
      window.supaPost = function (tabla, payload) { return Promise.resolve([{ ...payload, id: 'e1' }]); };

      window._hospMesRef = new Date(2026, 9, 1); // octubre 2026
      window.goTo('scHospReservasMes');
      window.renderReservasMes();
      const badgeAntes = document.querySelector('#hospMesGrid button[onclick*="2026-10-15"] .hosp-mes-day-badge').textContent;

      window.abrirHospDiaModal('2026-10-01');
      window.hospDiaTapHabitacion(1); // libre ese día -> abre check-in con fecha 2026-10-01
      document.getElementById('hospCkNombre').value = 'Reserva Larga';
      document.getElementById('hospCkCheckout').value = '2026-10-30';
      await window.confirmarCheckIn('reservado'); // dispara _hospRefrescarVista() al final

      const badgeDespues = document.querySelector('#hospMesGrid button[onclick*="2026-10-15"] .hosp-mes-day-badge').textContent;
      return { badgeAntes, badgeDespues };
    });

    expect(r.badgeAntes).toBe('0/1');
    expect(r.badgeDespues).toBe('1/1'); // sin llamar renderReservasMes() a mano: el fix lo hace solo
  });

  test('cerrarReservasMes() vuelve a Habitaciones', async ({ page }) => {
    await page.evaluate(() => {
      window.hospHabitaciones = [];
      window.hospEstadias = [];
      window.abrirReservasMes();
    });
    await expect(page.locator('#scHospReservasMes')).toHaveClass(/active/);

    await page.evaluate(() => window.cerrarReservasMes());
    await expect(page.locator('#scHabitaciones')).toHaveClass(/active/);
  });
});
