// 06 — Helpers UI core: toast, esc (XSS), goTo
const { test, expect } = require('@playwright/test');

test.describe('Helpers UI core', () => {
  test('escapeHtml escapa correctamente <, >, ", \', &', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.escapeHtml === 'function', { timeout: 8000 });

    const cases = await page.evaluate(() => ({
      lt: window.escapeHtml('<script>'),
      gt: window.escapeHtml('foo>bar'),
      amp: window.escapeHtml('a&b'),
      quot: window.escapeHtml('say "hi"'),
      apos: window.escapeHtml("it's"),
      nullVal: window.escapeHtml(null),
      undef: window.escapeHtml(undefined),
      number: window.escapeHtml(123),
    }));

    expect(cases.lt).toBe('&lt;script&gt;');
    expect(cases.gt).toBe('foo&gt;bar');
    expect(cases.amp).toBe('a&amp;b');
    expect(cases.quot).toBe('say &quot;hi&quot;');
    expect(cases.apos).toBe('it&#39;s');
    expect(cases.nullVal).toBe('');
    expect(cases.undef).toBe('');
    expect(cases.number).toBe('123');
  });

  test('esc es alias de escapeHtml', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.esc === 'function', { timeout: 8000 });

    const sameRef = await page.evaluate(() => window.esc === window.escapeHtml);
    expect(sameRef).toBe(true);
  });

  test('toast() existe y muestra un mensaje en pantalla', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => typeof window.toast === 'function', { timeout: 8000 });

    await page.evaluate(() => window.toast('Mensaje de prueba'));
    // El toast normalmente aparece como elemento con clase .toast o similar
    const found = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('*'))
        .some((el) => /Mensaje de prueba/.test(el.textContent || ''));
    });
    expect(found).toBe(true);
  });
});
