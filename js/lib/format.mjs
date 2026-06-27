// ════════════════════════════════════════════════════════════
// NODO format (ESM) — formateo de numeros, fechas, moneda
// ════════════════════════════════════════════════════════════
// Uso:
//   import { gs } from './lib/format.mjs';
//   gs(15000) → "₲15.000"
//   gs(0)     → "₲0"
//   gs(null)  → "₲0"
// ════════════════════════════════════════════════════════════

/**
 * Formatea un numero como precio en guaranies (sin decimales).
 * Redondea valores fraccionados; null/undefined se tratan como 0.
 * @param {number|null|undefined} n
 * @returns {string} — "₲15.000"
 */
export function gs(n) {
  return '₲' + Math.round(n || 0).toLocaleString('es-PY');
}

export default gs;
