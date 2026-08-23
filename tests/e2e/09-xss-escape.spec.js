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
});
