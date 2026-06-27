// Playwright config — mi-pos
// Red de seguridad: 10 tests E2E sobre el flujo crítico del POS.
// Ejecutar: npm test  ·  Para debugging visual: npm run test:ui

const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30 * 1000,
  expect: { timeout: 5000 },
  fullyParallel: false, // El POS comparte estado (localStorage/Dexie); evitamos races
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'html',

  use: {
    baseURL: 'http://127.0.0.1:8000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 8000,
    navigationTimeout: 15000,
  },

  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } },
    },
    // Mobile: el POS tambien se usa en tablet/celular
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 5'] },
    },
  ],

  webServer: {
    command: 'npm run serve',
    url: 'http://127.0.0.1:8000',
    timeout: 60 * 1000,
    reuseExistingServer: !process.env.CI,
  },
});
