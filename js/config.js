// ── Configuración centralizada ──
// Un solo lugar para credenciales y helpers de Supabase.
// Todos los HTML importan este archivo en vez de declarar sus propias constantes.

// ── Polyfill defensivo de _log/_warn/_err ──
// lib/index.mjs (que es la fuente real de estos helpers) carga como
// <script type="module"> y es defer/async, por lo que puede no estar listo
// cuando otros scripts sync (config → state → sounds → sync → cobro → ...) ejecutan.
// Sin este polyfill, el primer uso de _log() tira ReferenceError y rompe la
// inicialización (ej. sync.js abriendo IndexedDB). Cuando lib/index.mjs termine
// de cargar va a sobrescribir estos no-ops con la implementación real.
if (typeof window !== 'undefined') {
  if (typeof window._log  !== 'function') window._log  = function(){};
  if (typeof window._warn !== 'function') window._warn = function(){ console.warn.apply(console, arguments); };
  if (typeof window._err  !== 'function') window._err  = function(){ console.error.apply(console, arguments); };
}

// ── Polyfill AbortController (Chrome < 66 / Android 6 WebView) ──
// fetch() acepta signal:undefined sin errores — el fetch simplemente no tiene timeout.
if (typeof AbortController === 'undefined') {
  window.AbortController = function() {
    this.signal = { aborted: false };
    this.abort  = function() { this.signal.aborted = true; };
  };
}

var SUPA_URL  = 'https://kmreiniqgcvqgdtzvmel.supabase.co';
var SUPA_ANON = 'sb_publishable_j6btNHo1o3tSprmYUJITPw_8AsYgcvJ';

// ── API SQL externa (búsqueda de productos por código de barras) ──
// El token vive en el Worker — no se expone en el browser.
var APISQL_WORKER = 'https://apisql-proxy.multitechmulti727.workers.dev';

var SUPA_HEADERS = {
  'apikey':        SUPA_ANON,
  'Authorization': 'Bearer ' + SUPA_ANON,
};

function supaHeaders(extra) {
  return Object.assign({}, SUPA_HEADERS, extra || {});
}

// ── Helpers de fetch para Supabase REST API ──

var SUPA_FETCH_TIMEOUT = 30000; // 30 segundos

/** Crea un AbortSignal con timeout (undefined en Chrome <66 sin AbortController) */
function supaAbortSignal() {
  if (typeof AbortController === 'undefined') return undefined;
  var ctrl = new AbortController();
  setTimeout(function(){ ctrl.abort(); }, SUPA_FETCH_TIMEOUT);
  return ctrl.signal;
}

// GET: supaGet('pos_productos', 'activo=eq.true&order=nombre.asc')
async function supaGet(tabla, query) {
  var url = SUPA_URL + '/rest/v1/' + tabla + (query ? '?' + query : '');
  var r = await fetch(url, {
    headers: supaHeaders({ 'Content-Type': 'application/json', 'Accept': 'application/json' }),
    signal: supaAbortSignal()
  });
  if (!r.ok) {
    var txt = await r.text().catch(function(){ return ''; });
    throw new Error('HTTP ' + r.status + ' en ' + tabla + ': ' + txt.substring(0, 150));
  }
  var d = await r.json();
  return Array.isArray(d) ? d : [];
}

// POST: supaPost('pos_ventas', {datos}, 'on_conflict_col', true) — 4to param = minimal (sin retorno)
async function supaPost(tabla, data, conflictCol, minimal) {
  var url = conflictCol
    ? SUPA_URL + '/rest/v1/' + tabla + '?on_conflict=' + conflictCol
    : SUPA_URL + '/rest/v1/' + tabla;
  var prefer = conflictCol
    ? 'resolution=merge-duplicates,return=' + (minimal ? 'minimal' : 'representation')
    : 'return=' + (minimal ? 'minimal' : 'representation');
  var r = await fetch(url, {
    method: 'POST',
    headers: supaHeaders({ 'Content-Type': 'application/json', 'Prefer': prefer }),
    body: JSON.stringify(data),
    signal: supaAbortSignal()
  });
  if (minimal) { if (!r.ok) throw new Error('HTTP ' + r.status); return; }
  var txt = await r.text();
  if (!r.ok) throw new Error('HTTP ' + r.status + ': ' + txt.substring(0, 200));
  try { return JSON.parse(txt); } catch(e) { return []; }
}

// PATCH: supaPatch('pos_productos', 'id=eq.123', {nombre:'nuevo'}, true) — 4to param = minimal
async function supaPatch(tabla, filtro, data, minimal) {
  var r = await fetch(SUPA_URL + '/rest/v1/' + tabla + '?' + filtro, {
    method: 'PATCH',
    headers: supaHeaders({ 'Content-Type': 'application/json', 'Prefer': 'return=' + (minimal ? 'minimal' : 'representation') }),
    body: JSON.stringify(data),
    signal: supaAbortSignal()
  });
  if (minimal) { if (!r.ok) throw new Error('HTTP ' + r.status); return; }
  var txt = await r.text();
  if (!r.ok) throw new Error('HTTP ' + r.status + ': ' + txt.substring(0, 200));
  try { return JSON.parse(txt); } catch(e) { return []; }
}

// DELETE: supaDelete('pos_productos', 'id=eq.123')
async function supaDelete(tabla, filtro) {
  var r = await fetch(SUPA_URL + '/rest/v1/' + tabla + '?' + filtro, {
    method: 'DELETE',
    headers: supaHeaders({ 'Prefer': 'return=minimal' }),
    signal: supaAbortSignal()
  });
  if (!r.ok) {
    var txt = await r.text().catch(function(){ return ''; });
    throw new Error('HTTP ' + r.status + ': ' + txt.substring(0, 200));
  }
}

// RPC: supaRPC('nombre_funcion', {param1: 'val'})
async function supaRPC(fn, params) {
  var url = SUPA_URL + '/rest/v1/rpc/' + fn;
  var r = await fetch(url, {
    method: 'POST',
    headers: supaHeaders({ 'Content-Type': 'application/json', 'Accept': 'application/json' }),
    body: JSON.stringify(params),
    signal: supaAbortSignal()
  });
  var txt = await r.text();
  if (!r.ok) throw new Error('RPC ' + fn + ' HTTP ' + r.status + ': ' + txt.substring(0, 200));
  try { return JSON.parse(txt); } catch(e) { return txt; }
}
