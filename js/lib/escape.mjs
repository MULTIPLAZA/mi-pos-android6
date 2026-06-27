// ════════════════════════════════════════════════════════════
// NODO escape (ESM) — sanitizacion HTML / XSS
// ════════════════════════════════════════════════════════════
// Convierte caracteres especiales para insercion segura en innerHTML.
// USAR SIEMPRE para datos que vienen del usuario o del backend
// (nombres de cliente, observaciones, motivos, nombres de productos
// cargados por el cliente, etc.). Sin esto un cliente con nombre
// "<script>" inyecta XSS.
//
// Uso:
//   import { escapeHtml, esc } from './lib/escape.mjs';
//   element.innerHTML = '<div>' + esc(nombre) + '</div>';
// ════════════════════════════════════════════════════════════

export function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Alias mas corto para uso intensivo
export const esc = escapeHtml;

export default escapeHtml;
