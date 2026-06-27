// ════════════════════════════════════════════════════════════
// NODO POS — entry point ESM
// ════════════════════════════════════════════════════════════
// Este modulo se carga como <script type="module" src="js/lib/index.mjs">
// ANTES de los <script src> clasicos. Su rol:
//   1) Importar todos los modulos ESM de js/lib/
//   2) Re-exponerlos en `window` para compat con el codigo legacy
//      (que sigue siendo scripts globales por ahora)
//
// A medida que el resto del codigo se migre a ESM, este puente
// se va achicando hasta que no haga falta y todo sea import nativo.
//
// IMPORTANTE: los modulos ESM son `defer` por default — corren antes
// de DOMContentLoaded pero NO bloquean el parse del HTML. Por eso
// re-exponemos a window inmediatamente al import (no esperamos DCL).
// ════════════════════════════════════════════════════════════

import { NodoIco, PATHS as NODO_ICO_PATHS } from './icons.mjs';
import { escapeHtml, esc } from './escape.mjs';
import { _log, _warn, _err } from './log.mjs';
import { gs } from './format.mjs';

// ── Compat layer: re-exponer a window ───────────────────────
// El codigo legacy llama `NodoIco('foo')`, `esc(x)`, `_log(...)`, `gs(n)` esperando globals.
window.NodoIco = NodoIco;
window.__NODO_ICO_PATHS = NODO_ICO_PATHS;
window.escapeHtml = escapeHtml;
window.esc = esc;
window._log = _log;
window._warn = _warn;
window._err = _err;
window.gs = gs;

// Flag para que el codigo legacy pueda detectar que el lib ESM cargo
window.__nodoLibLoaded = true;
window.dispatchEvent(new CustomEvent('nodo-lib-ready'));
