// 03 — Pantalla config impresoras + asistente UX-002
// Test del wizard que recomienda BT / PC / USB Local segun dispositivo
const { test, expect } = require('@playwright/test');

// Inyectar estado de licencia mock para poder navegar
async function bypassLicencia(page) {
  await page.addInitScript(() => {
    try { localStorage.clear(); } catch (e) {}
    // Marcar licencia como activa para que init no muestre scActivacion
    localStorage.setItem('ali', '1');
    localStorage.setItem('alc', 'TEST-CLAVE-1234');
    localStorage.setItem('ale', 'test@example.com');
    localStorage.setItem('alm', 'demo');
    localStorage.setItem('aln', 'Test Negocio');
    localStorage.setItem('als', 'Sucursal Test');
    localStorage.setItem('ald', '1');
  });
}

test.describe('Config Impresoras + Asistente UX-002', () => {
  test('Pantalla scConfigImpresoras existe en el DOM', async ({ page }) => {
    await bypassLicencia(page);
    await page.goto('/');
    const screen = page.locator('#scConfigImpresoras');
    await expect(screen).toHaveCount(1);
  });

  test('Funcion asistenteImpresora esta disponible globalmente', async ({ page }) => {
    await bypassLicencia(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const exists = await page.evaluate(() => typeof window.asistenteImpresora === 'function');
    expect(exists).toBe(true);
  });

  test('Asistente abre modal con recomendacion', async ({ page }) => {
    await bypassLicencia(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => typeof window.asistenteImpresora === 'function', { timeout: 8000 });

    await page.evaluate(() => window.asistenteImpresora('ticket'));

    const modal = page.locator('#modalAsistenteImp');
    await expect(modal).toBeVisible({ timeout: 3000 });
    await expect(modal).toContainText(/Te recomendamos/i);
  });

  test('Cancelar cierra el modal del asistente', async ({ page }) => {
    await bypassLicencia(page);
    await page.goto('/');
    await page.waitForFunction(() => typeof window.asistenteImpresora === 'function', { timeout: 8000 });
    await page.evaluate(() => window.asistenteImpresora('ticket'));

    const modal = page.locator('#modalAsistenteImp');
    await expect(modal).toBeVisible();

    await modal.getByText(/Cancelar/i).click();
    await expect(modal).toHaveCount(0);
  });
});
