// ── SONIDOS UX — feedback auditivo del POS ────────────────────
// Usa Web Audio API con osciladores generados (sin archivos).
//
// Sonidos:
//   sndTap()    → click corto al agregar producto al ticket
//   sndPedido() → campana triple cuando llega pedido del satélite
//   sndCobro()  → acorde ascendente al confirmar cobro
//
// Mute:
//   sonidoMuteGet() / sonidoMuteSet(bool) → persiste en localStorage
//   sonidoToggle() → alterna y devuelve el estado
//
// El AudioContext se crea lazy en la primera llamada (autoplay policy).
// Si está mute o el context no se pudo crear, las funciones son no-op.

var _audioCtx = null;
var _sonidoInit = false;

function _ensureAudioCtx(){
  if(_audioCtx) return _audioCtx;
  try {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if(!Ctx) return null;
    _audioCtx = new Ctx();
    _sonidoInit = true;
    return _audioCtx;
  } catch(e){
    console.warn('[Sounds] AudioContext no disponible:', e.message);
    return null;
  }
}

function sonidoMuteGet(){
  return localStorage.getItem('pos_sonido_mute') === '1';
}
function sonidoMuteSet(v){
  localStorage.setItem('pos_sonido_mute', v ? '1' : '0');
}
function sonidoToggle(){
  var muted = !sonidoMuteGet();
  sonidoMuteSet(muted);
  return muted;
}

// Master gain + compressor para aumentar volumen percibido sin clipping
var _masterGain = null;
var _compressor = null;

function _getMaster(ctx){
  if(_masterGain && _compressor) return _masterGain;
  _compressor = ctx.createDynamicsCompressor();
  _compressor.threshold.value = -24;
  _compressor.knee.value = 30;
  _compressor.ratio.value = 12;
  _compressor.attack.value = 0.003;
  _compressor.release.value = 0.25;
  _masterGain = ctx.createGain();
  _masterGain.gain.value = 1.8; // boost global
  _masterGain.connect(_compressor);
  _compressor.connect(ctx.destination);
  return _masterGain;
}

// Helper: tono con frecuencia fija + envelope ADSR
function _tono(ctx, freq, startTime, duration, volume, type){
  var osc = ctx.createOscillator();
  var gain = ctx.createGain();
  osc.type = type || 'sine';
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(_getMaster(ctx));

  var vol = volume || 0.15;
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(vol, startTime + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

// ── TAP — beep de scanner de supermercado ──
// Doble capa sine para mayor percepción de volumen:
// - 2000Hz principal (el "beep" limpio)
// - 2800Hz armónico superior (le da brillo y lo hace sentir más alto)
function sndTap(){
  if(sonidoMuteGet()) return;
  if(document.visibilityState === 'hidden') return;
  var ctx = _ensureAudioCtx();
  if(!ctx) return;
  try {
    var t = ctx.currentTime;
    _tono(ctx, 2000, t, 0.05, 0.95, 'sine');
    _tono(ctx, 2800, t, 0.05, 0.6,  'sine');
  } catch(e){}
}

// ── PEDIDO SATÉLITE — campana triple ──
function sndPedido(){
  if(sonidoMuteGet()) return;
  var ctx = _ensureAudioCtx();
  if(!ctx) return;
  try {
    var t = ctx.currentTime;
    _tono(ctx, 1320, t,          0.22, 0.7, 'sine'); // E6
    _tono(ctx, 1320, t + 0.26,   0.22, 0.7, 'sine');
    _tono(ctx, 990,  t + 0.52,   0.38, 0.7, 'sine'); // B5 final
  } catch(e){}
}

// ── COBRO EXITOSO — acorde ascendente ──
function sndCobro(){
  if(sonidoMuteGet()) return;
  var ctx = _ensureAudioCtx();
  if(!ctx) return;
  try {
    var t = ctx.currentTime;
    _tono(ctx, 523.25, t,          0.14, 0.55, 'triangle'); // C5
    _tono(ctx, 659.25, t + 0.10,   0.14, 0.55, 'triangle'); // E5
    _tono(ctx, 783.99, t + 0.20,   0.14, 0.55, 'triangle'); // G5
    _tono(ctx, 1046.5, t + 0.30,   0.35, 0.60, 'triangle'); // C6 sostenida
  } catch(e){}
}

// ── VOZ SINTÉTICA — anuncia el total al cobrar ──
// Usa Web Speech API (speechSynthesis) — disponible en Chrome/Android.
// Se configura con la mejor voz española disponible en el dispositivo.

function vozMuteGet(){
  return localStorage.getItem('pos_voz_mute') === '1';
}
function vozMuteSet(v){
  localStorage.setItem('pos_voz_mute', v ? '1' : '0');
}

// Devuelve todas las voces en español disponibles en el dispositivo
function listarVocesEs(){
  if(!('speechSynthesis' in window)) return [];
  var voces = window.speechSynthesis.getVoices() || [];
  return voces.filter(function(v){ return v.lang && v.lang.indexOf('es') === 0; });
}

// Heurística para detectar género por nombre conocido
var _NOMBRES_FEM = ['sabina','helena','paulina','monica','lucia','isabel','marisol','esperanza','laura','sofia','carmen','angelica','conchita','soledad'];
var _NOMBRES_MASC = ['raul','pablo','jorge','diego','carlos','miguel','javier','enrique','antonio','roberto','ricardo','juan','fernando','alberto'];

function generoVoz(v){
  if(!v || !v.name) return 'neutral';
  var n = v.name.toLowerCase();
  if(n.indexOf('female') >= 0 || n.indexOf('mujer') >= 0 || n.indexOf('femenin') >= 0) return 'female';
  if(n.indexOf('male') >= 0 || n.indexOf('hombre') >= 0 || n.indexOf('masculin') >= 0) return 'male';
  for(var i=0; i<_NOMBRES_FEM.length; i++) if(n.indexOf(_NOMBRES_FEM[i]) >= 0) return 'female';
  for(var i=0; i<_NOMBRES_MASC.length; i++) if(n.indexOf(_NOMBRES_MASC[i]) >= 0) return 'male';
  return 'neutral';
}

// Selección de voz guardada en localStorage.
// En Android Chrome, los .name de las voces pueden variar ligeramente entre
// sesiones, por eso guardamos MÚLTIPLES identificadores: voiceURI (más estable),
// name y lang. Al buscar, probamos en ese orden de especificidad.
function vozSeleccionadaGet(){
  // Retorna objeto {voiceURI, name, lang} o null
  var raw = localStorage.getItem('pos_voz_data');
  if(raw){
    try { return JSON.parse(raw); } catch(e) {}
  }
  // Fallback legacy: solo nombre
  var legacy = localStorage.getItem('pos_voz_name');
  if(legacy) return { name: legacy, voiceURI: '', lang: '' };
  return null;
}
function vozSeleccionadaSet(voz){
  if(!voz){
    localStorage.removeItem('pos_voz_data');
    localStorage.removeItem('pos_voz_name');
    return;
  }
  // voz puede ser un objeto SpeechSynthesisVoice o solo un name string
  if(typeof voz === 'string'){
    var voces = listarVocesEs();
    var match = voces.find(function(v){ return v.name === voz; });
    if(match) voz = match;
  }
  var data = {
    voiceURI: voz.voiceURI || '',
    name:     voz.name     || '',
    lang:     voz.lang     || '',
  };
  localStorage.setItem('pos_voz_data', JSON.stringify(data));
  // Retrocompatibilidad
  localStorage.setItem('pos_voz_name', data.name);
}

function _findVozEs(){
  if(!('speechSynthesis' in window)) return null;
  var voces = listarVocesEs();
  if(!voces.length) return null;
  // Si el usuario seleccionó una voz específica, intentar matching multi-nivel
  var guardada = vozSeleccionadaGet();
  if(guardada){
    // 1. Match exacto por voiceURI (más estable en Android Chrome)
    if(guardada.voiceURI){
      var v1 = voces.find(function(x){ return x.voiceURI === guardada.voiceURI; });
      if(v1) return v1;
    }
    // 2. Match por name + lang (bastante estable)
    if(guardada.name && guardada.lang){
      var v2 = voces.find(function(x){ return x.name === guardada.name && x.lang === guardada.lang; });
      if(v2) return v2;
    }
    // 3. Match solo por name
    if(guardada.name){
      var v3 = voces.find(function(x){ return x.name === guardada.name; });
      if(v3) return v3;
    }
    // 4. Match por name parcial (por si el nombre cambió ligeramente)
    if(guardada.name){
      var nombreLower = guardada.name.toLowerCase();
      var v4 = voces.find(function(x){
        var xn = (x.name||'').toLowerCase();
        return xn.indexOf(nombreLower) >= 0 || nombreLower.indexOf(xn) >= 0;
      });
      if(v4) return v4;
    }
    // 5. Match por lang solamente
    if(guardada.lang){
      var v5 = voces.find(function(x){ return x.lang === guardada.lang; });
      if(v5) return v5;
    }
  }
  // Default: preferencias por región
  var preferidas = ['es-PY','es-AR','es-MX','es-US','es-ES','es-CL','es-CO'];
  for(var i=0; i<preferidas.length; i++){
    var vp = voces.find(function(x){ return x.lang === preferidas[i]; });
    if(vp) return vp;
  }
  return voces[0];
}

// Forzar carga inicial de voces. En Chrome Android getVoices() retorna []
// la primera vez — las voces llegan async vía el evento 'voiceschanged'.
// Cuando las voces están disponibles, refrescamos el selector de config
// si está visible (por si el usuario estaba esperando verlo).
var _vocesYaCargadas = false;
if('speechSynthesis' in window){
  window.speechSynthesis.addEventListener('voiceschanged', function(){
    _vocesYaCargadas = true;
    // Refrescar el selector de voces en config si está visible
    if(typeof poblarSelectorVoces === 'function'){
      var sel = document.getElementById('cfgVozSelect');
      if(sel && sel.offsetParent !== null){
        poblarSelectorVoces(typeof _vozFiltroActual !== 'undefined' ? _vozFiltroActual : 'all');
      }
    }
    // Calentar el engine ahora que las voces están disponibles (si ya hubo gesto)
    if(typeof calentarVoz === 'function') calentarVoz();
  });
  // Trigger inicial (algunos browsers necesitan esto para disparar voiceschanged)
  try { window.speechSynthesis.getVoices(); } catch(e){}
}

// Formatea un número grande en palabras simples para el TTS.
// Ej: 75000 → "setenta y cinco mil guaraníes"
// Mantenemos esto simple: dejamos que el TTS lea el número, solo le
// ponemos "guaraníes" al final. El TTS moderno lee números bien.
function _formatMontoVoz(n){
  n = parseInt(n) || 0;
  return n.toLocaleString('es-PY') + ' guaraníes';
}

function hablarCobro(monto){
  if(vozMuteGet()) return;
  if(!('speechSynthesis' in window)) return;
  try {
    // Cancelar utterance anterior si estaba hablando
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance();
    u.text = 'Total ' + _formatMontoVoz(monto);
    u.lang = 'es-PY';
    u.rate = 1.05;
    u.pitch = 1;
    u.volume = 1;
    var v = _findVozEs();
    if(v) u.voice = v;
    window.speechSynthesis.speak(u);
  } catch(e){}
}

// Anuncia un pedido nuevo que llegó del satélite
function hablarPedidoNuevo(cantidad){
  if(vozMuteGet()) return;
  if(!('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance();
    u.text = cantidad > 1
      ? 'Atención, ' + cantidad + ' pedidos nuevos'
      : 'Atención, pedido nuevo';
    u.lang = 'es-PY';
    u.rate = 1.05;
    u.volume = 1;
    var v = _findVozEs();
    if(v) u.voice = v;
    window.speechSynthesis.speak(u);
  } catch(e){}
}

// Anuncia la razón social encontrada al buscar un RUC
function hablarRazonSocial(razonSocial){
  if(vozMuteGet()) return;
  if(!('speechSynthesis' in window)) return;
  if(!razonSocial) return;
  try {
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance();
    u.text = 'Facturar a ' + razonSocial + '. Confirmá los datos.';
    u.lang = 'es-PY';
    u.rate = 1.02;
    u.volume = 1;
    var v = _findVozEs();
    if(v) u.voice = v;
    window.speechSynthesis.speak(u);
  } catch(e){}
}

// ── WARMUP del engine de TTS ─────────────────────────────
// En Android Chrome/PWA, la primera llamada a speechSynthesis.speak()
// tarda ~1-2 segundos porque el servicio TTS del sistema se inicializa
// lazy. Este warmup dispara una utterance REAL (con volumen muy bajo,
// casi inaudible) para que el engine quede listo antes del primer uso.
//
// Estrategia triple:
// 1. Al primer gesto del usuario (touchstart/click) — si las voces ya
//    están cargadas, dispara inmediatamente.
// 2. Cuando se dispara voiceschanged por primera vez — si ya hubo un
//    gesto previo pendiente, calienta ahí.
// 3. Re-intento tras 1s si el primer speak no se completó (Chrome
//    a veces descarta el primer utterance silenciosamente).
var _vozCalentada = false;
var _gestoHecho = false;

function calentarVoz(){
  if(_vozCalentada) return;
  if(!('speechSynthesis' in window)) return;
  if(!_gestoHecho) return; // sin user gesture no hay permiso
  if(vozMuteGet()) return;
  var voces = listarVocesEs();
  if(!voces.length){
    // Las voces aún no cargaron — esperar a voiceschanged
    return;
  }
  try {
    // Primer speak: una palabra real con volumen muy bajo.
    // Un texto vacío o solo espacios es descartado por Chrome.
    var u1 = new SpeechSynthesisUtterance('hola');
    u1.volume = 0.01;
    u1.rate = 2.5;
    var v = _findVozEs();
    if(v) u1.voice = v;
    u1.onstart = function(){ _vozCalentada = true; };
    u1.onend = function(){ _vozCalentada = true; };
    window.speechSynthesis.speak(u1);

    // Failsafe: si después de 300ms no se disparó onstart, cancelar
    // y re-intentar (bug conocido en Chrome Android donde el primer
    // utterance queda stuck).
    setTimeout(function(){
      if(!_vozCalentada){
        try {
          window.speechSynthesis.cancel();
          var u2 = new SpeechSynthesisUtterance('hola');
          u2.volume = 0.01;
          u2.rate = 2.5;
          if(v) u2.voice = v;
          u2.onstart = function(){ _vozCalentada = true; };
          window.speechSynthesis.speak(u2);
        } catch(e){}
      }
    }, 300);
  } catch(e){}
}

function _marcarGesto(){
  _gestoHecho = true;
  calentarVoz();
}

// Calentar la voz en el primer gesto del usuario (mutliples eventos para
// asegurar captura)
document.addEventListener('touchstart', _marcarGesto, { once: true, passive: true });
document.addEventListener('click',      _marcarGesto, { once: true });
document.addEventListener('keydown',    _marcarGesto, { once: true });

// ── VOZ EN CIERRE DE TURNO ──────────────────────────────

// Al entrar a la pantalla de cierre, saludo corto para indicar al cajero
// que debe contar el dinero fisico.
function hablarCierreInicio(){
  if(vozMuteGet()) return;
  if(!('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance();
    u.text = 'Cierre de caja. Contá el dinero físico y declará cada método de pago.';
    u.lang = 'es-PY';
    u.rate = 1.05;
    u.volume = 1;
    var v = _findVozEs();
    if(v) u.voice = v;
    window.speechSynthesis.speak(u);
  } catch(e){}
}

// Recita los valores esperados de cada método de pago (on-demand).
// cierreMetodos es un objeto { EFECTIVO: {esperado, contado}, POS: {...}, ... }
function hablarValoresEsperados(cierreMetodos, saldoTotal){
  if(vozMuteGet()) return;
  if(!('speechSynthesis' in window)) return;
  if(!cierreMetodos) return;
  try {
    window.speechSynthesis.cancel();
    var partes = [];
    // Orden preferido: EFECTIVO primero, luego resto
    var orden = ['EFECTIVO','POS','TRANSFERENCIA'];
    var vistos = {};
    orden.forEach(function(m){
      if(cierreMetodos[m]){
        var esp = Math.round(cierreMetodos[m].esperado || 0);
        if(esp > 0 || m === 'EFECTIVO'){
          partes.push(_metodoALabel(m) + ' ' + _numeroALabel(esp) + ' guaraníes');
          vistos[m] = true;
        }
      }
    });
    // Métodos adicionales no en el orden estándar
    Object.keys(cierreMetodos).forEach(function(m){
      if(vistos[m]) return;
      var esp = Math.round(cierreMetodos[m].esperado || 0);
      if(esp > 0){
        partes.push(_metodoALabel(m) + ' ' + _numeroALabel(esp) + ' guaraníes');
      }
    });

    var texto;
    if(partes.length === 0){
      texto = 'No hay ventas registradas en este turno.';
    } else {
      texto = 'Valores esperados. ' + partes.join('. ') + '.';
      if(saldoTotal != null){
        texto += ' Total ' + _numeroALabel(Math.round(saldoTotal)) + ' guaraníes.';
      }
    }
    var u = new SpeechSynthesisUtterance();
    u.text = texto;
    u.lang = 'es-PY';
    u.rate = 1.0;
    u.volume = 1;
    var v = _findVozEs();
    if(v) u.voice = v;
    window.speechSynthesis.speak(u);
  } catch(e){}
}

// Alerta al cajero si hay diferencia al cerrar
// diferencia > 0 = sobrante, < 0 = faltante, 0 = cuadre
function hablarDiferenciaCierre(diferencia){
  if(vozMuteGet()) return;
  if(!('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance();
    var monto = Math.abs(Math.round(diferencia));
    if(diferencia === 0 || monto === 0){
      u.text = 'Caja cuadrada correctamente.';
    } else if(diferencia > 0){
      u.text = 'Atención, sobrante de ' + _numeroALabel(monto) + ' guaraníes.';
    } else {
      u.text = 'Atención, faltante de ' + _numeroALabel(monto) + ' guaraníes.';
    }
    u.lang = 'es-PY';
    u.rate = 1.0;
    u.volume = 1;
    var v = _findVozEs();
    if(v) u.voice = v;
    window.speechSynthesis.speak(u);
  } catch(e){}
}

// Helper: convierte código de método a etiqueta legible
function _metodoALabel(m){
  if(!m) return '';
  var map = {
    'EFECTIVO': 'Efectivo',
    'POS': 'Tarjeta POS',
    'TRANSFERENCIA': 'Transferencias',
    'QR': 'Código QR',
    'CHEQUE': 'Cheques',
  };
  return map[m.toUpperCase()] || (m.charAt(0).toUpperCase() + m.slice(1).toLowerCase());
}

// Helper: formatea número con el locale es-PY (el TTS lee bien los números)
function _numeroALabel(n){
  return Number(n).toLocaleString('es-PY');
}

// Anuncia el vuelto al cliente ("Vuelto 70.000 guaraníes")
// Android Chrome bug: cancel() + speak() inmediato a veces deja el engine
// colgado y el utterance nunca arranca. Hacemos cancel, esperamos un tick,
// y después speak. También agregamos resume() por si quedó pausado.
function hablarVuelto(monto){
  if(vozMuteGet()) return;
  if(!('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    setTimeout(function(){
      try {
        var u = new SpeechSynthesisUtterance();
        u.text = 'Vuelto ' + _formatMontoVoz(monto);
        u.lang = 'es-PY';
        u.rate = 1.1;
        u.pitch = 1;
        u.volume = 1;
        var v = _findVozEs();
        if(v) u.voice = v;
        // Failsafe: si onstart no se disparó en 400ms, re-intentar
        var arrancó = false;
        u.onstart = function(){ arrancó = true; };
        try { window.speechSynthesis.resume(); } catch(e){}
        window.speechSynthesis.speak(u);
        setTimeout(function(){
          if(!arrancó){
            try {
              window.speechSynthesis.cancel();
              var u2 = new SpeechSynthesisUtterance();
              u2.text = 'Vuelto ' + _formatMontoVoz(monto);
              u2.lang = 'es-PY';
              u2.rate = 1.1;
              u2.volume = 1;
              if(v) u2.voice = v;
              window.speechSynthesis.speak(u2);
            } catch(e){}
          }
        }, 400);
      } catch(e){}
    }, 80);
  } catch(e){}
}

// Probar una voz específica con un monto ejemplo
function probarVoz(nombreVoz){
  if(!('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance();
    u.text = 'Total 75.000 guaraníes';
    u.lang = 'es-PY';
    u.rate = 1.05;
    u.volume = 1;
    if(nombreVoz){
      var voces = listarVocesEs();
      var v = voces.find(function(x){ return x.name === nombreVoz; });
      if(v) u.voice = v;
    }
    window.speechSynthesis.speak(u);
  } catch(e){}
}

// Inicialización en el primer toque (necesario para autoplay policy)
document.addEventListener('touchstart', function _sInitT(){
  _ensureAudioCtx();
  if(_audioCtx && _audioCtx.state === 'suspended') _audioCtx.resume();
}, { passive: true, once: true });

document.addEventListener('click', function _sInitC(){
  _ensureAudioCtx();
  if(_audioCtx && _audioCtx.state === 'suspended') _audioCtx.resume();
}, { once: true });
