# Tests E2E — mi-pos

Red de seguridad con **Playwright** sobre el POS. Detecta regresiones antes de que lleguen a producción.

## Ejecutar

```bash
npm install              # primera vez
npx playwright install   # navegadores headless
npm test                 # corre todos los tests
npm run test:ui          # modo interactivo (para debugging)
npm run test:headed      # ver el browser mientras corre
npm run test:report      # ver reporte HTML del último run
```

El servidor estático arranca automáticamente en `127.0.0.1:8000` vía `webServer` en `playwright.config.js`.

## Estructura

```
tests/e2e/
  ├── 01-smoke.spec.js          ← App carga, manifest, SW
  ├── 02-activacion.spec.js     ← Pantalla de activación visible para licencia nueva
  ├── 03-config-impresoras.spec.js ← Asistente impresoras + botones
  ├── 04-pwa.spec.js            ← Service Worker + manifest válido
  ├── 05-licencia-validacion.spec.js ← Form valida email/clave vacíos
  ├── 06-ui-componentes.spec.js ← Componentes UI core funcionan (toasts, modales)
  ├── 07-config-general.spec.js ← Pantalla config general accesible
  ├── 08-admin.spec.js          ← Panel admin (admin-negocio.html) carga
  ├── 09-xss-escape.spec.js     ← esc() escapa bien + regression de XSS reales ya arreglados
  ├── 10-regression-mesa.spec.js ← Mesa atascada — regression test del fix
  ├── 11-arch-esm.spec.js       ← Módulos ESM (lib/*.mjs) cargan y exponen sus globals
  ├── 12-banner-timbrado-regression.spec.js ← Banner "sin timbrado" no tapa el header (BUG-09)
  ├── 13-timbrado-vigencia.spec.js ← _timbradoEstaVigente() rechaza timbrado con vig_ini futuro
  ├── 14-limpieza-tenant-anterior.spec.js ← limpiarCacheTenantAnterior() vacía TODAS las colas/estado del tenant anterior (fix v1.16.60 + v1.16.78)
  ├── 15-filtro-tenant-sync-queue.spec.js ← Filtros tenant-seguros de la cola offline (fix v1.16.58/v1.16.59)
  ├── 16-device-id-random.spec.js ← device_id usa CSPRNG (getRandomValues) incluso sin crypto.randomUUID
  ├── 17-super-admin-xss.spec.js ← XSS en super-admin.html (nombre de plan, device_id sin escapar)
  ├── 18-guardar-asignacion-persiste.spec.js ← guardarAsignacion() persiste el cambio de categoría (no solo memoria)
  ├── 19-renombrar-categoria-persiste.spec.js ← guardarCategoria() persiste el rename en Supabase
  ├── 20-sw-admin-no-intercepta-gateway.spec.js ← sw-admin.js/sw-superadmin.js no interceptan workers.dev (denylist correcta)
  ├── 21-anular-venta-persiste-supabase.spec.js ← _anularVentaConfirmarInterno() marca anulada=true en Supabase (fix v1.16.102)
  ├── 22-factura-postcobro-persiste-supabase.spec.js ← fpConfirmar() persiste tiene_factura/factura_* en Supabase (fix v1.16.103)
  ├── 23-stock-revertir-rpc-atomico.spec.js ← stockRevertirVenta() usa RPC atómica con fallback (fix v1.16.104)
  ├── 24-hotel-dashboard-xss-habitacion.spec.js ← Hotel Dashboard escapa hab.numero (fix v1.16.105)
  └── 25-inventario-reintenta-cola-al-abrir.spec.js ← renderInventarios() reintenta colas de sync al abrir (fix v1.16.106)
```

## Niveles de cobertura

Los tests actuales son **smoke + unit-de-DOM**: validan que la app carga, que las pantallas existen, que los validadores client-side funcionan. No tocan Supabase.

### Por hacer más adelante (requiere infra)

- **Mock de Supabase**: para tests de flujos reales (login, cobro, ajuste inventario)
  - Opción A: `playwright route` para interceptar `*.supabase.co/*`
  - Opción B: arrancar Supabase local con `supabase start` y seed
  - Opción C: feature flag `?test=1` en la app que active mocks internos
- **Mock de impresoras**: stub de `usbprint` HTTP server y Bluetooth
- **Tests Mobile**: ya hay un project `chromium-mobile` (Pixel 5) preparado

## Convenciones

- Cada test arranca con `localStorage.clear()` en `beforeEach` (estado limpio).
- Selectores preferentes: `data-testid` > `id` > role/text. Si no existe el atributo, usar id.
- Tests son **independientes**: no comparten estado entre ellos.
- Si un test depende de licencia activada, inyectar localStorage previamente (`ali`, `alc`, etc) en lugar de hacer login real.

## Cuando agregar un test

1. **Después de cada bug fix crítico**: regression test del bug.
2. **Antes de refactorizar algo grande**: snapshot del comportamiento actual.
3. **Cuando un cliente reporta algo dos veces**: ya no es anécdota, es regresión latente.
