// ── ASISTENTE DE VOZ BIDIRECCIONAL ──────────────────────────────
// Usa Web Speech API (SpeechRecognition) para escuchar al cajero y
// ejecutar comandos. Responde usando las funciones de voz existentes
// en sounds.js (hablarGenerico).
//
// Flujo:
//   1. Usuario toca el FAB <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg> o dice "hey pos"
//   2. Se activa SpeechRecognition con lang='es-PY'
//   3. Al detectar speech, parsea el texto contra patrones conocidos
//   4. Ejecuta la acción
//   5. Responde con voz y toast visual
//
// Comandos soportados:
//   - "agregar/agrega [producto]"
//   - "cobrar [efectivo|tarjeta|transferencia|justo]"
//   - "confirmar pago"
//   - "nueva venta"
//   - "abrir mesa [número]"
//   - "cuánto llevo vendido"
//   - "total del turno"
//   - "cancelar" / "cerrar"
//   - "ayuda" (lista comandos)

var _recognition = null;
var _asistActivo = false;
var _asistEscuchando = false;

// ── Modo conversación continua ─────────────────────────
var _asistModoConversacion = false;
var _asistSilencioTimer = null;
var _asistCountdownTimer = null;
var _asistSilencioMs = 12000;      // 12s sin voz = salir
var _asistUltimoInterim = '';
var _asistUltimoFinal = '';
var _asistReiniciando = false;     // bandera para reiniciar rec tras onend

// ── Disambiguación ─────────────────────────────────────
var _asistDisambiguacion = null;   // { candidatos:[], callback:fn, intentos:N, textoOriginal:str }

// ── Aliases (IndexedDB) ────────────────────────────────
var _asistDb = null;
var _asistAliasCache = {};         // { aliasNormalizado: productoId }
var _asistAliasMem = false;        // true cuando falló IndexedDB y vamos en memoria

// ══════════════════════════════════════════════════════════════════════
// MODO ONE-SHOT SIMPLE
// ══════════════════════════════════════════════════════════════════════
// El modo continuo en Android Chrome es inherentemente problemático:
// - abort() no es instantáneo → resultados en cola se entregan tarde
// - El TTS se captura a sí mismo aunque el recognition esté "cerrado"
// - El silencio después de cada frase disparaba respuestas prematuras
//
// La solución simple: 1 tap = 1 pregunta = 1 respuesta. Nada más.
// Para hacer otra pregunta, el usuario tiene que tocar el mic otra vez.

// Bloqueo global: mientras el asistente habla o está procesando,
// NO aceptar ningún input del micrófono
var _asistBloqueado = false;
// Flag anti-doble-procesamiento: si ya recibimos un resultado final,
// ignorar los que vengan después (evita latencia del motor de silencio)
var _asistYaProcesó = false;

// Inicializa el reconocimiento de voz — sólo se ejecuta una vez
function _initAsistente(){
  if(_recognition) return _recognition;
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){
    console.warn('[Asistente] SpeechRecognition no disponible');
    return null;
  }
  _recognition = new SR();
  _recognition.lang = 'es-PY';
  // MODO CONTINUO con interim — más rápido que one-shot porque
  // podemos detectar el primer final y cortar inmediatamente
  _recognition.continuous = true;
  _recognition.interimResults = true;
  _recognition.maxAlternatives = 3;

  _recognition.onstart = function(){
    _asistEscuchando = true;
    _asistMostrarOndas(true);
    _asistYaProcesó = false;
    _log('[Asistente] Escuchando (rápido)...');
  };

  _recognition.onresult = function(e){
    // Si el asistente está hablando o bloqueado, ignorar
    if(_asistHablando || _asistBloqueado){
      _log('[Asistente] Resultado ignorado (bloqueado/hablando)');
      return;
    }
    if(_asistYaProcesó) return;

    // Buscar el primer resultado FINAL disponible
    var finalRes = null;
    for(var i = e.resultIndex; i < e.results.length; i++){
      var r = e.results[i];
      if(r && r.isFinal){ finalRes = r; break; }
    }
    if(!finalRes) return;

    _asistYaProcesó = true;
    var alternativas = [];
    for(var k = 0; k < finalRes.length; k++) alternativas.push(finalRes[k].transcript);
    _log('[Asistente] Escuché:', alternativas);

    var textoCrudo = _asistNormalizar(alternativas[0] || '');
    if(!textoCrudo){
      toast('No te escuché');
      _asistBloqueado = false;
      try { _recognition.abort(); } catch(e){}
      return;
    }

    // Cerrar el mic INMEDIATAMENTE — no esperar que el motor decida
    _asistBloqueado = true;
    try { _recognition.abort(); } catch(e){}

    // ¿Estamos esperando respuesta de disambiguación?
    if(_asistDisambiguacion){
      var textoLimpio = _asistLimpiarMuletillas(textoCrudo);
      _asistResolverDisambiguacion(textoLimpio);
    } else {
      _asistEjecutarComando(alternativas);
    }
  };

  _recognition.onerror = function(e){
    console.warn('[Asistente] Error:', e.error);
    if(e.error === 'not-allowed'){
      toast('Micrófono denegado — activalo en ajustes del navegador');
    } else if(e.error === 'no-speech'){
      toast('No te escuché, tocá el micrófono y repetí');
    } else if(e.error === 'aborted'){
      // silencio, fue cancelado intencionalmente
    } else if(e.error !== 'audio-capture'){
      toast('Error: ' + e.error);
    }
    _asistEscuchando = false;
    _asistMostrarOndas(false);
  };

  _recognition.onend = function(){
    _asistEscuchando = false;
    _asistMostrarOndas(false);
    _log('[Asistente] Sesión terminada');
  };

  return _recognition;
}

// Trigger manual — se llama desde el botón <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
// Cada tap inicia UNA sesión de escucha. Si ya está escuchando, cancela.
function asistenteEscuchar(){
  var rec = _initAsistente();
  if(!rec){
    toast('Tu navegador no soporta reconocimiento de voz');
    return;
  }
  // Asegurar que aliases estén cargados (util para búsquedas futuras)
  _asistAliasInit();

  // Si está escuchando, segundo tap = cancelar
  if(_asistEscuchando){
    try { rec.abort(); } catch(e){}
    return;
  }

  // Si está hablando, esperar a que termine
  if(_asistHablando){
    toast('Esperá que termine de hablar');
    return;
  }

  try {
    _asistBloqueado = false;
    if('speechSynthesis' in window) window.speechSynthesis.cancel();
    rec.start();
  } catch(e){
    console.warn('[Asistente] No se pudo iniciar:', e.message);
    toast('Error al iniciar: ' + e.message);
  }
}

// Stubs vacíos de conversación continua (preservados por compatibilidad)
function _asistEntrarConversacion(){ /* no-op en modo one-shot */ }
function _asistSalirConversacion(){
  _asistDisambiguacion = null;
  _asistBloqueado = false;
  try { if(_recognition) _recognition.abort(); } catch(e){}
  _asistMostrarOndas(false);
}
function _asistResetSilencio(){ /* no-op */ }

var _ASIST_SALIDA_RE = /^(listo|chau|chao|terminado|terminar|ya\s+est[aá]|gracias|salir|fuera|adios|adi[oó]s|listo\s+gracias|chau\s+gracias|nada\s+mas|nada\s+m[aá]s)$/;
function _asistEsFraseSalida(texto){
  if(!texto) return false;
  return _ASIST_SALIDA_RE.test(texto.trim());
}

// ── PARSEO DE COMANDOS (v2 — NLP extendido) ──────────────────────
//
// Soporta gramática paraguaya/rioplatense con voseo/tuteo, muletillas
// ("che", "dale", "hey pos"), números hablados, fuzzy matching con
// Levenshtein, comandos encadenados con "y", y contexto de pantalla.

// Respuestas naturales variadas
var _ASIST_FRASES = {
  agregado: [
    'Listo, agregué {n} {p}',
    'Ahí va, {n} {p}',
    'Perfecto, {n} {p} al ticket',
    'Ok, sumé {n} {p}'
  ],
  quitado: [
    'Ok, saqué {p}',
    'Listo, quitado',
    'Eliminado del ticket'
  ],
  cobrando: ['Yendo a cobrar', 'Dale, pasando a cobro', 'Pasamos a cobrar'],
  confirmado: ['Listo, venta confirmada', 'Perfecto, cobrado', 'Ahí va, pago confirmado'],
  noEntendi: ['No te entendí, repetí por favor', 'No capté eso', 'Perdón, no agarré qué querés hacer'],
  vacio: ['El ticket está vacío', 'Primero agregá algún producto']
};

function _asistFrase(key, vars){
  var arr = _ASIST_FRASES[key] || ['Ok'];
  var f = arr[Math.floor(Math.random() * arr.length)];
  if(vars){
    for(var k in vars){ f = f.replace(new RegExp('\\{'+k+'\\}','g'), vars[k]); }
  }
  return f;
}

function _asistNormalizar(texto){
  return (texto || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,;:!?¿¡]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Saca muletillas y wake words: "hey pos", "che", "dale", "a ver", etc.
function _asistLimpiarMuletillas(texto){
  var rels = [
    /^(hey\s+pos|hey\s+post|hey|oye\s+pos|okey\s+pos|ok\s+pos|che\s+pos)\s+/gi,
    /^(che|mira|miri|oye|oi|hola|bueno|ok|okey)\s+/gi,
    /^(por\s+favor|porfa|porfis)\s+/gi,
    /\b(por\s+favor|porfa|porfis)\b/gi,
    /^(quiero|quisiera|necesito|me\s+pod[eé]s|pod[eé]s)\s+/gi,
    /^(anda|andate|dale\s+que|vamos|vamo|a\s+ver|aver|listo)\s+/gi,
    /\b(un\s+poco|un\s+poquito|dale|listo)\b/gi,   // "vendeme un poco" → "vendeme"
    /^(que\s+se)\s+/gi
  ];
  var t = ' ' + texto + ' ';
  rels.forEach(function(r){ t = t.replace(r, ' '); });
  return t.replace(/\s+/g,' ').trim();
}

// Números hablados: "cincuenta mil" → 50000
function _asistParsearNumeroHablado(texto){
  if(texto == null) return NaN;
  var t = _asistNormalizar(String(texto));
  if(!t) return NaN;

  var limpio = t.replace(/\./g,'').replace(/,/g,'');
  var mK = limpio.match(/^(\d+(?:\.\d+)?)\s*k\b/);
  if(mK) return Math.round(parseFloat(mK[1]) * 1000);
  var mMil = limpio.match(/^(\d+(?:\.\d+)?)\s*mil\b/);
  if(mMil) return Math.round(parseFloat(mMil[1]) * 1000);
  var mMillon = limpio.match(/^(\d+(?:\.\d+)?)\s*millon(?:es)?\b/);
  if(mMillon) return Math.round(parseFloat(mMillon[1]) * 1000000);
  if(/^\d+$/.test(limpio)) return parseInt(limpio, 10);

  var unidades = {
    'cero':0,'un':1,'uno':1,'una':1,'dos':2,'tres':3,'cuatro':4,'cinco':5,
    'seis':6,'siete':7,'ocho':8,'nueve':9,'diez':10,'once':11,'doce':12,
    'trece':13,'catorce':14,'quince':15,'dieciseis':16,'diecisiete':17,
    'dieciocho':18,'diecinueve':19,'veinte':20,'veintiuno':21,'veintiun':21,
    'veintidos':22,'veintitres':23,'veinticuatro':24,'veinticinco':25,
    'veintiseis':26,'veintisiete':27,'veintiocho':28,'veintinueve':29
  };
  var decenas = {
    'treinta':30,'cuarenta':40,'cincuenta':50,'sesenta':60,
    'setenta':70,'ochenta':80,'noventa':90
  };
  var centenas = {
    'cien':100,'ciento':100,'doscientos':200,'doscientas':200,
    'trescientos':300,'trescientas':300,'cuatrocientos':400,'cuatrocientas':400,
    'quinientos':500,'quinientas':500,'seiscientos':600,'seiscientas':600,
    'setecientos':700,'setecientas':700,'ochocientos':800,'ochocientas':800,
    'novecientos':900,'novecientas':900
  };

  var palabras = t.split(/\s+/).filter(Boolean);
  var total = 0, actual = 0, hubo = false;
  for(var i = 0; i < palabras.length; i++){
    var w = palabras[i];
    if(w === 'y' || w === 'de') continue;
    if(/^\d+$/.test(w)){ actual += parseInt(w,10); hubo = true; continue; }
    if(unidades[w] !== undefined){ actual += unidades[w]; hubo = true; continue; }
    if(decenas[w] !== undefined){ actual += decenas[w]; hubo = true; continue; }
    if(centenas[w] !== undefined){ actual += centenas[w]; hubo = true; continue; }
    if(w === 'mil'){
      actual = (actual === 0 ? 1 : actual) * 1000;
      total += actual; actual = 0; hubo = true; continue;
    }
    if(w === 'millon' || w === 'millones'){
      actual = (actual === 0 ? 1 : actual) * 1000000;
      total += actual; actual = 0; hubo = true; continue;
    }
    break;
  }
  total += actual;
  return hubo ? total : NaN;
}

// Extrae primer número hablado dentro de una frase larga
function _asistExtraerNumero(texto){
  var t = _asistNormalizar(texto);
  var tokens = t.split(' ');
  var palabrasNum = /^(cero|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieciseis|diecisiete|dieciocho|diecinueve|veinte|veintiuno|veintiun|veintidos|veintitres|veinticuatro|veinticinco|veintiseis|veintisiete|veintiocho|veintinueve|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|doscientos|doscientas|trescientos|trescientas|cuatrocientos|cuatrocientas|quinientos|quinientas|seiscientos|seiscientas|setecientos|setecientas|ochocientos|ochocientas|novecientos|novecientas|mil|millon|millones|y|de)$/;
  var esNumTok = function(w){ return /^\d/.test(w) || palabrasNum.test(w) || /^\d+k$/.test(w); };

  for(var i = 0; i < tokens.length; i++){
    if(!esNumTok(tokens[i])) continue;
    var j = i;
    while(j < tokens.length && esNumTok(tokens[j])) j++;
    var frag = tokens.slice(i, j).join(' ');
    frag = frag.replace(/(\s+(y|de))+$/,'').trim();
    var v = _asistParsearNumeroHablado(frag);
    if(!isNaN(v) && v > 0) return { valor: v, inicio: i, fin: j };
    i = j - 1;
  }
  return null;
}

// Fuzzy matching: Levenshtein
function _asistLevenshtein(a, b){
  if(a === b) return 0;
  if(!a.length) return b.length;
  if(!b.length) return a.length;
  var prev = new Array(b.length + 1), curr = new Array(b.length + 1);
  for(var j = 0; j <= b.length; j++) prev[j] = j;
  for(var i = 1; i <= a.length; i++){
    curr[0] = i;
    for(var k = 1; k <= b.length; k++){
      var cost = a.charCodeAt(i-1) === b.charCodeAt(k-1) ? 0 : 1;
      curr[k] = Math.min(curr[k-1]+1, prev[k]+1, prev[k-1]+cost);
    }
    var tmp = prev; prev = curr; curr = tmp;
  }
  return prev[b.length];
}

function _asistSimilitud(a, b){
  if(!a || !b) return 0;
  var maxL = Math.max(a.length, b.length);
  if(!maxL) return 1;
  return 1 - (_asistLevenshtein(a, b) / maxL);
}

// Sinónimos bidireccionales: grupos de palabras que significan lo mismo.
// Se usan para EXPANDIR la búsqueda, no para reemplazar (mantiene la info
// discriminante entre productos). Ej: si el usuario dice "coca", también
// buscamos "gaseosa", "cola", "bebida" — pero el producto "Coca Cola" sigue
// teniendo tokens ["coca", "cola"] intactos.
var _ASIST_GRUPOS_SINONIMOS = [
  ['coca','cola','gaseosa','bebida','refresco','soda'],
  ['chela','birra','cerveza','rubia'],
  ['pizza','piza','pizzsa'],
  ['hamburguesa','hamburger','burger','burguer','hamburguesas'],
  ['agua','aguita'],
  ['cafe','cafecito','café'],
  ['lomito','lomi','lomitos'],
  ['papas','papa','fritas','papitas'],
  ['milanesa','mila','milanesas'],
  ['sandwich','sanguche','sanguich','sanguchito'],
  ['empanada','empanadita','empanadas']
];

// Devuelve array de sinónimos para una palabra (incluyéndola misma)
function _asistExpandirSinonimos(palabra){
  for(var g = 0; g < _ASIST_GRUPOS_SINONIMOS.length; g++){
    var grupo = _ASIST_GRUPOS_SINONIMOS[g];
    if(grupo.indexOf(palabra) >= 0) return grupo;
  }
  return [palabra];
}

function _asistSingularizar(w){
  // ES especial: palabras cortas o con patrones comunes
  if(w.length <= 3) return w;
  // Plurales en -es (meses, papas fritas, ...)
  if(w.length > 5 && /ciones$/.test(w)) return w.slice(0,-4) + 'cion';
  if(w.length > 4 && /ades$/.test(w))   return w.slice(0,-3) + 'ad';
  if(w.length > 4 && /eses$/.test(w))   return w.slice(0,-2);
  if(w.length > 4 && /nes$/.test(w))    return w.slice(0,-2);
  // Plurales simples
  if(w.length > 4 && /[aeiou]s$/.test(w)) return w.slice(0,-1);
  return w;
}

// Tokeniza SIN aplicar sinónimos — preserva info original del producto
function _asistTokensProducto(texto){
  return _asistNormalizar(texto).split(/\s+/)
    .filter(function(w){ return w.length > 1; })
    .map(_asistSingularizar);
}

// Tokeniza con EXPANSIÓN de sinónimos — usado solo en la búsqueda del usuario
// Devuelve un array de arrays: [["coca","cola","gaseosa",...], ["500ml"]]
// Cada sub-array son sinónimos de UN token.
function _asistTokensBusquedaExpandido(texto){
  return _asistNormalizar(texto).split(/\s+/)
    .filter(function(w){ return w.length > 1; })
    .map(function(w){
      var sing = _asistSingularizar(w);
      return _asistExpandirSinonimos(sing);
    });
}

// ──────────────────────────────────────────────────────────────
// BUSCADOR DE PRODUCTOS V3 — robusto y tolerante
//
// Estrategia (primero que matchea con mejor score gana):
//   1. Alias aprendido del cajero (instantáneo)
//   2. Match exacto de nombre normalizado
//   3. El nombre del producto está CONTENIDO en el texto buscado
//   4. El texto buscado está CONTENIDO en el nombre del producto
//      (crítico: "coca" debe matchear "Coca Cola 500ml")
//   5. Match de tokens con sinónimos expandidos
//   6. Fuzzy Levenshtein por token
//
// Threshold bajó a 0.40 — es mejor ofrecer disambiguación
// que decir "no encontré".
// ──────────────────────────────────────────────────────────────
var _ASIST_DEBUG = true; // toggle desde localStorage si querés

function _buscarProductosConAlternativas(texto){
  if(typeof PRODS === 'undefined' || !PRODS.length){
    return { mejor:null, mejorScore:0, alternativas:[] };
  }
  var buscado = _asistNormalizar(texto);
  if(!buscado) return { mejor:null, mejorScore:0, alternativas:[] };

  // Log de diagnóstico
  if(_ASIST_DEBUG) _log('[Buscar] Buscando:', JSON.stringify(buscado));

  // 1) Alias aprendido (lookup instantáneo)
  var aliasProd = _asistAliasBuscar(buscado);
  if(aliasProd){
    if(_ASIST_DEBUG) _log('[Buscar] <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><polyline points="20 6 9 17 4 12"/></svg> Alias:', aliasProd.name);
    return { mejor: aliasProd, mejorScore: 1, alternativas: [aliasProd], viaAlias: true };
  }

  var tokensBuscados = _asistTokensProducto(texto); // sin expandir (tokens crudos)
  var tokensBuscadosExp = _asistTokensBusquedaExpandido(texto); // array de arrays

  if(!tokensBuscados.length) return { mejor:null, mejorScore:0, alternativas:[] };

  var resultados = []; // { p, score, motivo }
  var exacto = null;

  for(var i = 0; i < PRODS.length; i++){
    var p = PRODS[i];
    if(!p || !p.name || p.itemLibre || p.esInsumo) continue;
    var nombreNorm = _asistNormalizar(p.name);
    var tokensProd = _asistTokensProducto(p.name);
    if(!tokensProd.length) continue;

    // ── Estrategia 1: Match exacto ──
    if(nombreNorm === buscado){ exacto = p; break; }

    var score = 0;
    var motivo = '';

    // ── Estrategia 2: Nombre del producto contenido en texto buscado ──
    // "agregar coca cola" debería matchear "Coca Cola"
    if(buscado.indexOf(nombreNorm) >= 0){
      score = Math.max(score, 0.98);
      motivo = 'prod⊂busqueda';
    }

    // ── Estrategia 3: Texto buscado contenido en nombre del producto ──
    // "coca" debería matchear "Coca Cola 500ml" (el caso que no funcionaba)
    if(nombreNorm.indexOf(buscado) >= 0){
      // Cuanto más larga la búsqueda vs el nombre, más específica
      var ratioLen = buscado.length / nombreNorm.length;
      // Mínimo 0.85, máximo 0.95 para que no pise match exacto
      var sIncl = 0.85 + (ratioLen * 0.10);
      if(sIncl > score){ score = sIncl; motivo = 'busqueda⊂prod'; }
    }

    // ── Estrategia 4: Token individual de búsqueda aparece en nombre ──
    // Fallback muy permisivo para búsquedas de 1 palabra
    if(tokensBuscados.length === 1){
      var tokB = tokensBuscados[0];
      // Búsqueda directa
      for(var tt = 0; tt < tokensProd.length; tt++){
        if(tokensProd[tt] === tokB ||
           tokensProd[tt].indexOf(tokB) >= 0 ||
           tokB.indexOf(tokensProd[tt]) >= 0){
          var sTokDir = 0.88;
          if(sTokDir > score){ score = sTokDir; motivo = 'token-directo'; }
          break;
        }
      }
      // Búsqueda por sinónimos expandidos
      var expandido = tokensBuscadosExp[0];
      for(var ee = 0; ee < expandido.length; ee++){
        var sin = expandido[ee];
        if(sin === tokB) continue; // ya probado
        for(var tt2 = 0; tt2 < tokensProd.length; tt2++){
          if(tokensProd[tt2] === sin ||
             tokensProd[tt2].indexOf(sin) >= 0 ||
             sin.indexOf(tokensProd[tt2]) >= 0){
            var sSin = 0.78;
            if(sSin > score){ score = sSin; motivo = 'sinonimo:' + sin; }
            break;
          }
        }
      }
    }

    // ── Estrategia 5: Cobertura de tokens (para búsquedas multi-palabra) ──
    var comunes = 0;
    var usados = {};
    for(var t = 0; t < tokensBuscadosExp.length; t++){
      var sinonimos = tokensBuscadosExp[t]; // array de sinónimos del token t
      for(var u = 0; u < tokensProd.length; u++){
        if(usados[u]) continue;
        var matcheo = false;
        for(var s = 0; s < sinonimos.length; s++){
          var sinW = sinonimos[s];
          var prodW = tokensProd[u];
          if(prodW === sinW){ matcheo = true; break; }
          if(prodW.length >= 4 && sinW.length >= 4 &&
             _asistSimilitud(prodW, sinW) >= 0.8){
            matcheo = true; break;
          }
        }
        if(matcheo){ comunes++; usados[u] = true; break; }
      }
    }
    if(comunes > 0){
      var coberturaProd = comunes / tokensProd.length;
      var coberturaBusq = comunes / tokensBuscados.length;
      // Damos más peso a cobertura de búsqueda (el usuario dijo lo que quería)
      var tokScore = (coberturaProd * 0.4) + (coberturaBusq * 0.6);
      // Bonus si todos los tokens buscados se encontraron
      if(coberturaBusq >= 0.99) tokScore = Math.min(tokScore + 0.1, 0.95);
      if(tokScore > score){ score = tokScore; motivo = 'tokens(' + comunes + ')'; }
    }

    // ── Estrategia 6: Levenshtein global del texto ──
    if(tokensBuscados.length <= 2){
      var simGlobal = _asistSimilitud(buscado, nombreNorm);
      if(simGlobal >= 0.7){
        if(simGlobal > score){ score = simGlobal; motivo = 'fuzzy:' + simGlobal.toFixed(2); }
      }
    }

    if(score >= 0.40){
      resultados.push({ p: p, score: score, motivo: motivo });
    }
  }

  if(exacto){
    if(_ASIST_DEBUG) _log('[Buscar] <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><polyline points="20 6 9 17 4 12"/></svg> Exacto:', exacto.name);
    return { mejor: exacto, mejorScore: 1, alternativas: [exacto], viaAlias: false };
  }
  if(!resultados.length){
    if(_ASIST_DEBUG) _log('[Buscar] <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Sin matches');
    return { mejor:null, mejorScore:0, alternativas:[] };
  }

  resultados.sort(function(a,b){ return b.score - a.score; });

  if(_ASIST_DEBUG){
    _log('[Buscar] Top 5:');
    for(var rr = 0; rr < Math.min(5, resultados.length); rr++){
      _log('  ' + resultados[rr].score.toFixed(2) + ' ' +
                  resultados[rr].p.name + ' [' + resultados[rr].motivo + ']');
    }
  }

  var top = resultados[0].score;
  var alternativas = [];
  for(var r = 0; r < resultados.length; r++){
    if(resultados[r].score >= top - 0.15) alternativas.push(resultados[r].p);
    if(alternativas.length >= 5) break;
  }
  return {
    mejor: resultados[0].p,
    mejorScore: top,
    alternativas: alternativas,
    viaAlias: false
  };
}

// API original — devuelve solo el producto (o null)
function _buscarProducto(texto){
  var r = _buscarProductosConAlternativas(texto);
  return r.mejor;
}

// Búsqueda PERMISIVA — devuelve el mejor candidato sin importar score
// Se usa como "¿quisiste decir X?" cuando la búsqueda principal falla.
function _asistBuscarPermisivo(texto){
  if(typeof PRODS === 'undefined' || !PRODS.length) return null;
  var buscado = _asistNormalizar(texto);
  if(!buscado) return null;
  var tokens = _asistTokensProducto(texto);
  if(!tokens.length) return null;

  var mejor = null, mejorScore = 0;
  for(var i = 0; i < PRODS.length; i++){
    var p = PRODS[i];
    if(!p || !p.name || p.itemLibre || p.esInsumo) continue;
    var nombreNorm = _asistNormalizar(p.name);
    var tokensProd = _asistTokensProducto(p.name);
    if(!tokensProd.length) continue;

    // Similitud más suave: cualquier token que matchee cuenta
    var score = _asistSimilitud(buscado, nombreNorm);
    // Bonus si algún token buscado aparece en el nombre
    for(var t = 0; t < tokens.length; t++){
      if(nombreNorm.indexOf(tokens[t]) >= 0){ score += 0.15; break; }
      // También probar sinónimos
      var sinonimos = _asistExpandirSinonimos(tokens[t]);
      for(var s = 0; s < sinonimos.length; s++){
        if(nombreNorm.indexOf(sinonimos[s]) >= 0){ score += 0.12; break; }
      }
    }
    if(score > mejorScore){ mejorScore = score; mejor = p; }
  }
  // Mínimo 0.25 para considerar como sugerencia
  return mejorScore >= 0.25 ? mejor : null;
}

function _asistPantallaActiva(){
  var scs = ['scSale','scCobrar','scMesas','scPendientes','scConfig','scTurno','scCierre','scDetalle','scGuardar','scRecibo'];
  for(var i = 0; i < scs.length; i++){
    var el = document.getElementById(scs[i]);
    if(el && el.classList.contains('active')) return scs[i];
  }
  return null;
}

function _asistIrA(screenId){
  if(typeof goTo === 'function'){
    var el = document.getElementById(screenId);
    if(el && !el.classList.contains('active')) goTo(screenId);
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// ASISTENTE CONSULTIVO — solo responde preguntas sobre el negocio
// ══════════════════════════════════════════════════════════════════════════════
//
// El asistente NO agrega productos ni navega. Responde preguntas sobre:
//   - Ventas del turno (totales, cantidad, promedio, máxima)
//   - Cobros por método de pago (efectivo, POS, transferencia)
//   - Caja (saldo, efectivo inicial, egresos)
//   - Productos más vendidos
//   - Información del turno (inicio, duración)
//   - Mesas ocupadas
//   - Resumen general
//
// Si el usuario intenta operar (agregar/cobrar/navegar), responde que debe
// usar los botones de la pantalla.

// ── Helpers de cálculo ──
function _asistTotalVentas(){
  if(typeof turnoData === 'undefined' || !turnoData.ventas) return { total: 0, cantidad: 0 };
  var ventas = turnoData.ventas.filter(function(v){ return !v.anulada; });
  var total = ventas.reduce(function(s, v){ return s + (v.total || 0); }, 0);
  return { total: total, cantidad: ventas.length };
}

function _asistTotalPorMetodo(){
  if(typeof turnoData === 'undefined' || !turnoData.ventas) return {};
  var metodos = {};
  turnoData.ventas.forEach(function(v){
    if(v.anulada) return;
    var acumular = function(m, monto){
      m = (m || 'EFECTIVO').toUpperCase().trim();
      metodos[m] = (metodos[m] || 0) + monto;
    };
    if(v.divPagos && v.divPagos.length > 0){
      v.divPagos.forEach(function(p){ acumular(p.metodo, p.monto || 0); });
    } else if(v.metodo && v.metodo.indexOf(' + ') >= 0){
      var partes = v.metodo.split(' + ');
      var montoParte = Math.round(v.total / partes.length);
      partes.forEach(function(p, i){
        var m = i === partes.length - 1 ? v.total - montoParte * (partes.length - 1) : montoParte;
        acumular(p, m);
      });
    } else {
      acumular(v.metodo, v.total);
    }
  });
  return metodos;
}

function _asistProductosVendidos(){
  if(typeof turnoData === 'undefined' || !turnoData.ventas) return [];
  var conteo = {};
  turnoData.ventas.forEach(function(v){
    if(v.anulada || !v.items) return;
    v.items.forEach(function(i){
      if(!i || !i.name || i.esDescuento || i.esDelivery) return;
      var nombre = i.name;
      if(!conteo[nombre]) conteo[nombre] = { cantidad: 0, total: 0 };
      conteo[nombre].cantidad += (i.qty || 1);
      conteo[nombre].total    += (i.price || 0) * (i.qty || 1);
    });
  });
  var arr = Object.keys(conteo).map(function(k){
    return { name: k, cantidad: conteo[k].cantidad, total: conteo[k].total };
  });
  arr.sort(function(a, b){ return b.cantidad - a.cantidad; });
  return arr;
}

function _asistTotalEgresos(){
  if(typeof turnoData === 'undefined' || !turnoData.egresos) return 0;
  return turnoData.egresos.filter(function(e){ return !e.anulada; })
    .reduce(function(s, e){ return s + (e.monto || 0); }, 0);
}

function _asistFmt(n){
  return Number(Math.round(n || 0)).toLocaleString('es-PY');
}

// ── INTENTS CONSULTIVOS ────────────────────────────────────────

function _asistIntentAyuda(texto){
  if(!/^(ayuda|help|hola|que\s+puedo\s+preguntarte?|que\s+puedo\s+decir|que\s+entend[eé]s|comandos|que\s+sab[eé]s\s+hacer)/.test(texto)) return false;
  _asistHablar('Puedo responderte: cuánto vendiste, cuál es el ticket promedio, cuánto hay en caja, qué producto vendiste más, cuánto cobraste en efectivo, resumen del turno, o cuántas mesas ocupadas.');
  return true;
}

function _asistIntentTotalVentas(texto){
  // Regex MUY permisivo — tolera variaciones del speech-to-text
  // Acepta: "cuanto vendi", "cuánto vendí hoy", "cuanta venta llevo",
  //         "cuanto llevo", "cuanto hice", "cuanto gane", "total de ventas",
  //         "total del turno", "facturación", "ventas del día", "ventas hoy",
  //         "que vendi hoy", "vendi mucho", etc.
  var patrones = [
    /cuant[oa]s?\s+(vend|llev|hice|hic|gan[eé]|facturé?|hizo|hiciste)/,
    /total\s+(de\s+|del\s+)?(vent|turno|d[ií]a|hoy|facturaci)/,
    /llevo\s+(vendid|hecho|facturad)/,
    /(vent|ingres).*(hoy|d[ií]a|turno)/,
    /hice\s+(hoy|de\s+vent|del\s+d[ií]a)/,
    /gane\s+hoy/,
    /facturaci[oó]n/,
    /\bvend[ií]\b/,  // "vendí" suelto también cuenta si no matcheó otro intent
    /que\s+llevo/,
    /cuanto\s+es\s+(la\s+)?total/
  ];
  var matcheo = false;
  for(var i = 0; i < patrones.length; i++){
    if(patrones[i].test(texto)){ matcheo = true; break; }
  }
  if(!matcheo) return false;

  var r = _asistTotalVentas();
  if(r.cantidad === 0){ _asistHablar('Todavía no hay ventas en este turno'); return true; }
  _asistHablar('Llevás ' + r.cantidad + ' ventas por ' + _asistFmt(r.total) + ' guaraníes');
  return true;
}

function _asistIntentCantidadVentas(texto){
  if(!/(cuantas\s+ventas|cantidad\s+de\s+ventas|n[uú]mero\s+de\s+ventas|ventas\s+(hay|llevo|hice))/.test(texto)) return false;
  var r = _asistTotalVentas();
  if(r.cantidad === 0){ _asistHablar('Todavía no hay ventas'); return true; }
  _asistHablar('Llevás ' + r.cantidad + ' venta' + (r.cantidad !== 1 ? 's' : '') + ' en este turno');
  return true;
}

function _asistIntentPromedio(texto){
  if(!/(ticket\s+promedio|venta\s+promedio|promedio\s+(de\s+)?(ventas?|ticket)|media\s+de\s+ventas?|^promedio)/.test(texto)) return false;
  var r = _asistTotalVentas();
  if(r.cantidad === 0){ _asistHablar('No hay ventas aún'); return true; }
  var prom = Math.round(r.total / r.cantidad);
  _asistHablar('Ticket promedio: ' + _asistFmt(prom) + ' guaraníes');
  return true;
}

function _asistIntentVentaMax(texto){
  if(!/(venta\s+m[aá]s\s+alta|ticket\s+m[aá]s\s+alto|mayor\s+venta|m[aá]s\s+alta|venta\s+grande|m[aá]xima\s+venta|venta\s+mayor)/.test(texto)) return false;
  if(typeof turnoData === 'undefined' || !turnoData.ventas || !turnoData.ventas.length){
    _asistHablar('No hay ventas en este turno'); return true;
  }
  var max = 0;
  turnoData.ventas.forEach(function(v){
    if(v.anulada) return;
    if((v.total || 0) > max) max = v.total;
  });
  _asistHablar('La venta más alta fue de ' + _asistFmt(max) + ' guaraníes');
  return true;
}

function _asistIntentMetodos(texto){
  if(/efectivo|en\s+cash|cash|contado/.test(texto) &&
     /(cuanto|total|cobr[eé]|recib[ií]|llevo|hice|tengo)/.test(texto)){
    var m = _asistTotalPorMetodo();
    var ef = m['EFECTIVO'] || 0;
    _asistHablar('Cobraste ' + _asistFmt(ef) + ' guaraníes en efectivo');
    return true;
  }
  if(/(tarjeta|pos|debito|credito|posnet|plastico)/.test(texto) &&
     /(cuanto|total|cobr[eé]|llevo|hice)/.test(texto)){
    var m2 = _asistTotalPorMetodo();
    var pos = m2['POS'] || m2['TARJETA'] || 0;
    _asistHablar('Cobraste ' + _asistFmt(pos) + ' guaraníes con tarjeta');
    return true;
  }
  if(/(transfer|giro|qr|sipap|bancard)/.test(texto) &&
     /(cuanto|total|cobr[eé]|llevo|hice)/.test(texto)){
    var m3 = _asistTotalPorMetodo();
    var tr = m3['TRANSFERENCIA'] || m3['TRANSFER'] || 0;
    _asistHablar('Cobraste ' + _asistFmt(tr) + ' guaraníes por transferencia');
    return true;
  }
  if(/(m[eé]todos?\s+de\s+pago|por\s+m[eé]todo|desglose|como\s+cobr[eé])/.test(texto)){
    var metodos = _asistTotalPorMetodo();
    var keys = Object.keys(metodos);
    if(!keys.length){ _asistHablar('No hay ventas aún'); return true; }
    var partes = keys.map(function(k){
      return k.toLowerCase() + ' ' + _asistFmt(metodos[k]) + ' guaraníes';
    });
    _asistHablar('Tus cobros son: ' + partes.join(', '));
    return true;
  }
  return false;
}

function _asistIntentCaja(texto){
  if(!/(cuanto\s+hay\s+en\s+(la\s+)?caja|saldo\s+(de\s+)?caja|caja\s+actual|qu[eé]\s+hay\s+en\s+caja|total\s+de\s+caja|efectivo\s+en\s+caja|caja\s+tiene)/.test(texto)) return false;
  if(typeof calcSaldoEsperado === 'function'){
    var saldo = calcSaldoEsperado();
    _asistHablar('En la caja hay ' + _asistFmt(saldo) + ' guaraníes');
    return true;
  }
  var m = _asistTotalPorMetodo();
  var ef = m['EFECTIVO'] || 0;
  _asistHablar('En efectivo llevás ' + _asistFmt(ef) + ' guaraníes');
  return true;
}

function _asistIntentEgresos(texto){
  if(!/(egreso|gasto|gast[eé]|sal[ií]\s+plata|retir[eé])/.test(texto)) return false;
  var total = _asistTotalEgresos();
  var cant = (typeof turnoData !== 'undefined' && turnoData.egresos)
    ? turnoData.egresos.filter(function(e){ return !e.anulada; }).length : 0;
  if(cant === 0){ _asistHablar('No hay egresos registrados en este turno'); return true; }
  _asistHablar(cant + ' egreso' + (cant !== 1 ? 's' : '') + ' por un total de ' + _asistFmt(total) + ' guaraníes');
  return true;
}

function _asistIntentMasVendido(texto){
  if(!/(producto\s+m[aá]s\s+vendid|m[aá]s\s+vendid|producto\s+estrella|top\s+vent|top\s+producto|(que|cual)\s+(producto\s+)?(se\s+)?vend[ií]?\s+m[aá]s|m[aá]s\s+pedid)/.test(texto)) return false;
  var arr = _asistProductosVendidos();
  if(!arr.length){ _asistHablar('No hay productos vendidos aún'); return true; }
  if(/top\s+tres|top\s+3|tres\s+m[aá]s|primeros\s+tres/.test(texto) && arr.length >= 2){
    var top3 = arr.slice(0, 3).map(function(p){
      return p.name + ' con ' + p.cantidad + ' unidades';
    });
    _asistHablar('Los más vendidos son: ' + top3.join(', '));
    return true;
  }
  var top = arr[0];
  _asistHablar('El producto más vendido es ' + top.name + ' con ' + top.cantidad + ' unidades');
  return true;
}

function _asistIntentCantidadProductos(texto){
  if(!/(cuantos\s+productos|total\s+de\s+productos|cuantas\s+unidades|productos\s+vendidos?)/.test(texto)) return false;
  var arr = _asistProductosVendidos();
  var total = arr.reduce(function(s, p){ return s + p.cantidad; }, 0);
  _asistHablar('Vendiste ' + total + ' productos en total');
  return true;
}

function _asistIntentInicioTurno(texto){
  if(!/(cuando\s+(empec[eé]|empezo|abr[ií]|inici[eé])|hora\s+de\s+(apertura|inicio)|inicio\s+del?\s+turno|hace\s+cuanto\s+(abr[ií]|empec[eé])|apertura\s+del?\s+turno)/.test(texto)) return false;
  if(typeof turnoData === 'undefined' || !turnoData.fechaApertura){
    _asistHablar('No hay turno abierto'); return true;
  }
  var f = turnoData.fechaApertura instanceof Date ? turnoData.fechaApertura : new Date(turnoData.fechaApertura);
  var hh = String(f.getHours()).padStart(2, '0');
  var mm = String(f.getMinutes()).padStart(2, '0');
  var ms = Date.now() - f.getTime();
  var hs = Math.floor(ms / 3600000);
  var mins = Math.floor((ms % 3600000) / 60000);
  var hace = '';
  if(hs > 0) hace = ', hace ' + hs + ' hora' + (hs !== 1 ? 's' : '') + (mins > 0 ? ' y ' + mins + ' minutos' : '');
  else hace = ', hace ' + mins + ' minutos';
  _asistHablar('Abriste el turno a las ' + hh + ':' + mm + hace);
  return true;
}

function _asistIntentMesas(texto){
  if(!/(cuantas\s+mesas|mesas\s+ocupad|mesas\s+libres|cuantas\s+estan\s+ocupad|estado\s+de\s+mesas|mesas\s+hay)/.test(texto)) return false;
  if(typeof pendientes === 'undefined'){ _asistHablar('No puedo consultar las mesas ahora'); return true; }
  var ocupadas = pendientes.filter(function(p){ return p.mesa_id; });
  if(!ocupadas.length){ _asistHablar('No hay mesas ocupadas'); return true; }
  var total = 0;
  ocupadas.forEach(function(p){ total += (p.total || 0); });
  _asistHablar('Hay ' + ocupadas.length + ' mesa' + (ocupadas.length !== 1 ? 's' : '') + ' ocupada' + (ocupadas.length !== 1 ? 's' : '') + ' por un total de ' + _asistFmt(total) + ' guaraníes');
  return true;
}

function _asistIntentResumen(texto){
  if(!/(resumen|como\s+va\s+el\s+dia|como\s+(esta|va)\s+(el\s+)?turno|balance|reporte\s+(del?\s+)?(turno|d[ií]a)|como\s+voy)/.test(texto)) return false;
  var r = _asistTotalVentas();
  if(r.cantidad === 0){
    _asistHablar('Todavía no hay ventas en este turno');
    return true;
  }
  var prom = Math.round(r.total / r.cantidad);
  var m = _asistTotalPorMetodo();
  var ef = m['EFECTIVO'] || 0;
  var pos = m['POS'] || m['TARJETA'] || 0;
  var tr = m['TRANSFERENCIA'] || m['TRANSFER'] || 0;
  var partes = [];
  partes.push('Llevás ' + r.cantidad + ' ventas por ' + _asistFmt(r.total) + ' guaraníes');
  partes.push('Ticket promedio ' + _asistFmt(prom));
  if(ef > 0)  partes.push('Efectivo ' + _asistFmt(ef));
  if(pos > 0) partes.push('Tarjeta ' + _asistFmt(pos));
  if(tr > 0)  partes.push('Transferencia ' + _asistFmt(tr));
  var topProd = _asistProductosVendidos()[0];
  if(topProd) partes.push('El más vendido es ' + topProd.name);
  _asistHablar(partes.join('. ') + '.');
  return true;
}

// ── INTENT: redirigir operatoria al usuario ──
// Si el usuario intenta agregar/cobrar/navegar, le avisamos que no lo puede
// hacer con voz y que use los botones de la pantalla.
function _asistIntentOperatoria(texto){
  var patronesOperativos = [
    /^(agregar|agreg[aá]|vend[eé]me?|vender?|vende|poner|pon[eé]me?|ponele|a[nñ]adir|sumar|cargar|traer|tra[eé]me?|meter|dame|d[aá]me|quiero|necesito|vamos\s+con|facturame)\b/,
    /^(cobrar|cobr[aá]|cobrame|confirmar|confirm[aá]|finalizar|imprimir|imprim[ií])\b/,
    /^(abrir\s+mesa|cerrar\s+mesa|ir\s+a\s+mesa|pasame\s+a)/,
    /^(nueva\s+venta|limpiar|vaciar|cancelar\s+venta|anular)/,
    /^(efectivo\s+justo|recib[ií]|me\s+dio|pago\s+con)/
  ];
  for(var i = 0; i < patronesOperativos.length; i++){
    if(patronesOperativos[i].test(texto)){
      _asistHablar('Solo respondo preguntas sobre tus ventas. Para operar, usá los botones de la pantalla.');
      return true;
    }
  }
  return false;
}

// Dispatcher principal — solo ejecuta intents consultivos
function _asistEjecutarComando(alternativas){
  var alts = [];
  for(var i = 0; i < alternativas.length; i++){
    var raw = (alternativas[i] || '').toString().trim();
    if(raw) alts.push(raw);
  }
  if(!alts.length){ _asistHablar(_asistFrase('noEntendi')); return; }

  // Lista de intents — solo consultas (el asistente NO opera)
  var intents = [
    _asistIntentAyuda,
    _asistIntentResumen,           // resumen completo (antes de detalle)
    _asistIntentInicioTurno,
    _asistIntentMasVendido,
    _asistIntentCantidadProductos,
    _asistIntentMesas,
    _asistIntentEgresos,
    _asistIntentPromedio,
    _asistIntentVentaMax,
    _asistIntentCaja,
    _asistIntentMetodos,
    _asistIntentCantidadVentas,
    _asistIntentTotalVentas,
    _asistIntentOperatoria         // último: atrapa intentos operativos
  ];

  // Diagnóstico visual: muestra lo que escuchó antes de procesar
  if(typeof toast === 'function') toast('' + alts[0]);

  for(var a = 0; a < alts.length; a++){
    var textoNorm = _asistLimpiarMuletillas(_asistNormalizar(alts[a]));
    _log('[Asistente] Probando alt', a, ':', JSON.stringify(textoNorm));
    for(var q = 0; q < intents.length; q++){
      var intentName = intents[q].name || 'intent' + q;
      if(intents[q](textoNorm)){
        _log('[Asistente] <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><polyline points="20 6 9 17 4 12"/></svg> Matcheó:', intentName);
        return;
      }
    }
  }

  _asistHablar(_asistFrase('noEntendi') + ' Escuché: ' + alts[0]);
}

// ── DISAMBIGUACIÓN DE PRODUCTOS ─────────────────────────
function _asistPedirDisambiguacion(candidatos, textoOriginal, callback){
  _asistDisambiguacion = {
    candidatos: candidatos.slice(0, 5),
    callback: callback,
    intentos: 0,
    textoOriginal: textoOriginal
  };
  var nombres = _asistDisambiguacion.candidatos.map(function(p){ return p.name; });
  var frase;
  if(nombres.length === 2){
    frase = '¿Cuál? Tengo ' + nombres[0] + ' o ' + nombres[1];
  } else {
    frase = '¿Cuál? ' + nombres.slice(0, -1).join(', ') + ' o ' + nombres[nombres.length - 1];
  }
  _asistHablar(frase);
}

function _asistResolverDisambiguacion(texto){
  var d = _asistDisambiguacion;
  if(!d) return;
  d.intentos++;

  if(/^(cancelar|anular|nada|ninguno|olvid[aá]|dejalo)$/.test(texto)){
    _asistDisambiguacion = null;
    _asistHablar('Ok, cancelado');
    return;
  }

  var elegido = _asistMatchDisambiguacion(texto, d.candidatos);
  if(elegido){
    var cb = d.callback;
    var orig = d.textoOriginal;
    _asistDisambiguacion = null;
    _asistAliasGuardar(orig, elegido);
    if(typeof cb === 'function') cb(elegido);
    return;
  }

  if(d.intentos >= 2){
    _asistDisambiguacion = null;
    _asistHablar('No te entendí, dejalo así');
    return;
  }
  _asistHablar('¿Cuál? Decí el nombre o el número');
}

function _asistMatchDisambiguacion(texto, candidatos){
  if(!texto || !candidatos || !candidatos.length) return null;
  var t = _asistNormalizar(texto);

  // 1) Por posición: primero/segundo/tercero/etc. o número
  var posMap = {
    'primero':0,'el primero':0,'primera':0,'uno':0,'el uno':0,'la uno':0,'1':0,
    'segundo':1,'el segundo':1,'segunda':1,'dos':1,'el dos':1,'2':1,
    'tercero':2,'el tercero':2,'tres':2,'3':2,
    'cuarto':3,'cuatro':3,'4':3,
    'quinto':4,'cinco':4,'5':4
  };
  if(posMap[t] !== undefined && candidatos[posMap[t]]) return candidatos[posMap[t]];
  var m = t.match(/^(?:el\s+|la\s+)?(primero|primera|segundo|segunda|tercero|cuarto|quinto|uno|dos|tres|cuatro|cinco)$/);
  if(m && posMap[m[1]] !== undefined && candidatos[posMap[m[1]]]) return candidatos[posMap[m[1]]];

  // 2) Por substring del nombre (palabra diferenciadora)
  // Calcular tokens únicos por candidato (los que NO comparten con otros)
  var tokensCand = candidatos.map(function(p){ return _asistTokensProducto(p.name); });
  var tokensTexto = _asistTokensProducto(texto);

  // Buscar match directo de token
  var mejorIdx = -1, mejorCnt = 0;
  for(var i = 0; i < candidatos.length; i++){
    var cnt = 0;
    for(var a = 0; a < tokensCand[i].length; a++){
      for(var b = 0; b < tokensTexto.length; b++){
        if(tokensCand[i][a] === tokensTexto[b]){ cnt++; break; }
        if(tokensCand[i][a].length >= 4 && tokensTexto[b].length >= 4 &&
           _asistSimilitud(tokensCand[i][a], tokensTexto[b]) >= 0.8){ cnt++; break; }
      }
    }
    if(cnt > mejorCnt){ mejorCnt = cnt; mejorIdx = i; }
  }
  if(mejorCnt > 0) return candidatos[mejorIdx];

  // 3) Fuzzy sobre nombre completo
  var bestScore = 0, bestP = null;
  for(var j = 0; j < candidatos.length; j++){
    var s = _asistSimilitud(_asistNormalizar(candidatos[j].name), t);
    if(s > bestScore){ bestScore = s; bestP = candidatos[j]; }
  }
  if(bestScore >= 0.5) return bestP;
  return null;
}

// ── ALIASES POR CAJERO (IndexedDB + fallback en memoria) ─
var _ASIST_ALIAS_INIT = false;
function _asistAliasInit(){
  if(_ASIST_ALIAS_INIT) return;
  _ASIST_ALIAS_INIT = true;
  try {
    if(typeof Dexie === 'undefined'){
      console.warn('[Asistente/Alias] Dexie no disponible, usando memoria');
      _asistAliasMem = true;
      return;
    }
    _asistDb = new Dexie('POSAsistAlias');
    _asistDb.version(1).stores({
      aliases: '++id, &alias, productoId, usos, ultimoUso'
    });
    _asistDb.open().then(function(){
      return _asistDb.aliases.toArray();
    }).then(function(rows){
      var ahora = Date.now();
      var limpieza = [];
      var treintaDias = 30 * 24 * 60 * 60 * 1000;
      for(var i = 0; i < rows.length; i++){
        var r = rows[i];
        if((r.usos || 0) < 2 && (ahora - (r.ultimoUso || 0)) > treintaDias){
          limpieza.push(r.id);
          continue;
        }
        _asistAliasCache[r.alias] = r.productoId;
      }
      if(limpieza.length){
        _asistDb.aliases.bulkDelete(limpieza).catch(function(){});
      }
      _log('[Asistente/Alias] Cargados:', Object.keys(_asistAliasCache).length);
    }).catch(function(err){
      console.warn('[Asistente/Alias] Error abriendo DB, fallback memoria:', err);
      _asistAliasMem = true;
    });
  } catch(e){
    console.warn('[Asistente/Alias] Excepción init, fallback memoria:', e);
    _asistAliasMem = true;
  }
}

function _asistAliasBuscar(textoNorm){
  if(!textoNorm) return null;
  var id = _asistAliasCache[textoNorm];
  if(id == null || typeof PRODS === 'undefined') return null;
  for(var i = 0; i < PRODS.length; i++){
    if(PRODS[i] && PRODS[i].id === id) return PRODS[i];
  }
  return null;
}

function _asistAliasGuardar(texto, producto){
  if(!producto || !producto.id) return;
  var alias = _asistNormalizar(texto);
  if(!alias) return;
  // No guardar si el alias es idéntico al nombre normalizado
  if(alias === _asistNormalizar(producto.name)) return;
  var existente = _asistAliasCache[alias];
  _asistAliasCache[alias] = producto.id;
  _log('[Asistente/Alias] Guardando:', alias, '→', producto.name);

  if(_asistAliasMem || !_asistDb){
    return; // solo en cache
  }
  try {
    _asistDb.aliases.where('alias').equals(alias).first().then(function(row){
      if(row){
        return _asistDb.aliases.update(row.id, {
          productoId: producto.id,
          usos: (row.usos || 0) + 1,
          ultimoUso: Date.now()
        });
      }
      return _asistDb.aliases.add({
        alias: alias,
        productoId: producto.id,
        usos: 1,
        ultimoUso: Date.now()
      });
    }).catch(function(err){
      console.warn('[Asistente/Alias] Error guardando, fallback memoria:', err);
      _asistAliasMem = true;
    });
  } catch(e){
    console.warn('[Asistente/Alias] Excepción guardando:', e);
    _asistAliasMem = true;
  }
}

// ── UI: PANEL DE TRANSCRIPCIÓN EN VIVO (DESACTIVADO) ──────────────────
// El usuario pidió no ver el texto dictado en pantalla.
// Las funciones quedan como no-ops para preservar la interfaz interna.
function _asistTranscripcionEl(){ return null; }
function _asistTranscripcionMostrar(){ /* no-op */ }
function _asistTranscripcionOcultar(){
  // Por las dudas, remover el elemento si existe
  var el = document.getElementById('asistTranscripcion');
  if(el && el.parentNode) el.parentNode.removeChild(el);
}
function _asistTranscripcionUpdate(texto, esFinal){ /* no-op */ }
function _asistTranscripcionCountdown(segs){ /* no-op */ }

// ── RESPUESTA POR VOZ ──────────────────────────────────
// Flag para saber si el asistente está hablando — se usa para ignorar
// lo que captura el micrófono mientras habla (auto-escucha)
var _asistHablando = false;

function _asistHablar(texto){
  if(typeof toast === 'function') toast('' + texto);
  if(typeof vozMuteGet === 'function' && vozMuteGet()){
    _asistHablando = false;
    _asistBloqueado = false;
    return;
  }
  if(!('speechSynthesis' in window)){
    _asistHablando = false;
    _asistBloqueado = false;
    return;
  }
  try {
    window.speechSynthesis.cancel();

    // PAUSAR el recognition mientras el asistente habla
    if(_recognition && _asistEscuchando){
      try { _recognition.abort(); } catch(e){}
    }
    _asistHablando = true;
    _asistBloqueado = true;

    var u = new SpeechSynthesisUtterance();
    u.text = texto;
    u.lang = 'es-PY';
    u.rate = 1.18;  // más rápido (antes 1.08)
    u.volume = 1;
    if(typeof _findVozEs === 'function'){
      var v = _findVozEs();
      if(v) u.voice = v;
    }

    var desbloquear = function(){
      _asistHablando = false;
      // Delay corto (200ms) para evitar eco pero permitir siguiente tap rápido
      setTimeout(function(){ _asistBloqueado = false; }, 200);
    };

    u.onend = desbloquear;
    u.onerror = desbloquear;

    // Failsafe: si onend no se dispara en 15s, desbloquear igual
    setTimeout(function(){
      if(_asistHablando){
        console.warn('[Asistente] onend no disparó — desbloqueando manualmente');
        desbloquear();
      }
    }, 15000);

    window.speechSynthesis.speak(u);
  } catch(e){
    _asistHablando = false;
    _asistBloqueado = false;
  }
}

// ── UI: FAB FLOTANTE + ONDAS ANIMADAS ───────────────────
function _asistMostrarOndas(activo){
  var fab = document.getElementById('asistFab');
  if(!fab) return;
  if(activo){
    fab.classList.add('escuchando');
  } else {
    fab.classList.remove('escuchando');
  }
}

// Leer configuración del toggle — por defecto: activado
function asistenteHabilitadoGet(){
  var v = localStorage.getItem('pos_asistente_habilitado');
  return v !== '0'; // default true
}
function asistenteHabilitadoSet(habilitado){
  localStorage.setItem('pos_asistente_habilitado', habilitado ? '1' : '0');
  var fab = document.getElementById('asistFab');
  if(fab){
    fab.style.display = habilitado ? 'flex' : 'none';
  } else if(habilitado){
    _asistCrearFab();
  }
}

// Crear el FAB al cargar la página
function _asistCrearFab(){
  if(!document.body){
    console.warn('[Asistente] document.body no disponible aún, reintentando...');
    setTimeout(_asistCrearFab, 200);
    return;
  }
  if(document.getElementById('asistFab')){
    _log('[Asistente] FAB ya existe');
    return;
  }
  // Solo crear si está habilitado en config
  if(!asistenteHabilitadoGet()){
    _log('[Asistente] Deshabilitado por config');
    return;
  }
  var fab = document.createElement('button');
  fab.id = 'asistFab';
  fab.className = 'asist-fab';
  fab.title = 'Asistente de voz (toca para hablar)';
  // Estilos inline como fallback en caso de que el CSS no cargue
  fab.style.cssText = [
    'position:fixed',
    'bottom:24px',
    'right:24px',
    'width:62px',
    'height:62px',
    'border-radius:50%',
    'background:linear-gradient(135deg,#4caf50 0%,#2e7d32 100%)',
    'border:3px solid rgba(255,255,255,.25)',
    'color:#fff',
    'box-shadow:0 6px 28px rgba(76,175,80,.6),0 2px 10px rgba(0,0,0,.4)',
    'cursor:pointer',
    'z-index:999999',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'padding:0',
  ].join(';');
  fab.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="position:relative;z-index:2;">'
    + '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>'
    + '<path d="M19 10v2a7 7 0 0 1-14 0v-2"/>'
    + '<line x1="12" y1="19" x2="12" y2="23"/>'
    + '<line x1="8" y1="23" x2="16" y2="23"/>'
    + '</svg>'
    + '<span class="asist-ondas"><span></span><span></span><span></span></span>';
  fab.onclick = asistenteEscuchar;
  document.body.appendChild(fab);
  // Warm-up del cache de aliases
  try { _asistAliasInit(); } catch(e){}
  _log('[Asistente] FAB creado y agregado al body <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><polyline points="20 6 9 17 4 12"/></svg>');
}

// Intentar crear el FAB en múltiples momentos para asegurar que se renderiza
// (eliminado _log top-level — corre antes de que lib/log.mjs cargue)
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', _asistCrearFab);
} else {
  _asistCrearFab();
}
// Backup: también al window.load (por si acaso)
window.addEventListener('load', function(){
  if(!document.getElementById('asistFab')) _asistCrearFab();
});
// Último backup: después de 2 segundos, si aún no existe, crearlo
setTimeout(function(){
  if(!document.getElementById('asistFab')){
    console.warn('[Asistente] FAB no se creó en el flujo normal, forzando...');
    _asistCrearFab();
  }
}, 2000);
