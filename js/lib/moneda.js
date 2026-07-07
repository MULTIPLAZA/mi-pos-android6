// ════════════════════════════════════════════════════════════
// NODO POS — módulo multi-moneda centralizado
// Consolida las conversiones Gs⇄R$/ARS/USD que antes vivían
// reimplementadas por separado en hospedaje.js, turno.js, app.js
// y cobro.js (auditoría 2026-07-07). Un solo lugar, una sola
// política de redondeo, un solo criterio para cotización ausente.
// ════════════════════════════════════════════════════════════

/**
 * Cotización configurada para una moneda (Gs por 1 unidad de esa moneda).
 * @param {string} moneda 'BRL' | 'ARS' | 'USD'
 * @returns {number} 0 si no está configurada
 */
window.mmCotizacion = function(moneda) {
  var clave = { BRL: 'mm_cotBRL', ARS: 'mm_cotARS', USD: 'mm_cotUSD' }[moneda];
  if (!clave) return 0;
  return parseFloat(localStorage.getItem(clave)) || 0;
};

/**
 * Convierte un monto en Gs a su equivalente en moneda extranjera.
 * @param {number} montoGs
 * @param {number} cot cotización (Gs por 1 unidad) — usar mmCotizacion()
 * @param {number} [decimales=2]
 * @returns {number|null} null si la cotización no está configurada — el
 *   caller decide qué mostrar ante null, nunca se devuelve 0 silencioso.
 */
window.mmGsAExtranjera = function(montoGs, cot, decimales) {
  if (!cot || cot <= 0) return null;
  decimales = decimales === undefined ? 2 : decimales;
  var factor = Math.pow(10, decimales);
  return Math.round(((montoGs || 0) / cot) * factor) / factor;
};

/**
 * Convierte un monto en moneda extranjera a su equivalente en Gs.
 * @param {number} monto
 * @param {number} cot cotización (Gs por 1 unidad)
 * @param {string} [redondeo='round'] 'round' (normal) | 'ceil' (cobro con
 *   vuelto — redondear hacia arriba para no cobrar de menos)
 * @returns {number} 0 si la cotización no está configurada
 */
window.mmExtranjeraAGs = function(monto, cot, redondeo) {
  if (!cot || cot <= 0) return 0;
  var producto = (monto || 0) * cot;
  return redondeo === 'ceil' ? Math.ceil(producto) : Math.round(producto);
};

/**
 * Texto "≈ R$ X.XX" para mostrar el equivalente de un monto en Gs — mismo
 * formato en toda la app (reemplaza las 6 copias de hospedaje.js).
 * @param {number} montoGs
 * @param {string} [simbolo='R$']
 * @param {string} [moneda='BRL']
 * @returns {string} '' si no hay cotización o el monto es 0
 */
window.mmFormatoEquivalente = function(montoGs, simbolo, moneda) {
  simbolo = simbolo || 'R$';
  moneda = moneda || 'BRL';
  var cot = window.mmCotizacion(moneda);
  var equiv = window.mmGsAExtranjera(montoGs, cot, 2);
  if (equiv === null || !montoGs) return '';
  return ' (≈ ' + simbolo + ' ' + equiv.toFixed(2) + ')';
};

/**
 * Formatea un monto en Gs para las pantallas/tickets de caja (turno,
 * cierre) — en R$ si la cuenta declara caja en Reales (_cajaMonedaBRL(),
 * definida en app.js) y hay cotización configurada; si no, cae a gs()
 * (Guaraníes). Reemplaza gnT/gnCR/gnDiff (turno.js) y gnResumen (app.js),
 * que hacían exactamente esto por separado.
 * @param {number} montoGs
 * @returns {string}
 */
window.mmMontoCaja = function(montoGs) {
  if (typeof _cajaMonedaBRL === 'function' && _cajaMonedaBRL()) {
    var cot = window.mmCotizacion('BRL');
    var equiv = window.mmGsAExtranjera(montoGs, cot, 0);
    if (equiv !== null) return 'R$ ' + equiv.toLocaleString('es-PY');
  }
  return typeof gs === 'function' ? gs(montoGs) : String(Math.round(montoGs || 0));
};

/**
 * true si esta cuenta lleva la caja en DOS monedas simultáneas (Gs Y R$
 * reales, no un equivalente convertido) — hoteles de frontera que cobran
 * parte en guaraníes (transferencia, efectivo) y parte en reales (efectivo,
 * Pix) y necesitan saber cuánto tienen de cada uno en la caja física.
 * Distinto de _cajaMonedaBRL() (que es "todo en R$ como preferencia de
 * visualización") — acá se muestran las DOS columnas a la vez.
 */
window._cajaDobleMoneda = function(){
  return localStorage.getItem('caja_doble_moneda') === '1';
};

/**
 * Desglosa una venta en cuánto se cobró realmente en cada moneda/método,
 * inspeccionando la forma que corresponda (divPagos de un pago dividido,
 * pixMpPagos de un Pix/MP simple, mmPagos de un cobro multi-moneda simple,
 * o el total plano si no hay nada de eso). ARS/USD se reportan como su
 * equivalente en Gs (fuera de alcance de "dos monedas", que es Gs+R$).
 * @param {object} v una venta de turnoData.ventas
 * @returns {Array<{metodo:string, gs:number, brl:number}>}
 */
window.mmVentaMetodoMonedaBreakdown = function(v){
  var out = [];
  function add(metodo, gsV, brlV){
    metodo = (metodo || 'EFECTIVO').toUpperCase().trim();
    var existente = out.find(function(o){ return o.metodo === metodo; });
    if (!existente) { existente = { metodo: metodo, gs: 0, brl: 0 }; out.push(existente); }
    existente.gs += gsV || 0;
    existente.brl += brlV || 0;
  }
  if (v.divPagos && v.divPagos.length) {
    v.divPagos.forEach(function(p){
      if (p.montoBRL) add(p.metodo, 0, p.montoBRL);
      else add(p.metodo, p.monto || 0, 0);
    });
    return out;
  }
  if (v.pixMpPagos) {
    if (v.pixMpPagos.tipo === 'pix') {
      add('PIX', 0, v.pixMpPagos.monedaAmt || 0);
      var restoPix = (v.total || 0) - (v.pixMpPagos.monedaGs || 0);
      if (restoPix > 0) add(v.metodo, restoPix, 0);
    } else {
      add('MERCADO PAGO', v.pixMpPagos.monedaGs || 0, 0);
    }
    return out;
  }
  if (v.mmPagos) {
    if (v.mmPagos.pagoGS > 0)  add(v.metodo, v.mmPagos.pagoGS, 0);
    if (v.mmPagos.pagoBRL > 0) add(v.metodo, 0, v.mmPagos.pagoBRL);
    if (v.mmPagos.pagoARSGs > 0) add(v.metodo, v.mmPagos.pagoARSGs, 0);
    if (v.mmPagos.pagoUSDGs > 0) add(v.metodo, v.mmPagos.pagoUSDGs, 0);
    return out;
  }
  add(v.metodo, v.total || 0, 0);
  return out;
};

/**
 * Resumen de caja en dos monedas (Gs y R$) para un turno — agrega todas
 * las ventas (vía mmVentaMetodoMonedaBreakdown) y egresos (vía su
 * monedaOriginal/montoOriginal si se registraron en R$).
 * @param {object} turnoData
 * @returns {{metodos:Object, totalEntradaGs:number, totalEntradaBRL:number,
 *            totalSalidaGs:number, totalSalidaBRL:number}}
 */
window.mmTurnoDobleMonedaResumen = function(turnoData){
  var metodos = {};
  var totalGs = 0, totalBRL = 0;
  (turnoData.ventas || []).forEach(function(v){
    window.mmVentaMetodoMonedaBreakdown(v).forEach(function(c){
      if (!metodos[c.metodo]) metodos[c.metodo] = { gs: 0, brl: 0 };
      metodos[c.metodo].gs += c.gs;
      metodos[c.metodo].brl += c.brl;
      totalGs += c.gs;
      totalBRL += c.brl;
    });
  });
  var egresosGs = 0, egresosBRL = 0;
  (turnoData.egresos || []).filter(function(e){ return !e.anulada; }).forEach(function(e){
    if (e.monedaOriginal === 'BRL' && e.montoOriginal) egresosBRL += e.montoOriginal;
    else egresosGs += e.monto || 0;
  });
  // Ingresos manuales (ej. cobro de fiado) también suman a la entrada total,
  // en la moneda en la que realmente entraron.
  var ingresosGs = 0, ingresosBRL = 0;
  (turnoData.ingresos || []).forEach(function(i){
    if (i.monedaOriginal === 'BRL' && i.montoOriginal) ingresosBRL += i.montoOriginal;
    else ingresosGs += i.monto || 0;
  });
  return {
    metodos: metodos,
    // totalEntradaGs/BRL: solo ventas (mismo criterio que "Total Entrada" del
    // resumen en modo una sola moneda) — ingresosGs/BRL van aparte, para
    // "Movimientos de Caja" y para el cálculo de Saldo en Caja del cierre.
    totalEntradaGs: totalGs, totalEntradaBRL: totalBRL,
    totalSalidaGs: egresosGs, totalSalidaBRL: egresosBRL,
    ingresosGs: ingresosGs, ingresosBRL: ingresosBRL,
  };
};

window.__nodoMonedaLoaded = true;
