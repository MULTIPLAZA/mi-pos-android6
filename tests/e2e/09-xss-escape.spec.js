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
});
