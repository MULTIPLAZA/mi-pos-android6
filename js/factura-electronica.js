// ── factura-electronica.js — Capa adaptadora de Factura Electrónica (SIFEN) ──
// Interfaz genérica del POS hacia el proveedor de facturación electrónica.
// Implementación actual: FacturaSend (via proxy /api/fe/ en Cloudflare Functions).
// Para migrar a NODO Engine u otro proveedor: reimplementar estas mismas
// funciones públicas sin tocar cobro.js / sync.js / impresion.js.
//
// API pública:
//   feGetConfig() / feSetConfig(cfg) / feActiva()
//   feTestConexion()                → verifica credenciales (GET departamentos)
//   feEmitir(documentos, opts)      → POST lote/create   (array, 1..50 docs)
//   feConsultarEstados(cdcs)        → POST de/estado
//   feCancelar(cdc, motivo)         → POST evento/cancelacion (máx 48hs)
//   feObtenerKude(cdc, format)      → POST de/pdf (base64)
//
// Estados FacturaSend: -1 Borrador · 0 Generado · 1 Enviado · 2 Aprobado
//                       3 Aprobado c/obs · 4 Rechazado · 98 Inexistente · 99 Cancelado

// ── CONFIG ────────────────────────────────────────────────
// Credenciales del negocio (cada negocio = un tenant en FacturaSend).
// Se guardan en localStorage igual que el resto de la config del POS.

var FE_PROXY = '/api/fe/';
var FE_FETCH_TIMEOUT = 30000;

function feGetConfig() {
  return {
    tenantId: localStorage.getItem('fe_tenant_id') || '',
    apiKey:   localStorage.getItem('fe_api_key')   || '',
    // URL base de la API. Vacío = nube (api.facturasend.com.py).
    // Self-hosted: ej. http://207.244.255.146:85/api
    apiUrl:   localStorage.getItem('fe_api_url')   || '',
    activa:   localStorage.getItem('fe_activa') === '1',
  };
}

function feSetConfig(cfg) {
  if (cfg.tenantId !== undefined) localStorage.setItem('fe_tenant_id', (cfg.tenantId || '').trim());
  if (cfg.apiKey   !== undefined) localStorage.setItem('fe_api_key',   (cfg.apiKey || '').trim());
  if (cfg.apiUrl   !== undefined) localStorage.setItem('fe_api_url',   (cfg.apiUrl || '').trim().replace(/\/+$/, ''));
  if (cfg.activa   !== undefined) localStorage.setItem('fe_activa',    cfg.activa ? '1' : '0');
  _log('[FE] Config actualizada. Activa:', feGetConfig().activa);
}

/** true si la factura electrónica está configurada Y activada */
function feActiva() {
  var c = feGetConfig();
  return c.activa && !!c.tenantId && !!c.apiKey;
}

// ── FETCH INTERNO ─────────────────────────────────────────

function _feAbortSignal() {
  if (typeof AbortController === 'undefined') return undefined;
  var ctrl = new AbortController();
  setTimeout(function(){ ctrl.abort(); }, FE_FETCH_TIMEOUT);
  return ctrl.signal;
}

/**
 * Llama al proxy /api/fe/<ruta>. body null → GET, objeto → POST.
 * Devuelve el JSON parseado; lanza Error con mensaje legible si falla.
 */
async function _feFetch(ruta, body) {
  var cfg = feGetConfig();
  if (!cfg.tenantId || !cfg.apiKey) {
    throw new Error('Factura electrónica sin configurar (tenantId / apiKey)');
  }
  var headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'X-FE-Tenant': cfg.tenantId,
    'X-FE-ApiKey': cfg.apiKey,
  };
  if (cfg.apiUrl) headers['X-FE-BaseUrl'] = cfg.apiUrl;
  var r = await fetch(FE_PROXY + ruta, {
    method: body === null ? 'GET' : 'POST',
    headers: headers,
    body: body === null ? undefined : JSON.stringify(body),
    signal: _feAbortSignal(),
  });
  var txt = await r.text();
  var data;
  try { data = JSON.parse(txt); }
  catch(e) { throw new Error('FE HTTP ' + r.status + ': respuesta no JSON: ' + txt.substring(0, 150)); }

  if (!r.ok || data.success === false) {
    var msg = data.error || ('HTTP ' + r.status);
    // errores por documento vienen en data.errores
    if (data.errores && data.errores.length) {
      msg += ' — ' + JSON.stringify(data.errores).substring(0, 300);
    }
    var err = new Error(msg);
    err.feResponse = data;
    throw err;
  }
  return data;
}

// ── API PÚBLICA ───────────────────────────────────────────

/**
 * Test de conexión y credenciales — pide la lista de departamentos
 * (endpoint liviano que requiere auth válida). Devuelve true/lanza Error.
 * Uso desde consola: feTestConexion().then(console.log).catch(console.error)
 */
async function feTestConexion() {
  var d = await _feFetch('departamentos', null);
  var n = (d.result || []).length;
  _log('[FE] Conexión OK — ' + n + ' departamentos recibidos');
  return { ok: true, departamentos: n };
}

/**
 * Emite documentos electrónicos. `documentos` = array de DEs (formato JSON
 * FacturaSend, mismo que el TPV). Máx 50 por lote, todos del mismo tipo.
 * opts: { draft, xml, qr, tax } — por defecto pide qr=true (para el ticket).
 * Devuelve { deList: [{cdc, numero, estado, qr...}], loteId }.
 */
async function feEmitir(documentos, opts) {
  if (!Array.isArray(documentos)) documentos = [documentos];
  opts = opts || {};
  var qs = [];
  if (opts.draft) qs.push('draft=true');
  if (opts.xml)   qs.push('xml=true');
  if (opts.qr !== false) qs.push('qr=true');
  if (opts.tax)   qs.push('tax=true');
  var d = await _feFetch('lote/create' + (qs.length ? '?' + qs.join('&') : ''), documentos);
  return d.result;
}

/**
 * Consulta estados de una lista de CDCs pendientes.
 * cdcs: array de strings CDC. Devuelve array de {cdc, estado, situacion,
 * respuesta_codigo, respuesta_mensaje, ...}.
 */
async function feConsultarEstados(cdcs) {
  var body = { cdcList: cdcs.map(function(c){ return { cdc: c }; }) };
  var d = await _feFetch('de/estado', body);
  return d.result || d.deList || [];
}

/**
 * Cancela un documento aprobado (plazo SIFEN: 48 hs desde emisión).
 * Pasado el plazo corresponde Nota de Crédito, no cancelación.
 */
async function feCancelar(cdc, motivo) {
  return await _feFetch('evento/cancelacion', { cdc: cdc, motivo: motivo || 'Anulación de la operación' });
}

/**
 * Obtiene el KuDE en PDF (base64) de un CDC.
 * format: 'ticket' (térmica) | 'a4'. Devuelve el base64 del PDF.
 */
async function feObtenerKude(cdc, format) {
  var d = await _feFetch('de/pdf', {
    cdcList: [{ cdc: cdc }],
    type: 'base64',
    format: format || 'ticket',
  });
  // la respuesta trae el base64 en result (ajustar según sandbox si difiere)
  return d.result;
}
