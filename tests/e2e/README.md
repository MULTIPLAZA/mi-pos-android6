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
  ├── 08-tutoriales.spec.js     ← (admin) Tutoriales se cargan
  ├── 09-xss-escape.spec.js     ← Helper escapeHtml está disponible globalmente
  └── 10-regression-mesa.spec.js ← Mesa atascada — regression test del fix
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
