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

// ══════════════════════════════════════════════════════════
// EMISIÓN DESDE EL POS (fase 2)
// Genera el JSON del DE al cobrar (mismo formato validado del TPV),
// lo emite en background y, si falla o no hay internet, lo encola en
// localStorage para reintentar. Nunca bloquea el cobro.
// ══════════════════════════════════════════════════════════

var FE_COLA_KEY = 'fe_cola';       // jobs de emisión pendientes
var FE_PEND_KEY = 'fe_pend_cdcs';  // CDCs esperando estado final de SIFEN

/** Formatea Date → 'YYYY-MM-DDTHH:mm:ss' en hora local (sin zona), como el TPV */
function _feFechaLocal(d) {
  var p = function(n){ return String(n).padStart(2,'0'); };
  return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+
         'T'+p(d.getHours())+':'+p(d.getMinutes())+':'+p(d.getSeconds());
}

/** Mapeo método de pago del POS → tipo de pago SIFEN (E606). Validar en sandbox. */
function _feTipoPago(metodo) {
  var m = (metodo||'').toLowerCase();
  if (m.indexOf('efectivo') >= 0) return 1;
  if (m.indexOf('pos') >= 0 || m.indexOf('tarjeta') >= 0) return 3;  // tarjeta crédito
  if (m.indexOf('transfer') >= 0) return 5;                          // transferencia
  if (m.indexOf('pix') >= 0) return 5;
  if (m.indexOf('mercado') >= 0 || m.indexOf('billetera') >= 0) return 7; // billetera electrónica
  return 1;
}

/** IVA del producto ('10'|'5'|'0'|'exento') → campos SIFEN del item */
function _feIvaItem(iva) {
  var v = String(iva === undefined || iva === null ? '10' : iva).toLowerCase();
  if (v === '5')  return { ivaTipo: 1, ivaBase: 100, iva: 5 };
  if (v === '0' || v === 'exento' || v === 'exenta') return { ivaTipo: 3, ivaBase: 0, iva: 0 };
  return { ivaTipo: 1, ivaBase: 100, iva: 10 };
}

/**
 * ¿Corresponde emitir FE para esta venta? Devuelve el documento DE armado
 * (más metadatos _fe*) o null. Se llama desde supaInsertVenta (turno.js).
 */
function feDocumentoParaVenta(data) {
  try {
    if (!feActiva()) return null;
    var f = data.factura;
    if (!f || !f.timbrado || f.tipo_timbrado !== 'electronico') return null;
    return feArmarDocumento(data);
  } catch (e) {
    console.warn('[FE] Error armando documento:', e.message);
    return null;
  }
}

/**
 * Arma el JSON del DE (factura, tipoDocumento 1) con el formato del TPV.
 * data = payload de registrarVentaEnTurno (items, total, metodo, factura,
 * fecha, divPagos...). El correlativo ya viene asignado en factura.nro_factura.
 */
function feArmarDocumento(data) {
  var f = data.factura;

  // Numeración: '001-001-0000123' ya calculada en getFacturaData()
  var partes = (f.nro_factura || '').split('-');
  var numero = parseInt(partes[2], 10);
  if (!numero) throw new Error('Sin correlativo de factura');

  // ── Cliente ──
  var ruc = (f.ruc || '').trim().toUpperCase();
  var esContribuyente = /^\d{5,8}-?\d$/.test(ruc);   // RUC válido (con o sin guión)
  if (esContribuyente && ruc.indexOf('-') < 0) {
    ruc = ruc.slice(0, -1) + '-' + ruc.slice(-1);     // normalizar con dígito verificador
  }
  var nombre = (f.nombre && f.nombre !== 'SIN NOMBRE') ? f.nombre : 'Sin Nombre';
  var cliente;
  if (esContribuyente) {
    cliente = {
      contribuyente: true,
      ruc: ruc,
      razonSocial: nombre,
      tipoOperacion: 1,                                // B2B
      direccion: f.direccion || '',
      pais: 'PRY',
      // Heurística PY: RUC 8xxxxxxx (8 dígitos) = persona jurídica
      tipoContribuyente: /^8\d{7}-/.test(ruc) ? '2' : '1',
      documentoTipo: '', documentoNumero: '',
      telefono: '', celular: '', email: '',
      codigo: '0',
    };
  } else {
    // Consumidor final (innominado) — caso a validar en sandbox
    cliente = {
      contribuyente: false,
      ruc: '',
      razonSocial: nombre,
      tipoOperacion: 2,                                // B2C
      direccion: f.direccion || '',
      pais: 'PRY',
      tipoContribuyente: '1',
      documentoTipo: 5,                                // innominado
      documentoNumero: '0',
      telefono: '', celular: '', email: '',
      codigo: '0',
    };
  }

  // ── Items ──
  // Los ítems con precio negativo (descuentos como línea) se excluyen y su
  // monto se descuenta proporcionalmente del resto, porque SIFEN no acepta
  // precios negativos. El descuento de ticket ya está reflejado en data.total.
  var visibles = (data.items || []).filter(function(i){ return (i.price || 0) > 0 && (i.qty || 0) > 0; });
  if (!visibles.length) throw new Error('Venta sin ítems facturables');
  var bruto = visibles.reduce(function(s, i){ return s + i.price * i.qty; }, 0);
  var objetivo = Math.round(data.total || bruto);
  var factor = (objetivo > 0 && bruto > 0 && objetivo !== Math.round(bruto)) ? objetivo / bruto : 1;

  var items = visibles.map(function(i){
    var ivaC = _feIvaItem(i.iva);
    return {
      codigo: String(i.id !== undefined ? i.id : '0'),
      descripcion: i.name || 'Item',
      observacion: i.obs || '',
      unidadMedida: 77,                                // 77 = unidad
      cantidad: i.qty,
      precioUnitario: Math.round(i.price * factor),
      ivaTipo: ivaC.ivaTipo,
      ivaBase: ivaC.ivaBase,
      iva: ivaC.iva,
    };
  });

  // Ajustar el redondeo del prorrateo en una línea de cantidad 1 para que
  // la suma de líneas cierre exacta contra lo cobrado (evita error 2377)
  var suma = items.reduce(function(s, it){ return s + it.precioUnitario * it.cantidad; }, 0);
  var dif = objetivo - suma;
  if (dif !== 0) {
    for (var k = 0; k < items.length; k++) {
      if (items[k].cantidad === 1 && items[k].precioUnitario + dif > 0) {
        items[k].precioUnitario += dif; suma += dif; break;
      }
    }
  }

  // ── Condición de pago ──
  var esCredito = (data.metodo || '').toLowerCase().indexOf('cr') === 0; // Crédito/Fiado
  var condicion;
  if (esCredito) {
    condicion = { tipo: 2, credito: { tipo: 1, plazo: '30 días' } };
  } else if (Array.isArray(data.divPagos) && data.divPagos.length) {
    // Pago dividido → una entrega por método. Prorratear igual que los items
    // para que la suma de entregas cierre contra la suma de líneas.
    var totPagos = data.divPagos.reduce(function(s, p){ return s + (p.monto || 0); }, 0) || suma;
    var entregas = data.divPagos.map(function(p){
      return {
        tipo: _feTipoPago(p.metodo),
        monto: Math.round((p.monto || 0) / totPagos * suma),
        moneda: 'PYG', monedaDescripcion: 'Guarani', cambio: 0,
      };
    });
    var difE = suma - entregas.reduce(function(s, e){ return s + e.monto; }, 0);
    if (difE !== 0) entregas[0].monto += difE;
    condicion = { tipo: 1, entregas: entregas };
  } else {
    condicion = {
      tipo: 1,
      entregas: [{ tipo: _feTipoPago(data.metodo), monto: suma, moneda: 'PYG', monedaDescripcion: 'Guarani', cambio: 0 }],
    };
  }

  var fecha = (data.fecha instanceof Date) ? data.fecha : new Date();

  var doc = {
    tipoDocumento: '1',
    establecimiento: f.sucursal_nro || '001',
    punto: f.punto_exp || '001',
    numero: numero,
    descripcion: '',
    observacion: '',
    fecha: _feFechaLocal(fecha),
    tipoEmision: 1,
    tipoTransaccion: 1,
    tipoImpuesto: 1,
    moneda: 'PYG',
    cliente: cliente,
    Usuario: {
      documentoTipo: 1,
      documentoNumero: null,
      nombre: (typeof configData !== 'undefined' && configData.terminal) ? configData.terminal : 'CAJA',
      cargo: 'CAJERO',
    },
    factura: { presencia: 1 },
    condicion: condicion,
    items: items,
  };
  // Metadatos internos (no se envían — se pelan antes del POST)
  doc._feNumeroFmt = f.nro_factura;
  return doc;
}

/** Pela los metadatos internos _fe* del doc antes de mandarlo */
function _feDocLimpio(doc) {
  var d = JSON.parse(JSON.stringify(doc));
  Object.keys(d).forEach(function(k){ if (k.indexOf('_fe') === 0) delete d[k]; });
  return d;
}

/**
 * Emite el DE de una venta. Devuelve los campos fe_* listos para persistir
 * en pos_ventas. Registra el CDC para el polling de estados.
 */
async function feEmitirVenta(doc) {
  var r = await feEmitir([_feDocLimpio(doc)], { qr: true });
  var de = (r && r.deList && r.deList[0]) || {};
  if (!de.cdc) throw new Error('FacturaSend no devolvió CDC');
  _fePendAgregar(de.cdc);
  _log('[FE] Emitido', doc._feNumeroFmt, 'CDC:', de.cdc);
  return {
    fe_cdc: de.cdc,
    fe_estado: '0',                                    // 0-Generado (async en SIFEN)
    fe_numero: de.numero || doc._feNumeroFmt,
    fe_qr: de.qr || null,
    fe_lote_id: (r.loteId !== undefined && r.loteId !== null) ? String(r.loteId) : null,
    fe_error: null,
    fe_fecha_emision: new Date().toISOString(),
  };
}

// ── COLA DE EMISIÓN (offline / reintentos) ────────────────

function _feColaLeer(k) {
  try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch (e) { return []; }
}
function _feColaEscribir(k, arr) {
  try { localStorage.setItem(k, JSON.stringify(arr)); } catch (e) { /* storage lleno */ }
}

/** Encola un DE para emisión diferida (sin internet o emisión fallida) */
function feColaAgregar(doc) {
  var cola = _feColaLeer(FE_COLA_KEY);
  // No duplicar el mismo número
  if (cola.some(function(j){ return j.numeroFmt === doc._feNumeroFmt; })) return;
  cola.push({ doc: doc, numeroFmt: doc._feNumeroFmt, fe: null, intentos: 0, creado: new Date().toISOString() });
  _feColaEscribir(FE_COLA_KEY, cola);
  _log('[FE] Encolado para emisión diferida:', doc._feNumeroFmt);
}

function _fePendAgregar(cdc) {
  var p = _feColaLeer(FE_PEND_KEY);
  if (p.indexOf(cdc) < 0) { p.push(cdc); _feColaEscribir(FE_PEND_KEY, p); }
}

var _feColaEnProceso = false;

/**
 * Procesa la cola de emisión: emite cada job pendiente y persiste los
 * campos fe_* en pos_ventas (match por licencia_email + fe_numero).
 * Si el job ya emitió pero el PATCH no encontró la fila (venta aún no
 * sincronizada), guarda el resultado y reintenta solo el PATCH.
 */
async function feProcesarCola() {
  if (_feColaEnProceso || !navigator.onLine || !feActiva()) return;
  var cola = _feColaLeer(FE_COLA_KEY);
  if (!cola.length) return;
  var email = localStorage.getItem('lic_email');
  if (!email) return;
  _feColaEnProceso = true;

  for (var i = 0; i < cola.length; i++) {
    var job = cola[i];
    try {
      if (!job.fe) {
        job.fe = await feEmitirVenta(job.doc);       // emitir UNA sola vez
        _feColaEscribir(FE_COLA_KEY, cola);
      }
      var rows = await supaPatch('pos_ventas',
        'licencia_email=eq.' + encodeURIComponent(email) + '&fe_numero=eq.' + encodeURIComponent(job.numeroFmt),
        job.fe);
      if (Array.isArray(rows) && rows.length) {
        job.listo = true;
        _log('[FE] Cola: ' + job.numeroFmt + ' emitido y persistido');
      } else {
        _log('[FE] Cola: venta ' + job.numeroFmt + ' aún no sincronizada, reintento luego');
      }
    } catch (e) {
      job.intentos = (job.intentos || 0) + 1;
      job.ultimoError = (e.message || '').substring(0, 200);
      console.warn('[FE] Cola error (' + job.numeroFmt + '):', e.message);
      _feColaEscribir(FE_COLA_KEY, cola);
    }
  }
  _feColaEscribir(FE_COLA_KEY, cola.filter(function(j){ return !j.listo; }));
  _feColaEnProceso = false;
}

/**
 * Polling de estados: consulta los CDCs pendientes y persiste el estado
 * final (Aprobado/Rechazado/Cancelado) en pos_ventas por fe_cdc.
 */
async function feActualizarEstadosPendientes() {
  if (!navigator.onLine || !feActiva()) return;
  var pend = _feColaLeer(FE_PEND_KEY);
  if (!pend.length) return;
  var email = localStorage.getItem('lic_email');
  if (!email) return;
  try {
    var res = await feConsultarEstados(pend);
    var quedan = pend.slice();
    for (var i = 0; i < (res || []).length; i++) {
      var r = res[i];
      if (!r || !r.cdc) continue;
      var est = (r.situacion !== undefined && r.situacion !== null) ? String(r.situacion) : null;
      if (est === null || est === '0' || est === '1') continue;   // sigue pendiente
      var resp = ((r.respuesta_codigo || '') + ' ' + (r.respuesta_mensaje || r.estado || '')).trim();
      await supaPatch('pos_ventas',
        'licencia_email=eq.' + encodeURIComponent(email) + '&fe_cdc=eq.' + encodeURIComponent(r.cdc),
        { fe_estado: est, fe_respuesta: resp || null }, true);
      quedan = quedan.filter(function(c){ return c !== r.cdc; });
      _log('[FE] Estado final CDC ' + r.cdc.substring(0, 12) + '…: ' + est + ' ' + resp);
    }
    _feColaEscribir(FE_PEND_KEY, quedan);
  } catch (e) {
    console.warn('[FE] Error consultando estados:', e.message);
  }
}

// ── Ciclos automáticos — solo en el POS (no en el panel admin) ──
if (typeof document !== 'undefined' && document.getElementById('tpanel')) {
  setInterval(feProcesarCola, 3 * 60 * 1000);                    // cola de emisión c/3 min
  setInterval(feActualizarEstadosPendientes, 10 * 60 * 1000);    // estados c/10 min
  window.addEventListener('online', function(){ setTimeout(feProcesarCola, 5000); });
  setTimeout(feProcesarCola, 15000);                             // al iniciar la app
  setTimeout(feActualizarEstadosPendientes, 30000);
}
