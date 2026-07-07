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

window.__nodoMonedaLoaded = true;
