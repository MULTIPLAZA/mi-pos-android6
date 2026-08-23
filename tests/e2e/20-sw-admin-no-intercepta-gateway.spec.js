// 20 — Regression: sw-admin.js / sw-superadmin.js (Service Workers de los
// paneles admin) tenían la condición de intercepción de fetch() INVERTIDA
// respecto a sw.js (el SW del POS principal): en vez de una denylist
// ("excluir hosts externos conocidos, interceptar todo lo demás", que es lo
// que sw.js hace), usaban una allowlist ("interceptar SOLO si el host
// contiene workers.dev/pages.dev/localhost").
//
// Eso causaba 2 problemas reales:
// 1) SÍ interceptaban workers.dev (mipos-gateway) -- exactamente lo que
//    sw.js documenta como bug ya arreglado ahí: si el Worker está caído, el
//    .catch() del SW devuelve el HTML de la app (200 OK) en vez de un error
//    de red real, y supaGet()/supaPost() (que esperan JSON) explotan con un
//    SyntaxError que el código no reconoce como reintentable -- el item
//    queda "error permanente" en vez de encolado. Esto es un bug activo HOY
//    en producción (mi-pos-android6.pages.dev), no solo teórico.
// 2) Si el sitio alguna vez se sirve desde un dominio propio (no *.pages.dev),
//    NINGÚN fetch se intercepta -- el SW deja de aplicar `cache:'no-store'`
//    por completo, y admin-negocio.html/super-admin.html (los paneles de
//    mayor riesgo si sirven una versión vieja) vuelven a depender de la
//    caché HTTP normal del navegador.
//
// Este test carga el archivo SW real con vm (sin browser, sin red) y prueba
// la lógica de intercepción contra varios hosts.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function cargarLogicaFetch(archivoRelativo) {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', archivoRelativo), 'utf8');
  let fetchListener = null;
  const sandbox = {
    self: {
      addEventListener(tipo, cb) { if (tipo === 'fetch') fetchListener = cb; },
    },
    caches: {
      open: () => Promise.resolve({ put: () => Promise.resolve(), match: () => Promise.resolve(undefined) }),
      keys: () => Promise.resolve([]),
      match: () => Promise.resolve(undefined),
    },
    fetch: () => Promise.resolve({ ok: true, status: 200, clone: () => ({}) }),
    URL,
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: archivoRelativo });
  return function seIntercepta(urlStr, metodo) {
    let interceptado = false;
    const evento = {
      request: { url: urlStr, method: metodo || 'GET' },
      respondWith() { interceptado = true; },
    };
    fetchListener(evento);
    return interceptado;
  };
}

test.describe('sw-admin.js / sw-superadmin.js — denylist correcta de fetch', () => {
  for (const archivo of ['sw-admin.js', 'sw-superadmin.js']) {
    test(archivo + ': intercepta same-origin (pages.dev) y dominio propio, no intercepta workers.dev ni CDNs', () => {
      const seIntercepta = cargarLogicaFetch(archivo);

      // Mismo origen — debe interceptarse sin importar el dominio real.
      expect(seIntercepta('https://mi-pos-android6.pages.dev/admin-negocio.html')).toBe(true);
      expect(seIntercepta('https://app.negociodelcliente.com/admin-negocio.html')).toBe(true); // dominio propio -- antes NO se interceptaba
      expect(seIntercepta('http://localhost:8000/admin-negocio.html')).toBe(true);

      // mipos-gateway — NUNCA debe interceptarse (antes SÍ se interceptaba, ese era el bug activo).
      expect(seIntercepta('https://mipos-gateway.multitechmulti727.workers.dev/rest/v1/pos_config')).toBe(false);

      // CDNs/terceros conocidos — tampoco se interceptan.
      expect(seIntercepta('https://xxxxx.supabase.co/rest/v1/pos_productos')).toBe(false);
      expect(seIntercepta('https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js')).toBe(false);

      // POST no se intercepta (el handler solo actúa sobre GET).
      expect(seIntercepta('https://mi-pos-android6.pages.dev/algo', 'POST')).toBe(false);
    });
  }
});
