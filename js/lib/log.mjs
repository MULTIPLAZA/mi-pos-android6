// ════════════════════════════════════════════════════════════
// NODO log (ESM) — wrappers de console con flag DEBUG
// ════════════════════════════════════════════════════════════
// _log: solo escribe si window.DEBUG === true.
// USAR _log en vez de console.log para evitar leakear info en produccion.
// _warn / _err siempre escriben (queremos ver problemas siempre).
//
// Para activar logs en una sesion: DevTools console →
//   window.DEBUG = true
// y refrescar.
//
// El flag DEBUG se auto-activa en localhost y 127.0.0.1.
// ════════════════════════════════════════════════════════════

// Inicializar DEBUG (idempotente)
if (typeof window !== 'undefined') {
  window.DEBUG = window.DEBUG || (
    location.hostname === 'localhost' || location.hostname === '127.0.0.1'
  );
}

export function _log() {
  if (typeof window !== 'undefined' && window.DEBUG && console && console.log) {
    console.log.apply(console, arguments);
  }
}

export function _warn() {
  if (console && console.warn) console.warn.apply(console, arguments);
}

export function _err() {
  if (console && console.error) console.error.apply(console, arguments);
}
