// 27 — Coherencia del ciclo de Reservas (js/hospedaje.js), a pedido de Hotel
// Nico tras sumar el calendario mensual (ver 26-hosp-reservas-mes.spec.js):
// reservas de varias noches, cancelación, conversión a check-in, pago antes
// (seña sobre una reserva) y pago después (checkout con saldo tras abonos
// parciales), y tarifa cargada en Gs vs en R$ (frontera PY/BR). Todo mockeando
// supaPost/supaPatch (mismo patrón que 21/22/23) — no depende de red real.
const { test, expect } = require('@playwright/test');

test.describe('Reservas — coherencia del ciclo completo', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.clear(); } catch (e) {}
      try { sessionStorage.clear(); } catch (e) {}
    });
    await page.goto('/');
    await page.waitForFunction(() =>
      typeof window.confirmarCheckIn === 'function'
      && typeof window.hospCancelarReserva === 'function'
      && typeof window.hospConvertirReservaEnCheckin === 'function'
      && typeof window.hospConfirmarAbonoMonto === 'function'
      && typeof window.checkOutFolio === 'function'
    );
    await page.evaluate(() => {
      localStorage.setItem('lic_email', 'test@test.com');
      localStorage.setItem('ali', '1');
    });
  });

  test('reserva de 3 noches ocupa esos días exactos en el calendario mensual y libera el día de checkout', async ({ page }) => {
    const r = await page.evaluate(async () => {
      window.hospHabitaciones = [{ id: 1, numero: '101', tipo: 'individual', estado: 'libre', precio_noche: 200000 }];
      window.hospEstadias = [];
      const posts = [];
      window.supaPost = function (tabla, payload) { posts.push(payload); return Promise.resolve([{ ...payload, id: 'e1' }]); };

      window.abrirCheckIn(1, '2026-09-10');
      document.getElementById('hospCkNombre').value = 'Carlos Diaz';
      document.getElementById('hospCkCheckout').value = '2026-09-13'; // 3 noches: 10, 11, 12
      await window.confirmarCheckIn('reservado');

      const cubre = (d) => window._hospHabitacionesEnFecha(d).length;
      return {
        posted: posts[0],
        dia10: cubre('2026-09-10'),
        dia11: cubre('2026-09-11'),
        dia12: cubre('2026-09-12'),
        dia13checkout: cubre('2026-09-13'),
        estadias: window.hospEstadias.length,
      };
    });

    expect(r.posted.estado).toBe('reservado');
    expect(r.posted.total).toBe(0); // reserva no cobra nada hasta el check-in real
    expect(r.estadias).toBe(1);
    expect(r.dia10).toBe(1);
    expect(r.dia11).toBe(1);
    expect(r.dia12).toBe(1);
    expect(r.dia13checkout).toBe(0); // el día de checkout ya no cuenta como ocupado

    // El grid mensual refleja lo mismo que la consulta directa
    await page.evaluate(() => {
      window._hospMesRef = new Date(2026, 8, 1); // setiembre 2026
      window.renderReservasMes();
    });
    await expect(page.locator('#hospMesGrid button[onclick*="2026-09-10"] .hosp-mes-day-badge')).toHaveText('1/1');
    await expect(page.locator('#hospMesGrid button[onclick*="2026-09-12"] .hosp-mes-day-badge')).toHaveText('1/1');
    await expect(page.locator('#hospMesGrid button[onclick*="2026-09-13"] .hosp-mes-day-badge')).toHaveText('0/1');
  });

  test('overbooking: avisa la superposición y respeta la decisión del recepcionista (cancelar vs confirmar igual)', async ({ page }) => {
    const r = await page.evaluate(async () => {
      window.hospHabitaciones = [{ id: 1, numero: '101', tipo: 'individual', estado: 'libre', precio_noche: 200000 }];
      window.hospEstadias = [{
        id: 'r1', habitacion_id: 1, huesped_nombre: 'Reserva Previa',
        checkin: '2026-09-10', checkout_previsto: '2026-09-13', estado: 'reservado',
        tarifa_noche: 200000, cargos: [], total: 0,
      }];
      window.supaPost = function (tabla, payload) { return Promise.resolve([{ ...payload, id: 'e2' }]); };

      const confirmMsgs = [];
      window.confirm = function (msg) { confirmMsgs.push(msg); return false; }; // el recepcionista CANCELA

      window.abrirCheckIn(1, '2026-09-12'); // se superpone con la reserva previa (10-13)
      document.getElementById('hospCkNombre').value = 'Otro Huesped';
      document.getElementById('hospCkCheckout').value = '2026-09-14';
      await window.confirmarCheckIn('reservado');
      const trasCancelar = window.hospEstadias.length;

      window.confirm = function () { return true; }; // esta vez CONFIRMA el overbooking a sabiendas
      window.abrirCheckIn(1, '2026-09-12');
      document.getElementById('hospCkNombre').value = 'Otro Huesped';
      document.getElementById('hospCkCheckout').value = '2026-09-14';
      await window.confirmarCheckIn('reservado');
      const trasConfirmar = window.hospEstadias.length;

      return { confirmMsgs, trasCancelar, trasConfirmar };
    });

    expect(r.confirmMsgs[0]).toContain('Reserva Previa');
    expect(r.trasCancelar).toBe(1); // no se agregó ninguna reserva nueva
    expect(r.trasConfirmar).toBe(2); // esta vez sí, el recepcionista asumió el overbooking
  });

  test('cancelar reserva: persiste estado=cancelado y libera el calendario', async ({ page }) => {
    const r = await page.evaluate(async () => {
      window.hospHabitaciones = [{ id: 1, numero: '101', tipo: 'individual', estado: 'libre' }];
      window.hospEstadias = [{
        id: 'r1', habitacion_id: 1, huesped_nombre: 'Ana Lopez',
        checkin: '2026-09-20', checkout_previsto: '2026-09-22', estado: 'reservado',
        tarifa_noche: 150000, cargos: [], total: 0,
      }];
      const patches = [];
      window.supaPatch = function (tabla, filtro, data) { patches.push({ tabla, filtro, data }); return Promise.resolve([]); };
      window.confirm = function () { return true; };

      window.abrirReserva('r1');
      await window.hospCancelarReserva();

      return {
        patches,
        quedaEnMemoria: window.hospEstadias.some(e => e.id === 'r1'),
        ocupaDia21: window._hospHabitacionesEnFecha('2026-09-21').length,
      };
    });

    const patch = r.patches.find(p => p.tabla === 'pos_estadias' && p.data && p.data.estado === 'cancelado');
    expect(patch).toBeTruthy();
    expect(patch.filtro).toContain('id=eq.r1');
    expect(r.quedaEnMemoria).toBe(false);
    expect(r.ocupaDia21).toBe(0);
  });

  test('convertir reserva en check-in: carga la primera noche y persiste en_estadia', async ({ page }) => {
    const r = await page.evaluate(async () => {
      window.hospHabitaciones = [{ id: 1, numero: '202', tipo: 'matrimonial', estado: 'libre' }];
      window.hospEstadias = [{
        id: 'r2', habitacion_id: 1, huesped_nombre: 'Familia Gomez',
        checkin: '2026-09-27', checkout_previsto: null, estado: 'reservado',
        tarifa_noche: 350000, modalidad: 'noche', cargos: [], total: 0,
      }];
      const patches = [];
      window.supaPatch = function (tabla, filtro, data) { patches.push({ tabla, filtro, data }); return Promise.resolve([]); };

      window.abrirReserva('r2');
      await window.hospConvertirReservaEnCheckin();

      const est = window.hospEstadias.find(e => e.id === 'r2');
      return { patches, estado: est.estado, total: est.total, cargos: est.cargos };
    });

    expect(r.estado).toBe('en_estadia');
    expect(r.total).toBe(350000);
    expect(r.cargos.length).toBe(1);
    expect(r.cargos[0].monto).toBe(350000);
    const patch = r.patches.find(p => p.data && p.data.estado === 'en_estadia');
    expect(patch).toBeTruthy();
    expect(patch.data.total).toBe(350000);
  });

  test('tarifa tipeada en R$ se guarda en Gs con el mismo resultado que tipearla directo en Gs', async ({ page }) => {
    const r = await page.evaluate(async () => {
      localStorage.setItem('mm_cotBRL', '1300'); // 1 R$ = 1.300 Gs
      window.hospHabitaciones = [
        { id: 1, numero: '101', tipo: 'individual', estado: 'libre', precio_noche: 200000 },
        { id: 2, numero: '102', tipo: 'individual', estado: 'libre', precio_noche: 200000 },
      ];
      window.hospEstadias = [];
      const posts = []; // supaPost también se llama para 'pos_huespedes' (registro de huésped) — filtrar por tabla
      window.supaPost = function (tabla, payload) { posts.push({ tabla, payload }); return Promise.resolve([{ ...payload, id: 'e' + posts.length }]); };
      const postsEstadia = () => posts.filter(p => p.tabla === 'pos_estadias').map(p => p.payload);

      // Check-in 1: tarifa tipeada en REALES
      window.abrirCheckIn(1);
      window.hospCkSetMonedaTarifa('brl');
      document.getElementById('hospCkNombre').value = 'Huesped Reales';
      document.getElementById('hospCkTarifa').value = '100'; // R$ 100
      await window.confirmarCheckIn('en_estadia');

      // Check-in 2: tarifa tipeada directo en GUARANIES (100 * 1300 = 130000)
      window.abrirCheckIn(2);
      window.hospCkSetMonedaTarifa('gs');
      document.getElementById('hospCkNombre').value = 'Huesped Guaranies';
      document.getElementById('hospCkTarifa').value = '130000';
      await window.confirmarCheckIn('en_estadia');

      const [estadia1, estadia2] = postsEstadia();
      return { tarifaReales: estadia1.tarifa_noche, tarifaGs: estadia2.tarifa_noche, cargoReales: estadia1.cargos[0].monto };
    });

    expect(r.tarifaReales).toBe(130000);
    expect(r.tarifaGs).toBe(130000);
    expect(r.tarifaReales).toBe(r.tarifaGs); // misma tarifa real, sin importar en qué moneda se tipeó
    expect(r.cargoReales).toBe(130000); // el primer cargo (noche) también queda en Gs
  });

  test('pago ANTES del check-in (seña sobre una reserva) reduce el saldo pendiente', async ({ page }) => {
    const r = await page.evaluate(async () => {
      window.hospHabitaciones = [{ id: 1, numero: '101', tipo: 'individual', estado: 'libre' }];
      window.hospEstadias = [{
        id: 'r3', habitacion_id: 1, huesped_nombre: 'Seña Adelantada',
        checkin: '2026-10-01', checkout_previsto: '2026-10-04', estado: 'reservado', // 3 noches
        tarifa_noche: 200000, cargos: [], total: 0, abonos: [],
      }];
      const patches = [];
      window.supaPatch = function (tabla, filtro, data) { patches.push({ tabla, filtro, data }); return Promise.resolve([]); };

      window.abrirReserva('r3');
      window.hospAbrirAbonoReserva();
      const saldoInicial = document.getElementById('hospAbonoSaldo').textContent; // 3 noches * 200000 = 600000
      document.getElementById('hospAbonoMonto').value = '200000'; // paga 1 noche por adelantado
      window.hospConfirmarAbonoMonto();
      const hookAbono = window._hospedajeEstadiaAbono;
      const cartTrasAbono = window.cart.map(i => ({ name: i.name, price: i.price }));

      // Esto es lo que turno.js llama DESPUÉS de confirmar el cobro real:
      await window.hospedajeRegistrarAbonoTrasVenta(hookAbono.estadiaId, hookAbono.monto, 'COMP-001');

      const est = window.hospEstadias.find(e => e.id === 'r3');
      return {
        saldoInicial, hookAbono, cartTrasAbono,
        pagado: window._hospTotalPagado(est),
        abonos: est.abonos,
        patches,
      };
    });

    expect(r.saldoInicial).toContain('600');
    expect(r.hookAbono.monto).toBe(200000);
    expect(r.cartTrasAbono[0].price).toBe(200000);
    expect(r.pagado).toBe(200000);
    expect(r.abonos.length).toBe(1);
    expect(r.abonos[0].comprobante).toBe('COMP-001');
    const patch = r.patches.find(p => p.data && p.data.abonos);
    expect(patch).toBeTruthy();
    expect(patch.data.abonos[0].monto).toBe(200000);
  });

  test('pago DESPUÉS (checkout) descuenta los abonos ya cobrados y liquida la estadía', async ({ page }) => {
    const r = await page.evaluate(async () => {
      window.hospHabitaciones = [{ id: 1, numero: '303', tipo: 'triplo', estado: 'ocupada' }];
      window.hospEstadias = [{
        id: 'e9', habitacion_id: 1, huesped_nombre: 'Cuenta Final',
        checkin: '2026-10-05', checkout_previsto: '2026-10-08', estado: 'en_estadia',
        tarifa_noche: 100000,
        cargos: [
          { fecha: '2026-10-05', descripcion: 'Noche — Hab. 303', cantidad: 1, precio_unitario: 100000, monto: 100000, iva: '10' },
          { fecha: '2026-10-06', descripcion: 'Noche — Hab. 303', cantidad: 1, precio_unitario: 100000, monto: 100000, iva: '10' },
          { fecha: '2026-10-07', descripcion: 'Noche — Hab. 303', cantidad: 1, precio_unitario: 100000, monto: 100000, iva: '10' },
        ],
        total: 300000,
        abonos: [{ fecha: '2026-10-05', monto: 100000, comprobante: 'COMP-000' }], // ya pagó 1 noche por adelantado
      }];
      window.cart = [];
      const patches = [];
      window.supaPatch = function (tabla, filtro, data) { patches.push({ tabla, filtro, data }); return Promise.resolve([]); };

      window.abrirFolio('e9');
      await window.checkOutFolio();

      const cartFinal = window.cart.map(i => ({ name: i.name, price: i.price, esDescuento: !!i.esDescuento }));
      const saldoACobrar = cartFinal.reduce((s, i) => s + i.price, 0);

      // Simular que turno.js confirmó el cobro del saldo:
      await window.hospedajeLiquidarEstadiaTrasVenta('e9', 'COMP-FINAL');

      return {
        cartFinal, saldoACobrar,
        estadiaSigueAbierta: window.hospEstadias.some(e => e.id === 'e9'),
        habEstado: window.hospHabitaciones.find(h => h.id === 1).estado,
        patches,
      };
    });

    expect(r.cartFinal.length).toBe(4); // 3 noches + 1 línea de descuento por el abono
    const descuento = r.cartFinal.find(i => i.esDescuento);
    expect(descuento.price).toBe(-100000);
    expect(r.saldoACobrar).toBe(200000); // 300000 - 100000 ya pagado = saldo real a cobrar ahora

    expect(r.estadiaSigueAbierta).toBe(false); // se liquidó y se sacó de memoria
    expect(r.habEstado).toBe('limpieza'); // se libera a limpieza, no directo a libre
    const patchEstadia = r.patches.find(p => p.tabla === 'pos_estadias' && p.data && p.data.estado === 'checkout');
    expect(patchEstadia).toBeTruthy();
    expect(patchEstadia.data.comprobante_venta).toBe('COMP-FINAL');
  });
});
