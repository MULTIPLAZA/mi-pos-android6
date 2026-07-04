// ── Licencia, sesion, login, activacion ──

// SUPA_URL y SUPA_ANON vienen de js/config.js
var APP_VERSION = 'v1.15.33 (2026-07-05)';

// ══════════════════════════════════════════════════════════════════════════════
// MODO TERMINAL — 'caja' (default) o 'satelite'
//
// DESCRIPCIÓN:
//   Controla qué puede hacer este dispositivo dentro del sistema POS.
//
//   'caja'     → Terminal principal. Puede abrir/cerrar turno, cobrar y facturar.
//                Comportamiento original sin cambios.
//
//   'satelite' → Terminal de mesero/delivery. Puede tomar pedidos, asignar mesas,
//                imprimir comandas en cocina, pero NO puede cobrar ni facturar.
//                El botón COBRAR se convierte en ENVIAR PEDIDO.
//                Los pedidos se sincronizan a Supabase (tabla pos_pedidos) para
//                que la caja central los vea en tiempo real.
//
// CÓMO CONFIGURAR:
//   Desde admin-negocio.html → Configuración → Modo Terminal
//   O directamente: localStorage.setItem('pos_modo_terminal', 'satelite')
//
// IMPACTO EN UI:
//   - Botón COBRAR → ENVIAR PEDIDO (color púrpura #534AB7)
//   - Pantalla #scCobrar → inaccesible
//   - Turno/Cierre → ocultos en drawer
//   - Todo lo demás (catálogo, mesas, delivery, carrito) → sin cambios
// ══════════════════════════════════════════════════════════════════════════════
var MODO_TERMINAL = localStorage.getItem('pos_modo_terminal') || 'caja';
// SUPA_ANON ahora en js/config.js

// supaRPC viene de js/config.js

var SK = {
  token:'lic_token', email:'lic_email', negocio:'lic_negocio',
  plan:'lic_plan', vence:'lic_vence', nextCheck:'lic_next_check',
  activated:'lic_activated', deviceId:'lic_device_id', fallos:'lic_fallos'
};

const DEMO_KEYS = {
  'DEMO-2025-XXXX': { plan:'Basico',   vence:'2026-12-31' },
  'PRO-2025-YYYY':  { plan:'Pro',      vence:'2026-12-31' },
  'FULL-2025-ZZZZ': { plan:'Completo', vence:'2027-12-31' },
};
var USAR_DEMO = (SUPA_URL === 'https://XXXXXXXXXXXXXXXX.supabase.co');

// Cookie helpers para device_id (sobrevive borrar caché en algunos casos)
function cookieSet(name, val, days){
  const d = new Date(); d.setTime(d.getTime()+(days*86400000));
  document.cookie = name+'='+encodeURIComponent(val)+';expires='+d.toUTCString()+';path=/;SameSite=Lax';
}
function cookieGet(name){
  const m = document.cookie.match('(?:^|; )'+name+'=([^;]*)');
  return m ? decodeURIComponent(m[1]) : null;
}

function licGetDeviceId(){
  // Priority: localStorage → cookie → sessionStorage → generate NEW
  let id = localStorage.getItem(SK.deviceId)
         || cookieGet('pos_device_id')
         || sessionStorage.getItem(SK.deviceId);
  if(!id){
    const rand = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2);
    id = 'dev_' + rand.replace(/-/g,'').slice(0, 20);
  }
  // Persistir en todas las capas
  localStorage.setItem(SK.deviceId, id);
  cookieSet('pos_device_id', id, 365); // cookie dura 1 año
  sessionStorage.setItem(SK.deviceId, id);
  if(typeof db !== 'undefined' && db){
    // BUG-02 fix: el object store `config` tiene keyPath `clave` (español, ver sync.js:31),
    // antes se usaba {key, value} y el put() fallaba silenciosamente con "key path did not yield a value".
    try { db.config.put({clave:'device_id', valor:id}); } catch(e){ console.warn('[licencia] Error persistiendo device_id en IndexedDB:', e.message); }
  }
  return id;
}

async function licGetDeviceIdAsync(){
  // 1. Try fastest layers first
  let id = localStorage.getItem(SK.deviceId) || sessionStorage.getItem(SK.deviceId);
  if(id) return id;

  // 2. Try cookie — survives localStorage.clear() in most browsers
  if(!id) id = cookieGet('pos_device_id');
  if(id){
    localStorage.setItem(SK.deviceId, id);
    sessionStorage.setItem(SK.deviceId, id);
    return id;
  }

  // 3. Try IndexedDB — survives localStorage.clear()
  try {
    if(typeof db !== 'undefined' && db){
      const row = await db.config.get('device_id');
      // BUG-02 fix: el object store guarda como {clave, valor}; antes leía .value (inglés)
      // que nunca existía → siempre devolvía null y se regeneraba un device_id distinto
      // en cada sesión cuando localStorage estaba limpio.
      var rowVal = row && (row.valor || row.value);
      if(rowVal){
        id = rowVal;
        localStorage.setItem(SK.deviceId, id);
        cookieSet('pos_device_id', id, 365);
        sessionStorage.setItem(SK.deviceId, id);
        return id;
      }
    }
  } catch(e){ console.warn('[licencia] Error leyendo device_id de IndexedDB:', e.message); }

  // 3. No ID found anywhere — generate a NEW unique one for THIS device
  const rand = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2);
  id = 'dev_' + rand.replace(/-/g,'').slice(0, 20);

  // Persist everywhere
  localStorage.setItem(SK.deviceId, id);
  sessionStorage.setItem(SK.deviceId, id);
  if(typeof db !== 'undefined' && db){
    // BUG-02 fix: keyPath del store `config` es `clave` (ver sync.js:31).
    try { db.config.put({clave:'device_id', valor:id}); } catch(e){ console.warn('[licencia] Error persistiendo device_id en IndexedDB:', e.message); }
  }
  return id;
}
function licIsActivated(){ return !!localStorage.getItem(SK.activated); }

async function licActivar(email,clave){
  const claveUp=clave.toUpperCase().trim();
  if(!email||!email.includes('@')) return {ok:false,error:'Email invalido'};
  if(!claveUp) return {ok:false,error:'Ingresa la clave de licencia'};
  if(USAR_DEMO){
    await new Promise(r=>setTimeout(r,1200));
    const licData=DEMO_KEYS[claveUp];
    if(!licData) return {ok:false,error:'Clave invalida. (Demo: DEMO-2025-XXXX)'};
    const token='tk_demo_'+btoa(email+':'+claveUp).replace(/=/g,'').substring(0,24);
    return {ok:true,token,email,plan:licData.plan,vence:licData.vence};
  }
  try {
    _log('[Licencia] Activando con Supabase...', claveUp);
    const data=await supaRPC('activar_licencia',{p_clave:claveUp,p_email:email,p_device_id:licGetDeviceId()});
    _log('[Licencia] Respuesta Supabase:', data);
    if(!data.ok) return {ok:false,error:data.error||'Error al activar'};
    return {ok:true,token:data.token,email,plan:data.plan,vence:data.vence};
  } catch(e){
    console.error('[Licencia] Error Supabase:', e.message);
    return {ok:false,error:'Error de conexion: '+e.message};
  }
}

function licGuardar(data){
  localStorage.setItem(SK.activated,'1');
  localStorage.setItem(SK.token,data.token);
  localStorage.setItem(SK.email,data.email);
  localStorage.setItem(SK.plan,data.plan);
  localStorage.setItem(SK.vence,data.vence);
  localStorage.setItem(SK.fallos,'0');
  localStorage.setItem(SK.nextCheck,String(Date.now()+24*60*60*1000));
  // Guardar email en cookie como backup para auto-recuperación offline.
  // Si se borra el localStorage, licInit puede leer el email desde aquí
  // y usarlo como fallback mientras no haya internet.
  cookieSet('pos_email_bk', data.email, 730); // 2 años
}

function licSetNegocio(nombre){
  localStorage.setItem(SK.negocio,nombre);
  if(typeof configData!=='undefined') configData.negocio=nombre;
  if(db) dbSaveConfig('negocio',nombre);
}

function licGetTerminal(){
  return localStorage.getItem('pos_terminal') || 'Terminal 1';
}

async function licVerificarServidor(){
  if(USAR_DEMO){ await new Promise(r=>setTimeout(r,400)); return true; }
  const email=localStorage.getItem(SK.email);
  if(!email) return false;
  const data=await supaRPC('verificar_licencia',{p_device_id:licGetDeviceId(),p_email:email});
  return data.activa===true;
}

async function licCheckPeriodico(){
  if(!licIsActivated()) return;
  const next=parseInt(localStorage.getItem(SK.nextCheck)||'0');
  if(Date.now()<next) return;
  await licVerificarAhora();
}

// Verificación forzada — llama al servidor sin importar el timer
async function licVerificarAhora(){
  if(!licIsActivated()) return false;
  if(!navigator.onLine) return true; // sin internet, tolerar
  try {
    const activa=await licVerificarServidor();
    if(!activa){
      localStorage.removeItem(SK.activated);
      licMostrarBloqueo('SUSPENDIDA');
      return false;
    }
    // Verificación exitosa: resetear timer y fallos
    localStorage.setItem(SK.nextCheck, String(Date.now()+24*60*60*1000));
    localStorage.setItem(SK.fallos,'0');
    return true;
  } catch(e){
    // Error de red — siempre tolerar, nunca bloquear por falta de internet
    const fallos=parseInt(localStorage.getItem(SK.fallos)||'0')+1;
    localStorage.setItem(SK.fallos,String(fallos));
    console.warn('[Licencia] Fallo #'+fallos+': '+e.message);
    // Solo bloquear si hay muchos fallos Y hay internet (error real, no de red)
    if(fallos>=5 && navigator.onLine) licMostrarBloqueo('SIN_CONEXION');
    return true; // siempre dejar pasar si es error de conectividad
  }
}

function licMostrarBloqueo(motivo){
  const msgs={
    'SUSPENDIDA':{t:'Licencia suspendida',s:'Tu licencia fue suspendida. Contacta al soporte.',i:''},
    'SIN_CONEXION':{t:'Sin verificacion',s:'No se pudo verificar por 3 dias. Verifica tu internet.',i:''},
    'VENCIDA':{t:'Licencia vencida',s:'Tu periodo vencio. Renova tu licencia para continuar.',i:''},
  };
  const m=msgs[motivo]||msgs['SUSPENDIDA'];
  document.getElementById('bloqueoTitulo').textContent=m.t;
  document.getElementById('bloqueoSub').textContent=m.s;
  document.getElementById('bloqueoInfo').textContent=m.i;
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active')); ['scActivacion','scActivado','scBloqueado'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='none';});
  document.getElementById('scBloqueado').style.display='flex';
}

// ══════════════════════════════════════════════════════════════════════════════
// licInit — punto de entrada de la verificación de licencia al arrancar.
//
// FLUJO MEJORADO — auto-recuperación sin re-registro:
//
//   CASO 1 — Normal (localStorage intacto):
//     lic_activated presente → arrancar directo, verificar en background.
//
//   CASO 2 — Caché borrada / app reinstalada (localStorage perdido):
//     lic_activated ausente, PERO el device_id puede sobrevivir en:
//       a) Cookie (dura 1 año, sobrevive borrar caché en Android/Chrome)
//       b) IndexedDB (sobrevive borrar caché si no se borró storage completo)
//     Si hay device_id → consultar activaciones en Supabase.
//     Si Supabase confirma que ese device está activo → restaurar todo
//     automáticamente SIN pedirle nada al usuario.
//     Si no hay device_id O Supabase dice que no está → pedir registro.
//
//   CASO 3 — Sin internet:
//     Usar lo que haya en localStorage/cookies sin verificar.
//     Si no hay nada en ninguna capa → mostrar pantalla de activación.
//
// PRINCIPIO:
//   Una vez que un dispositivo fue registrado, NUNCA debe pedir registro
//   de nuevo salvo que el proveedor (super-admin) lo deshabilite
//   seteando activaciones.activa = false.
// ══════════════════════════════════════════════════════════════════════════════
async function licInit(){

  // ── CASO 1: localStorage intacto — flujo normal ──────────────────────────
  if(licIsActivated()){
    const neg = localStorage.getItem(SK.negocio);
    if(neg && typeof configData !== 'undefined') configData.negocio = neg;

    if(navigator.onLine){
      // Verificar en background sin bloquear el arranque
      licVerificarAhora().catch(e => console.warn('[Licencia] Verificación background:', e.message));
      // Recuperar config de terminal si se perdió (sin re-registro)
      if(!localStorage.getItem('pos_terminal') || !localStorage.getItem('pos_sucursal')){
        try{
          await licGetDeviceIdAsync();
          const cfg = await recuperarConfigTerminalSupabase();
          if(cfg){
            aplicarConfigTerminal(cfg);
            _log('[licInit] Terminal recuperada:', cfg.terminal, '/', cfg.sucursal);
          }
        }catch(e){ console.warn('[licInit] No se pudo recuperar config:', e.message); }
      }
    } else {
      licCheckPeriodico().catch(function(e){ console.warn('[Licencia] Error en check periódico:', e.message); });
    }
    return true;
  }

  // ── CASO 2: localStorage perdido — intentar auto-recuperar ───────────────
  // El device_id puede sobrevivir en cookie o IndexedDB aunque se borre
  // el localStorage. Si lo encontramos, consultamos Supabase.
  _log('[licInit] localStorage sin activación — buscando device_id en otras capas...');

  // Mostrar pantalla de carga mientras intentamos recuperar
  licMostrarRecuperando();

  let recuperado = false;

  if(navigator.onLine){
    try{
      // Intentar recuperar el device_id desde cookie o IndexedDB
      const deviceId = await licGetDeviceIdAsync();
      _log('[licInit] device_id encontrado:', deviceId ? deviceId.substring(0,12)+'...' : 'ninguno');

      if(deviceId){
        // Consultar activaciones por device_id directamente
        const rows = await supaGet('activaciones',
            'device_id=eq.' + encodeURIComponent(deviceId)
            + '&activa=eq.true'
            + '&select=email,nombre_negocio,nombre_terminal,sucursal,licencia_id,modo'
            + '&limit=1');

        {
          const activ = Array.isArray(rows) && rows[0] ? rows[0] : null;

          if(activ && activ.email){
            _log('[licInit] <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><polyline points="20 6 9 17 4 12"/></svg> Dispositivo reconocido en Supabase — restaurando sesión...');
            _log('[licInit]   Email:', activ.email, '| Terminal:', activ.nombre_terminal, '| Modo:', activ.modo);

            // Restaurar datos de licencia en localStorage
            // El token lo regeneramos desde Supabase o usamos un placeholder seguro
            const tokenData = await supaRPC('verificar_licencia', {
              p_device_id: deviceId,
              p_email:     activ.email,
            });

            if(tokenData && tokenData.activa){
              // Restaurar todas las claves SK
              localStorage.setItem(SK.activated, '1');
              localStorage.setItem(SK.email,     activ.email);
              localStorage.setItem(SK.token,     tokenData.token || 'restored_' + deviceId.slice(0,8));
              localStorage.setItem(SK.plan,      tokenData.plan  || 'Basico');
              localStorage.setItem(SK.vence,     tokenData.vence || '');
              localStorage.setItem(SK.fallos,    '0');
              localStorage.setItem(SK.nextCheck, String(Date.now() + 24*60*60*1000));

              // Restaurar datos del negocio — solo como fallback si el usuario no tiene valor propio
              if(activ.nombre_negocio){
                localStorage.setItem(SK.negocio, activ.nombre_negocio);
                // Solo aplicar a configData si el usuario NO tiene un valor guardado en 'an'
                var _userNeg = localStorage.getItem('an');
                if(!_userNeg && typeof configData !== 'undefined') configData.negocio = activ.nombre_negocio;
              }

              // Restaurar datos de terminal
              if(activ.nombre_terminal) localStorage.setItem('pos_terminal', activ.nombre_terminal);
              if(activ.sucursal)        localStorage.setItem('pos_sucursal', activ.sucursal);
              if(activ.licencia_id)     { localStorage.setItem('ali', String(activ.licencia_id)); cookieSet('ali', String(activ.licencia_id), 365); }
              if(activ.modo)            localStorage.setItem('pos_modo_terminal', activ.modo);

              // Intentar recuperar config completa (deposito_id, sucursal_id, etc.)
              try{
                const cfg = await recuperarConfigTerminalSupabase();
                if(cfg) aplicarConfigTerminal(cfg);
              }catch(e){ console.warn('[licInit] Error recuperando config terminal:', e.message); }

              recuperado = true;
              _log('[licInit] <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><polyline points="20 6 9 17 4 12"/></svg> Sesión restaurada automáticamente — sin re-registro');
            } else {
              console.warn('[licInit] Supabase dice que la licencia no está activa para este device');
            }
          } else {
            console.warn('[licInit] device_id no encontrado en activaciones o inactivo');
          }
        }
      }
    } catch(e){
      console.warn('[licInit] Error al intentar auto-recuperar:', e.message);
      // No bloquear: si falla la red, caer al caso 3 (sin internet)
    }
  } else {
    // ── CASO 3: Sin internet y sin localStorage ─────────────────────────────
    // Intentar usar lo que quede en cookie/sessionStorage como fallback mínimo
    const emailCookie = cookieGet('pos_email_bk'); // guardado al activar
    if(emailCookie){
      console.warn('[licInit] Sin internet — usando email desde cookie como fallback offline');
      localStorage.setItem(SK.email, emailCookie);
      // NO marcamos como activated — al conectarse verificará correctamente
    }
  }

  // Ocultar pantalla de recuperación
  licOcultarRecuperando();

  if(recuperado){
    // Restauración exitosa — arrancar normalmente
    return true;
  }

  // No se pudo recuperar — mostrar pantalla de activación
  _log('[licInit] No se pudo recuperar sesión — mostrando pantalla de activación');
  document.getElementById('scActivacion').style.display = 'flex';
  return false;
}

// ── Pantalla de "Recuperando sesión..." (mientras se consulta Supabase) ──────
// Evita que el usuario vea brevemente la pantalla de activación antes
// de que la auto-recuperación termine.
function licMostrarRecuperando(){
  // Reutilizar scBloqueado con mensaje diferente, o crear overlay simple
  const overlay = document.getElementById('licRecuperandoOverlay');
  if(overlay){ overlay.style.display = 'flex'; return; }
  // Crear el overlay si no existe
  const div = document.createElement('div');
  div.id = 'licRecuperandoOverlay';
  div.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:10000', 'background:#1a1a1a',
    'display:flex', 'flex-direction:column', 'align-items:center',
    'justify-content:center', 'gap:16px',
  ].join(';');
  div.innerHTML = [
    '<div style="width:48px;height:48px;border-radius:50%;border:3px solid #2a2a2a;',
    'border-top-color:#4caf50;animation:lic-spin .8s linear infinite;"></div>',
    '<p style="color:#666;font-size:14px;font-family:Barlow,sans-serif;">',
    'Verificando dispositivo...</p>',
  ].join('');
  document.body.appendChild(div);
}

function licOcultarRecuperando(){
  const overlay = document.getElementById('licRecuperandoOverlay');
  if(overlay) overlay.style.display = 'none';
}

async function doActivar(){
  const email=document.getElementById('licEmail').value.trim();
  const clave=document.getElementById('licClave').value.trim();
  const btn=document.getElementById('licActivarBtn');
  const errEl=document.getElementById('licError');
  errEl.style.display='none';
  if(!email){licShowError('Ingresa tu email');return;}
  if(clave.length < 5){licShowError('Ingresa la clave de licencia');return;}
  btn.disabled=true;
  btn.style.background='#333';
  btn.innerHTML='<div style="width:18px;height:18px;border-radius:50%;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;animation:lic-spin .8s linear infinite;display:inline-block;margin-right:8px;vertical-align:middle;"></div> Verificando...';
  const res=await licActivar(email,clave);
  if(!res.ok){
    btn.disabled=false;
    btn.style.background='#4caf50';
    btn.innerHTML='ACTIVAR';
    licShowError(res.error); return;
  }
  licGuardar(res);
  document.getElementById('scActivacion').style.display='none';
  document.getElementById('activadoPlan').textContent='Plan '+res.plan;
  document.getElementById('activadoSub').textContent='Licencia activa hasta '+res.vence+'. Bienvenido.';
  document.getElementById('activadoNegocio').value='';
  // Mostrar spinner mientras buscamos config previa
  const btnEntrar = document.getElementById('scActivado');
  // Intentar recuperar config de ESTE dispositivo específico (solo por device_id exacto)
  try{
    var deviceId = await licGetDeviceIdAsync();
    if(deviceId){
      var cfgRows = await supaGet('pos_config',
        'licencia_email=eq.'+encodeURIComponent(email)
        +'&clave=eq.terminal_config_'+encodeURIComponent(deviceId)
        +'&select=valor&limit=1');
      if(cfgRows && cfgRows[0]){
        var cfg = JSON.parse(cfgRows[0].valor);
        if(cfg && cfg.terminal && cfg.sucursal){
          aplicarConfigTerminal(cfg);
          _log('[Activar] Terminal restaurada por device_id exacto:', cfg.terminal, '/', cfg.sucursal);
          document.getElementById('scActivado').style.display='none';
          await iniciarApp();
          return;
        }
      }
    }
  }catch(e){ console.warn('[Activar] No se pudo recuperar config:', e.message); }
  // Este dispositivo no tiene config → mostrar formulario de setup
  // Pre-llenar nombre del negocio si lo tenemos
  var negGuardado = localStorage.getItem(SK.negocio);
  if(negGuardado) document.getElementById('activadoNegocio').value = negGuardado;

  // Cargar sucursales existentes para sugerir en el dropdown
  cargarSucursalesExistentes(email);

  // BUG-06 fix: scClosed (entre otras) tiene `class="screen active"` por default
  // en index.html → queda renderizado detrás del overlay scActivado y sus botones
  // (ej. "ABRIR EL TURNO") aparecen como clickeables en tests de accesibilidad/QA
  // aunque el usuario humano no los ve por el z-index. Análogo al ocultamiento
  // que hace licMostrarBloqueo() en línea 221 antes de mostrar scBloqueado.
  document.querySelectorAll('.screen').forEach(function(s){
    if(s.id !== 'scActivado'){ s.style.display='none'; s.classList.remove('active'); }
  });
  document.getElementById('scActivado').style.display='flex';
}

// ── Selector de sucursal: carga desde tabla `sucursales` ──────────────────────
// Muestra un <select> real con las sucursales registradas + opción "Nueva sucursal"
async function cargarSucursalesExistentes(email){
  var sel  = document.getElementById('activadoSucursalSel');
  if(!sel) return;
  if(!email || USAR_DEMO){
    // Sin datos reales: dejar el campo listo para escribir nombre libre
    sel.innerHTML = '<option value="__nuevo__"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nueva sucursal</option>';
    onSucursalSelChange(sel);
    return;
  }

  try {
    // Obtener licencia_id del email
    // NOTA: la tabla `licencias` NO tiene la columna `nombre_negocio`; el nombre del
    // negocio se pre-llena más abajo desde la tabla `activaciones` (fallback) que sí lo tiene.
    var licRows = await supaGet('licencias',
      'email_cliente=ilike.' + encodeURIComponent(email) + '&activa=eq.true&select=id&limit=1');
    var licId = licRows && licRows[0] ? licRows[0].id : null;
    var negInput = document.getElementById('activadoNegocio');

    var sucursales = [];
    if(licId){
      sucursales = await supaGet('sucursales',
        'licencia_id=eq.' + licId + '&activa=eq.true&order=nombre.asc&select=id,nombre');
    }

    // Si no hay sucursales en la tabla, intentar desde activaciones como fallback
    if(!sucursales.length){
      var actRows = await supaGet('activaciones',
        'email=eq.' + encodeURIComponent(email)
        + '&activa=eq.true&deleted_at=is.null'
        + '&select=sucursal,nombre_negocio');
      if(Array.isArray(actRows)){
        var vistas = {};
        actRows.forEach(function(r){
          if(r.sucursal && !vistas[r.sucursal]){
            vistas[r.sucursal] = true;
            sucursales.push({ id: null, nombre: r.sucursal });
          }
        });
        // Pre-llenar negocio desde activaciones si no se obtuvo de licencias
        if(negInput && !negInput.value && actRows[0] && actRows[0].nombre_negocio){
          negInput.value = actRows[0].nombre_negocio;
        }
      }
    }

    // Poblar el select
    var opciones = '<option value="" disabled>Selecciona una sucursal...</option>';
    sucursales.forEach(function(s){
      opciones += '<option value="' + (s.id||'__nombre__:'+s.nombre) + '" data-nombre="' + s.nombre.replace(/"/g,'&quot;') + '">'
               + s.nombre + '</option>';
    });
    opciones += '<option value="__nuevo__"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nueva sucursal</option>';
    sel.innerHTML = opciones;

    // Si solo hay una, preseleccionarla y disparar cambio
    if(sucursales.length === 1){
      sel.value = sucursales[0].id ? String(sucursales[0].id) : '__nombre__:'+sucursales[0].nombre;
      onSucursalSelChange(sel);
    } else if(!sucursales.length){
      // Sin sucursales: mostrar directamente input de nueva
      sel.value = '__nuevo__';
      onSucursalSelChange(sel);
    } else {
      sel.value = '';
    }

    _log('[Setup] Sucursales cargadas:', sucursales.length);
  } catch(e){
    console.warn('[Setup] Error cargando sucursales:', e.message);
    // En caso de error, dejar opción de escribir manualmente
    var sel2 = document.getElementById('activadoSucursalSel');
    if(sel2) sel2.innerHTML = '<option value="__nuevo__"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nueva sucursal</option>';
    onSucursalSelChange(document.getElementById('activadoSucursalSel'));
  }
}

// Manejador de cambio en el select de sucursal
function onSucursalSelChange(sel){
  var val  = sel ? sel.value : '';
  var inputNueva = document.getElementById('activadoSucursalNueva');
  var hidNombre  = document.getElementById('activadoSucursal');
  var hidId      = document.getElementById('activadoSucursalId');
  var hint       = document.getElementById('activadoSucursalHint');

  if(val === '__nuevo__'){
    // Mostrar input de texto libre para nueva sucursal
    if(inputNueva) inputNueva.style.display = 'block';
    if(hidId)     hidId.value = '0';
    if(hidNombre) hidNombre.value = (inputNueva ? inputNueva.value.trim() : '');
    if(hint)      hint.textContent = 'Escribe el nombre de la nueva sucursal';
    // Limpiar depósitos (serán nuevos también)
    _limpiarDepositosSel(null, null);
  } else if(val && val.startsWith('__nombre__:')){
    // Sucursal sin ID (venía de activaciones fallback)
    var nombre = val.replace('__nombre__:', '');
    if(inputNueva) inputNueva.style.display = 'none';
    if(hidNombre)  hidNombre.value = nombre;
    if(hidId)      hidId.value = '0';
    if(hint)       hint.textContent = 'Sucursal seleccionada: ' + nombre;
    _cargarDepositosSel(null, nombre);
  } else if(val && val !== ''){
    // Sucursal existente con ID numérico
    var opt = sel ? sel.options[sel.selectedIndex] : null;
    var nombre2 = opt ? (opt.getAttribute('data-nombre') || opt.textContent.trim()) : val;
    if(inputNueva) inputNueva.style.display = 'none';
    if(hidNombre)  hidNombre.value = nombre2;
    if(hidId)      hidId.value = val;
    if(hint)       hint.textContent = 'Sucursal seleccionada: ' + nombre2;
    _cargarDepositosSel(parseInt(val), nombre2);
  } else {
    // Sin selección
    if(inputNueva) inputNueva.style.display = 'none';
    if(hidNombre)  hidNombre.value = '';
    if(hidId)      hidId.value = '0';
    _limpiarDepositosSel(null, null);
  }
}

// Sincronizar input de nueva sucursal → campo hidden
function onSucursalNuevaInput(input){
  var hid = document.getElementById('activadoSucursal');
  if(hid) hid.value = input.value.trim();
}

// ── Selector de depósito: carga desde tabla `depositos` ───────────────────────
async function _cargarDepositosSel(sucursalId, sucursalNombre){
  var sel = document.getElementById('activadoDepositoSel');
  var inputNuevo = document.getElementById('activadoDepositoNuevo');
  if(!sel) return;

  sel.innerHTML = '<option value="" disabled>Cargando depósitos...</option>';
  if(inputNuevo) inputNuevo.style.display = 'none';

  var depositos = [];
  try {
    var email = localStorage.getItem('lic_email');
    if(!USAR_DEMO && email && sucursalId){
      // Buscar depósitos por sucursal_id
      depositos = await supaGet('depositos',
        'sucursal_id=eq.' + sucursalId + '&activo=eq.true&order=nombre.asc&select=id,nombre');
    } else if(!USAR_DEMO && email && sucursalNombre){
      // Fallback: buscar por licencia_id + nombre de sucursal
      var licRows = await supaGet('licencias',
        'email_cliente=ilike.' + encodeURIComponent(email) + '&activa=eq.true&select=id&limit=1');
      if(licRows && licRows[0]){
        var sucRows = await supaGet('sucursales',
          'licencia_id=eq.' + licRows[0].id + '&nombre=ilike.' + encodeURIComponent(sucursalNombre) + '&select=id&limit=1');
        if(sucRows && sucRows[0]){
          depositos = await supaGet('depositos',
            'sucursal_id=eq.' + sucRows[0].id + '&activo=eq.true&order=nombre.asc&select=id,nombre');
          // Actualizar el hidden sucursal_id ahora que lo tenemos
          var hidSucId = document.getElementById('activadoSucursalId');
          if(hidSucId) hidSucId.value = sucRows[0].id;
        }
      }
    }
  } catch(e){
    console.warn('[Setup] Error cargando depósitos:', e.message);
  }

  var opciones = '';
  if(depositos.length){
    opciones = '<option value="" disabled>Selecciona un depósito...</option>';
    depositos.forEach(function(d){
      opciones += '<option value="' + d.id + '" data-nombre="' + d.nombre.replace(/"/g,'&quot;') + '">'
               + d.nombre + '</option>';
    });
    opciones += '<option value="__nuevo__"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nuevo depósito</option>';
    sel.innerHTML = opciones;

    // Preseleccionar el primero
    sel.value = String(depositos[0].id);
    onDepositoSelChange(sel);

    _log('[Setup] Depósitos cargados:', depositos.length);
  } else {
    // Sin depósitos: solo opción nueva
    sel.innerHTML = '<option value="__nuevo__"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nuevo depósito</option>';
    sel.value = '__nuevo__';
    onDepositoSelChange(sel);
  }
}

function _limpiarDepositosSel(sucursalId, sucursalNombre){
  var sel = document.getElementById('activadoDepositoSel');
  if(!sel) return;
  sel.innerHTML = '<option value="__nuevo__"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Nuevo depósito</option>';
  sel.value = '__nuevo__';
  onDepositoSelChange(sel);
}

// Manejador de cambio en el select de depósito
function onDepositoSelChange(sel){
  var val  = sel ? sel.value : '__nuevo__';
  var inputNuevo = document.getElementById('activadoDepositoNuevo');
  var hidNombre  = document.getElementById('activadoDeposito');
  var hidId      = document.getElementById('activadoDepositoId');

  if(val === '__nuevo__' || !val){
    if(inputNuevo) inputNuevo.style.display = 'block';
    if(hidId)      hidId.value = '0';
    // El nombre lo toma del input cuando se llama doEntrar
    if(hidNombre && inputNuevo) hidNombre.value = inputNuevo.value.trim() || 'Depósito Principal';
  } else {
    if(inputNuevo) inputNuevo.style.display = 'none';
    var opt = sel ? sel.options[sel.selectedIndex] : null;
    var nombre = opt ? (opt.getAttribute('data-nombre') || opt.textContent.trim()) : val;
    if(hidNombre)  hidNombre.value = nombre;
    if(hidId)      hidId.value = val;
  }
}

function licShowError(msg){
  const el=document.getElementById('licError');
  if(!el) return;
  el.textContent=msg;
  el.style.display='block';
}

// ── Selector de modo en pantalla de activación ──
function selModoActivacion(modo){
  var btnCaja = document.getElementById('btnModoCaja');
  var btnSat  = document.getElementById('btnModoSatelite');
  var input   = document.getElementById('activadoModo');
  if(!btnCaja || !btnSat) return;
  input.value = modo;
  if(modo === 'caja'){
    btnCaja.style.borderColor = '#4caf50';
    btnCaja.style.background  = 'rgba(76,175,80,.12)';
    btnCaja.style.color       = '#4caf50';
    btnSat.style.borderColor  = '#444';
    btnSat.style.background   = 'transparent';
    btnSat.style.color        = '#888';
  } else {
    btnSat.style.borderColor  = '#534AB7';
    btnSat.style.background   = 'rgba(83,74,183,.12)';
    btnSat.style.color        = '#534AB7';
    btnCaja.style.borderColor = '#444';
    btnCaja.style.background  = 'transparent';
    btnCaja.style.color       = '#888';
  }
}

async function doEntrar(){
  var negocio  = document.getElementById('activadoNegocio').value.trim();
  var terminal = document.getElementById('activadoTerminal').value.trim() || 'Terminal 1';
  var modo     = (document.getElementById('activadoModo') || {}).value || 'caja';

  // ── Resolver nombre de sucursal ────────────────────────────────────────────
  // Si el select tiene valor '__nuevo__', tomamos el input libre; si no, el hidden ya tiene el nombre.
  var sucSelVal = (document.getElementById('activadoSucursalSel')||{}).value || '';
  var sucursal, sucursalId;
  if(sucSelVal === '__nuevo__'){
    var inputNueva = document.getElementById('activadoSucursalNueva');
    sucursal   = inputNueva ? inputNueva.value.trim() : '';
    sucursalId = 0;
  } else {
    sucursal   = (document.getElementById('activadoSucursal')||{}).value || '';
    sucursalId = parseInt((document.getElementById('activadoSucursalId')||{}).value || '0') || 0;
  }
  sucursal = sucursal || 'Principal';

  // ── Resolver nombre de depósito ────────────────────────────────────────────
  var depSelVal = (document.getElementById('activadoDepositoSel')||{}).value || '__nuevo__';
  var deposito, depositoId;
  if(depSelVal === '__nuevo__'){
    var inputNuevo = document.getElementById('activadoDepositoNuevo');
    deposito   = inputNuevo ? inputNuevo.value.trim() : '';
    depositoId = 0;
  } else {
    deposito   = (document.getElementById('activadoDeposito')||{}).value || '';
    depositoId = parseInt((document.getElementById('activadoDepositoId')||{}).value || '0') || 0;
  }
  deposito = deposito || 'Depósito Principal';

  if(!negocio){ alert('Ingresá el nombre del negocio'); return; }
  if(!sucursal){ alert('Ingresá el nombre de la sucursal'); return; }

  licSetNegocio(negocio);

  // Guardar todo localmente
  localStorage.setItem('pos_terminal', terminal);
  localStorage.setItem('pos_sucursal', sucursal);
  localStorage.setItem('pos_deposito', deposito);
  localStorage.setItem('pos_modo_terminal', modo);
  MODO_TERMINAL = modo;
  cookieSet('pos_terminal', terminal, 365);
  cookieSet('pos_sucursal', sucursal, 365);
  cookieSet('pos_deposito', deposito, 365);
  cookieSet('pos_modo_terminal', modo, 365);
  if(db){
    await dbSaveConfig('terminal', terminal);
    await dbSaveConfig('sucursal', sucursal);
    await dbSaveConfig('deposito', deposito);
    await dbSaveConfig('modo_terminal', modo);
  }
  if(typeof configData !== 'undefined'){
    configData.terminal = terminal;
    configData.sucursal = sucursal;
    configData.deposito = deposito;
  }

  // Persistir IDs resueltos si ya los tenemos del dropdown (selección de existente)
  if(sucursalId > 0){
    localStorage.setItem('pos_sucursal_id', String(sucursalId));
    cookieSet('pos_suc_id', String(sucursalId), 365);
    if(db) await dbSaveConfig('sucursal_id', String(sucursalId));
  }
  if(depositoId > 0){
    localStorage.setItem('pos_deposito_id', String(depositoId));
    cookieSet('pos_dep_id', String(depositoId), 365);
    if(db) await dbSaveConfig('deposito_id', String(depositoId));
  }

  // Crear sucursal + depósito en Supabase (solo cuando son nuevos o no tenemos IDs)
  if(!USAR_DEMO){
    try {
      // Actualizar activación
      await supaRPC('actualizar_activacion', {
        p_device_id: licGetDeviceId(),
        p_email:     localStorage.getItem(SK.email),
        p_negocio:   negocio,
        p_terminal:  terminal,
        p_sucursal:  sucursal,
      });
      // Guardar modo en activaciones
      await supaFetch('PATCH',
        'activaciones?device_id=eq.' + encodeURIComponent(licGetDeviceId()),
        { modo: modo }
      );

      // Solo llamar crear_sucursal si no tenemos IDs ya resueltos desde el dropdown
      if(sucursalId === 0 || depositoId === 0){
        var activ = await supaFetch('GET', 'activaciones?device_id=eq.'+licGetDeviceId()+'&select=licencia_id');
        var activData = await activ.json();
        if(activData && activData[0]){
          var licId = activData[0].licencia_id;
          // crear_sucursal crea o reutiliza la sucursal/depósito por nombre (idempotente)
          var result = await supaRPC('crear_sucursal', {
            p_licencia_id: licId,
            p_nombre:      sucursal,
            p_direccion:   '',
            p_deposito:    deposito,
          });
          if(result && result.sucursal_id){
            if(sucursalId === 0){
              localStorage.setItem('pos_sucursal_id', result.sucursal_id);
              cookieSet('pos_suc_id', String(result.sucursal_id), 365);
              if(db) await dbSaveConfig('sucursal_id', String(result.sucursal_id));
            }
            if(depositoId === 0){
              localStorage.setItem('pos_deposito_id', result.deposito_id);
              cookieSet('pos_dep_id', String(result.deposito_id), 365);
              if(db) await dbSaveConfig('deposito_id', String(result.deposito_id));
            }
            _log('[Setup] Sucursal ID:', result.sucursal_id, '| Depósito ID:', result.deposito_id);
          }
        }
      }
    } catch(e){ console.warn('[Setup Supabase]', e.message); toast('Error al configurar en servidor: '+e.message); }
  }

  await licGetDeviceIdAsync();
  await guardarConfigTerminalSupabase({negocio, terminal, sucursal, deposito});
  if(typeof db!=='undefined'&&db){
    // BUG-02 fix: keyPath del store `config` es `clave` (ver sync.js:31).
    try{await db.config.put({clave:'terminal_cfg',valor:JSON.stringify({negocio,terminal,sucursal,deposito})});}catch(e){ console.warn('[licencia] Error guardando config en IndexedDB:', e.message); }
  }
  document.getElementById('scActivado').style.display='none';
  await iniciarApp();
}

async function doReintentar(){
  try {
    const activa=await licVerificarServidor();
    if(activa){
      localStorage.setItem(SK.fallos,'0');
      localStorage.setItem(SK.activated,'1');
      localStorage.setItem(SK.nextCheck,String(Date.now()+24*60*60*1000));
      document.getElementById('scBloqueado').style.display='none';
      await iniciarApp();
    } else { licMostrarBloqueo('SUSPENDIDA'); }
  } catch(e){ licMostrarBloqueo('SIN_CONEXION'); }
}

function doContactarSoporte(){
  const msg=encodeURIComponent('Hola, necesito ayuda con mi licencia POS. Email: '+(localStorage.getItem(SK.email)||''));
  window.open('https://wa.me/595XXXXXXXXX?text='+msg,'_blank');
}

function doDesactivar(){
  if(!confirm('Desactivar esta licencia en este dispositivo?')) return;
  Object.values(SK).forEach(k=>localStorage.removeItem(k));
  // Limpiar IndexedDB para que no queden datos de la cuenta anterior
  try {
    if(typeof db !== 'undefined' && db){
      Promise.all([
        db.productos.clear(),
        db.categorias.clear(),
        db.config.clear(),
      ]).catch(function(){});
    }
  } catch(e){}
  document.getElementById('scBloqueado').style.display='none';
  document.getElementById('scActivacion').style.display='flex';
}
