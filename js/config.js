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

// ── mipos-gateway (Cloudflare Worker + D1) — solo para clientes NUEVOS ──
// Los tenants activados con backend='supabase' (todos los existentes hoy) NUNCA
// llegan a tocar esta URL para su trafico normal — siguen yendo directo a Supabase
// arriba, sin cambios. Ver workers/mipos-gateway/docs/fase0-inventario.md.
var GATEWAY_URL = 'https://mipos-gateway.multitechmulti727.workers.dev'; // confirmada tras el deploy 2026-08-10

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

// ── Resolución de backend por tenant ──
// Default 'supabase' cuando todavía no hay nada guardado (dispositivo sin activar,
// o cualquier tenant existente que nunca escribió este flag): comportamiento
// idéntico al de siempre, cero cambio para clientes que ya facturan.
function licBackend() {
  return localStorage.getItem('lic_backend') || 'supabase';
}
function licGatewayToken() {
  return localStorage.getItem('lic_gateway_token') || '';
}
function usaGateway() {
  return licBackend() === 'cloudflare';
}
function backendHeaders(extra) {
  if (usaGateway()) {
    return Object.assign({ 'Authorization': 'Bearer ' + licGatewayToken() }, extra || {});
  }
  return supaHeaders(extra);
}
function backendBaseUrl() {
  return usaGateway() ? GATEWAY_URL : SUPA_URL;
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
  var url = backendBaseUrl() + '/rest/v1/' + tabla + (query ? '?' + query : '');
  var r = await fetch(url, {
    headers: backendHeaders({ 'Content-Type': 'application/json', 'Accept': 'application/json' }),
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
  var base = backendBaseUrl() + '/rest/v1/' + tabla;
  var url = conflictCol ? base + '?on_conflict=' + conflictCol : base;
  var prefer = conflictCol
    ? 'resolution=merge-duplicates,return=' + (minimal ? 'minimal' : 'representation')
    : 'return=' + (minimal ? 'minimal' : 'representation');
  var r = await fetch(url, {
    method: 'POST',
    headers: backendHeaders({ 'Content-Type': 'application/json', 'Prefer': prefer }),
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
  var r = await fetch(backendBaseUrl() + '/rest/v1/' + tabla + '?' + filtro, {
    method: 'PATCH',
    headers: backendHeaders({ 'Content-Type': 'application/json', 'Prefer': 'return=' + (minimal ? 'minimal' : 'representation') }),
    body: JSON.stringify(data),
    signal: supaAbortSignal()
  });
  if (minimal) { if (!r.ok) throw new Error('HTTP ' + r.status); return; }
  var txt = await r.text();
  if (!r.ok) throw new Error('HTTP ' + r.status + ': ' + txt.substring(0, 200));
  try { return JSON.parse(txt); } catch(e) { return []; }
}

// ── PATCH resiliente (con cola de reintento en localStorage) ────────────
// Mismo patron que se termino repitiendo (y a veces faltando) en varios
// modulos por separado -- ver hallazgos 2026-08-22 en credito.js
// (pos_cred_fiado/pos_cred_clientes) y hospedaje.js (pos_estadias): un
// simple `.catch(function(){})` sin cola de respaldo hacia que un corte de
// red momentaneo perdiera el cambio para siempre (o dejara datos
// inconsistentes entre terminales) sin que nadie se enterara. Se centraliza
// aca para que cualquier modulo nuevo lo use en vez de reinventarlo (o, peor,
// olvidarse de manejarlo). credito.js/hospedaje.js ya tenian su propia
// implementacion andando antes de que existiera esta -- no se tocaron para
// no arriesgar una regresion sobre algo ya en produccion, pero el proximo
// caso deberia usar esto.
async function supaPatchResiliente(tabla, filtro, data, fallbackKey) {
  try {
    await supaPatch(tabla, filtro, data, true);
  } catch (e) {
    var arr = [];
    try { arr = JSON.parse(localStorage.getItem(fallbackKey) || '[]'); } catch (e2) {}
    arr.push({ tabla: tabla, filtro: filtro, data: data, encolado: new Date().toISOString() });
    try { localStorage.setItem(fallbackKey, JSON.stringify(arr)); } catch (e3) {}
    console.warn('[' + tabla + '] Patch falló, encolado en ' + fallbackKey + ':', e.message);
  }
}
// Reintenta todo lo pendiente en `fallbackKey`. Llamar oportunísticamente
// cada vez que la pantalla dueña de esos datos se recarga, ANTES de traer
// datos frescos del servidor (si no, el refetch pisa el cambio local que
// todavía no subió).
async function supaReintentarResilientes(fallbackKey) {
  var arr = [];
  try { arr = JSON.parse(localStorage.getItem(fallbackKey) || '[]'); } catch (e) { return; }
  if (!arr.length) return;
  var quedan = [];
  for (var i = 0; i < arr.length; i++) {
    var it = arr[i];
    try { await supaPatch(it.tabla, it.filtro, it.data, true); }
    catch (e) { quedan.push(it); }
  }
  try { localStorage.setItem(fallbackKey, JSON.stringify(quedan)); } catch (e) {}
}

// ── POST/upsert resiliente (mismo patron que supaPatchResiliente arriba) ──
// Encontrado 2026-08-22: admin-inventario.js actualizaba `stock` tras una
// compra/transferencia/anulación con un upsert "fire and forget"
// (`.catch(function(e){console.warn(...)})`, sin cola de respaldo). Si ese
// upsert fallaba (corte de red momentáneo), el comprobante de compra quedaba
// igual registrado (se guarda con `await` sin catch, así que si falla corta
// todo el flujo) pero la cantidad real en `stock` NUNCA se actualizaba —
// inventario desincronizado del historial de compras, sin aviso, sin
// reintento, mismo patrón que ya se repitió varias veces este mes.
async function supaPostResiliente(tabla, data, onConflict, fallbackKey) {
  try {
    await supaPost(tabla, data, onConflict, true);
  } catch (e) {
    var arr = [];
    try { arr = JSON.parse(localStorage.getItem(fallbackKey) || '[]'); } catch (e2) {}
    arr.push({ tabla: tabla, data: data, onConflict: onConflict, encolado: new Date().toISOString() });
    try { localStorage.setItem(fallbackKey, JSON.stringify(arr)); } catch (e3) {}
    console.warn('[' + tabla + '] Post falló, encolado en ' + fallbackKey + ':', e.message);
  }
}
async function supaReintentarResilientesPost(fallbackKey) {
  var arr = [];
  try { arr = JSON.parse(localStorage.getItem(fallbackKey) || '[]'); } catch (e) { return; }
  if (!arr.length) return;
  var quedan = [];
  for (var i = 0; i < arr.length; i++) {
    var it = arr[i];
    try { await supaPost(it.tabla, it.data, it.onConflict, true); }
    catch (e) { quedan.push(it); }
  }
  try { localStorage.setItem(fallbackKey, JSON.stringify(quedan)); } catch (e) {}
}

// DELETE: supaDelete('pos_productos', 'id=eq.123')
async function supaDelete(tabla, filtro) {
  var r = await fetch(backendBaseUrl() + '/rest/v1/' + tabla + '?' + filtro, {
    method: 'DELETE',
    headers: backendHeaders({ 'Prefer': 'return=minimal' }),
    signal: supaAbortSignal()
  });
  if (!r.ok) {
    var txt = await r.text().catch(function(){ return ''; });
    throw new Error('HTTP ' + r.status + ': ' + txt.substring(0, 200));
  }
}

// RPC: supaRPC('nombre_funcion', {param1: 'val'})
// 'activar_licencia' es especial: un dispositivo recien instalado todavia no tiene
// backend guardado (licBackend() por default da 'supabase'), asi que esta llamada
// puntual SIEMPRE va al Worker — el Worker decide server-side si el tenant es D1
// nativo o si hace passthrough a Supabase, y de ahi en mas licGuardar() persiste
// el backend correcto para todo el resto del trafico. Ver workers/mipos-gateway/src/index.js.
async function supaRPC(fn, params) {
  var base = (fn === 'activar_licencia') ? GATEWAY_URL : backendBaseUrl();
  var headers = (fn === 'activar_licencia') ? { 'Content-Type': 'application/json', 'Accept': 'application/json' } : backendHeaders({ 'Content-Type': 'application/json', 'Accept': 'application/json' });
  var url = base + '/rest/v1/rpc/' + fn;
  var r = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(params),
    signal: supaAbortSignal()
  });
  var txt = await r.text();
  if (!r.ok) throw new Error('RPC ' + fn + ' HTTP ' + r.status + ': ' + txt.substring(0, 200));
  try { return JSON.parse(txt); } catch(e) { return txt; }
}
