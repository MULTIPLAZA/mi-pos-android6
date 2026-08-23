// 09 — Regression test SEC-002: XSS via escape de HTML en renders dinamicos
// Verifica que un payload XSS no se inyecte como HTML real cuando pasa por esc()
const { test, expect } = require('@playwright/test');

test.describe('XSS escape (SEC-002)', () => {
  test('esc() neutraliza payload <img onerror=alert>', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.esc === 'function', { timeout: 8000 });

    const escaped = await page.evaluate(() => window.esc("<img src=x onerror=alert('XSS')>"));
    // Lo critico: < y > estan escapados → no se interpreta como tag HTML real
    expect(escaped).not.toContain('<img');
    expect(escaped).toContain('&lt;img');
    expect(escaped).not.toContain('<');
    expect(escaped).not.toContain('>');
    // Las comillas tambien deben estar escapadas para que no rompa atributos
    expect(escaped).toContain('&#39;');
  });

  test('esc() neutraliza payload <script>', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.esc === 'function', { timeout: 8000 });

    const escaped = await page.evaluate(() => window.esc('<script>document.title="hacked"</script>'));
    expect(escaped).not.toContain('<script>');
    expect(escaped).toContain('&lt;script&gt;');
  });

  test('Insertar nombre con HTML en innerHTML usando esc no ejecuta', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.esc === 'function', { timeout: 8000 });

    // Simular el patron usado en admin-inventario.js: '<div>'+esc(it.nombre_producto)+'</div>'
    const result = await page.evaluate(() => {
      const payload = "<img src=x onerror=window.__xss_executed=true>";
      const div = document.createElement('div');
      div.innerHTML = '<span>' + window.esc(payload) + '</span>';
      document.body.appendChild(div);

      // Pequeña espera para que el evento onerror se hubiera ejecutado SI hubiera funcionado
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            executed: !!window.__xss_executed,
            html: div.innerHTML,
          });
          div.remove();
        }, 200);
      });
    });

    expect(result.executed).toBe(false);
    expect(result.html).toContain('&lt;img');
  });

  // Regression tests puntuales sobre las plantillas de impresión (impresion.js)
  // — a diferencia de los 3 tests de arriba (que solo verifican que esc() en
  // sí funciona), estos llaman a las funciones reales que generan el HTML
  // impreso, para que un futuro cambio que vuelva a olvidar el esc() en un
  // campo de texto libre lo agarre este test y no un usuario en producción.
  // Ambos campos fueron hallazgos reales de la auditoría 2026-08-23 (ver
  // memoria del proyecto): la descripción de un egreso de caja y la
  // descripción de un consumo de hospedaje (ambos texto libre tipeado por
  // el cajero — el segundo llega incluso vía la función "item libre" de
  // productos.js) se imprimían sin escapar antes del fix de v1.16.64.
  test('generarHTMLCierreTurno() escapa la descripción de un egreso', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.generarHTMLCierreTurno === 'function', { timeout: 8000 });

    const html = await page.evaluate(() => {
      const data = {
        efInicial: 0, totalVentas: 0, cantVentas: 0, totalIngresos: 0, totalEgresos: 100,
        egresos: [{ desc: "<img src=x onerror=window.__xss_executed=true>", monto: 100 }],
      };
      return window.generarHTMLCierreTurno(data, '58');
    });

    expect(html).not.toContain('<img src=x onerror');
    expect(html).toContain('&lt;img');
  });

  test('generarHTMLComprobanteCuenta() escapa la descripción de un cargo (consumo item libre)', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.generarHTMLComprobanteCuenta === 'function', { timeout: 8000 });

    const html = await page.evaluate(() => {
      const estadia = {
        huesped_nombre: 'Huésped de prueba',
        checkin: '2026-08-01',
        total: 50000,
        cargos: [{ descripcion: "<img src=x onerror=window.__xss_executed=true>", monto: 50000, cantidad: 1 }],
      };
      return window.generarHTMLComprobanteCuenta(estadia, null, '58');
    });

    expect(html).not.toContain('<img src=x onerror');
    expect(html).toContain('&lt;img');
  });

  // Hallazgo real de la auditoría 2026-08-23: generarHTMLComprobanteCheckIn()
  // y generarHTMLComprobanteCuenta() (js/impresion.js) escapaban casi todos
  // los campos de la estadía, pero NO habitacion.numero -- a diferencia de
  // hospedaje.js, que SÍ lo escapa en cada innerHTML. Esto es explotable de
  // verdad: imprimirAndroidNativo() (mismo archivo) hace tmp.innerHTML=... con
  // este HTML para convertirlo a comandos ESC/POS, así que un <img onerror>
  // en habitacion.numero se ejecutaba en el momento de imprimir un
  // comprobante de check-in o de cuenta -- el path de impresión nativa de
  // Android, el uso real de este fork.
  test('generarHTMLComprobanteCheckIn() escapa habitacion.numero', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.generarHTMLComprobanteCheckIn === 'function', { timeout: 8000 });

    const html = await page.evaluate(() => {
      const estadia = { huesped_nombre: 'Huésped de prueba', checkin: '2026-08-01', estado: 'checkin' };
      const habitacion = { numero: "<img src=x onerror=window.__xss_executed=true>" };
      return window.generarHTMLComprobanteCheckIn(estadia, habitacion, '58');
    });

    expect(html).not.toContain('<img src=x onerror');
    expect(html).toContain('&lt;img');
  });

  test('generarHTMLComprobanteCuenta() escapa habitacion.numero', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.generarHTMLComprobanteCuenta === 'function', { timeout: 8000 });

    const html = await page.evaluate(() => {
      const estadia = { huesped_nombre: 'Huésped de prueba', checkin: '2026-08-01', total: 50000, cargos: [] };
      const habitacion = { numero: "<img src=x onerror=window.__xss_executed=true>" };
      return window.generarHTMLComprobanteCuenta(estadia, habitacion, '58');
    });

    expect(html).not.toContain('<img src=x onerror');
    expect(html).toContain('&lt;img');
  });

  // Hallazgo real de la auditoría 2026-08-23: generarHTMLComanda() (js/impresion.js,
  // ticket de comanda para cocina) insertaba data.mesa sin escapar en el
  // "*** MESA X ***" del encabezado -- a diferencia de generarHTMLTicket() y
  // generarHTMLFactura() (mismo archivo), que SÍ lo escapan. mesa.nombre viene
  // de mesas.js (guardarMesa), texto libre hasta 30 caracteres sin protección
  // de escritura propia en Supabase. Mismo sink real que habitacion.numero:
  // imprimirAndroidNativo() parsea este HTML via innerHTML=.
  test('generarHTMLComanda() escapa data.mesa', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.generarHTMLComanda === 'function', { timeout: 8000 });

    const html = await page.evaluate(() => {
      const data = {
        fecha: new Date(), nroTicket: 1, tipoPedido: 'local',
        mesa: "<img src=x onerror=window.__xss_executed=true>",
        items: [{ name: 'Producto test', qty: 1, comanda: true }],
      };
      return window.generarHTMLComanda(data, '58');
    });

    // data.mesa se pasa por .toUpperCase() ANTES de esc() (así el label sale
    // en mayúsculas como el resto de "*** MESA X ***"), así que el escapado
    // también queda en mayúsculas -- &lt;IMG, no &lt;img.
    expect(html).not.toContain('<img src=x onerror');
    expect(html).toContain('&lt;IMG');
  });

  // Hallazgo real de la auditoría 2026-08-23: _renderFlujoSheet() (js/productos.js,
  // flujo de mitades/modificadores obligatorios al agregar un producto al carrito)
  // escapaba el nombre de cada OPCIÓN de modificador (o.nombre) pero no el nombre
  // del MODIFICADOR mismo (m.nombre) -- ambos vienen de pos_modificadores, tabla
  // sincronizada por Supabase sin RLS (ver memoria project_mipos_supabase_rls_desactivado),
  // así que cualquiera con el anon key público podía escribir un nombre de
  // modificador malicioso que se ejecutaba en la sesión de CUALQUIER cajera del
  // tenant apenas tocara un producto con ese modificador obligatorio.
  test('_renderFlujoSheet() escapa el nombre del modificador (no solo el de sus opciones)', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.abrirFlujoPizza === 'function' && typeof window._renderFlujoSheet === 'function', { timeout: 8000 });

    const result = await page.evaluate(() => {
      window.modificadores = [{
        id: 1,
        nombre: "<img src=x onerror=window.__xss_executed=true>",
        tipo: 'unico',
        obligatorio: true,
        opciones: [{ id: 1, nombre: 'Opción normal', precio_adicional: 0 }],
        productos: [999],
      }];
      window.abrirFlujoPizza({ id: 999, name: 'Producto de prueba', price: 1000 }, true);
      _flujo.paso = 3; // saltar directo al paso de modificadores
      window._renderFlujoSheet();
      return document.getElementById('modifSheetBody').innerHTML;
    });

    expect(result).not.toContain('<img src=x onerror');
    expect(result).toContain('&lt;img');
  });

  // Otro hallazgo real de la misma auditoría 2026-08-23: renderCajasData()
  // (js/admin-dashboard.js, panel "Cierres de Caja" del admin) escapaba
  // c.nombre_operador con _esc() en el bloque de turnos CERRADOS pero no en
  // el bloque de turnos EN CURSO (mismo campo, mismo origen: pos_turno,
  // sincronizada por Supabase sin RLS) -- el admin viendo un turno abierto
  // ejecutaba el payload en su propia sesión.
  test('renderCajasData() escapa nombre_operador de un turno EN CURSO', async ({ page }) => {
    await page.goto('/admin-negocio.html');
    await page.waitForFunction(() => typeof window.renderCajasData === 'function', { timeout: 8000 });

    const result = await page.evaluate(() => {
      // DOM mínimo que renderCajasData() necesita (normalmente lo arma otra
      // función al abrir la sección "Cajas" del admin).
      document.body.insertAdjacentHTML('beforeend',
        '<div id="cjA"></div><div id="cjC"></div><div id="cjT"></div><div id="cjALive"></div><div id="cajasBody"></div>');

      // OJO: admin-negocio.html declara `let allCjs=[]` a nivel de pagina (linea
      // ~313) -- eso vive en el lexical scope global, SEPARADO de `window.allCjs`.
      // Asignar window.allCjs no lo toca; hay que reasignar el identificador
      // suelto para que renderCajasData() (que lee `allCjs` sin `window.`) lo vea.
      allCjs = [{
        estado: 'abierto',
        terminal: 'Caja 1',
        fecha_apertura: new Date().toISOString(),
        total_vendido: 10000,
        cantidad_ventas: 1,
        efectivo_inicial: 0,
        nombre_operador: "<img src=x onerror=window.__xss_executed=true>",
      }];
      window.renderCajasData();
      return document.getElementById('cajasBody').innerHTML;
    });

    expect(result).not.toContain('<img src=x onerror');
    expect(result).toContain('&lt;img');
  });

  // Hallazgo probablemente el más expuesto de toda la auditoría: openCat()
  // (js/app.js, selector de categoría de la pantalla principal de venta --
  // la pantalla que más ve una cajera en el uso normal del POS) insertaba
  // el nombre Y el color de cada categoría (pos_categorias, sincronizada por
  // Supabase sin RLS) sin escapar. El nombre es contenido de elemento (XSS
  // directo); el color se usa dentro de un atributo style="..." -- una
  // comilla en el valor rompe el atributo e inyecta uno nuevo (ej.
  // onmouseover). Cualquiera con el anon key público podía escribir un
  // nombre/color de categoría malicioso que se ejecutaba en la sesión de
  // CUALQUIER cajera apenas abriera el selector de categorías.
  test('openCat() escapa nombre Y color de categoría', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.openCat === 'function', { timeout: 8000 });

    const result = await page.evaluate(() => {
      window.CATEGORIAS = [{
        nombre: "<img src=x onerror=window.__xss_executed=true>",
        color: '"><img src=x onerror=window.__xss_executed_color=true>',
      }];
      window.openCat();
      return document.getElementById('catSheetContent').innerHTML;
    });

    expect(result).not.toContain('<img src=x onerror');
    expect(result).toContain('&lt;img');
  });
});
