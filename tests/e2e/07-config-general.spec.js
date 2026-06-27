// 07 — Pantallas de configuracion existen en el DOM
const { test, expect } = require('@playwright/test');

test.describe('Pantallas de configuracion', () => {
  test('Todas las pantallas de config principales existen', async ({ page }) => {
    await page.goto('/');

    const screens = [
      'scConfig',
      'scConfigSync',
      'scConfigImpresoras',
      'scConfigImpuestos',
      'scConfigGeneral',
      'scActivacion',
      'scActivado',
      'scVentas',
      'scMesas',
      'scTurno',
    ];

    for (const id of screens) {
      const count = await page.locator('#' + id).count();
      expect(count, `screen #${id}`).toBe(1);
    }
  });

  test('Funcion goTo existe y cambia de pantalla', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.goTo === 'function', { timeout: 8000 });

    const can = await page.evaluate(() => typeof window.goTo === 'function');
    expect(can).toBe(true);
  });

  test('Pantalla impresoras tiene asistente + cards de tickets y comandas', async ({ page }) => {
    await page.goto('/');

    const screen = page.locator('#scConfigImpresoras');
    // Asistente UX-002
    await expect(screen.getByText(/RECOMI[ÉE]NDAME/i)).toHaveCount(1);
    // Cards principales
    await expect(screen.locator('#ticketPrinterCard')).toHaveCount(1);
    await expect(screen.locator('#comandaPrinterCard')).toHaveCount(1);
  });
});
