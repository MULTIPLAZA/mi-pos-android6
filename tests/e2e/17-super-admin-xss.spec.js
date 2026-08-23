// 17 — Regression: renderL()/renderCliente() (super-admin.html) insertaban el
// nombre de plan (l.planes.nombre, JOIN de PostgREST a la tabla `planes` de
// Supabase) sin escapar. `planes` no tiene proteccion de escritura propia (ver
// memoria project_mipos_supabase_rls_desactivado) -- mismo hueco que otros ya
// arreglados esta auditoria, pero esta vez en la pantalla que ve el DUEÑO
// (gestion de TODAS las licencias/tenants), no un tenant individual.
const { test, expect } = require('@playwright/test');

test.describe('XSS en super-admin.html (pNom sin escapar)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/super-admin.html');
    await page.waitForFunction(
      () => typeof window.renderL === 'function' && typeof window.esc === 'function',
      { timeout: 8000 }
    );
  });

  test('renderL() escapa el nombre de plan (l.planes.nombre)', async ({ page }) => {
    const result = await page.evaluate(() => {
      document.body.insertAdjacentHTML('beforeend', '<div id="licCount"></div><div id="licList"></div>');
      const lic = {
        id: 1, clave: 'TEST-XSS', nombre_cliente: 'Cliente Test', email_cliente: 'a@b.com',
        plan_id: 1, planes: { nombre: "<img src=x onerror=window.__xss_executed=true>" },
        activa: true, fecha_vence: null, _backend: 'supabase',
      };
      window.renderL([lic]);
      return document.getElementById('licList').innerHTML;
    });

    expect(result).not.toContain('<img src=x onerror');
    expect(result).toContain('&lt;img');
  });

  // buildTerCard() (usada por renderTer(), lista de terminales) insertaba
  // t.device_id sin esc(), solo truncado a 24 caracteres -- un payload corto
  // (ej. <img src=1 onerror=x()>, 23 caracteres) entra completo en ese limite.
  // device_id no tiene validacion de formato server-side (ni la RPC
  // activar_licencia, ni la tabla `activaciones` misma vía RLS-desactivado),
  // asi que un valor malicioso podia llegar sin pasar por licGetDeviceId().
  test('renderTer() escapa device_id (buildTerCard)', async ({ page }) => {
    const result = await page.evaluate(() => {
      document.body.insertAdjacentHTML('beforeend', '<div id="terCount"></div><div id="terList"></div>');
      const ter = {
        id: 1, email: 'a@b.com', nombre_negocio: 'Negocio Test', nombre_terminal: 'Caja 1',
        sucursal: 'Central', activa: true, modo: 'caja', ultima_consulta: null,
        device_id: '<img src=1 onerror=window.__xss_executed=true>resto-del-id',
        licencias: { planes: { nombre: 'Básico' } },
      };
      window.renderTer([ter]);
      return document.getElementById('terList').innerHTML;
    });

    expect(result).not.toContain('<img src=1 onerror');
    expect(result).toContain('&lt;img');
  });
});
