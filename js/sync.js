// ── Sincronización: IndexedDB, Supabase sync, queue, UI ──

// ══════════════════════════════════════════════════════════
// DEXIE.JS — BASE DE DATOS LOCAL (IndexedDB)
// ══════════════════════════════════════════════════════════

// Inicializar base de datos
var db;

async function initDB(){
  // Esperar hasta 3 segundos a que Dexie cargue
  for(let i=0; i<30; i++){
    if(typeof Dexie !== 'undefined') break;
    await new Promise(r=>setTimeout(r,100));
  }

  if(typeof Dexie === 'undefined'){
    console.warn('[DB] Dexie no disponible — app funciona sin BD local');
    db = null;
    return null;
  }

  try {
    db = new Dexie('POSDatabase');
    db.version(1).stores({
      productos:   '++id, nombre, categoria, activo, updatedAt, imagen',
      categorias:  '++id, nombre, updatedAt',
      ventas:      '++id, fecha, turno_id, terminal, sincronizado, anulada, factura_anulada',
      turno:       '++id, fecha_apertura, estado, terminal',
      egresos:     '++id, turno_id, fecha, sincronizado, anulada',
      config:      'clave',
      sync_queue:  '++id, tabla, sincronizado, timestamp, error_msg',
    });
    db.version(2).stores({
      productos:   '++id, nombre, categoria, activo, updatedAt, imagen',
      categorias:  '++id, nombre, updatedAt',
      ventas:      '++id, fecha, turno_id, terminal, sincronizado, anulada, factura_anulada',
      turno:       '++id, fecha_apertura, estado, terminal',
      egresos:     '++id, turno_id, fecha, sincronizado, anulada',
      config:      'clave',
      sync_queue:  '++id, tabla, sincronizado, timestamp, error_msg',
      mesas_cache: 'clave',
    });
    await db.open();
    _log('[DB] IndexedDB inicializado OK');
    await dbLoadConfig();
    await dbLoadProductos();
    return db;
  } catch(e){
    console.warn('[DB] Error al abrir IndexedDB:', e.message);
    db = null;
    return null;
  }
}

// ── CONFIG ────────────────────────────────────────────────
async function dbSaveConfig(clave, valor){
  if(!db) return;
  await db.config.put({ clave, valor });
}

async function dbGetConfig(clave){
  if(!db) return null;
  const row = await db.config.get(clave);
  return row ? row.valor : null;
}

async function dbLoadConfig(){
  try {
    const negocio   = await dbGetConfig('negocio');
    const direccion = await dbGetConfig('direccion');
    const telefono  = await dbGetConfig('telefono');
    const ruc       = await dbGetConfig('ruc');
    const terminal  = await dbGetConfig('terminal');

    if(negocio && typeof configData !== 'undefined'){
      configData.negocio   = negocio   || configData.negocio;
      configData.direccion = direccion || configData.direccion;
      configData.telefono  = telefono  || configData.telefono;
      configData.ruc       = ruc       || configData.ruc;
    }
    if(terminal) configData.terminal = terminal;
    _log('[DB] Config cargada');
  } catch(e){ console.warn('[DB] Config no disponible aún:', e.message); }
}

async function dbSaveConfigAll(){
  if(typeof configData === 'undefined') return;
  await dbSaveConfig('negocio',   configData.negocio);
  await dbSaveConfig('direccion', configData.direccion);
  await dbSaveConfig('telefono',  configData.telefono);
  await dbSaveConfig('ruc',       configData.ruc);
  toast('Configuración guardada');
}

// ── PRODUCTOS ─────────────────────────────────────────────
async function dbSaveProducto(prod){
  if(!db) return;
  const data = {
    id:             prod.id,
    nombre:         prod.name,
    precio:         prod.price,
    precio_variable: prod.precioVariable || false,
    costo:          prod.costo || 0,
    codigo:         prod.codigo || '',
    codigos:        JSON.stringify(prod.codigos || []),
    categoria:      prod.cat,
    iva:            prod.iva || '10',
    color:          prod.color,
    color_propio:   prod.colorPropio || false,
    mitad:          prod.mitad || false,
    inventario:     prod.inventario || false,
    comanda:        prod.comanda || false,
    item_libre:     prod.itemLibre || false,
    activo:         prod.activo !== false,
    imagen:         prod.imagen || null,
    es_kilo:        prod.esKilo || false,
    es_favorito:    prod.esFavorito || false,
    updatedAt:      new Date().toISOString(),
  };
  await db.productos.put(data);
  await dbQueueSync('productos', 'upsert', data);
}

async function dbDeleteProducto(id){
  await db.productos.update(id, { activo: false, updatedAt: new Date().toISOString() });
  await dbQueueSync('productos', 'delete', { id });
}

async function dbLoadProductos(){
  try {
    const prods = await db.productos.toArray(); // cargar todos, activos e inactivos
    if(prods.length === 0) return; // usar los hardcodeados
    // Mapear de DB a formato PRODS
    PRODS.length = 0;
    prods.forEach(p => {
      PRODS.push({
        id:             p.id,
        name:           p.nombre,
        price:          p.precio,
        precioVariable: p.precio_variable,
        costo:          p.costo,
        codigo:         p.codigo,
        codigos:        (function(){ try{ return JSON.parse(p.codigos||'[]'); }catch(e){ return []; } })(),
        cat:            p.categoria,
        iva:            p.iva,
        color:          p.color,
        colorPropio:    p.color_propio,
        mitad:          p.mitad,
        inventario:     p.inventario,
        comanda:        p.comanda,
        itemLibre:      p.item_libre,
        activo:         p.activo !== false && p.activo !== 0,
        imagen:         p.imagen || null,
        imagen:         p.imagen || null, // null/undefined/true = active
        esDescuento:    p.es_descuento || false,
        descTipo:       p.desc_tipo || null,
        descValor:      p.desc_valor != null ? p.desc_valor : null,
        esKilo:         p.es_kilo || false,
        esFavorito:     p.es_favorito || false,
      });
    });
    _log('[DB] Productos cargados:', PRODS.length);
    // Asegurar que ítem libre siempre esté presente
    if(!PRODS.find(p=>p.itemLibre)){
      PRODS.push({id:99,name:'ÍTEM LIBRE',price:0,color:'#37474f',cat:'Otros',
        precioVariable:true,itemLibre:true,iva:'10',colorPropio:false,activo:true});
    }
    curCat = (typeof _catDefaultInicial === 'function') ? _catDefaultInicial() : 'Todos los artículos';
    const lbl2 = document.getElementById('catLbl');
    if(lbl2) lbl2.textContent = curCat;
    // Fallback: si CATEGORIAS está vacío, derivarlas de los productos recién cargados
    if(typeof CATEGORIAS !== 'undefined' && CATEGORIAS.length === 0 && typeof derivarCategoriasDeProductos === 'function'){
      derivarCategoriasDeProductos();
    }
    if(typeof filterP === 'function') filterP();
  } catch(e){ console.warn('[DB] Productos no disponibles aún:', e.message); }
}

// ── CATEGORÍAS ────────────────────────────────────────────
async function dbSaveCategoria(cat){
  const data = {
    id:        cat.id,
    nombre:    cat.nombre,
    color:     cat.color,
    updatedAt: new Date().toISOString(),
  };
  await db.categorias.put(data);
  await dbQueueSync('categorias', 'upsert', data);
}

async function dbLoadCategorias(){
  if(!db) return;
  try {
    const cats = await db.categorias.toArray();
    if(cats.length === 0) return;
    CATEGORIAS.length = 0;
    cats.forEach(c => CATEGORIAS.push({ id:c.id, nombre:c.nombre, color:c.color }));
    CATEGORIAS_DEFAULT.length = 0;
    CATEGORIAS.forEach(c => CATEGORIAS_DEFAULT.push(c.nombre));
    _log('[DB] Categorias cargadas:', CATEGORIAS.length);
  } catch(e){ console.warn('[DB] Categorias no disponibles aún:', e.message); }
}

// ── VENTAS ────────────────────────────────────────────────
async function dbSaveVenta(data){
  const venta = {
    fecha:        data.fecha ? data.fecha.toISOString() : new Date().toISOString(),
    turno_id:     data.turnoId || null,
    terminal:     (typeof configData !== 'undefined' ? configData.terminal : null) || 'Principal',
    total:        data.total,
    metodo_pago:  data.metodo,
    comprobante:  data.comprobante || '',
    items:        JSON.stringify(data.items),
    div_pagos:    data.divPagos ? JSON.stringify(data.divPagos) : null,
    // mm_pagos/pix_mp_pagos: desglose real Gs/R$/ARS/USD de la venta (pago
    // simple con Multi-moneda o Pix/MP) — sin esto, esa info solo vivía en
    // turnoData.ventas EN MEMORIA y se perdía al cerrar la app o recargar,
    // quedando indistinguible de un pago 100% en guaraníes.
    mm_pagos:     data.mmPagos ? JSON.stringify(data.mmPagos) : null,
    pix_mp_pagos: data.pixMpPagos ? JSON.stringify(data.pixMpPagos) : null,
    tiene_factura: !!data.factura,
    factura_ruc:  data.factura ? data.factura.ruc : '',
    factura_nombre: data.factura ? data.factura.nombre : '',
    // Nombre rapido del cliente (sin RUC) — independiente de factura_nombre.
    // Se guarda local para que reimpresion offline y listado de ventas del
    // turno tambien lo muestren. Sincroniza a pos_ventas.cliente_nombre.
    cliente_nombre: data.clienteNombre || null,
    sincronizado: 0,
  };
  const id = await db.ventas.add(venta);
  // NO encolar aquí — supaInsertVenta maneja el envío a Supabase
  // y encola en sync_queue solo si falla o no hay internet
  return id;
}

// ── TURNO ─────────────────────────────────────────────────
async function dbAbrirTurno(efectivoInicial){
  if(!db) return null;
  const email = localStorage.getItem('lic_email') || '';
  const turno = {
    fecha_apertura:   new Date().toISOString(),
    efectivo_inicial: efectivoInicial,
    estado:           'abierto',
    terminal:         (typeof configData !== 'undefined' ? configData.terminal : null) || 'Principal',
    licencia_email:   email,
    sincronizado:     0,
  };
  const id = await db.turno.add(turno);
  turnoData.dbId = id;
  await dbQueueSync('turno', 'insert', { ...turno, id });
  return id;
}

async function dbCerrarTurno(turnoDbId, totalContado, diferencia){
  const email = localStorage.getItem('lic_email') || '';
  await db.turno.update(turnoDbId, {
    fecha_cierre:   new Date().toISOString(),
    estado:         'cerrado',
    total_contado:  totalContado,
    diferencia,
    licencia_email: email,
    sincronizado:   0,
  });
  await dbQueueSync('turno', 'update', {
    id:             turnoDbId,
    estado:         'cerrado',
    total_contado:  totalContado,
    diferencia,
    licencia_email: email,
  });
}

async function dbSaveEgreso(egreso){
  const data = {
    turno_id:       turnoData.dbId || null,
    descripcion:    egreso.desc,
    monto:          egreso.monto,
    fecha:          egreso.fecha ? egreso.fecha.toISOString() : new Date().toISOString(),
    terminal:       (typeof configData !== 'undefined' ? configData.terminal : null) || 'Principal',
    licencia_email: localStorage.getItem('lic_email') || '',
    sincronizado:   0,
  };
  const id = await db.egresos.add(data);
  await dbQueueSync('egresos', 'insert', { ...data, id });
  return id;
}

// ── SYNC QUEUE ────────────────────────────────────────────
async function dbQueueSync(tabla, operacion, datos){
  if(!db) return;
  // Limpiar campos locales que Supabase rechazaría
  const datosSupa = Object.assign({}, datos);
  delete datosSupa.sincronizado;
  delete datosSupa.updatedAt;
  await db.sync_queue.add({
    tabla,
    operacion,
    datos:        JSON.stringify(datosSupa),
    timestamp:    new Date().toISOString(),
    sincronizado: 0,
  });
}

// ── SINCRONIZACIÓN CON SUPABASE ───────────────────────────
var syncEnProceso = false;
var _syncStartTime = 0;
var _SYNC_TIMEOUT  = 45000; // 45 segundos — si sync supera esto, se fuerza reset del flag

/** Verifica si syncEnProceso está trabado y lo resetea si pasaron más de 45s */
function _syncCheckStuck(){
  if(syncEnProceso && _syncStartTime > 0){
    var elapsed = Date.now() - _syncStartTime;
    if(elapsed > _SYNC_TIMEOUT){
      console.warn('[Sync] Sync trabado por ' + Math.round(elapsed/1000) + 's — forzando reset');
      syncEnProceso = false;
      _syncStartTime = 0;
    }
  }
}

/** Determina si un error es de red/timeout (reintentable) vs error de API (no reintentar) */
function _esErrorReintentar(err){
  if(!err) return false;
  // TypeError = error de red (Failed to fetch, NetworkError)
  if(err.name === 'TypeError') return true;
  // AbortError = timeout del AbortController
  if(err.name === 'AbortError') return true;
  // Mensajes conocidos de error de red
  if(err.message && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError') || err.message.includes('ERR_INTERNET') || err.message.includes('aborted'))) return true;
  return false;
}

/** Ejecuta fn() con retry exponencial para errores de red/timeout. No reintenta errores HTTP. */
async function _conReintento(fn){
  var delays = [5000, 15000, 45000]; // 5s, 15s, 45s
  var intentos = 0;
  while(true){
    try {
      return await fn();
    } catch(err){
      if(_esErrorReintentar(err) && intentos < delays.length){
        _log('[Sync] Error de red/timeout, reintento ' + (intentos+1) + '/' + delays.length + ' en ' + (delays[intentos]/1000) + 's...');
        await new Promise(function(r){ setTimeout(r, delays[intentos]); });
        intentos++;
      } else {
        throw err; // error de API o agotados los reintentos
      }
    }
  }
}

async function syncConSupabase(){
  _syncCheckStuck();
  if(syncEnProceso || !navigator.onLine) return;
  // No solapar con syncVentasPendientes: ambos procesan filas 'ventas' del
  // sync_queue y sin esto se postea la misma venta dos veces (duplicado).
  if(typeof _syncVentasEnProceso !== 'undefined' && _syncVentasEnProceso) return;
  if(typeof SUPA_URL === 'undefined' || SUPA_URL.includes('XXXX')) return;
  if(!db){ console.warn('[Sync] Sin BD local, omitiendo sync'); return; }

  syncEnProceso = true;
  _syncStartTime = Date.now();
  try {
    const pendientes = await db.sync_queue
      .where('sincronizado').equals(0)
      .limit(50)
      .toArray();

    if(pendientes.length === 0){ syncEnProceso=false; return; }

    _log('[Sync] Enviando', pendientes.length, 'registros...');
    let exitos = 0, fallos = 0;

    for(const item of pendientes){
      try {
        const datos = JSON.parse(item.datos);
        const tabla = 'pos_' + item.tabla; // prefijo en Supabase

        let supaId = null;

        if(item.operacion === 'delete'){
          await _conReintento(function(){ return supaFetch('DELETE', tabla, null, { id: 'eq.'+datos.id }); });
        } else if(item.operacion === 'update'){
          const { id: itemId, ...datosUpdate } = datos;
          await _conReintento(function(){ return supaFetch('PATCH', tabla, datosUpdate, { id: 'eq.'+itemId }); });
        } else {
          // insert — usar return=representation para obtener el ID asignado por Supabase
          const res = await _conReintento(function(){ return supaFetch('POST', tabla, datos, null, 'return=representation'); });
          try {
            const inserted = await res.clone().json();
            if(inserted && inserted[0]) supaId = inserted[0].id;
          } catch(e){ /* safe to ignore: optional ID extraction from response */ }
        }

        await db.sync_queue.update(item.id, { sincronizado: 1, error_msg: null });
        exitos++;

        // Si era un turno nuevo, actualizar turno_id en ventas pendientes de la cola
        if(item.tabla === 'turno' && item.operacion === 'insert' && supaId && datos.id){
          const localTurnoId = datos.id;
          const pendientesVentas = await db.sync_queue
            .where('sincronizado').equals(0)
            .toArray();
          for(const v of pendientesVentas){
            try {
              const vd = JSON.parse(v.datos);
              if(vd.turno_id === localTurnoId){
                vd.turno_id = supaId;
                await db.sync_queue.update(v.id, { datos: JSON.stringify(vd) });
              }
            } catch(e){ console.warn('[Sync] Error actualizando turno_id en item pendiente:', e.message); }
          }
          _log('[Sync] turno_id actualizado en ventas pendientes: local', localTurnoId, '→ supa', supaId);
        }
      } catch(e){
        console.warn('[Sync] Error en item', item.id, e.message);
        const esErrorRed     = e.message.includes('Failed to fetch') || e.message.includes('NetworkError') || e.message.includes('ERR_INTERNET') || !navigator.onLine;
        const esDuplicado    = e.message.includes('23505') || e.message.includes('duplicate key') || e.message.includes('409');

        if(esErrorRed){
          // Sin internet → dejar en 0 para reintentar
          _log('[Sync] Error de red, se reintentará cuando vuelva internet');
          if(!navigator.onLine) break;
        } else if(esDuplicado){
          // Ya existe en Supabase → marcar como sincronizado (no es un error real)
          _log('[Sync] Item ya existe en Supabase, marcando como sincronizado');
          await db.sync_queue.update(item.id, { sincronizado: 1, error_msg: null });
          exitos++;
        } else {
          // Error real de Supabase (campo inválido, permisos, etc.) → marcar como error
          await db.sync_queue.update(item.id, { sincronizado: 2, error_msg: e.message });
          fallos++;
        }
      }
    }
    _log('[Sync] Completado — OK:', exitos, '| Errores:', fallos);
    // Guardar timestamp de última sync exitosa
    if(exitos > 0){
      const ahora = new Date().toLocaleString('es-PY');
      localStorage.setItem('pos_ultima_sync', ahora);
    }
    // Notificar resultado si había pendientes
    if(exitos > 0 && fallos === 0){
      toast('' + exitos + ' venta' + (exitos !== 1 ? 's' : '') + ' sincronizada' + (exitos !== 1 ? 's' : ''));
    } else if(fallos > 0){
      toast('' + exitos + ' sincronizada' + (exitos !== 1 ? 's' : '') + ' — ' + fallos + ' con error. Revisá Configuración → Sincronización');
    }
    // Limpiar cola y actualizar badge
    await limpiarSyncQueue();
    updSyncBadge();
  } catch(e){
    console.warn('[Sync] Error general:', e.message);
  }
  syncEnProceso = false;
  _syncStartTime = 0;
}

async function supaFetch(method, tabla, body, params, prefer){
  let url = SUPA_URL + '/rest/v1/' + tabla;
  if(params){
    const q = Object.entries(params).map(([k,v])=>k+'='+v).join('&');
    url += '?' + q;
  }
  const opts = {
    method,
    headers: supaHeaders({ 'Content-Type': 'application/json', 'Prefer': prefer || 'return=minimal' }),
  };
  if(body) opts.body = JSON.stringify(body);
  opts.signal = supaAbortSignal();
  const res = await fetch(url, opts);
  if(!res.ok) throw new Error(await res.text());
  return res;
}

// Sincronizar cada 2 minutos cuando hay internet
setInterval(syncConSupabase, 2 * 60 * 1000);
// Verificar licencia cada 30 minutos en background
setInterval(function(){
  if(navigator.onLine && licIsActivated()) licVerificarAhora();
}, 30 * 60 * 1000);
// También sync ventas pendientes cada 5 minutos
setInterval(syncVentasPendientes, 5 * 60 * 1000);
// Actualizar badge cada 30 segundos
setInterval(updSyncBadge, 30 * 1000);

window.addEventListener('online', () => {
  _log('[Sync] Conexion detectada, sincronizando...');
  updSyncBadge();
  // Avisar al usuario que volvió internet y hay pendientes
  if(db){
    db.sync_queue.where('sincronizado').equals(0).count().then(n => {
      if(n > 0){
        toast('Conexión restaurada — sincronizando ' + n + ' venta' + (n !== 1 ? 's' : '') + ' pendiente' + (n !== 1 ? 's' : '') + '...');
      } else {
        toast('Conexión restaurada');
      }
    }).catch(()=>{ toast('Conexión restaurada'); });
  }
  setTimeout(async () => {
    _syncCheckStuck(); // forzar reset si sync anterior quedó trabada
    await syncConSupabase();
    await syncVentasPendientes();
    updSyncBadge();
  }, 3000);
});

window.addEventListener('offline', () => {
  _log('[Sync] Sin conexión');
  updSyncBadge();
  toast('Sin conexión — las ventas se guardan localmente');
});

// ══════════════════════════════════════════════════════════
// SYNC UI — Badge, panel y reintentos
// ══════════════════════════════════════════════════════════

/** Actualiza el badge de sync en el header */
async function updSyncBadge(){
  const badge   = document.getElementById('syncBadge');
  const countEl = document.getElementById('syncCount');
  const menuBdg = document.getElementById('syncMenuBadge');
  if(!badge || !countEl) return;

  const setIcon = (estado, n) => {
    badge.className = 'sync-' + estado;
    if(n > 0){
      countEl.textContent = n > 99 ? '99+' : n;
      countEl.classList.remove('hidden');
    } else {
      countEl.classList.add('hidden');
    }
    if(menuBdg){
      if(n > 0){ menuBdg.textContent = n; menuBdg.style.display = 'inline'; }
      else { menuBdg.style.display = 'none'; }
    }
  };

  if(!navigator.onLine){ setIcon('offline', 0); return; }
  if(!db)               { setIcon('ok', 0);      return; }

  try {
    const pendientes = await db.sync_queue.where('sincronizado').equals(0).count();
    const errores    = await db.sync_queue.where('sincronizado').equals(2).count();

    if(errores > 0)         setIcon('error',   errores);
    else if(pendientes > 0) setIcon('pending', pendientes);
    else                    setIcon('ok',      0);
  } catch(e){
    setIcon('ok', 0);
  }
}

/** Renderiza el panel completo de sincronización */
async function renderSyncPanel(){
  const el = document.getElementById('syncPanelContent');
  if(!el) return;

  const online   = navigator.onLine;
  const ultimaSync = localStorage.getItem('pos_ultima_sync') || '—';

  // Stats
  let pendientes = 0, errores = 0, sincronizados = 0;
  if(db){
    try {
      pendientes    = await db.sync_queue.where('sincronizado').equals(0).count();
      errores       = await db.sync_queue.where('sincronizado').equals(2).count();
      sincronizados = await db.sync_queue.where('sincronizado').equals(1).count();
    } catch(e){ /* safe to ignore: optional sync stats for UI panel */ }
  }

  let html = '';

  // Estado de conexión
  html += '<div class="sync-section">';
  html += '<div class="sync-section-title">Estado</div>';
  html += '<div class="sync-stat-row">';
  html += '<span class="sync-stat-label">Conexión</span>';
  html += '<span class="sync-stat-value" style="color:' + (online ? '#4caf50' : '#e53935') + '">' + (online ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 16 9"/></svg> En línea' : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> Sin internet') + '</span>';
  html += '</div>';
  html += '<div class="sync-stat-row"><span class="sync-stat-label">Última sync exitosa</span><span class="sync-stat-value" style="font-size:11px;">' + ultimaSync + '</span></div>';
  html += '<div class="sync-stat-row"><span class="sync-stat-label">Ventas pendientes</span><span class="sync-stat-value" style="color:' + (pendientes > 0 ? '#ff9800' : 'var(--text)') + '">' + pendientes + '</span></div>';
  html += '<div class="sync-stat-row"><span class="sync-stat-label">Con error</span><span class="sync-stat-value" style="color:' + (errores > 0 ? '#e53935' : 'var(--text)') + '">' + errores + '</span></div>';
  html += '</div>';

  // Botón sync manual
  html += '<div class="sync-section">';
  const btnDis = !online ? 'disabled' : '';
  html += '<button class="sync-btn-now" onclick="syncManual()" ' + btnDis + '>';
  html += online ? '↻ Sincronizar ahora' : 'Sin conexión a internet';
  html += '</button>';
  html += '</div>';

  // Items con error
  if(errores > 0 && db){
    html += '<div class="sync-section">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">';
    html += '<div class="sync-section-title" style="margin-bottom:0;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>️ Con error — requieren atención</div>';
    html += '<button onclick="limpiarErroresSync()" style="background:rgba(229,57,53,.12);border:1.5px solid #e53935;border-radius:8px;color:#e53935;font-family:Barlow,sans-serif;font-size:11px;font-weight:800;padding:5px 12px;cursor:pointer;letter-spacing:.3px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg> Limpiar errores</button>';
    html += '</div>';
    try {
      const items = await db.sync_queue.where('sincronizado').equals(2).limit(20).toArray();
      items.forEach(item => {
        let datos = {};
        try { datos = JSON.parse(item.datos); } catch(e){ /* safe to ignore: fallback to empty datos */ }
        const fecha = item.timestamp ? new Date(item.timestamp).toLocaleString('es-PY') : '—';
        const total = datos.total ? gs(datos.total) : '';
        html += '<div class="sync-item-row error">';
        html += '<div class="sync-item-fecha">' + fecha + '</div>';
        html += '<div class="sync-item-info">Venta ' + (total ? '· ' + total : '') + (datos.metodo_pago ? ' · ' + datos.metodo_pago : '') + '</div>';
        if(item.error_msg) html += '<div style="font-size:11px;color:#e53935;margin-top:3px;">' + item.error_msg + '</div>';
        html += '<button class="sync-btn-retry" onclick="reintentarSyncItem(' + item.id + ')">↻ Reintentar</button>';
        html += '</div>';
      });
    } catch(e){ html += '<div class="sync-empty">Error al cargar items</div>'; }
    html += '</div>';
  }

  // Items pendientes
  if(pendientes > 0 && db){
    html += '<div class="sync-section">';
    html += '<div class="sync-section-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Pendientes de envío</div>';
    try {
      const items = await db.sync_queue.where('sincronizado').equals(0).limit(20).toArray();
      items.forEach(item => {
        let datos = {};
        try { datos = JSON.parse(item.datos); } catch(e){ /* safe to ignore: fallback to empty datos */ }
        const fecha = item.timestamp ? new Date(item.timestamp).toLocaleString('es-PY') : '—';
        const total = datos.total ? gs(datos.total) : '';
        html += '<div class="sync-item-row pending">';
        html += '<div class="sync-item-fecha">' + fecha + '</div>';
        html += '<div class="sync-item-info">Venta ' + (total ? '· ' + total : '') + (datos.metodo_pago ? ' · ' + datos.metodo_pago : '') + '</div>';
        html += '</div>';
      });
      if(pendientes > 20) html += '<div style="text-align:center;font-size:12px;color:var(--muted);padding:8px;">...y ' + (pendientes - 20) + ' más</div>';
    } catch(e){ /* safe to ignore: optional pending items UI rendering */ }
    html += '</div>';
  }

  if(pendientes === 0 && errores === 0){
    html += '<div class="sync-empty"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 16 9"/></svg> Todo sincronizado<br><span style="font-size:11px;margin-top:4px;display:block;">No hay ventas pendientes de envío</span></div>';
  }

  // Nota informativa
  html += '<div class="sync-section">';
  html += '<div style="background:rgba(255,152,0,.08);border:1.5px solid rgba(255,152,0,.25);border-radius:10px;padding:12px 14px;font-size:12px;color:var(--muted);line-height:1.5;">';
  html += '<b style="color:#ff9800;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>️ Importante sobre el modo offline</b><br>';
  html += 'Podés vender sin internet — todas las ventas se guardan en tu dispositivo. ';
  html += 'Cuando volvés a conectarte, la app sincroniza automáticamente con la nube. ';
  html += 'Si cerrás la app con ventas pendientes, se enviarán la próxima vez que abras con internet.';
  html += '</div>';
  html += '</div>';

  el.innerHTML = html;
}

/** Sync manual desde el panel */
async function syncManual(){
  const btn = document.querySelector('.sync-btn-now');
  if(btn){ btn.disabled = true; btn.textContent = 'Sincronizando...'; }
  try {
    await syncConSupabase();
    await syncVentasPendientes();
    await limpiarSyncQueue();
    updSyncBadge();
    renderSyncPanel();
    toast('Sincronización completada');
  } catch(e){
    toast('Error al sincronizar: ' + e.message);
    renderSyncPanel();
  }
}

/** Reintentar un item específico con error */
async function reintentarSyncItem(itemId){
  if(!db || !navigator.onLine) return;
  try {
    const item = await db.sync_queue.get(itemId);
    if(!item) return;
    const datos = JSON.parse(item.datos);
    const tabla = 'pos_' + item.tabla;
    if(item.operacion === 'delete'){
      await supaFetch('DELETE', tabla, null, { id: 'eq.'+datos.id });
    } else if(item.operacion === 'update'){
      var datosUpdate = Object.assign({}, datos);
      delete datosUpdate.id;
      await supaFetch('PATCH', tabla, datosUpdate, { id: 'eq.'+datos.id });
    } else {
      await supaFetch('POST', tabla, datos, null, 'return=representation');
    }
    await db.sync_queue.update(itemId, { sincronizado: 1 });
    toast('Venta sincronizada correctamente');
    updSyncBadge();
    renderSyncPanel();
  } catch(e){
    await db.sync_queue.update(itemId, { error_msg: e.message });
    toast('Error: ' + e.message);
    renderSyncPanel();
  }
}

/** Limpia manualmente todos los registros con error del sync_queue */
async function limpiarErroresSync(){
  if(!db) return;
  try {
    const n = await db.sync_queue.where('sincronizado').equals(2).count();
    if(n === 0){ toast('No hay errores para limpiar'); return; }
    await db.sync_queue.where('sincronizado').equals(2).delete();
    updSyncBadge();
    renderSyncPanel();
    toast('' + n + ' error' + (n !== 1 ? 'es' : '') + ' eliminado' + (n !== 1 ? 's' : ''));
  } catch(e){
    toast('Error al limpiar: ' + e.message);
  }
}

/** Limpia registros ya sincronizados de más de 24 horas */
async function limpiarSyncQueue(){
  if(!db) return;
  try {
    const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await db.sync_queue
      .where('sincronizado').equals(1)
      .and(item => item.timestamp < hace24h)
      .delete();
    _log('[Sync] Cola limpiada');
  } catch(e){ console.warn('[Sync] Error limpiando cola:', e.message); }
}
