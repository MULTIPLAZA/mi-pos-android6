// 10 — Regression: navegacion de tickets restaura items correctamente
// Bug original: pressing arrow keys to navigate tickets didn't restore items
// Verificamos que las funciones de navegacion existen y que el patron _modoLectura
// esta presente en el codigo.
const { test, expect } = require('@playwright/test');

test.describe('Regression: navegacion tickets + mesa atascada', () => {
  test('Funcion navegarTicket existe en el codigo', async ({ request }) => {
    // navegarTicket(dir) es la funcion que mueve entre tickets con las flechas (linea 374 en ventas.js)
    const res = await request.get('/js/ventas.js');
    const body = await res.text();
    expect(body).toMatch(/function navegarTicket\s*\(/);
  });

  test('Variable _modoLectura existe en el codigo (proteccion mesa atascada)', async ({ request }) => {
    // Verificar en mesas.js o ventas.js que _modoLectura este presente
    const res = await request.get('/js/mesas.js');
    const body = await res.text();
    expect(body).toMatch(/_modoLectura/);
  });

  test('XSS escape aplicado en ventas.js (clienteNombre)', async ({ request }) => {
    const res = await request.get('/js/ventas.js');
    const body = await res.text();
    // Los 3 puntos parcheados en SEC-002
    const matches = body.match(/esc\(nomCli|esc\(t\.clienteNombre|esc\(_nomCliTab/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  test('XSS escape aplicado en admin-inventario.js (nombre_producto)', async ({ request }) => {
    const res = await request.get('/js/admin-inventario.js');
    const body = await res.text();
    const matches = body.match(/esc\(/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(8);
  });
});
