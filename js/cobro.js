// ============================================================
// cobro.js — Cobro, facturación, numpad y recibo
// Ampersand POS
// ============================================================
//
// PROPÓSITO:
//   Maneja todo el flujo desde que el cajero presiona COBRAR
//   hasta que se genera el recibo:
//     - Pantalla de cobro (selección de método de pago)
//     - Numpad para ingresar montos y comprobantes
//     - Descuento sobre el ticket total
//     - Facturación: RUC, timbrado, punto de expedición
//     - Confirmación del pago y generación del recibo
//
// DEPENDE DE (variables globales en index.html):
//   gs, toast, goTo              → ui.js
//   cart, calcTotal(),
//   calcDescuentoMonto(),
//   ticketDescuento, pendientes,
//   currentTicketNro, ticketCounter,
//   tipoPedido, showTkt,
//   divPagos, divNpIdx,
//   npCtx, npVal                 → ventas.js (monolito por ahora)
//   mesaActual, updMesaBtn,
//   mesaLimpiarAlPagar           → mesas.js (monolito por ahora)
//   registrarVentaEnTurno,
//   getTimbradoActivo,
//   avanzarNroFactura            → turno/db (monolito por ahora)
//   generarRecibo, imprimirComanda → impresion.js (monolito por ahora)
//   agregarMontoDelivery         → ventas.js
//   SUPA_URL, SUPA_ANON, USAR_DEMO → db/licencia (monolito por ahora)
//   cierreTotal, cierreMetodos,
//   cierreNpMetodo, updCierreDiff  → turno/cierre (monolito por ahora)
// ============================================================

// ── IR A COBRAR ─────────────────────────────────────────────

/**
 * Setup visual de la pantalla de cobro — actualiza ctotal, métodos, etc.
 * Llamada desde goCobrar() en index.html cuando MODO_TERMINAL === 'caja'.
 * NO hacer goTo() aquí — lo hace goCobrar() después de llamar esta función.
 * Nombre interno: _goCobrarSetup para evitar colisión con index.html.
 */
function _goCobrarSetup() {
  const t = calcTotal();
  if (!t) { toast('Agregá productos primero'); return; }

  document.getElementById('ctotal').textContent = gs(t);
  document.getElementById('efecVal').textContent = gs(t);

  // Fila de descuento — visible solo si hay descuento activo
  const row     = document.getElementById('descTicketRow');
  const montoEl = document.getElementById('descTicketMonto');
  if (row)     row.style.display = ticketDescuento > 0 ? 'flex' : 'none';
  if (montoEl) montoEl.textContent = '-' + gs(calcDescuentoMonto());

  const btn = document.getElementById('btnDescTicket');
  if (btn) btn.textContent = ticketDescuento > 0 ? ticketDescuento + '% DESC' : '% DESC';

  // Seleccionar Efectivo por defecto
  document.querySelectorAll('.pay-btn').forEach((b, i) => b.classList.toggle('sel', i === 0));

  // Multi-moneda: mostrar panel MM si esta activo, sino panel normal
  var _mmActivoSetup = localStorage.getItem('mm_activo') === '1';
  var _mmSecSetup = document.getElementById('mmSec');
  if (_mmActivoSetup && _mmSecSetup) {
    document.getElementById('efecSec').style.display = 'none';
    _mmSecSetup.style.display = 'block';
    // Reset valores MM al abrir la pantalla de cobro
    _mmVals.gs = 0; _mmVals.brl = 0; _mmVals.ars = 0;
    var _sgEl = document.getElementById('mmGsVal');
    var _sbEl = document.getElementById('mmBrlVal');
    var _saEl = document.getElementById('mmArsVal');
    var _sbeEl = document.getElementById('mmBrlEq');
    var _saeEl = document.getElementById('mmArsEq');
    var _stEl = document.getElementById('mmTotalRec');
    var _svEl = document.getElementById('mmVueltoAmt');
    var _svrEl = document.getElementById('mmVueltoRow');
    if (_sgEl) _sgEl.textContent = gs(0);
    if (_sbEl) _sbEl.textContent = '0';
    if (_saEl) _saEl.textContent = '0';
    if (_sbeEl) _sbeEl.textContent = '= ' + gs(0);
    if (_saeEl) _saeEl.textContent = '= ' + gs(0);
    if (_stEl) _stEl.textContent = gs(0);
    if (_svEl) _svEl.textContent = gs(0);
    if (_svrEl) _svrEl.classList.remove('show');
  } else {
    document.getElementById('efecSec').style.display = 'block';
    if (_mmSecSetup) _mmSecSetup.style.display = 'none';
  }

  document.getElementById('vueltoRow').classList.remove('show');
  document.getElementById('compSec').classList.remove('open');
  document.getElementById('npLbl').textContent = 'Efectivo recibido';

  // goTo('scCobrar') lo hace goCobrar() en index.html — no duplicar navegación
  // Mostrar/ocultar botón comanda según config
  if(typeof updBtnComandaCobro === 'function') updBtnComandaCobro();
}

// ── MÉTODO DE PAGO ───────────────────────────────────────────

/**
 * Selecciona el método de pago y actualiza la UI.
 * @param {HTMLElement} btn  - Botón presionado
 * @param {string}      m    - 'efectivo' | 'pos' | 'transferencia'
 */
function selPay(btn, m) {
  document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');

  // Multi-moneda: cuando esta activo, EFECTIVO muestra el panel MM en vez del normal
  var _mmAct = localStorage.getItem('mm_activo') === '1';
  var _mmS = document.getElementById('mmSec');
  if (_mmAct && m === 'efectivo') {
    document.getElementById('efecSec').style.display = 'none';
    if (_mmS) _mmS.style.display = 'block';
  } else {
    document.getElementById('efecSec').style.display = m === 'efectivo' ? 'block' : 'none';
    if (_mmS) _mmS.style.display = 'none';
  }

  const comp      = document.getElementById('compSec');
  const needsComp = m === 'pos' || m === 'transferencia';
  comp.classList.toggle('open', needsComp);

  if (!needsComp) {
    const d = document.getElementById('compDisplay');
    if (d) { d.textContent = '—'; d.style.color = '#ccc'; }
  }
}

// ── DESCUENTO EN TICKET ──────────────────────────────────────

/**
 * Abre un prompt para ingresar el % de descuento del ticket.
 * Ingresá 0 para quitar el descuento activo.
 */
function abrirDescTicket() {
  const actual = ticketDescuento > 0 ? ticketDescuento : '';
  const val    = prompt('Descuento en ticket total (%) — Ingresá 0 para quitar:', actual);
  if (val === null) return;

  const pct = Math.min(100, Math.max(0, parseFloat(val) || 0));
  setTicketDescuento(pct);
  updUI();

  const t       = calcTotal();
  const monto   = calcDescuentoMonto();
  const row     = document.getElementById('descTicketRow');
  const montoEl = document.getElementById('descTicketMonto');
  const descBtn = document.getElementById('btnDescTicket');

  if (row)     row.style.display = pct > 0 ? 'flex' : 'none';
  if (montoEl) montoEl.textContent = '-' + gs(monto);
  if (descBtn) descBtn.textContent = pct > 0 ? pct + '% DESC' : '% DESC';

  document.getElementById('ctotal').textContent = gs(t);
  document.getElementById('efecVal').textContent = gs(t);

  if (pct > 0) toast('Descuento ' + pct + '% aplicado — ' + gs(monto) + ' de descuento');
  else         toast('Descuento eliminado');
}

// ── NUMPAD ───────────────────────────────────────────────────

/**
 * Abre el teclado numérico con el contexto dado.
 *
 * Contextos:
 *   'cobrar'      → monto en efectivo recibido
 *   'comprobante' → número de comprobante POS/transferencia
 *   'shift'       → efectivo inicial del turno
 *   'delivery'    → monto del envío
 *   'div'         → monto de un pago dividido
 *   'divComp'     → comprobante de un pago dividido
 *   'ruc'         → RUC del cliente (factura)
 *   'cierreTotal' / 'cierre_X' → conteo de cierre
 *
 * @param {string} ctx
 */
function openNP(ctx) {
  setNpCtx(ctx);
  setNpVal('');

  const labels = {
    shift:          'Efectivo inicial',
    cobrar:         'Efectivo recibido',
    comprobante:    'Nro. de Comprobante',
    mm_gs:          'Guaranies recibidos',
    mm_brl:         'Reales (R$)',
    mm_ars:         'Pesos Arg. ($)',
    cierre_arq_BRL: 'Reales (R$) en caja',
    cierre_arq_ARS: 'Pesos Arg. ($) en caja',
  };

  if (!ctx.startsWith('cierre_')) {
    document.getElementById('npLbl').textContent = labels[ctx] || 'Cantidad';
  }

  if (ctx === 'comprobante') {
    const cur = document.getElementById('compDisplay').textContent;
    setNpVal((cur === '—' || cur === '') ? '' : cur);
  }

  // Pre-poblar valores MM si ya se ingreso algo antes
  if (ctx === 'mm_gs'  && _mmVals.gs  > 0) setNpVal(String(_mmVals.gs));
  if (ctx === 'mm_brl' && _mmVals.brl > 0) setNpVal(String(_mmVals.brl));
  if (ctx === 'mm_ars' && _mmVals.ars > 0) setNpVal(String(_mmVals.ars));
  if (ctx === 'cierre_arq_BRL' && cierreArqueoBRL > 0) setNpVal(String(cierreArqueoBRL));
  if (ctx === 'cierre_arq_ARS' && cierreArqueoARS > 0) setNpVal(String(cierreArqueoARS));

  if (ctx === 'cierreTotal') {
    setNpVal(cierreTotal > 0 ? String(cierreTotal) : '');
    document.getElementById('npLbl').textContent = 'Total de valores contados';
  } else if (ctx.startsWith('cierre_')) {
    const m = ctx.replace('cierre_', '');
    cierreNpMetodo = m;
    if (m === 'TOTAL') {
      setNpVal(cierreTotal > 0 ? String(cierreTotal) : '');
      document.getElementById('npLbl').textContent = 'Total contado';
    } else {
      setNpVal(cierreMetodos[m] && cierreMetodos[m].contado > 0 ? String(cierreMetodos[m].contado) : '');
      document.getElementById('npLbl').textContent = 'Conteo ' + m;
    }
  }

  // Display inicial del numpad segun contexto
  var _npInitV = parseInt(npVal) || 0;
  if (ctx === 'mm_brl' || ctx === 'cierre_arq_BRL') {
    document.getElementById('npDisp').textContent = npVal ? 'R$ ' + _npInitV : 'R$ 0';
  } else if (ctx === 'mm_ars' || ctx === 'cierre_arq_ARS') {
    document.getElementById('npDisp').textContent = npVal ? '$ ' + _npInitV : '$ 0';
  } else if (ctx === 'comprobante') {
    document.getElementById('npDisp').textContent = npVal || '—';
  } else {
    document.getElementById('npDisp').textContent = npVal ? gs(_npInitV) : '₲0';
  }
  document.getElementById('billetesRow').classList.toggle('show', ctx === 'cobrar');
  document.getElementById('npOverlay').classList.add('open');
}

/** Cierra el numpad al tocar fuera del overlay */
function npOutside(e) {
  if (e.target === document.getElementById('npOverlay')) {
    if (npCtx && npCtx.startsWith('texto_')) cerrarNpTexto();
    document.getElementById('npOverlay').classList.remove('open');
  }
}

/**
 * Presionar un dígito en el numpad.
 * @param {string} d — dígito '0'-'9' o '000'
 */
function npP(d) {
  const esTexto = npCtx === 'comprobante' || npCtx === 'divComp' || npCtx === 'ruc';
  if (esTexto) {
    setNpVal(npVal + d);
    if (npVal.length > 15) setNpVal(npVal.slice(0, 15));
    document.getElementById('npDisp').textContent = npVal || '—';
  } else {
    if (npVal === '0' && d !== '000') setNpVal(d); else setNpVal(npVal + d);
    if (npVal.length > 10) setNpVal(npVal.slice(0, 10));
    var _pV = parseInt(npVal) || 0;
    if (npCtx === 'mm_brl' || npCtx === 'cierre_arq_BRL') {
      document.getElementById('npDisp').textContent = 'R$ ' + _pV;
    } else if (npCtx === 'mm_ars' || npCtx === 'cierre_arq_ARS') {
      document.getElementById('npDisp').textContent = '$ ' + _pV;
    } else {
      document.getElementById('npDisp').textContent = gs(_pV);
    }
  }
}

/** Tecla borrar del numpad */
function npD() {
  setNpVal(npVal.slice(0, -1));
  const esTexto = npCtx === 'comprobante' || npCtx === 'divComp' || npCtx === 'ruc';
  if (esTexto) {
    document.getElementById('npDisp').textContent = npVal || '—';
  } else {
    var _dV = parseInt(npVal) || 0;
    if (npCtx === 'mm_brl' || npCtx === 'cierre_arq_BRL') {
      document.getElementById('npDisp').textContent = 'R$ ' + _dV;
    } else if (npCtx === 'mm_ars' || npCtx === 'cierre_arq_ARS') {
      document.getElementById('npDisp').textContent = '$ ' + _dV;
    } else {
      document.getElementById('npDisp').textContent = gs(_dV);
    }
  }
}

/** Confirmar el valor ingresado en el numpad */
function npOK() {
  const v = parseInt(npVal) || 0;

  if (npCtx === 'shift') {
    document.getElementById('shiftDisp').textContent = gs(v);

  } else if (npCtx === 'div') {
    divPagos[divNpIdx].monto = v;
    // Recalcular los otros pagos no cobrados para que la suma cierre el total
    if (typeof divAjustarRestantes === 'function') divAjustarRestantes(divNpIdx);
    document.getElementById('npOverlay').classList.remove('open');
    renderDivList();
    updDivRestante();
    return;

  } else if (npCtx === 'cierreTotal') {
    cierreTotal = v;
    const disp = document.getElementById('cierreTotalDisp');
    if (disp) disp.textContent = gs(v);
    updCierreDiff();
    document.getElementById('npOverlay').classList.remove('open');
    return;

  } else if (npCtx === 'cierre_arq_BRL') {
    cierreArqueoBRL = v;
    if(typeof updCierreMMTotal === 'function') updCierreMMTotal();
    document.getElementById('npOverlay').classList.remove('open');
    return;

  } else if (npCtx === 'cierre_arq_ARS') {
    cierreArqueoARS = v;
    if(typeof updCierreMMTotal === 'function') updCierreMMTotal();
    document.getElementById('npOverlay').classList.remove('open');
    return;

  } else if (npCtx.startsWith('cierre_')) {
    const m = cierreNpMetodo || npCtx.replace('cierre_', '');
    if (m === 'TOTAL') {
      var _cMM = localStorage.getItem('mm_activo') === '1';
      if(_cMM){
        cierreArqueoGS = v;
        if(typeof updCierreMMTotal === 'function') updCierreMMTotal();
      } else {
        cierreTotal = v;
        const disp = document.getElementById('cierreVal_TOTAL');
        if (disp) disp.textContent = gs(v);
      }
    } else {
      if (cierreMetodos[m]) cierreMetodos[m].contado = v;
      const disp = document.getElementById('cierreVal_' + m);
      if (disp) disp.textContent = gs(v);
      cierreTotal = Object.values(cierreMetodos).reduce((s, d) => s + d.contado, 0);
      const dispT = document.getElementById('cierreVal_TOTAL');
      if (dispT) dispT.textContent = gs(cierreTotal);
    }
    if (cierreTotal > 0) {
      const tDisp = document.getElementById('cierreTotalDisp');
      if (tDisp) tDisp.textContent = gs(cierreTotal);
    }
    updCierreDiff();
    document.getElementById('npOverlay').classList.remove('open');
    return;

  } else if (npCtx === 'delivery') {
    const monto = parseInt(npVal) || 0;
    if (monto > 0) {
      const tabInp = document.getElementById('tabDeliveryMonto');
      if (tabInp) tabInp.value = monto;
      agregarMontoDelivery();
    }
    document.getElementById('npOverlay').classList.remove('open');
    return;

  } else if (npCtx.startsWith('texto_')) {
    const campo = npCtx.replace('texto_', '');
    const ti    = document.getElementById('npTextInput');
    const val   = (ti ? ti.value : npVal).trim();
    if (campo === 'ruc') {
      const el = document.getElementById('factRuc');
      if (el) { el.value = val; onRucInput(); }
    } else if (campo === 'nombre') {
      const el = document.getElementById('factNombre');
      if (el) el.value = val;
    }
    cerrarNpTexto();
    document.getElementById('npOverlay').classList.remove('open');
    return;

  } else if (npCtx === 'ruc') {
    const elRuc = document.getElementById('factRuc');
    if (elRuc) {
      elRuc.value = npVal;
      document.getElementById('npOverlay').classList.remove('open');
      if (npVal.replace(/-/g, '').length >= 5) setTimeout(consultarRuc, 200);
    } else {
      document.getElementById('npOverlay').classList.remove('open');
    }
    return;

  } else if (npCtx === 'comprobante') {
    const display = document.getElementById('compDisplay');
    display.textContent = npVal || '—';
    display.style.color = npVal ? '#fff' : '#ccc';
    document.getElementById('npOverlay').classList.remove('open');
    return;

  } else if (npCtx === 'divComp') {
    divPagos[divNpIdx].comprobante = npVal;
    const disp = document.getElementById('divCompDisp' + divNpIdx);
    if (disp) { disp.textContent = npVal || '—'; disp.style.color = npVal ? '#fff' : '#666'; }
    document.getElementById('npOverlay').classList.remove('open');
    return;

  } else if (npCtx === 'mm_gs') {
    _mmVals.gs = v;
    var _mmGsDisp = document.getElementById('mmGsVal');
    if (_mmGsDisp) _mmGsDisp.textContent = gs(v);
    updMMTotal();
    document.getElementById('npOverlay').classList.remove('open');
    return;

  } else if (npCtx === 'mm_brl') {
    _mmVals.brl = v;
    var _mmBrlDisp = document.getElementById('mmBrlVal');
    if (_mmBrlDisp) _mmBrlDisp.textContent = String(v);
    updMMTotal();
    document.getElementById('npOverlay').classList.remove('open');
    return;

  } else if (npCtx === 'mm_ars') {
    _mmVals.ars = v;
    var _mmArsDisp = document.getElementById('mmArsVal');
    if (_mmArsDisp) _mmArsDisp.textContent = String(v);
    updMMTotal();
    document.getElementById('npOverlay').classList.remove('open');
    return;

  } else {
    // ctx === 'cobrar' → monto efectivo
    document.getElementById('efecVal').textContent = gs(v);
    updVuelto(v);
  }

  document.getElementById('npOverlay').classList.remove('open');
}

// Teclado físico → numpad
document.addEventListener('keydown', function (e) {
  const ov = document.getElementById('npOverlay');
  if (!ov || !ov.classList.contains('open')) return;
  if (npCtx && npCtx.startsWith('texto_')) return;
  if (e.key >= '0' && e.key <= '9') { e.preventDefault(); npP(e.key); }
  else if (e.key === 'Backspace')   { e.preventDefault(); npD(); }
  else if (e.key === 'Enter')       { e.preventDefault(); npOK(); }
  else if (e.key === 'Escape')      { e.preventDefault(); cerrarNpTexto(); ov.classList.remove('open'); }
});

// ── VUELTO ───────────────────────────────────────────────────

// ── BILLETES RÁPIDOS en scCobrar — 1 tap sin abrir numpad ──
// Setea directamente el valor del efectivo recibido y calcula el vuelto.
// Si el billete tocado es MENOR al total, suma (por si el usuario va
// acumulando billetes para llegar al total). Si es MAYOR, reemplaza.
function setEfectivoBillete(monto) {
  // Modo multi-moneda: los billetes rapidos suman al campo GS del panel MM
  if (localStorage.getItem('mm_activo') === '1') {
    var total    = calcTotal();
    var cotBRL   = parseFloat(localStorage.getItem('mm_cotBRL')) || 0;
    var cotARS   = parseFloat(localStorage.getItem('mm_cotARS')) || 0;
    var totalRec = _mmVals.gs + Math.round(_mmVals.brl * cotBRL) + Math.round(_mmVals.ars * cotARS);
    if (_mmVals.gs === 0 || totalRec >= total) {
      _mmVals.gs = monto;
    } else {
      _mmVals.gs = _mmVals.gs + monto;
    }
    var elGs = document.getElementById('mmGsVal');
    if (elGs) elGs.textContent = gs(_mmVals.gs);
    updMMTotal();
    if (typeof sndTap === 'function') sndTap();
    return;
  }
  // Modo normal: modifica el campo de efectivo GS unico
  var total = calcTotal();
  var current = parseInt((document.getElementById('efecVal').textContent || '0').replace(/[^0-9]/g,'')) || 0;
  var nuevo;
  if(current === 0 || current >= total){
    // Primera tap o ya completo: reemplaza
    nuevo = monto;
  } else {
    // Va acumulando hasta llegar al total
    nuevo = current + monto;
  }
  document.getElementById('efecVal').textContent = gs(nuevo);
  updVuelto(nuevo);
  // Sonido de feedback
  if(typeof sndTap === 'function') sndTap();
}

// ── EFECTIVO JUSTO — setea el monto exacto del total ──
function setEfectivoJusto() {
  var total = calcTotal();
  // Modo multi-moneda: pone el total exacto en GS y limpia BRL/ARS
  if (localStorage.getItem('mm_activo') === '1') {
    _mmVals.gs = total; _mmVals.brl = 0; _mmVals.ars = 0;
    var elGs  = document.getElementById('mmGsVal');
    var elBrl = document.getElementById('mmBrlVal');
    var elArs = document.getElementById('mmArsVal');
    if (elGs)  elGs.textContent  = gs(total);
    if (elBrl) elBrl.textContent = '0';
    if (elArs) elArs.textContent = '0';
    updMMTotal();
    if (typeof sndTap === 'function') sndTap();
    return;
  }
  document.getElementById('efecVal').textContent = gs(total);
  updVuelto(total);
  if(typeof sndTap === 'function') sndTap();
}

/**
 * Calcula y muestra el vuelto.
 * @param {number} entregado — monto en efectivo recibido
 */
var _vueltoVozTimer = null;
var _vueltoUltimo = 0;

// Estado de valores multi-moneda ingresados en el panel MM
var _mmVals = { gs: 0, brl: 0, ars: 0 };
function updVuelto(entregado) {
  const total  = calcTotal();
  const vuelto = entregado - total;
  const row    = document.getElementById('vueltoRow');
  if (vuelto > 0) {
    document.getElementById('vueltoAmt').textContent = gs(vuelto);
    row.classList.add('show');
    // Voz anuncia el vuelto con debounce — evita hablar con cada tap de billetes rápidos
    if (typeof hablarVuelto === 'function' && vuelto !== _vueltoUltimo) {
      _vueltoUltimo = vuelto;
      clearTimeout(_vueltoVozTimer);
      _vueltoVozTimer = setTimeout(function(){ hablarVuelto(vuelto); }, 250);
    }
  } else {
    row.classList.remove('show');
    _vueltoUltimo = 0;
  }
}

// ── MULTI-MONEDA — recalcular total y vuelto ─────────────────
/**
 * Recalcula el total recibido en GS y el vuelto cuando hay pago multi-moneda.
 * Lee _mmVals.gs / _mmVals.brl / _mmVals.ars y las cotizaciones de localStorage.
 */
function updMMTotal() {
  var total    = calcTotal();
  var cotBRL   = parseFloat(localStorage.getItem('mm_cotBRL')) || 0;
  var cotARS   = parseFloat(localStorage.getItem('mm_cotARS')) || 0;
  var brlEnGs  = Math.round(_mmVals.brl * cotBRL);
  var arsEnGs  = Math.round(_mmVals.ars * cotARS);
  var totalRec = _mmVals.gs + brlEnGs + arsEnGs;
  var vuelto   = Math.max(0, totalRec - total);

  var elBrlEq = document.getElementById('mmBrlEq');
  var elArsEq = document.getElementById('mmArsEq');
  var elTot   = document.getElementById('mmTotalRec');
  var elVue   = document.getElementById('mmVueltoAmt');
  var elVRow  = document.getElementById('mmVueltoRow');

  if (elBrlEq) elBrlEq.textContent = '= ' + gs(brlEnGs);
  if (elArsEq) elArsEq.textContent = '= ' + gs(arsEnGs);
  if (elTot)   elTot.textContent   = gs(totalRec);
  if (elVue)   elVue.textContent   = gs(vuelto);
  if (elVRow)  elVRow.classList.toggle('show', vuelto > 0);

  // Anunciar vuelto por voz con debounce (mismo patron que updVuelto)
  if (vuelto > 0 && typeof hablarVuelto === 'function' && vuelto !== _vueltoUltimo) {
    _vueltoUltimo = vuelto;
    clearTimeout(_vueltoVozTimer);
    _vueltoVozTimer = setTimeout(function(){ hablarVuelto(vuelto); }, 250);
  } else if (vuelto === 0) {
    _vueltoUltimo = 0;
  }
}

// ── BILLETES RÁPIDOS ─────────────────────────────────────────

/**
 * Suma un billete rápido al monto del numpad.
 * @param {number} val — denominación del billete (ej: 50000)
 */
function npBillete(val) {
  const current = parseInt(npVal) || 0;
  setNpVal(String(current + val));
  if (npVal.length > 10) setNpVal(npVal.slice(0, 10));
  const total = parseInt(npVal);
  document.getElementById('npDisp').textContent = gs(total);
  document.getElementById('efecVal').textContent = gs(total);
  updVuelto(total);
}

// ── NUMPAD TEXTO (RUC / Nombre) ──────────────────────────────

/**
 * En móvil, en vez de abrir el teclado virtual, usa el overlay
 * del numpad con un campo texto propio para RUC y Nombre.
 *
 * @param {string}      ctx     - 'ruc' | 'nombre'
 * @param {HTMLElement} inputEl - El input original
 */
function openNpTexto(ctx, inputEl) {
  if (window.innerWidth >= 700) return;
  inputEl.blur();
  setTimeout(function () { inputEl.blur(); }, 10);
  setNpCtx('texto_' + ctx);
  setNpVal(inputEl.value || '');
  const labels = { ruc: 'RUC / C.I.', nombre: 'Razón Social / Nombre' };
  document.getElementById('npLbl').textContent = labels[ctx] || ctx;
  document.getElementById('npDisp').style.display = 'none';
  document.getElementById('billetesRow').classList.remove('show');
  const grid = document.getElementById('npGrid');
  if (grid) grid.style.display = 'none';
  const ti = document.getElementById('npTextInput');
  ti.style.display = 'block';
  ti.value = npVal;
  ti.autocapitalize = ctx === 'nombre' ? 'words' : 'off';
  document.getElementById('npOverlay').classList.add('open');
  setTimeout(function () { ti.focus(); }, 300);
}

/** Restaura el numpad numérico después del modo texto */
function cerrarNpTexto() {
  document.getElementById('npDisp').style.display = '';
  const ng = document.getElementById('npGrid');
  if (ng) ng.style.display = '';
  const ti = document.getElementById('npTextInput');
  if (ti) { ti.style.display = 'none'; ti.value = ''; }
  setNpCtx('');
}

/** Abre el numpad numérico para ingresar el RUC */
function openNpRuc() {
  setNpCtx('ruc');
  setNpVal(document.getElementById('factRuc').value.trim() || '');
  document.getElementById('npLbl').textContent  = 'RUC / C.I.';
  document.getElementById('npDisp').textContent = npVal || '—';
  document.getElementById('billetesRow').classList.remove('show');
  document.getElementById('npOverlay').classList.add('open');
}

/** Abre el numpad para ingresar el monto del delivery */
function openNpDelivery() {
  const existing = cart.find(function (i) { return i.esDelivery; });
  setNpCtx('delivery');
  setNpVal(existing ? String(existing.price) : '');
  document.getElementById('npLbl').textContent  = 'Monto del envío (Delivery)';
  document.getElementById('npDisp').textContent = existing ? gs(existing.price) : '₲0';
  document.getElementById('billetesRow').classList.remove('show');
  document.getElementById('npOverlay').classList.add('open');
}

// ── FACTURACIÓN ──────────────────────────────────────────────

var facturaActiva        = false;
var rucTimer             = null;
var timbradoSeleccionado = null;
var timbradoSession      = null;

// Revert BUG-09: el banner persistente tapaba el topbar de scSale (position:fixed top:0
// sobre pantallas position:absolute top:0, el padding-top del body no las empuja).
// Se vuelve al toast on-demand cuando el usuario intenta facturar; los toasts de
// "Sin timbrado configurado" siguen en cobro.js:905 (facturar) y turno.js:581/679.
// Polyfill defensivo: si código viejo llama a las funciones removidas, no rompe.
if (typeof window !== 'undefined') {
  if (typeof window.mostrarBannerSinTimbrado !== 'function') window.mostrarBannerSinTimbrado = function(){};
  if (typeof window.ocultarBannerSinTimbrado !== 'function') window.ocultarBannerSinTimbrado = function(){};
}

/**
 * Carga el timbrado activo para esta sesión desde Supabase
 * y lo guarda en localStorage como fallback offline.
 */
async function cargarTimbradoSesion() {
  const terminal = localStorage.getItem('pos_terminal') || 'Terminal 1';
  const email    = localStorage.getItem('lic_email');
  if (!email || USAR_DEMO) { timbradoSession = getTimbradoActivo(); return; }

  try {
    const r = await fetch(SUPA_URL + '/rest/v1/rpc/get_timbrado_terminal', {
      method: 'POST',
      headers: {
        'apikey':        SUPA_ANON,
        'Authorization': 'Bearer ' + SUPA_ANON,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ p_email: email, p_terminal: terminal }),
    });
    const d = await r.json();
    if (d && d.nro) {
      window._timbradoCache = d;
      localStorage.setItem('pos_timbrado_activo', JSON.stringify(d));
      const tims = [{ ...d, asignaciones: [{ terminal, punto_exp: d.punto_exp, nro_actual: d.nro_actual }] }];
      localStorage.setItem('pos_timbrados', JSON.stringify(tims));
      localStorage.setItem('pos_timbrados_mapa', JSON.stringify({ [terminal]: { timIdx: 0, asigIdx: 0 } }));
      timbradoSession = d;
      _log('[Timbrado] <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 16 9"/></svg> Cargado:', d.nro, '| Próx.:', getNroFactura(d));
    } else {
      console.warn('[Timbrado] Sin asignación para terminal:', terminal, d);
      timbradoSession = getTimbradoActivo();
    }
  } catch (e) {
    console.warn('[Timbrado] Error RPC:', e.message);
    timbradoSession = getTimbradoActivo();
    // En error de red NO mostramos el banner — puede ser un blip transitorio y
    // tenemos el cache local como fallback. Solo se muestra cuando confirmamos
    // que el server respondió "sin asignación".
  }
}

/**
 * Activa o desactiva el formulario de factura.
 * Valida que haya timbrado vigente antes de abrir.
 */
function toggleFactura() {
  if (!facturaActiva) {
    let tims = [];
    try { tims = JSON.parse(localStorage.getItem('pos_timbrados') || '[]'); } catch (e) {}
    const hoy      = new Date();
    const vigentes = tims.filter(t =>
      t.tipo === 'electronico' || (t.vig_fin ? new Date(t.vig_fin + ' 00:00:00') >= hoy : true)
    );
    if (!vigentes.length) {
      toast('Sin timbrado configurado. Configurá uno en Panel Admin → Administración');
      return;
    }
  }

  facturaActiva = !facturaActiva;
  document.getElementById('facturaForm').classList.toggle('open', facturaActiva);
  document.getElementById('facturaToggle').classList.toggle('active', facturaActiva);
  document.getElementById('facturaBadge').textContent = facturaActiva ? 'ACTIVA' : 'OPCIONAL';

  if (facturaActiva) {
    mostrarSelectorTimbrado();
    setTimeout(() => { const r = document.getElementById('factRuc'); if (r) r.focus(); }, 300);
  } else {
    timbradoSeleccionado = null;
  }
}

/** Renderiza el selector de timbrado en el formulario de factura */
function mostrarSelectorTimbrado() {
  const infoEl = document.getElementById('timbradoInfo');
  if (!infoEl) return;

  let tims = [];
  try { tims = JSON.parse(localStorage.getItem('pos_timbrados') || '[]'); } catch (e) {}
  const hoy      = new Date();
  const vigentes = tims.filter(t =>
    t.tipo === 'electronico' || (t.vig_fin ? new Date(t.vig_fin + ' 00:00:00') >= hoy : true)
  );

  if (!vigentes.length) {
    infoEl.style.display = 'block';
    infoEl.innerHTML =
      '<div style="display:flex;align-items:center;gap:8px;padding:4px 0;">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef5350" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
      '<span style="font-size:13px;color:#ef5350;font-weight:700;">Sin timbrado configurado</span></div>' +
      '<div style="font-size:12px;color:#666;margin-top:2px;">Configurá un punto de expedición en el ' +
      '<b style="color:#aaa">Panel Admin → Administración</b></div>';
    timbradoSeleccionado = null;
    return;
  }

  const autoTim = getTimbradoActivo();
  if (autoTim && vigentes.find(t => t.nro === autoTim.nro)) {
    timbradoSeleccionado = autoTim;
    renderTimbradoBanner(infoEl, autoTim, vigentes);
    return;
  }
  if (vigentes.length === 1) {
    timbradoSeleccionado = vigentes[0];
    renderTimbradoBanner(infoEl, vigentes[0], vigentes);
    return;
  }
  timbradoSeleccionado = null;
  renderTimbradoBanner(infoEl, null, vigentes);
}

/**
 * Dibuja el banner de timbrado (con selector dropdown si hay varios).
 * @param {HTMLElement} el       - Contenedor
 * @param {Object|null} selected - Timbrado actualmente seleccionado
 * @param {Array}       todos    - Todos los timbrados vigentes
 */
function renderTimbradoBanner(el, selected, todos) {
  const pad3 = n => String(n).padStart(3, '0');
  const padN = n => String(n).padStart(7, '0');

  const opts = todos.map((t, i) => {
    const nro   = pad3(t.sucursal) + '-' + pad3(t.punto_exp) + '-' + padN(t.nro_actual || t.desde);
    const label = 'Timb. ' + t.nro + ' · ' + nro
      + (t.nombre_suc ? ' (' + t.nombre_suc + ')' : '')
      + (t.asignado_a ? ' — ' + t.asignado_a : '');
    const sel = selected && selected.nro === t.nro ? 'selected' : '';
    return '<option value="' + i + '" ' + sel + '>' + label + '</option>';
  }).join('');

  let certAlert = '';
  if (selected && selected.tipo === 'electronico' && selected.cert_venc) {
    const dias = Math.ceil((new Date(selected.cert_venc + ' 00:00:00') - new Date()) / (1000 * 60 * 60 * 24));
    if (dias <= 30) certAlert = '<div style="font-size:11px;color:var(--orange);margin-top:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>️ Certificado vence en ' + dias + ' días</div>';
  }

  el.style.display = 'block';
  el.innerHTML =
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">' +
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4caf50" stroke-width="2">' +
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' +
    '<span style="font-size:11px;font-weight:700;color:var(--green);">PUNTO DE EXPEDICIÓN</span></div>' +
    '<select id="selTimbrado" onchange="onSelTimbrado(this)"' +
    ' style="width:100%;background:#111;border:1.5px solid #2a2a2a;border-radius:8px;color:#fff;' +
    'font-family:Barlow,sans-serif;font-size:13px;padding:10px 12px;outline:none;margin-bottom:4px;">' +
    '<option value="">— Seleccioná un timbrado —</option>' + opts + '</select>' +
    (selected
      ? '<div style="font-size:12px;color:#aaa;display:flex;justify-content:space-between;align-items:center;">' +
        '<span>Próx. factura: <b style="color:#fff;font-family:monospace;">' +
        pad3(selected.sucursal) + '-' + pad3(selected.punto_exp) + '-' + padN(selected.nro_actual || selected.desde) +
        '</b></span><span style="color:#555;">Timb. ' + selected.nro + '</span></div>' + certAlert
      : '<div style="font-size:12px;color:#ef5350;">Seleccioná un timbrado para facturar</div>');

  el._todos = todos;
}

/** Aplica la selección del dropdown de timbrado */
function onSelTimbrado(sel) {
  const el = document.getElementById('timbradoInfo');
  let tims = [];
  try { tims = JSON.parse(localStorage.getItem('pos_timbrados') || '[]'); } catch (e) {}
  const hoy      = new Date();
  const vigentes = tims.filter(t =>
    t.tipo === 'electronico' || (t.vig_fin ? new Date(t.vig_fin + ' 00:00:00') >= hoy : true)
  );
  const idx = parseInt(sel.value);
  if (isNaN(idx) || idx < 0) { timbradoSeleccionado = null; return; }
  timbradoSeleccionado = vigentes[idx];
  localStorage.setItem('pos_timbrado_activo', JSON.stringify(timbradoSeleccionado));
  renderTimbradoBanner(el, timbradoSeleccionado, vigentes);
}

/**
 * Devuelve el objeto de datos de factura si está activa, o null.
 * @returns {Object|null}
 */
function getFacturaData() {
  if (!facturaActiva) return null;
  const tim  = timbradoSeleccionado || getTimbradoActivo();
  const pad3 = n => String(n).padStart(3, '0');
  const padN = n => String(n).padStart(7, '0');
  const nroFact = tim ? pad3(tim.sucursal) + '-' + pad3(tim.punto_exp) + '-' + padN(tim.nro_actual || tim.desde) : '';
  return {
    ruc:           document.getElementById('factRuc').value.trim(),
    nombre:        document.getElementById('factNombre').value.trim(),
    direccion:     document.getElementById('factDireccion').value.trim(),
    timbrado:      tim ? tim.nro : '',
    nro_factura:   nroFact,
    tipo_timbrado: tim ? tim.tipo : 'autoimpresor',
    sucursal_nro:  tim ? pad3(tim.sucursal) : '',
    punto_exp:     tim ? pad3(tim.punto_exp) : '',
    fecha_desde:   tim ? (tim.vig_inicio || tim.fecha_desde || '') : '',
    fecha_hasta:   tim ? (tim.vig_fin    || tim.fecha_hasta || '') : '',
  };
}

/** Resetea el formulario de factura a su estado vacío */
function resetFactura() {
  facturaActiva = false;
  document.getElementById('facturaForm').classList.remove('open');
  document.getElementById('facturaToggle').classList.remove('active');
  document.getElementById('facturaBadge').textContent = 'OPCIONAL';
  document.getElementById('factRuc').value       = '';
  document.getElementById('factNombre').value    = '';
  document.getElementById('factDireccion').value = '';
}

// ── CONSULTA DE RUC ──────────────────────────────────────────

// Datos de RUC para modo demo / sin conexión
var RUC_DEMO = {
  '80069563':  { nombre: 'SUPERMERCADO LA ESTRELLA SA',   direccion: 'Av. Mcal. López 1234, Asunción' },
  '800695639': { nombre: 'SUPERMERCADO LA ESTRELLA SA',   direccion: 'Av. Mcal. López 1234, Asunción' },
  '1234567':   { nombre: 'JUAN CARLOS PÉREZ RODRÍGUEZ',   direccion: 'Calle Palma 456, Asunción' },
  '12345678':  { nombre: 'JUAN CARLOS PÉREZ RODRÍGUEZ',   direccion: 'Calle Palma 456, Asunción' },
  '3456789':   { nombre: 'RESTAURANTE EL BUEN SABOR SRL', direccion: 'Ruta 2 Km 12, San Lorenzo' },
  '5555555':   { nombre: 'COMERCIAL DON PEDRO SA',        direccion: 'Av. España 789, Asunción' },
};

/** Se dispara al escribir en el campo RUC — busca automáticamente */
function onRucInput() {
  const ruc = document.getElementById('factRuc').value.trim().replace(/-/g, '');
  setRucStatus('', '');
  clearTimeout(rucTimer);
  if (ruc.length >= 6) rucTimer = setTimeout(consultarRuc, 800);
}

/** Consulta el RUC en Supabase (tabla contribuyentes) */
async function consultarRuc() {
  const rucRaw    = document.getElementById('factRuc').value.trim();
  const rucLimpio = rucRaw.replace(/[-.\s]/g, '');

  if (!rucLimpio || rucLimpio.length < 6) {
    setRucStatus('Ingresá un RUC o CI válido', 'error');
    return;
  }

  setRucStatus('Consultando...', 'loading');
  const btn = document.getElementById('btnBuscarRuc');
  if (btn) btn.disabled = true;

  try {
    let encontrado = false;

    // Buscar por RUC exacto o por prefijo
    const query = rucLimpio.length >= 7
      ? 'ruc=eq.' + encodeURIComponent(rucLimpio) + '&limit=1'
      : 'ruc=like.' + encodeURIComponent(rucLimpio + '%') + '&estado=eq.ACTIVO&limit=1';

    const r = await fetch(
      SUPA_URL + '/rest/v1/contribuyentes?' + query + '&select=ruc,razon_social,dv,estado',
      { headers: { 'apikey': SUPA_ANON, 'Authorization': 'Bearer ' + SUPA_ANON, 'Accept': 'application/json' } }
    );

    if (r.ok) {
      const data = await r.json();
      if (data && data.length > 0) {
        const c = data[0];
        document.getElementById('factNombre').value = c.razon_social;
        document.getElementById('factRuc').value    = c.ruc + (c.dv ? '-' + c.dv : '');
        setRucStatus('' + c.razon_social + (c.estado !== 'ACTIVO' ? ' (' + c.estado + ')' : ''), c.estado === 'ACTIVO' ? 'ok' : 'warn');
        if(typeof hablarRazonSocial === 'function') hablarRazonSocial(c.razon_social);
        encontrado = true;
      }
    }

    // Reintentar sin el último dígito verificador
    if (!encontrado && rucLimpio.length >= 7) {
      const sinDv = rucLimpio.slice(0, -1);
      const r2    = await fetch(
        SUPA_URL + '/rest/v1/contribuyentes?ruc=eq.' + encodeURIComponent(sinDv) + '&select=ruc,razon_social,dv,estado&limit=1',
        { headers: { 'apikey': SUPA_ANON, 'Authorization': 'Bearer ' + SUPA_ANON, 'Accept': 'application/json' } }
      );
      if (r2.ok) {
        const data2 = await r2.json();
        if (data2 && data2.length > 0) {
          const c = data2[0];
          document.getElementById('factNombre').value = c.razon_social;
          document.getElementById('factRuc').value    = c.ruc + (c.dv ? '-' + c.dv : '');
          setRucStatus('' + c.razon_social + (c.estado !== 'ACTIVO' ? ' (' + c.estado + ')' : ''), c.estado === 'ACTIVO' ? 'ok' : 'warn');
          if(typeof hablarRazonSocial === 'function') hablarRazonSocial(c.razon_social);
          encontrado = true;
        }
      }
    }

    // Fallback datos demo
    if (!encontrado) {
      const demo = RUC_DEMO[rucLimpio] || RUC_DEMO[rucLimpio.slice(0, -1)];
      if (demo) {
        document.getElementById('factNombre').value = demo.nombre;
        setRucStatus('' + demo.nombre, 'ok');
        if(typeof hablarRazonSocial === 'function') hablarRazonSocial(demo.nombre);
        encontrado = true;
      }
    }

    if (!encontrado) {
      setRucStatus('No encontrado — ingresá los datos manualmente', 'warn');
      document.getElementById('factNombre').focus();
    }

  } catch (e) {
    console.warn('[RUC]', e.message);
    setRucStatus('Error de conexión — ingresá manualmente', 'error');
  }

  if (btn) btn.disabled = false;
}

/**
 * Muestra el estado de la consulta de RUC en el campo #rucStatus.
 * @param {string} msg  - Texto a mostrar
 * @param {string} type - 'ok' | 'error' | 'warn' | 'loading' | ''
 */
function setRucStatus(msg, type) {
  const el = document.getElementById('rucStatus');
  if (!el) return;
  el.textContent = msg;
  el.style.color = type === 'ok' ? '#4caf50' : type === 'error' ? '#e53935' : type === 'warn' ? '#ff9800' : '#888';
}

// ── CONFIRMACIÓN DE PAGO ─────────────────────────────────────

/**
 * Confirma y registra la venta.
 *
 * Flujo:
 *   1. Captura datos del ticket ANTES de limpiar
 *   2. Valida campos de factura si está activa
 *   3. Avanza el correlativo de factura si corresponde
 *   4. Limpia carrito y estado visual del cobro
 *   5. Registra la venta en el turno activo
 *   6. Genera el recibo y navega a scRecibo
 */
async function confirmarPago() {
  if (confirmarPago._running) return;
  confirmarPago._running = true;
  const _btnConfirmar = document.querySelector('.btn-confirmar');
  if (_btnConfirmar) _btnConfirmar.disabled = true;
  try {
  // ── Obtener fecha del servidor PRIMERO (antes de cualquier await posterior) ──
  // IMPORTANTE: debe ser lo primero en la función para que esté disponible
  // en registrarVentaEnTurno y generarRecibo más abajo.
  const _fechaVenta = (typeof obtenerFechaServidor === 'function')
    ? await obtenerFechaServidor()
    : new Date();

  // ── Capturar datos ANTES de limpiar ───────────────────────
  const totalVenta        = calcTotal();
  const itemsVenta        = JSON.parse(JSON.stringify(cart));
  const comprobante = document.getElementById('compDisplay') ? document.getElementById('compDisplay').textContent : '';

  // Multi-moneda: capturar datos del pago antes de limpiar
  var _mmActivoPago = localStorage.getItem('mm_activo') === '1';
  var _mmCotBRL = parseFloat(localStorage.getItem('mm_cotBRL')) || 0;
  var _mmCotARS = parseFloat(localStorage.getItem('mm_cotARS')) || 0;
  var _mmPagosConf = null;
  if (_mmActivoPago && (_mmVals.gs > 0 || _mmVals.brl > 0 || _mmVals.ars > 0)) {
    var _mmBrlGs = Math.round(_mmVals.brl * _mmCotBRL);
    var _mmArsGs = Math.round(_mmVals.ars * _mmCotARS);
    var _mmTotalRec = _mmVals.gs + _mmBrlGs + _mmArsGs;
    _mmPagosConf = {
      pagoGS:    _mmVals.gs,
      pagoBRL:   _mmVals.brl,   pagoBRLGs: _mmBrlGs,
      pagoARS:   _mmVals.ars,   pagoARSGs: _mmArsGs,
      cotBRL:    _mmCotBRL,
      cotARS:    _mmCotARS,
      totalGs:   _mmTotalRec,
      vueltoGS:  Math.max(0, _mmTotalRec - totalVenta),
    };
  }

  const efectivoEntregado = _mmPagosConf
    ? gs(_mmPagosConf.totalGs)
    : (document.getElementById('efecVal') ? document.getElementById('efecVal').textContent : '');
  const _vueltoRow = document.getElementById('vueltoRow');
  const vuelto = (_mmPagosConf && _mmPagosConf.vueltoGS > 0)
    ? gs(_mmPagosConf.vueltoGS)
    : ((_vueltoRow && _vueltoRow.classList.contains('show'))
        ? (document.getElementById('vueltoAmt') ? document.getElementById('vueltoAmt').textContent : '')
        : '');
  // Capturar descuento ANTES de resetTicketDescuento() y clearCart()
  const descTicketCopy    = ticketDescuento;
  const descMontoCopy     = calcDescuentoMonto();
  // Nombre del cliente (opcional, se ingresa con el icono persona en scSale)
  const clienteNombreCopy = (typeof clienteNombre !== 'undefined' && clienteNombre) ? clienteNombre : '';

  // Detectar si es pago dividido (divPagos definido en ventas.js)
  // Requiere que haya al menos 2 pagos cobrados con monto > 0
  const divArr = (typeof divPagos !== 'undefined' && Array.isArray(divPagos)) ? divPagos : [];
  const esDividido = divArr.length >= 2
    && divArr.every(p => p.cobrado)
    && divArr.some(p => p.monto > 0);
  const divPagosCopia = esDividido
    ? JSON.parse(JSON.stringify(divArr.filter(p => p.monto > 0)))
    : null;
  const metodoPago = esDividido
    ? divPagosCopia.map(p => p.metodo).join(' + ')
    : document.querySelector('.pay-btn.sel')?.textContent?.trim() || 'Efectivo';

  // Número de ticket — avanzar contador si es nuevo
  const nroTicket = currentTicketNro !== null ? currentTicketNro : ticketCounter;
  if (currentTicketNro === null) incrementTicketCounter();

  // ── Validaciones de factura ────────────────────────────────
  if (facturaActiva) {
    const elRuc    = document.getElementById('factRuc');
    const elNombre = document.getElementById('factNombre');
    const tim      = timbradoSeleccionado || getTimbradoActivo();

    if (!tim) {
      toast('Sin timbrado configurado. No se puede emitir factura.');
      return;
    }
    // Si no se ingresó cliente, facturar como consumidor final (DNIT)
    if (elRuc && !elRuc.value.trim())       elRuc.value    = 'X';
    if (elNombre && !elNombre.value.trim()) elNombre.value = 'SIN NOMBRE';
  }

  const facturaData = getFacturaData();

  // Avanzar correlativo si se emitió factura
  if (facturaData && facturaData.timbrado) {
    avanzarNroFactura(timbradoSeleccionado || getTimbradoActivo());
    timbradoSeleccionado = null;
    timbradoSession      = getTimbradoActivo();
  }

  // ── Limpiar estado ─────────────────────────────────────────
  resetTicketDescuento();
  // Descartar snapshot de nav (al cobrar se cierra el ciclo del cart en curso)
  if(typeof _cartEnCursoNavSnap !== 'undefined') _cartEnCursoNavSnap = null;
  cart.forEach(i => { delete i.desc; });
  // Limpiar divPagos para que no contamine la próxima venta normal
  clearDivPagos();

  // Limpiar valores multi-moneda
  _mmVals.gs = 0; _mmVals.brl = 0; _mmVals.ars = 0;
  var _mmSecLimpiar = document.getElementById('mmSec');
  if (_mmSecLimpiar) _mmSecLimpiar.style.display = 'none';

  // Capturar supabasePedidoId ANTES de limpiar pendientes
  // para poder marcar el pedido satélite como cobrado en Supabase
  var _supabasePedidoId = null;
  if (currentTicketNro !== null) {
    const idx = pendientes.findIndex(p => p.nro === currentTicketNro);
    if (idx >= 0) {
      _supabasePedidoId = pendientes[idx].supabasePedidoId || null;
      removePendiente(idx);
    }
    setCurrentTicketNro(null);
  }
  try { localStorage.setItem('pos_pendientes', JSON.stringify(pendientes)); } catch (e) {}

  clearCart();
  setShowTkt(false);
  updUI();
  updBtnGuardar();

  document.getElementById('tpanel').classList.remove('open');
  document.getElementById('prodView').style.display = 'flex';

  const compDisp = document.getElementById('compDisplay');
  if (compDisp) { compDisp.textContent = '—'; compDisp.style.color = '#ccc'; }
  document.getElementById('compSec').classList.remove('open');
  document.querySelectorAll('.pay-btn').forEach((b, i) => b.classList.toggle('sel', i === 0));
  document.getElementById('efecSec').style.display = 'block';
  document.getElementById('vueltoRow').classList.remove('show');

  // ── Registrar y mostrar recibo ─────────────────────────────
  registrarVentaEnTurno({
    items:          itemsVenta,
    total:          totalVenta,
    metodo:         metodoPago,
    comprobante:    comprobante === '—' ? '' : comprobante,
    factura:        facturaData,
    fecha:          _fechaVenta, // hora del servidor
    nroTicket,
    divPagos:       divPagosCopia,
    clienteNombre:  clienteNombreCopy,
    efectivo:       efectivoEntregado,
    vuelto:         vuelto,
    mmPagos:        _mmPagosConf,
    _supabasePedidoId, // UUID del pedido satelite (null si fue venta directa)
  });

  // Sonido de cobro exitoso — la voz del total ya se dijo al entrar a scCobrar,
  // y la voz del vuelto (si hay) también se dijo al calcularlo
  if(typeof sndCobro === 'function') sndCobro();

  mesaLimpiarAlPagar();
  resetFactura();

  // Obs general del ticket — leer del pendiente activo (cargada en scGuardar)
  let _obsGeneral = '';
  if(currentTicketNro !== null && typeof pendientes !== 'undefined'){
    const _idxObs = pendientes.findIndex(p => p.nro === currentTicketNro);
    if(_idxObs >= 0) _obsGeneral = pendientes[_idxObs].obs || '';
    if(_obsGeneral === 'Auto-guardado') _obsGeneral = '';
  }

  generarRecibo({
    items:       itemsVenta,
    total:       totalVenta,
    descTicket:  descTicketCopy,
    descMonto:   descMontoCopy,
    metodo:      metodoPago,
    comprobante: comprobante === '—' ? '' : comprobante,
    efectivo:    efectivoEntregado,
    vuelto:      vuelto,
    nroTicket,
    nroOrden:    nroTicket,
    tipoPedido:  tipoPedido || 'llevar',
    mesa:        mesaActual ? mesaActual.nombre : null,
    fecha:       _fechaVenta, // hora del servidor
    factura:     facturaData,
    divPagos:    divPagosCopia,
    clienteNombre: clienteNombreCopy,
    obs:         _obsGeneral,
    mmPagos:     _mmPagosConf,
  });
  } finally {
    confirmarPago._running = false;
    if (_btnConfirmar) _btnConfirmar.disabled = false;
  }
}

// ── RECIBO ───────────────────────────────────────────────────

/** Cierra el recibo, limpia la mesa y vuelve a ventas.
 *  Si todavía hay items en el cart (preview sin cobrar), NO resetea
 *  el tipo de pedido ni borra el delivery — el usuario sigue trabajando
 *  en esa venta. */
function finalizarRecibo() {
  // Cancelar countdown si estaba activo
  if (typeof cancelarCountdown === 'function') cancelarCountdown();
  if (cart && cart.length > 0) {
    // Solo imprimió el preview, la venta sigue activa — no tocar nada
    goTo('scSale');
    return;
  }
  clearMesaActual();
  updMesaBtn();
  setTipoPedido('llevar');
  goTo('scSale');
}
