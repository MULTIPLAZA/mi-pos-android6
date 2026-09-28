// 28 — Tab lock (js/init.js): evita que el POS quede abierto 2 veces en el
// mismo dispositivo (2 pestañas del mismo navegador/tablet). Pedido real:
// un empleado abre el sistema en 2 pestañas por error y se confunde entre
// las dos — cobra en una, ve el turno/carrito viejo en la otra.
// NO debe afectar a otros dispositivos del negocio (localStorage es por
// dispositivo) — eso no se prueba acá porque Playwright ya aísla contexts
// distintos con storage distinto, que es justo el caso que NO debe bloquear.
const { test, expect } = require('@playwright/test');

test.describe('Tab lock — evita 2 pestañas del POS a la vez en el mismo dispositivo', () => {
  test('la 2da pestaña en el mismo dispositivo muestra el aviso; la 1ra sigue normal', async ({ context }) => {
    const page1 = await context.newPage();
    await page1.goto('/');
    await page1.waitForFunction(() => typeof window._tabLockTryAcquire === 'function');
    await expect.poll(() => page1.evaluate(() => window._tabLockIsMine())).toBe(true);
    await expect(page1.locator('#scPestanaDup')).toBeHidden();

    const page2 = await context.newPage();
    await page2.goto('/');
    await expect(page2.locator('#scPestanaDup')).toBeVisible({ timeout: 5000 });
    const p2EsDueña = await page2.evaluate(() => window._tabLockIsMine());
    expect(p2EsDueña).toBe(false);
    // La 1ra pestaña no se entera de nada — sigue siendo la dueña.
    const p1SigueSiendoDueña = await page1.evaluate(() => window._tabLockIsMine());
    expect(p1SigueSiendoDueña).toBe(true);

    await page1.close();
    await page2.close();
  });

  test('cerrando la 1ra pestaña, la 2da recupera el control sola (sin tocar nada)', async ({ context }) => {
    const page1 = await context.newPage();
    await page1.goto('/');
    await page1.waitForFunction(() => typeof window._tabLockTryAcquire === 'function');

    const page2 = await context.newPage();
    await page2.goto('/');
    await expect(page2.locator('#scPestanaDup')).toBeVisible();

    await page1.close(); // dispara pagehide/beforeunload -> libera el lock en localStorage

    // page2 sondea cada 2s; al ver el lock libre, se auto-recarga y arranca.
    await page2.waitForFunction(
      () => document.getElementById('scPestanaDup').style.display !== 'flex',
      { timeout: 8000 }
    );
    await page2.waitForFunction(() => typeof window._tabLockIsMine === 'function');
    const p2EsDueñaAhora = await page2.evaluate(() => window._tabLockIsMine());
    expect(p2EsDueñaAhora).toBe(true);
  });

  test('botón "Continuar igual acá" fuerza el control manualmente', async ({ context }) => {
    const page1 = await context.newPage();
    await page1.goto('/');
    await page1.waitForFunction(() => typeof window._tabLockTryAcquire === 'function');

    const page2 = await context.newPage();
    await page2.goto('/');
    await expect(page2.locator('#scPestanaDup')).toBeVisible();

    await page2.getByText('Continuar igual acá').click();
    await page2.waitForFunction(() => typeof window._tabLockIsMine === 'function');
    const p2EsDueñaAhora = await page2.evaluate(() => window._tabLockIsMine());
    expect(p2EsDueñaAhora).toBe(true);
  });
});
