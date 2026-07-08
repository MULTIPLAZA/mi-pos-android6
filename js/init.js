// ── Init: arranque, iniciarApp, reporte ventas ──

// ── WAKE LOCK — mantener pantalla encendida ──────────────
// Estrategia:
//   1. Screen Wake Lock API nativa (Chrome 84+, requiere HTTPS/secure context)
//   2. Watchdog que re-adquiere cada 15s si se liberó
//   3. Re-adquiere en cada interacción del usuario
//
// IMPORTANTE: en Android, el OS puede matar el wake lock sin importar el JS.
// Si la pantalla sigue apagándose, hay que ir a:
//   Ajustes → Batería → Uso en segundo plano → Apps sin dormir → Agregar Chrome/PWA
var _wakeLock = null;
var _wakeLockActivo = false;
var _wakeLockDenegado = false; // BUG-10 fix: caché de denegación (NotAllowedError)
var _wakeLockSecureWarned = false;

async function solicitarWakeLock(){
  if(_wakeLockActivo) return;
  // BUG-10 fix: si ya fue denegado (NotAllowedError, decisión del browser/permiso),
  // no reintentar — antes se pedía en cada click/touch/visibilitychange y spammeaba
  // el log con el mismo warning. Si el usuario quiere reintentar, debe refrescar.
  if(_wakeLockDenegado) return;

  if(!window.isSecureContext){
    if(!_wakeLockSecureWarned){
      console.warn('[WakeLock] NO secure context — la app debe abrirse por HTTPS');
      _wakeLockSecureWarned = true;
    }
    return;
  }

  if('wakeLock' in navigator){
    try {
      _wakeLock = await navigator.wakeLock.request('screen');
      _wakeLockActivo = true;
      _wakeLock.addEventListener('release', function(){
        _wakeLock = null;
        _wakeLockActivo = false;
        _log('[WakeLock] liberado — watchdog re-adquirirá');
      });
      _log('[WakeLock] API nativa activada');
      return;
    } catch(e){
      // NotAllowedError, SecurityError → no es transitorio, cachear y no reintentar.
      // Cualquier otro error (raro) también lo cacheamos por las dudas.
      _wakeLockDenegado = true;
      console.warn('[WakeLock] request falló (no se reintentará en esta sesión):', e.name, e.message);
    }
  }
}

// Re-adquirir al volver del background
document.addEventListener('visibilitychange', function(){
  if(document.visibilityState === 'visible') solicitarWakeLock();
});

// Re-adquirir en cada interacción del usuario (sin {once:true})
document.addEventListener('touchstart', function(){
  if(!_wakeLockActivo) solicitarWakeLock();
}, { passive: true });
document.addEventListener('click', function(){
  if(!_wakeLockActivo) solicitarWakeLock();
});

// WATCHDOG — re-adquiere cada 15s si se liberó por cualquier razón
setInterval(function(){
  if(!_wakeLockActivo && document.visibilityState === 'visible'){
    solicitarWakeLock();
  }
}, 15000);

// ── FUNCIÓN CENTRAL DE INICIO ─────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
// AUTO-SAVE del cart en localStorage (anti-perdida ante Ctrl+R / corte de luz)
// ══════════════════════════════════════════════════════════════════════════════
// El cart vive en memoria. Si el cajero esta cargando una venta y la app se
// recarga (refresh, crash, corte), TODO se pierde. Esta funcion persiste el
// estado vivo del carrito en localStorage cada 1.5s — si cambio respecto a
// la ultima version guardada.
//
// Al iniciar la app, recuperarCartAutosave() lee lo guardado y restaura el
// carrito. Solo se recupera si tiene items y es reciente (<6 horas).
//
// Se limpia automaticamente en clearCart() (despues de cobrar o descartar).
// ══════════════════════════════════════════════════════════════════════════════
var _ultimoCartJSON = '';
function guardarCartAutosave(){
  if(typeof cart === 'undefined') return;
  try {
    if(!cart || cart.length === 0){
      // No persistir cart vacio (clearCart ya limpio); evita pisar autosave valido
      return;
    }
    var snap = {
      cart:              cart,
      currentTicketNro:  (typeof currentTicketNro !== 'undefined') ? currentTicketNro : null,
      tipoPedido:        (typeof tipoPedido !== 'undefined') ? tipoPedido : 'llevar',
      mesaActual:        (typeof mesaActual !== 'undefined') ? mesaActual : null,
      ticketDescuento:   (typeof ticketDescuento !== 'undefined') ? ticketDescuento : 0,
      clienteNombre:     (typeof clienteNombre !== 'undefined') ? clienteNombre : '',
      ts:                Date.now(),
    };
    var json = JSON.stringify(snap);
    if(json !== _ultimoCartJSON){
      localStorage.setItem('pos_cart_autosave', json);
      _ultimoCartJSON = json;
    }
  } catch(e){ /* localStorage lleno o cart no serializable — ignorar */ }
}

function recuperarCartAutosave(){
  try {
    var saved = localStorage.getItem('pos_cart_autosave');
    if(!saved) return false;
    var s = JSON.parse(saved);
    if(!s || !Array.isArray(s.cart) || s.cart.length === 0) return false;
    // No recuperar si tiene mas de 6 horas (probablemente venta abandonada)
    if(s.ts && (Date.now() - s.ts) > 6*60*60*1000){
      localStorage.removeItem('pos_cart_autosave');
      return false;
    }
    if(typeof setCart === 'function') setCart(s.cart);
    if(typeof setCurrentTicketNro === 'function') setCurrentTicketNro(s.currentTicketNro);
    if(s.tipoPedido && typeof setTipoPedido === 'function') setTipoPedido(s.tipoPedido);
    if(s.mesaActual && typeof setMesaActual === 'function') setMesaActual(s.mesaActual);
    if(s.ticketDescuento && typeof setTicketDescuento === 'function') setTicketDescuento(s.ticketDescuento);
    if(s.clienteNombre && typeof setClienteNombre === 'function') setClienteNombre(s.clienteNombre);
    return true;
  } catch(e){ return false; }
}

async function iniciarApp(){
  // Mantener pantalla encendida
  solicitarWakeLock();

  // Iniciar BT Print Server (verificar y reconectar si hay MAC guardada)
  setTimeout(() => { BTPrinter.iniciar(); btpsCargarMacGuardada(); USBPrinter.iniciar(); }, 2000);

  // Reconectar automáticamente cuando la app vuelve al foco
  document.addEventListener('visibilitychange', function(){
    if(document.visibilityState === 'visible'){
      const mac = localStorage.getItem('btps_mac');
      if(mac) BTPrinter.iniciar();
    }
  });
  // Inicializar visibilidad de ítems del drawer según config guardada
  if(typeof updDrawerFiado === 'function') updDrawerFiado(localStorage.getItem('pos_credito') === '1');
  // Mostrar versión en drawer, configuración y pantalla de activación
  const _vEl = document.getElementById('drawerVersion');
  if(_vEl) _vEl.textContent = APP_VERSION + ' · by Nodo Informática';
  const _vCfg = document.getElementById('configVersion');
  if(_vCfg) _vCfg.textContent = APP_VERSION + ' · by Nodo Informática';
  const _vAct = document.getElementById('scActivacionVersion');
  if(_vAct) _vAct.textContent = APP_VERSION;

  // ── Auto-save del cart cada 1.5s ─────────────────────────
  // Anti-perdida: si el cajero esta cargando una venta y la app se recarga
  // (Ctrl+R, crash, corte de luz), el cart se persiste y se recupera al
  // proximo arranque. Solo guarda si el cart cambio respecto al ultimo save.
  setInterval(guardarCartAutosave, 1500);
  // Guardar tambien al perder visibilidad / cerrar la pestana
  document.addEventListener('visibilitychange', function(){
    if(document.visibilityState === 'hidden') guardarCartAutosave();
  });
  window.addEventListener('beforeunload', guardarCartAutosave);

  // ── Sanear hash de URL residual ──────────────────────────
  // Si la URL tiene un hash como #scCobrar (porque la app se cerro
  // en medio de un cobro), ignorarlo y limpiar para que el arranque
  // decida correctamente a que pantalla ir.
  if(window.location.hash){
    try {
      window.history.replaceState({}, '', window.location.pathname);
    } catch(e){}
  }
  // ─────────────────────────────────────────────────────────
  // ── PASO 0: Leer modo de terminal desde activaciones ─────
  // DEBE ejecutarse primero: determina si este dispositivo es
  // 'caja' o 'satelite'. El modo lo configura el proveedor
  // (Emvitta) desde el super-admin. El usuario/negocio NO puede
  // cambiarlo. Si no hay internet, usa el último valor guardado.
  await leerModoDesdeActivaciones();

  // ─────────────────────────────────────────────────────────
  // ── PASO 1: Config local (sin red) ───────────────────────
  // Restaurar desde localStorage o cookies (cookies sobreviven al borrar caché)
  const terminal = localStorage.getItem('pos_terminal') || cookieGet('pos_terminal');
  const sucursal = localStorage.getItem('pos_sucursal') || cookieGet('pos_sucursal');
  const deposito = localStorage.getItem('pos_deposito') || cookieGet('pos_deposito');
  const sucId    = localStorage.getItem('pos_sucursal_id') || cookieGet('pos_suc_id');
  const depId    = localStorage.getItem('pos_deposito_id') || cookieGet('pos_dep_id');
  if(terminal) { configData.terminal=terminal; localStorage.setItem('pos_terminal',terminal); }
  if(sucursal) { configData.sucursal=sucursal; localStorage.setItem('pos_sucursal',sucursal); }
  if(deposito) { configData.deposito=deposito; localStorage.setItem('pos_deposito',deposito); }
  if(sucId)    localStorage.setItem('pos_sucursal_id',sucId);
  if(depId)    localStorage.setItem('pos_deposito_id',depId);
  cargarConfigLocal();
  restaurarConfigImpresoras();
  cargarTimbradoSesion();

  // ── FASE 0: Aplicar configuración de rubro/tipo de negocio ──
  // Debe correr DESPUÉS de cargarConfigLocal() para que comandasHabilitadas
  // ya esté en configData, y ANTES de renderizar pantallas para que las
  // visibilidades sean correctas desde el primer frame.
  if(typeof rubroAplicarUI === 'function') rubroAplicarUI();

  // ── PASO 2: Restaurar pendientes ──────────────────────────
  try {
    const rp = localStorage.getItem('pos_pendientes');
    if(rp){
      const sp = JSON.parse(rp);
      if(Array.isArray(sp) && sp.length > 0){
        // Limpiar duplicados: pendientes con MISMO total + MISMOS items (legacy
        // del bug viejo donde el cart en curso se convertia en pendiente nuevo
        // al navegar con flechas). Quedarse con el de MAYOR nro de cada grupo.
        const _gruposDup = new Map();
        sp.forEach(p => {
          const cartArr = p.cart || p.items || [];
          const key = (p.total||0)+'::'+cartArr.map(i=>i.name+i.qty).join('|');
          if(!_gruposDup.has(key)) _gruposDup.set(key, []);
          _gruposDup.get(key).push(p);
        });
        let dedup = [];
        _gruposDup.forEach(group => {
          if(group.length === 1) dedup.push(group[0]);
          else {
            // Sort por nro DESC, dejar el primero (mas nuevo)
            group.sort((a,b)=>(b.nro||0)-(a.nro||0));
            dedup.push(group[0]);
          }
        });
        const eliminados = sp.length - dedup.length;
        if(eliminados > 0){
          _log('[init] Limpieza de pendientes duplicados: '+eliminados+' eliminados ('+sp.length+' -> '+dedup.length+')');
          // Re-persistir el array limpio
          try { localStorage.setItem('pos_pendientes', JSON.stringify(dedup)); } catch(e){}
        }
        setPendientes(dedup.map(p => ({ ...p, cart: p.cart || p.items || [] })));
        const mx = dedup.reduce((m,p)=>Math.max(m, p.nro||0), 0);
        if(mx >= ticketCounter) setTicketCounter(mx + 1);
            }
    }
    const savedCounter = parseInt(localStorage.getItem('pos_ticket_counter')||'1');
    if(savedCounter > ticketCounter) setTicketCounter(savedCounter);
    } catch(e){ console.warn('[App] Pendientes:', e.message); }

  // ── PASO 3: Restaurar turno ──────────────────────────────
  // Primero intentar desde localStorage (más rápido)
  let turnoOk = false;
  try {
    turnoOk = turnoRestaurar();
    // Si se restauró pero dbId es null, recuperarlo desde IndexedDB
    if(turnoOk && !turnoData.dbId && db){
      try {
        const t = await db.turno.where('estado').equals('abierto').last();
        if(t){
          turnoData.dbId = t.id;
          turnoGuardar();
          _log('[Turno] dbId recuperado desde IndexedDB:', t.id);
        }
      } catch(e){ console.warn('[Turno] Error recuperando dbId:', e.message); }
    }
    // ── Verificar con Supabase que el turno restaurado sigue abierto ─────────
    // Bug conocido: si la app se cierra DESPUÉS de confirmarCierre() pero ANTES
    // de que location.reload() procese la limpieza del localStorage, el turno
    // cerrado puede quedar en caché. Esta verificación lo detecta y lo limpia.
    if(turnoOk && navigator.onLine && !USAR_DEMO){
      const supaIdCheck = turnoData.supaId || turnoData.dbId;
      if(supaIdCheck){
        try{
          const rows = await supaGet('pos_turno',
            'id=eq.'+supaIdCheck+'&select=id,estado&limit=1');
          {
            const row  = rows && rows[0];
            if(row && row.estado !== 'abierto'){
              // El turno ya fue cerrado en Supabase — limpiar localStorage
              console.warn('[Turno] Turno en localStorage ya está '+row.estado+' en Supabase — limpiando caché');
              turnoBorrar();
              turnoData = { fechaApertura:null, efectivoInicial:0, ventas:[], egresos:[], ingresos:[] };
              turnoOk = false;
            }
          }
        } catch(e){ console.warn('[Turno] Error verificando estado en Supabase:', e.message); }
      }
    }
  } catch(e){ console.warn('[App] Turno:', e.message); }

  // ── Enviar cierre pendiente si quedó sin sincronizar (offline al cerrar) ──
  if(navigator.onLine && !USAR_DEMO){
    const _cpRaw = localStorage.getItem('pos_cierre_pendiente');
    if(_cpRaw){
      try {
        const _cp = JSON.parse(_cpRaw);
        await supaPatch('pos_turno', 'id=eq.'+_cp.id, {
          estado:          'cerrado',
          fecha_cierre:    _cp.fecha || new Date().toISOString(),
          total_contado:   _cp.totalContado  || 0,
          diferencia:      _cp.diferencia    || 0,
          total_vendido:   _cp.totalVendido  || 0,
          total_egresos:   _cp.totalEgresos  || 0,
          cantidad_ventas: _cp.cantVentas    || 0,
          resumen_pagos:   _cp.resumenPagos  || '{}',
        }, true);
        localStorage.removeItem('pos_cierre_pendiente');
        _log('[Init] Cierre pendiente sincronizado con Supabase');
      } catch(e){ console.warn('[Init] Error sincronizando cierre pendiente:', e.message); }
    }
  }

  // Si no hay turno en localStorage, buscar en Supabase (otra terminal abrió el turno)
  if(!turnoOk && navigator.onLine && !USAR_DEMO){
    try {
      const email    = localStorage.getItem(SK.email);
      const terminal = localStorage.getItem('pos_terminal');
      const sucursal = localStorage.getItem('pos_sucursal');
          if(email && terminal){
        // Buscar por terminal + email para aislar por tenant
        const query = 'estado=eq.abierto'
          + '&licencia_email=eq.' + encodeURIComponent(email)
          + '&terminal=eq.' + encodeURIComponent(terminal)
          + '&order=fecha_apertura.desc&limit=1'
          + '&select=id,terminal,fecha_apertura,efectivo_inicial';
        const rows = await supaGet('pos_turno', query);
        {
                  const t = rows && rows[0];
          if(t){
                      // Reconstruir turnoData desde Supabase
            turnoData.fechaApertura  = new Date(t.fecha_apertura);
            turnoData.efectivoInicial = t.efectivo_inicial || 0;
            turnoData.supaId         = t.id;
            turnoData.dbId           = t.id;
            turnoData.ventas         = [];
            turnoData.egresos        = [];
            turnoData.ingresos       = [];
            // Guardar en localStorage para la próxima vez
            turnoGuardar();
            turnoOk = true;
                    } else {
                    }
        }
      }
    } catch(e){ console.warn('[App] Supabase:', e.message); }
  }

  updTabTicketHeader();
  updBtnGuardar();

  // ── Rubro desde Supabase: cargar ANTES de navegar ───────────
  // Evita el flash de modo incorrecto si localStorage tiene un tipo stale
  // (ej: local tiene 'gastronomia' pero Supabase tiene 'retail').
  // Las llamadas del turno ya aguardaron — el splash sigue visible aquí.
  if(typeof rubroCargarDesdeSupabase === 'function' && navigator.onLine && !USAR_DEMO){
    try {
      await rubroCargarDesdeSupabase();
      if(typeof rubroAplicarUI === 'function') rubroAplicarUI();
    } catch(e){ /* continuar con el valor de localStorage */ }
  }

  // ── Recuperar carrito en curso si la app se recargó con venta sin cobrar ──
  // Esto evita la perdida de ventas por Ctrl+R, crash o corte de luz.
  // Se ejecuta DESPUES de cargar productos y config pero ANTES de navegar
  // a la pantalla principal, asi el cart aparece restaurado al abrir scSale.
  if(typeof recuperarCartAutosave === 'function'){
    var recuperado = recuperarCartAutosave();
    if(recuperado){
      setTimeout(function(){
        if(typeof updUI === 'function') updUI();
        if(typeof updBtnGuardar === 'function') updBtnGuardar();
        if(typeof updMesaBtn === 'function') updMesaBtn();
        if(typeof renderTkt === 'function') renderTkt();
        if(typeof toast === 'function'){
          toast('Venta en curso recuperada — ' + cart.length + ' item' + (cart.length!==1?'s':''));
        }
      }, 500);
    }
  }

  if(MODO_TERMINAL === 'satelite'){
    // MODO SATELITE: siempre verificar caja abierta en esta sucursal
    var cajaAbierta = await sateliteVerificarCajaActiva();
    if(cajaAbierta){
      if(mesasSalones && mesasSalones.length > 0){
        await mesasCargar();
        goTo('scMesas');
        renderMesasScreen();
      } else {
        goTo('scSale');
        renderCatPills();
        filterP();
      }
      toast('Terminal satelite lista');
    } else {
      sateliteMostrarEsperaCaja();
    }
  } else if(turnoOk){
    if(mesasSalones.length > 0){
      goTo('scMesas');
      renderMesasScreen();
      toast('Sesion restaurada');
    } else {
      goTo('scSale');
      renderCatPills();
      filterP();
      toast('Sesion restaurada — '+turnoData.ventas.length+' venta'+(turnoData.ventas.length!==1?'s':''));
    }
  } else {
    // MODO CAJA sin turno: mostrar pantalla de turno cerrado
    goTo('scClosed');
  }

  // ── PASO 4: Refrescar productos/categorías ───────────────
  // Con internet: refresca desde Supabase (IndexedDB ya cargó en el arranque)
  // Sin internet: ya renderizó arriba desde IndexedDB — no hacer nada
  if(!USAR_DEMO && navigator.onLine){
    try {
      await Promise.all([
        supaLoadCategorias(),
        supaLoadProductos(),
      ]);
    } catch(e){ console.warn('[App] Carga Supabase:', e.message); toast('Error al cargar datos de la nube'); }
  }

  // ── PASO 5: Sync background ───────────────────────────────
  // Auto-recuperar deposito_id si se perdió con el caché
  if(!localStorage.getItem('pos_deposito_id') && navigator.onLine && !USAR_DEMO){
    setTimeout(async function(){
      try{
        const email  = localStorage.getItem(SK.email);
        const sucNom = localStorage.getItem('pos_sucursal');
        if(!email || !sucNom) return;
        const ld = await supaGet('licencias',
          'email_cliente=ilike.'+encodeURIComponent(email)+'&activa=eq.true&select=id&limit=1');
        if(!ld||!ld[0]) return;
        const licId = ld[0].id;
        localStorage.setItem('ali', String(licId));
        cookieSet('ali', String(licId), 365);
        const sd = await supaGet('sucursales',
          'licencia_id=eq.'+licId+'&nombre=ilike.'+encodeURIComponent(sucNom)+'&select=id&limit=1');
        if(!sd||!sd[0]) return;
        localStorage.setItem('pos_sucursal_id', String(sd[0].id));
        cookieSet('pos_suc_id', String(sd[0].id), 365);
        const dd = await supaGet('depositos',
          'licencia_id=eq.'+licId+'&sucursal_id=eq.'+sd[0].id+'&activo=eq.true&select=id&order=id.asc&limit=1');
        if(!dd||!dd[0]) return;
        localStorage.setItem('pos_deposito_id', String(dd[0].id));
        cookieSet('pos_dep_id', String(dd[0].id), 365);
        _log('[App] Depósito restaurado:', dd[0].id);
        toast('Depósito listo (ID '+dd[0].id+')');
      }catch(e){ console.warn('[App] Error recuperando depósito:', e.message); }
    }, 4000);
  }

  setTimeout(sincronizarFechaServidor, 1000);  // sincronizar reloj con servidor al arrancar
  setTimeout(sincronizarConfigNegocio, 3000);
  setTimeout(syncConSupabase, 5000);
  setTimeout(syncVentasPendientes, 8000);
  setTimeout(mesasCargar, 6000); // Cargar mesas en background
  setTimeout(updSyncBadge, 1500); // Actualizar badge de sync al iniciar
  setTimeout(cargarModificadores, 4000); // Cargar modificadores en background

  // ── MODO SATÉLITE: adaptar UI si corresponde ─────────────────────────────
  // Se ejecuta con delay para que el DOM de la pantalla inicial esté listo.
  // sateliteInicializarUI() es un no-op si MODO_TERMINAL === 'caja'.
  setTimeout(sateliteInicializarUI, 500);

  // ── SYNC PEDIDOS SATÉLITE (solo modo caja) ───────────────────────────────
  // Polling rápido + trigger en visibility change + Realtime via WebSocket.
  // Primera sync a los 2s para no esperar el 7s clásico.
  if(typeof MODO_TERMINAL !== 'undefined' && MODO_TERMINAL === 'caja'){
    setTimeout(cajaSyncPedidosSatelite, 2000);
    setInterval(cajaSyncPedidosSatelite, 3000); // cada 3 segundos
    // Trigger inmediato al volver la app al foreground
    document.addEventListener('visibilitychange', function(){
      if(document.visibilityState === 'visible'){
        setTimeout(cajaSyncPedidosSatelite, 200);
      }
    });
    // Suscribirse a Realtime de Supabase si está disponible
    if(typeof cajaSuscribirRealtime === 'function'){
      setTimeout(cajaSuscribirRealtime, 3000);
    }
  }

  // ── SYNC ESTADO DE PEDIDOS (solo modo satélite) ─────────────────────────
  // El satélite reconcilia su array local con el estado real en Supabase,
  // así se eliminan los pedidos ya cobrados o cancelados por la caja.
  // Polling cada 5s + suscripción realtime para reaccionar en <1s a UPDATEs.
  if(typeof MODO_TERMINAL !== 'undefined' && MODO_TERMINAL === 'satelite'){
    if(typeof sateliteSyncPedidosPendientes === 'function'){
      setTimeout(sateliteSyncPedidosPendientes, 3000);
      setInterval(sateliteSyncPedidosPendientes, 5000);
      document.addEventListener('visibilitychange', function(){
        if(document.visibilityState === 'visible'){
          setTimeout(sateliteSyncPedidosPendientes, 200);
        }
      });
    }
    // Realtime via WebSocket: reacciona instantáneamente cuando la caja cobra
    if(typeof sateliteSuscribirRealtime === 'function'){
      setTimeout(sateliteSuscribirRealtime, 3000);
    }
  }
}

// ── ARRANQUE ──────────────────────────────────────────────
async function guardarConfigTerminalSupabase(cfg){
  const deviceId = await licGetDeviceIdAsync(); // siempre usar el ID de ESTE dispositivo
  try{
    await supaPost('pos_config', {
        clave: 'terminal_config_'+deviceId,
        valor: JSON.stringify({
          negocio:     cfg.negocio,
          terminal:    cfg.terminal,
          sucursal:    cfg.sucursal,
          deposito:    cfg.deposito,
          sucursal_id: localStorage.getItem('pos_sucursal_id')||null,
          deposito_id: localStorage.getItem('pos_deposito_id')||null,
          deviceId:    deviceId,
          savedAt:     new Date().toISOString()
        }),
        licencia_email: localStorage.getItem(SK.email)
      }, 'licencia_email,clave', true);
    _log('[Terminal] Config guardada — device:', deviceId.slice(0,12));
  }catch(e){console.warn('[Terminal] Error guardando:', e.message);}
}

async function recuperarConfigTerminalSupabase(){
  if(USAR_DEMO) return null;
  const email = localStorage.getItem(SK.email);
  if(!email) return null;
  const deviceId = await licGetDeviceIdAsync();

  try{
    // Intento 1: buscar por device_id específico
    if(deviceId){
      const data = await supaGet('pos_config',
        'licencia_email=eq.'+encodeURIComponent(email)
        +'&clave=eq.terminal_config_'+encodeURIComponent(deviceId)+'&select=valor');
      if(data && data[0]){
        const cfg = JSON.parse(data[0].valor);
        if(!cfg.deviceId || cfg.deviceId === deviceId){
          _log('[Terminal] Config recuperada por deviceId');
          return cfg;
        }
      }
    }

    // Intento 2 (fallback): buscar cualquier config de este email
    // Útil cuando se borró caché y se perdió el device_id
    const data2 = await supaGet('pos_config',
      'licencia_email=eq.'+encodeURIComponent(email)
      +'&clave=like.terminal_config_%25&select=valor,clave&order=id.desc&limit=1');
    if(data2 && data2[0]){
      const cfg = JSON.parse(data2[0].valor);
      // Si tiene config válida, restaurar y guardar el device_id que estaba en esa config
      if(cfg.terminal && cfg.sucursal){
        _log('[Terminal] Config recuperada por email (fallback) — terminal:', cfg.terminal);
        // Restaurar el device_id guardado en esa config para mantener consistencia
        if(cfg.deviceId && !localStorage.getItem(SK.deviceId)){
          localStorage.setItem(SK.deviceId, cfg.deviceId);
          cookieSet('pos_device_id', cfg.deviceId, 365);
        }
        return cfg;
      }
    }
    return null;
  }catch(e){
    console.warn('[Terminal] Error recuperando config:', e.message);
    return null;
  }
}

function aplicarConfigTerminal(cfg){
  if(!cfg) return false;
  // negocio: solo aplicar como fallback si el usuario no tiene valor propio en 'an'
  if(cfg.negocio)     { localStorage.setItem(SK.negocio,cfg.negocio);          if(typeof configData!=='undefined' && !localStorage.getItem('an')) configData.negocio=cfg.negocio; }
  if(cfg.terminal)    { localStorage.setItem('pos_terminal',cfg.terminal);      if(typeof configData!=='undefined') configData.terminal=cfg.terminal; }
  if(cfg.sucursal)    { localStorage.setItem('pos_sucursal',cfg.sucursal);      if(typeof configData!=='undefined') configData.sucursal=cfg.sucursal; }
  if(cfg.deposito)    { localStorage.setItem('pos_deposito',cfg.deposito);      if(typeof configData!=='undefined') configData.deposito=cfg.deposito; }
  // Restaurar IDs de sucursal y depósito si están en la config
  if(cfg.sucursal_id) { localStorage.setItem('pos_sucursal_id',String(cfg.sucursal_id)); cookieSet('pos_suc_id',String(cfg.sucursal_id),365); }
  if(cfg.deposito_id) { localStorage.setItem('pos_deposito_id',String(cfg.deposito_id)); cookieSet('pos_dep_id',String(cfg.deposito_id),365); }
  return true;
}

// ── VENTAS (reporte) ─────────────────────────────────────────────────────────

let ventasTabActual = 'vendidas';

function guardarDepositoId(){
  var _cfgDep=document.getElementById('cfgDepId'), _cfgSuc=document.getElementById('cfgSucId');
  const depId = parseInt((_cfgDep ? _cfgDep.value : '')||0);
  const sucId = parseInt((_cfgSuc ? _cfgSuc.value : '')||0);
  if(!depId){ toast('Ingresá el ID del depósito'); return; }
  localStorage.setItem('pos_deposito_id', String(depId));
  cookieSet('pos_dep_id', String(depId), 365);
  if(sucId){
    localStorage.setItem('pos_sucursal_id', String(sucId));
    cookieSet('pos_suc_id', String(sucId), 365);
  }
  // Guardar en Supabase para recuperar en futuro
  guardarConfigTerminalSupabase({
    negocio:     localStorage.getItem(SK.negocio)||configData.negocio||'',
    terminal:    localStorage.getItem('pos_terminal')||'Terminal 1',
    sucursal:    localStorage.getItem('pos_sucursal')||'',
    deposito:    localStorage.getItem('pos_deposito')||'',
    sucursal_id: sucId || localStorage.getItem('pos_sucursal_id'),
    deposito_id: depId,
  }).catch(e=>{ console.warn('[Terminal] Error guardando config en Supabase:', e && e.message); });
  toast('Depósito ID '+depId+' guardado');
  renderGeneralInfo();
}

function resetDepositoId(){
  if(!confirm('¿Cambiar el depósito configurado?')) return;
  localStorage.removeItem('pos_deposito_id');
  localStorage.removeItem('pos_sucursal_id');
  renderGeneralInfo();
}

async function goToVentas(){
  goTo('scVentas');
  ventasTabActual = 'vendidas';
  document.getElementById('tabVendidas').classList.add('sel');
  document.getElementById('tabPendientesV').classList.remove('sel');
  await renderVentasList();
}

function switchVentasTab(tab){
  ventasTabActual = tab;
  document.getElementById('tabVendidas').classList.toggle('sel', tab === 'vendidas');
  document.getElementById('tabPendientesV').classList.toggle('sel', tab === 'pendientes');
  renderVentasList();
}


// -- Satelite UI: ver js/pedidos.js --

// -- Mesas: ver js/mesas.js --

async function renderVentasList(){
  const list  = document.getElementById('ventasList');
  const resEl = document.getElementById('ventasResumen');
  if(!list) return;

  if(ventasTabActual === 'pendientes'){
    resEl.innerHTML = `
      <div class="ventas-resumen-item">
        <span class="ventas-resumen-lbl">Pendientes</span>
        <span class="ventas-resumen-val">${pendientes.length}</span>
      </div>`;
    if(!pendientes.length){
      list.innerHTML = `<div class="ventas-empty">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:.3"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
        <p>No hay tickets pendientes</p></div>`;
      return;
    }
    list.innerHTML = pendientes.map((t, i) => {
      const fecha = t.fecha ? new Date(t.fecha).toLocaleString('es-PY',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '—';
      const items = t.cart || [];
      const esPresupuesto = !!t.esPresupuesto;
      const itemsHTML = items.map(it => `
        <div class="venta-det-item">
          <span class="venta-det-name">${it.name||it.nombre||''}${it.obs?`<span class="venta-det-obs">↳ ${it.obs}</span>`:''}</span>
          <span class="venta-det-qty">x${it.qty}</span>
          <span class="venta-det-price">${gs((it.price||it.precio||0)*it.qty)}</span>
        </div>`).join('');
      return `
        <div class="venta-card" id="vpend_${i}">
          <div class="venta-card-main" onclick="toggleVentaCard('vpend_${i}')">
            <div class="venta-card-icon pendiente" style="${esPresupuesto?'background:rgba(103,58,183,.15);color:#9c27b0;':''}">
              ${esPresupuesto
                ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`
                : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`}
            </div>
            <div class="venta-card-info">
              <div class="venta-card-titulo">
                Ticket #${String(t.nro||i+1).padStart(4,'0')}
                ${esPresupuesto ? `<span style="font-size:11px;background:rgba(103,58,183,.15);color:#9c27b0;padding:1px 7px;border-radius:10px;font-weight:700;margin-left:4px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> Presupuesto</span>` : ''}
                ${t.esSatelite ? `<span style="font-size:11px;background:rgba(83,74,183,.15);color:#534AB7;padding:1px 7px;border-radius:10px;font-weight:700;margin-left:4px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg> ${t.terminalOrigen||'Satélite'}</span>` : ''}
                ${t.obs?' — '+t.obs:''}
              </div>
              <div class="venta-card-sub">${fecha} · ${items.length} artículo${items.length!==1?'s':''}</div>
            </div>
            <div class="venta-card-right">
              <div class="venta-card-total">${gs(t.total)}</div>
              <div class="venta-card-metodo">${esPresupuesto?'presupuesto':'pendiente'}</div>
            </div>
            <svg class="venta-card-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
          <div class="venta-detalle">
            ${itemsHTML}
            <div class="venta-det-footer">
              <span class="venta-det-badge ${esPresupuesto?'':'pendiente'}" style="${esPresupuesto?'background:rgba(103,58,183,.15);color:#9c27b0;':''}">
                ${esPresupuesto?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> Presupuesto':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Pendiente'}
              </span>
              <div><span class="venta-det-total-lbl">Total </span><span class="venta-det-total-val">${gs(t.total)}</span></div>
            </div>
            <div class="venta-det-actions" onclick="event.stopPropagation()">
              <button class="venta-act-btn" style="flex:1;${esPresupuesto?'background:rgba(76,175,80,.1);color:var(--green);border:1.5px solid rgba(76,175,80,.25);':'background:rgba(103,58,183,.1);color:#9c27b0;border:1.5px solid rgba(103,58,183,.25);'}"
                onclick="${!esPresupuesto && !presupuestosHabilitados() ? `toast('Presupuestos deshabilitados. Habilitá la función en Config → General')` : `marcarPresupuesto(${i},${!esPresupuesto})`}">
                ${esPresupuesto
                  ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Marcar pendiente`
                  : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> ${presupuestosHabilitados()?'Marcar presupuesto':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Presupuesto'}`}
              </button>
              ${esPresupuesto ? `
              <button class="venta-act-btn" style="flex:1;background:rgba(33,150,243,.1);color:#2196f3;border:1.5px solid rgba(33,150,243,.25);" onclick="imprimirPresupuesto(${i})">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                Imprimir
              </button>` : ''}
              <button class="venta-act-btn cambiar-pago" style="flex:2;" onclick="abrirPendienteDesdeVentas(${i})">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Abrir y editar
              </button>
              <button class="venta-act-btn" style="flex:1;background:var(--bg-dark);color:var(--text);border:1.5px solid var(--border);" onclick="imprimirTicketPendiente(${i})">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                Imprimir
              </button>
              <button class="venta-act-btn anular" onclick="descartarPendiente(${i})">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                Descartar
              </button>
            </div>
          </div>
        </div>`;
    }).join('');
    return;
  }

  // Tab vendidas — leer de IndexedDB filtrando por turno actual
  let ventas = [];
  if(db){
    try {
      if(turnoData.dbId){
        // Ventas del turno actual por turno_id
        let byTurno = await db.ventas
          .where('turno_id').equals(turnoData.dbId)
          .toArray();
        // Si no hay nada por turno_id, filtrar por fecha de apertura del turno actual
        // Acotamos también por fecha de cierre si existe, para no traer ventas de otros turnos
        if(!byTurno.length && turnoData.fechaApertura){
          const desde = new Date(turnoData.fechaApertura).toISOString();
          const hasta = turnoData.fechaCierre
            ? new Date(turnoData.fechaCierre).toISOString()
            : new Date().toISOString();
          byTurno = await db.ventas
            .where('fecha').between(desde, hasta, true, true)
            .toArray();
        }
        // Ordenar por fecha descendente
        ventas = byTurno.sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
      }
    } catch(e){ console.warn('[Turno] Error cargando ventas:', e.message); ventas = []; }
  }

  // Complementar con Supabase — IndexedDB es local por dispositivo, así que
  // una venta hecha en OTRA terminal (u otro dbId local tras una reinstalación)
  // nunca aparecía acá aunque sí haya llegado a la nube. Se fusiona por
  // comprobante para no duplicar, y las que solo existen en la nube se
  // marcan _remoto (sin acciones locales — anular/reimprimir necesitan el id
  // de IndexedDB, que estas filas no tienen).
  if(turnoData.supaId && navigator.onLine){
    try {
      const remotas = await supaGet('pos_ventas', 'turno_id=eq.'+turnoData.supaId+'&order=fecha.desc&limit=200');
      // Clave de fusión: comprobante si existe, si no la fecha normalizada a
      // epoch ms. NO usar el id como respaldo — el id local (IndexedDB) y el
      // id remoto (Supabase) son numeraciones independientes que nunca
      // coinciden, así que con comprobante vacío (caso común) cada venta
      // terminaba listada dos veces: una copia local y una "Otra terminal".
      const claveDe = v => v.comprobante || String(new Date(v.fecha).getTime());
      const vistos = new Set(ventas.map(claveDe));
      remotas.forEach(function(rv){
        const clave = claveDe(rv);
        if(vistos.has(clave)) return;
        vistos.add(clave);
        ventas.push(Object.assign({}, rv, { _remoto: true }));
      });
      ventas.sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
    } catch(e){ console.warn('[Ventas] Error trayendo ventas remotas:', e.message); }
  }

  const activas   = ventas.filter(v => !v.anulada || v.anulada === 0);
  const anuladas  = ventas.filter(v => v.anulada && v.anulada !== 0);
  const totalAct  = activas.reduce((s,v) => s+(v.total||0), 0);
  const nAnuladas = anuladas.length;

  resEl.innerHTML = `
    <div class="ventas-resumen-item">
      <span class="ventas-resumen-lbl">Ventas</span>
      <span class="ventas-resumen-val">${activas.length}</span>
    </div>
    <div class="ventas-resumen-item">
      <span class="ventas-resumen-lbl">Total</span>
      <span class="ventas-resumen-val">${gs(totalAct)}</span>
    </div>
    ${nAnuladas ? `<div class="ventas-resumen-item">
      <span class="ventas-resumen-lbl">Anuladas</span>
      <span class="ventas-resumen-val" style="color:#ef5350">${nAnuladas}</span>
    </div>` : ''}`;

  if(!turnoData.dbId){
    resEl.innerHTML = '';
    list.innerHTML = `<div class="ventas-empty">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:.3"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      <p>No hay turno activo</p>
      <p style="font-size:12px;">Abrí un turno para ver las ventas</p></div>`;
    return;
  }

  if(!ventas.length){
    list.innerHTML = `<div class="ventas-empty">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:.3"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
      <p>No hay ventas registradas</p></div>`;
    return;
  }

  list.innerHTML = ventas.map((v, i) => {
    const anulada = !!v.anulada;
    const fecha = v.fecha ? new Date(v.fecha).toLocaleString('es-PY',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '—';
    let items = [];
    try { items = JSON.parse(v.items||'[]'); } catch(e){ /* safe to ignore: fallback to empty items */ }
    const metodo = (v.metodo_pago||'EFECTIVO').toUpperCase();
    // Nro. de habitación (rubro hospedaje) — se busca en el nombre de los
    // items ("Noche — Hab. 104") para mostrarlo en la tarjeta sin tener que
    // abrir el detalle.
    const habMatch = items.map(it => it.nombre||it.name||'').join(' ').match(/Hab\.?\s*(\d+)/i);
    const habNro = habMatch ? habMatch[1] : null;
    // Total en la moneda real cobrada (Gs/R$/mixto) — no siempre el
    // equivalente en guaraníes: una venta en Pix o Efectivo-R$ tiene que
    // mostrar reales, no una conversión.
    const divPagosVenta = (() => { try { return v.div_pagos ? (typeof v.div_pagos==='string'?JSON.parse(v.div_pagos):v.div_pagos) : null; } catch(e){ return null; } })();
    const mmPagosVenta = (() => { try { return v.mm_pagos ? (typeof v.mm_pagos==='string'?JSON.parse(v.mm_pagos):v.mm_pagos) : null; } catch(e){ return null; } })();
    const pixMpPagosVenta = (() => { try { return v.pix_mp_pagos ? (typeof v.pix_mp_pagos==='string'?JSON.parse(v.pix_mp_pagos):v.pix_mp_pagos) : null; } catch(e){ return null; } })();
    let totalDisplay = gs(v.total);
    if(typeof mmVentaMetodoMonedaBreakdown === 'function'){
      const bd = mmVentaMetodoMonedaBreakdown({ total: v.total, metodo: v.metodo_pago, divPagos: divPagosVenta, mmPagos: mmPagosVenta, pixMpPagos: pixMpPagosVenta });
      const totGs = bd.reduce((s,c)=>s+(c.gs||0),0);
      const totBRL = bd.reduce((s,c)=>s+(c.brl||0),0);
      if(totBRL > 0 && totGs === 0) totalDisplay = 'R$ '+totBRL.toLocaleString('es-PY');
      else if(totBRL > 0 && totGs > 0) totalDisplay = 'R$ '+totBRL.toLocaleString('es-PY')+' + '+gs(totGs);
    }
    const facturada = !!v.tiene_factura;
    const nroFact = v.factura ? (function(){ var _f = typeof v.factura==='string' ? JSON.parse(v.factura) : v.factura; return (_f && _f.nro_factura) || ''; })() : '';
    const rucFact = v.factura_ruc || '';
    const nombreFact = v.factura_nombre || '';

    const itemsHTML = items.map(it => `
      <div class="venta-det-item">
        <span class="venta-det-name">${it.nombre||it.name||''}${it.obs?`<span class="venta-det-obs">↳ ${it.obs}</span>`:''}</span>
        <span class="venta-det-qty">x${it.qty||it.cantidad||1}</span>
        <span class="venta-det-price">${gs((it.precio||it.price||0)*(it.qty||it.cantidad||1))}</span>
      </div>`).join('');

    // Badges de estado
    const badgeEstado = anulada
      ? `<span class="venta-det-badge anulada"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Anulada</span>`
      : `<span class="venta-det-badge cobrado"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><polyline points="20 6 9 17 4 12"/></svg> Cobrado</span>`;
    const badgeFactura = facturada
      ? (v.factura_anulada
          ? `<span class="venta-det-badge" style="background:rgba(239,83,80,.1);color:#ef5350;margin-left:6px;text-decoration:line-through;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 1 1V2H4z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="14" y2="15"/></svg> ${nroFact||'FAC'} ANULADA</span>`
          : `<span class="venta-det-badge" style="background:rgba(33,150,243,.12);color:#2196f3;margin-left:6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 1 1V2H4z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="14" y2="15"/></svg> ${nroFact||'Facturada'}</span>`)
      : `<span class="venta-det-badge" style="background:var(--bg);color:var(--muted);border:1px solid var(--border);margin-left:6px;">Sin factura</span>`;

    // Info de factura en detalle
    const facturaDetalle = facturada ? `
      <div style="background:rgba(33,150,243,.06);border:1px solid rgba(33,150,243,.2);border-radius:6px;padding:8px 12px;margin-top:8px;margin-bottom:4px;font-size:12px;">
        <div style="font-weight:700;color:#2196f3;margin-bottom:4px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 1 1V2H4z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="14" y2="15"/></svg> Factura ${nroFact}</div>
        ${rucFact ? `<div style="color:var(--text);">RUC: <b>${rucFact}</b>${nombreFact?' · '+nombreFact:''}</div>` : ''}
      </div>` : '';

    // Comprobante si existe
    const compDet = v.comprobante ? `<div style="font-size:12px;color:var(--muted);margin-top:6px;">Ref: ${v.comprobante}</div>` : '';

    // Botones de acción — una fila _remoto (traída de Supabase, hecha en otro
    // dispositivo) no tiene id de IndexedDB local, así que anular/reimprimir/
    // cambiar pago no se pueden ejecutar desde acá con seguridad.
    const acciones = (anulada || v._remoto) ? '' : `
      <div class="venta-det-actions" onclick="event.stopPropagation()">
        ${!facturada ? `
        <button class="venta-act-btn emitir-fac" onclick="emitirFacturaPostCobro(${v.id})">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          Emitir factura
        </button>` : ''}
        <button class="venta-act-btn" style="background:var(--bg-dark);color:var(--text);border:1.5px solid var(--border);" onclick="reimprimirVentaTurno(${v.id})">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Reimprimir
        </button>
        <button class="venta-act-btn cambiar-pago" onclick="cambiarMetodoPago(${v.id})">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 7H4m0 0l4-4M4 7l4 4M4 17h16m0 0l-4-4m4 4l-4 4"/></svg>
          Cambiar pago
        </button>
        <button class="venta-act-btn anular" onclick="anularVenta(${v.id})">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          Anular
        </button>
      </div>`;

    return `
      <div class="venta-card${anulada?' anulada':''}" id="venta_${v.id||i}" onclick="toggleVentaCard('venta_${v.id||i}')">
        <div class="venta-card-main">
          <div class="venta-card-icon${anulada?' anulada':''}">
            ${anulada
              ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`
              : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`}
          </div>
          <div class="venta-card-info">
            <div class="venta-card-titulo">
              Venta #${v.id||i+1}
              ${habNro ? ` <span style="font-size:11px;background:rgba(255,152,0,.15);color:#ff9800;padding:1px 7px;border-radius:10px;font-weight:700;">Hab. ${habNro}</span>` : ''}
              ${facturada ? ` <span style="font-size:11px;background:${v.factura_anulada?'rgba(239,83,80,.15)':'rgba(33,150,243,.15)'};color:${v.factura_anulada?'#ef5350':'#2196f3'};padding:1px 6px;border-radius:10px;font-weight:700;">${v.factura_anulada?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 1 1V2H4z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="14" y2="15"/></svg> ANULADA':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 1 1V2H4z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="14" y2="15"/></svg> '+( nroFact||'FAC')}</span>` : ''}
              ${anulada ? ` <span style="font-size:11px;color:#ef5350;font-weight:700;">ANULADA</span>` : ''}
              ${v._remoto ? ` <span style="font-size:11px;background:rgba(255,152,0,.15);color:#ff9800;padding:1px 7px;border-radius:10px;font-weight:700;" title="Hecha en otro dispositivo — sin acciones desde acá">Otra terminal</span>` : ''}
            </div>
            <div class="venta-card-sub">${fecha} · ${items.length} artículo${items.length!==1?'s':''}${rucFact?' · '+rucFact:''}</div>
          </div>
          <div class="venta-card-right">
            <div class="venta-card-total">${totalDisplay}</div>
            <div class="venta-card-metodo">${metodo}</div>
          </div>
          <svg class="venta-card-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
        <div class="venta-detalle">
          ${itemsHTML||'<div class="venta-det-item"><span class="venta-det-name" style="color:var(--muted)">Sin detalle de artículos</span></div>'}
          ${facturaDetalle}
          ${compDet}
          <div class="venta-det-footer">
            <div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;">
              ${badgeEstado}${badgeFactura}
            </div>
            <div><span class="venta-det-total-lbl">Total </span><span class="venta-det-total-val">${totalDisplay}</span></div>
          </div>
          ${acciones}
        </div>
      </div>`;
  }).join('');
}

async function anularVenta(id){
  if(!db) return toast('Sin base de datos local');

  // Leer la venta antes de mostrar confirmación
  let venta;
  try { venta = await db.ventas.get(id); } catch(e){ return toast('Error al leer venta'); }
  if(!venta) return toast('Venta no encontrada');

  const tieneFac = !!venta.tiene_factura;
  const nroFac   = venta.factura ? (function(){ try{ var _f=typeof venta.factura==='string'?JSON.parse(venta.factura):venta.factura; return (_f && _f.nro_factura)||''; }catch(e){return '';} })() : '';
  const rucFac   = venta.factura_ruc || '';

  // Modal de confirmación con advertencia de factura
  const prev = document.getElementById('anulOverlay');
  if(prev) prev.remove();

  const ov = document.createElement('div');
  ov.id = 'anulOverlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:500;display:flex;align-items:flex-end;';
  ov.innerHTML = `
    <div style="background:var(--bg-card);width:100%;border-radius:16px 16px 0 0;padding:20px;animation:su .25s ease;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
        <div style="width:40px;height:40px;border-radius:50%;background:rgba(239,83,80,.12);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef5350" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        </div>
        <div>
          <div style="font-size:16px;font-weight:800;color:var(--text);">Anular venta #${id}</div>
          <div style="font-size:12px;color:var(--muted);">Total: ${gs(venta.total)} · ${(venta.metodo_pago||'EFECTIVO').toUpperCase()}</div>
        </div>
      </div>

      ${tieneFac ? `
        <div style="background:rgba(239,83,80,.08);border:1px solid rgba(239,83,80,.3);border-radius:8px;padding:10px 12px;margin-bottom:14px;">
          <div style="font-size:12px;font-weight:800;color:#ef5350;margin-bottom:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>️ Esta venta tiene factura asociada</div>
          <div style="font-size:12px;color:var(--text);">Factura <b>${nroFac||'—'}</b>${rucFac?' · RUC '+rucFac:''}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:4px;">La factura quedará marcada como anulada en el registro.</div>
        </div>` : ''}

      <div style="background:var(--bg-dark);border-radius:8px;padding:10px 12px;margin-bottom:18px;font-size:13px;color:var(--muted);">
        Esta acción <b style="color:var(--text);">no se puede deshacer</b>. La venta quedará registrada como anulada y el monto se descontará del turno actual.
      </div>

      <div style="display:flex;gap:10px;">
        <button onclick="document.getElementById('anulOverlay').remove()"
          style="flex:1;padding:14px;border-radius:8px;border:1.5px solid var(--border);background:transparent;color:var(--muted);font-family:'Barlow',sans-serif;font-size:13px;font-weight:700;cursor:pointer;">
          Cancelar
        </button>
        <button onclick="anularVentaConfirmar(${id})"
          style="flex:2;padding:14px;border-radius:8px;border:none;background:#ef5350;color:#fff;font-family:'Barlow',sans-serif;font-size:13px;font-weight:800;cursor:pointer;">
          ${tieneFac ? 'Anular venta y factura' : 'Confirmar anulación'}
        </button>
      </div>
    </div>`;
  document.body.appendChild(ov);
}

async function anularVentaConfirmar(id){
  if(!db) return;
  try {
    const venta = await db.ventas.get(id);
    if(!venta) return toast('Venta no encontrada');

    // 1. Marcar venta como anulada en IndexedDB (NUNCA se borra)
    await db.ventas.update(id, {
      anulada:         1,
      fecha_anulacion: new Date().toISOString(),
      // Si tiene factura, marcar factura como anulada también
      factura_anulada: venta.tiene_factura ? 1 : 0,
    });

    // 2. Revertir stock en Supabase (en background, sin bloquear UI)
    if(!USAR_DEMO && navigator.onLine){
      try {
        const items = JSON.parse(venta.items || '[]');
        await stockRevertirVenta(items, venta.comprobante || ('ANULACION-'+Date.now()));
      } catch(e){ console.warn('[Anulacion] Error revirtiendo stock:', e.message); }
    }

    // 2b. Hospedaje: si esta venta era el check-out de una habitación, la
    // habitación ya se liberó y la estadía quedó cerrada — anular la venta
    // NO revierte nada de eso automáticamente (no hay forma segura de
    // "reabrir" una habitación que puede ya estar ocupada por otro
    // huésped). Avisar fuerte y dejar la marca en la estadía para que se
    // revise a mano, en vez de que quede un check-out "cobrado" en el aire
    // sin que nadie se entere.
    if(!USAR_DEMO && navigator.onLine && venta.comprobante && typeof usaHabitaciones === 'function' && usaHabitaciones()){
      try {
        const estadias = await supaGet('pos_estadias', 'comprobante_venta=eq.'+encodeURIComponent(venta.comprobante));
        if(estadias && estadias.length){
          for(const est of estadias){
            await supaPatch('pos_estadias', 'id=eq.'+est.id, {
              pago_anulado: true,
              pago_anulado_fecha: new Date().toISOString(),
            }, true);
          }
          const est0 = estadias[0];
          let numHab = '';
          try {
            const habs = await supaGet('pos_habitaciones', 'id=eq.'+est0.habitacion_id);
            numHab = (habs && habs[0]) ? habs[0].numero : '';
          } catch(e){}
          alert('ATENCIÓN — esta venta era el check-out de la Habitación ' + (numHab||'?') +
            ' (' + (est0.huesped_nombre||'huésped') + '). La habitación ya fue liberada y no se revierte ' +
            'automáticamente. Revisá manualmente si corresponde volver a cobrar esa estadía.');
        }
      } catch(e){ console.warn('[Anulacion] Error chequeando estadía de hospedaje:', e.message); }
    }

    // 3. Reconstruir turnoData.ventas desde DB para que el turno cuadre
    //    (elimina la venta anulada del conteo de activas)
    await reconstruirVentasTurno();
    turnoGuardar();

    // 4. Cerrar modal y refrescar
    const ov = document.getElementById('anulOverlay');
    if(ov) ov.remove();

    const msgFac = venta.tiene_factura ? ' · Factura anulada' : '';
    toast('Venta anulada' + msgFac);
    await renderVentasList();

    // 4. Si el turno está visible, refrescarlo también
    var _scTurno=document.getElementById('scTurno'); if(_scTurno && _scTurno.classList.contains('active')){
      renderTurno();
    }
  } catch(e){
    toast('Error al anular: '+e.message);
  }
}

async function cambiarMetodoPago(id){
  if(!db) return toast('Sin base de datos local');

  let venta;
  try { venta = await db.ventas.get(id); } catch(e){ return toast('Error al leer venta'); }
  if(!venta) return toast('Venta no encontrada');

  const metodoActual = (venta.metodo_pago||'EFECTIVO').toUpperCase();
  overlay_cpMetodo = metodoActual; // inicializar con el valor actual

  // Eliminar overlay anterior si existe
  const prev = document.getElementById('cpOverlay');
  if(prev) prev.remove();

  const overlay = document.createElement('div');
  overlay.id = 'cpOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:500;display:flex;align-items:flex-end;';
  overlay.innerHTML = `
    <div style="background:var(--bg-card);width:100%;border-radius:16px 16px 0 0;padding:20px;animation:su .25s ease;">
      <div style="font-size:16px;font-weight:800;color:var(--text);margin-bottom:4px;">Cambiar forma de pago</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:16px;">Venta #${id} · ${venta.fecha ? new Date(venta.fecha).toLocaleString('es-PY',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : ''}</div>

      <div style="margin-bottom:14px;">
        <label style="font-size:11px;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;display:block;margin-bottom:8px;">Método de pago</label>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
          ${['EFECTIVO','POS','TRANSFERENCIA'].map(m => `
            <button onclick="cpSelMetodo('${m}')" id="cpBtn_${m}"
              style="padding:12px 8px;border-radius:8px;border:1.5px solid ${metodoActual===m?'var(--green)':'var(--border)'};
              background:${metodoActual===m?'rgba(76,175,80,.1)':'var(--bg-dark)'};
              color:${metodoActual===m?'var(--green)':'var(--text)'};
              font-family:'Barlow',sans-serif;font-size:12px;font-weight:700;cursor:pointer;transition:all .15s;">
              ${m}
            </button>`).join('')}
        </div>
      </div>

      <div id="cpComprobanteWrap" style="display:${metodoActual!=='EFECTIVO'?'block':'none'};margin-bottom:14px;">
        <label style="font-size:11px;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;display:block;margin-bottom:6px;">Nro. Comprobante / Referencia</label>
        <input id="cpComprobante" type="text" value="${venta.comprobante||''}"
          placeholder="Ej: 123456 / REF-ABC"
          style="width:100%;background:var(--bg-dark);border:none;border-bottom:1.5px solid var(--border2);color:var(--text);font-family:'Barlow',sans-serif;font-size:15px;padding:8px 2px;outline:none;">
      </div>

      <div style="display:flex;gap:10px;margin-top:8px;">
        <button onclick="document.getElementById('cpOverlay').remove()"
          style="flex:1;padding:14px;border-radius:8px;border:1.5px solid var(--border);background:transparent;color:var(--muted);font-family:'Barlow',sans-serif;font-size:13px;font-weight:700;cursor:pointer;">
          Cancelar
        </button>
        <button onclick="cpConfirmar(${id})"
          style="flex:2;padding:14px;border-radius:8px;border:none;background:var(--green);color:#fff;font-family:'Barlow',sans-serif;font-size:13px;font-weight:800;cursor:pointer;">
          Confirmar cambio
        </button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

function cpSelMetodo(m){
  overlay_cpMetodo = m;
  ['EFECTIVO','POS','TRANSFERENCIA'].forEach(opt => {
    const btn = document.getElementById('cpBtn_'+opt);
    if(!btn) return;
    const sel = opt === m;
    btn.style.borderColor  = sel ? 'var(--green)' : 'var(--border)';
    btn.style.background   = sel ? 'rgba(76,175,80,.1)' : 'var(--bg-dark)';
    btn.style.color        = sel ? 'var(--green)' : 'var(--text)';
  });
  const wrap = document.getElementById('cpComprobanteWrap');
  if(wrap) wrap.style.display = m !== 'EFECTIVO' ? 'block' : 'none';
}
let overlay_cpMetodo = '';

async function cpConfirmar(id){
  if(!db) return;
  const metodoNuevo = overlay_cpMetodo;
  if(!metodoNuevo){ toast('Seleccioná un método de pago'); return; }
  const comprobante = (document.getElementById('cpComprobante')||{}).value || '';

  try {
    // 1. Actualizar en IndexedDB
    await db.ventas.update(id, { metodo_pago: metodoNuevo, comprobante });

    // 2. Actualizar turnoData en memoria — buscar por dbId o nroTicket
    const venta = await db.ventas.get(id);
    let actualizado = false;

    // Intento 1: buscar por dbId
    let idx = turnoData.ventas.findIndex(v => v.dbId === id);
    // Intento 2: buscar por nroTicket
    if(idx === -1 && venta && venta.nroTicket != null)
      idx = turnoData.ventas.findIndex(v => v.nroTicket === venta.nroTicket);
    // Intento 3: buscar por fecha+total (último recurso)
    if(idx === -1 && venta)
      idx = turnoData.ventas.findIndex(v => v.total === venta.total && Math.abs(new Date(v.fecha)-new Date(venta.fecha)) < 5000);

    if(idx !== -1){
      turnoData.ventas[idx].metodo      = metodoNuevo;
      turnoData.ventas[idx].comprobante = comprobante;
      turnoData.ventas[idx].dbId        = id; // asegurar que quede guardado
      actualizado = true;
    } else {
      // Fallback: reconstruir turnoData.ventas desde IndexedDB del turno actual
      await reconstruirVentasTurno();
      actualizado = true;
    }

    if(actualizado) turnoGuardar();

    // Sync a Supabase en background
    if(!USAR_DEMO && navigator.onLine && venta && venta.fecha){
      const emailCp = localStorage.getItem(SK.email);
      if(emailCp){
        supaPatch('pos_ventas',
          'licencia_email=eq.'+encodeURIComponent(emailCp)+'&fecha=eq.'+encodeURIComponent(venta.fecha),
          { metodo_pago: metodoNuevo, comprobante }, true
        ).catch(e => console.warn('[cpConfirmar] Supabase sync error:', e.message));
      }
    }

    // Cerrar modal
    const ov = document.getElementById('cpOverlay');
    if(ov) ov.remove();

    toast('Forma de pago: '+metodoNuevo+(comprobante?' · '+comprobante:''));
    await renderVentasList();
  } catch(e){
    toast('Error: '+e.message);
  }
}

// Reconstruye turnoData.ventas leyendo las ventas del turno actual desde IndexedDB
async function reconstruirVentasTurno(){
  if(!db || !turnoData.dbId) return;
  try {
    const ventas = await db.ventas
      .where('turno_id').equals(turnoData.dbId)
      .toArray();
    const reconstruidas = ventas
      .filter(v => !v.anulada || v.anulada === 0)  // excluir anuladas (anulada=1)
      .map(v => ({
        dbId:        v.id,
        total:       v.total,
        metodo:      v.metodo_pago || 'EFECTIVO',
        comprobante: v.comprobante || '',
        factura:     v.tiene_factura ? { ruc: v.factura_ruc, nombre: v.factura_nombre } : null,
        fecha:       v.fecha ? new Date(v.fecha) : new Date(),
        nroTicket:   v.nro_ticket || null,
        items:       (() => { try { return JSON.parse(v.items||'[]');     } catch(e){ return []; } })(),
        divPagos:    (() => { try { return JSON.parse(v.div_pagos||'null'); } catch(e){ return null; } })(),
        // mmPagos/pixMpPagos: sin esto, el desglose real Gs/R$ de una venta
        // se perdía apenas se reconstruía el turno (recarga de la app, o los
        // otros puntos que llaman a esta función) — el cierre de caja veía
        // la venta como si fuera 100% en guaraníes.
        mmPagos:     (() => { try { return JSON.parse(v.mm_pagos||'null'); } catch(e){ return null; } })(),
        pixMpPagos:  (() => { try { return JSON.parse(v.pix_mp_pagos||'null'); } catch(e){ return null; } })(),
      }));
    // Salvavidas: si IndexedDB devuelve MENOS ventas de las que ya había en
    // memoria, algo falló guardando localmente (o esta lectura llegó antes
    // que el write) — nunca pisar el turno en memoria con datos incompletos,
    // porque esta función corre justo antes de mostrar/cerrar la caja y así
    // se perdía plata real de la pantalla de cierre sin ningún aviso.
    if(reconstruidas.length < turnoData.ventas.length){
      console.warn('[Turno] reconstruirVentasTurno trajo menos ventas ('+reconstruidas.length+') que las que había en memoria ('+turnoData.ventas.length+') — se conserva la memoria.');
      toast('Atención: no se pudieron confirmar todas las ventas guardadas localmente. No cierres el turno sin avisar a soporte.');
      return;
    }
    turnoData.ventas = reconstruidas;
  } catch(e){ console.warn('[Turno] Error reconstruyendo ventas:', e.message); toast('Error al cargar ventas del turno'); }
}

function toggleVentaCard(id){
  const card = document.getElementById(id);
  if(!card) return;
  card.classList.toggle('open');
}

// Helper para actualizar el texto del splash
function splashStatus(txt){
  var el = document.getElementById('splashStatus');
  if(el) el.textContent = txt;
}

// Oculta el splash con fade out (la animación CSS dura 400ms)
function hideSplash(){
  var sp = document.getElementById('splashScreen');
  if(!sp) return;
  sp.classList.add('hide');
  setTimeout(function(){ if(sp && sp.parentNode) sp.parentNode.removeChild(sp); }, 450);
}

(async function(){
  applyTheme();

  // Safety net: si algo se cuelga, forzar cierre del splash después de 15s
  var _splashKillTimer = setTimeout(function(){
    console.warn('[init] Safety timeout — forzando hideSplash()');
    hideSplash();
  }, 15000);

  splashStatus('Cargando configuración...');
  // Iniciar DB y verificar licencia EN PARALELO — no tienen dependencia
  // La DB carga productos desde IndexedDB para que aparezcan de inmediato
  // mientras licInit verifica con Supabase en background
  let dbOk = false;
  try {
    await initDB();
    dbOk = true;
  } catch(e){
    console.warn('[DB] Error al iniciar:', e.message);
  }

  splashStatus('Verificando licencia...');
  // Lanzar licInit y carga de IndexedDB en paralelo
  const [ok] = await Promise.all([
    licInit(),
    dbOk ? Promise.all([
      dbLoadCategorias().catch(e => console.warn('[DB] Categorías:', e.message)),
      dbLoadProductos().catch(e => console.warn('[DB] Productos:', e.message)),
    ]) : Promise.resolve(),
  ]);

  splashStatus('Listo ');

  if(ok) {
    try {
      await iniciarApp();
    } catch(e) {
      console.error('[iniciarApp] Error:', e);
      splashStatus('Error: ' + (e && e.message ? e.message : String(e)));
    }
  }

  // Ocultar splash siempre — nunca quedar colgados en pantalla verde
  clearTimeout(_splashKillTimer);
  setTimeout(hideSplash, 300);
})();
