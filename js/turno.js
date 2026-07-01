// ── Turno / Caja: apertura, cierre, registro de ventas ──
// ── TURNO / CAJA ─────────────────────────────────────────────────────────────
var turnoData = {
  fechaApertura: null,
  efectivoInicial: 0,
  ventas: [],       // {items, total, metodo, comprobante, factura, fecha, nroTicket}
  egresos: [],      // {desc, monto, fecha}
  ingresos: [],     // {desc, monto, fecha} — para futura funcionalidad
};

// Registrar venta en el turno al confirmar pago
// ══════════════════════════════════════════════════════
// TIMBRADO / PUNTO DE EXPEDICIÓN
// ══════════════════════════════════════════════════════

function getTimbradoActivo(){
  // Usar el timbrado cargado en sesión (descargado de Supabase)
  if(window._timbradoCache) return window._timbradoCache;
  // Fallback a localStorage
  try {
    const terminal = localStorage.getItem('pos_terminal')||'Terminal 1';
    const mapa = JSON.parse(localStorage.getItem('pos_timbrados_mapa')||'{}');
    const tims = JSON.parse(localStorage.getItem('pos_timbrados')||'[]');
    const asig = mapa[terminal];
    if(asig !== undefined && tims[asig.timIdx]){
      const t = tims[asig.timIdx];
      const a = t.asignaciones && t.asignaciones[asig.asigIdx];
      if(a) return { ...t, punto_exp:a.punto_exp, nro_actual:a.nro_actual||a.desde||1 };
    }
    // Buscar en asignaciones directamente
    for(const t of tims){
      const a = (t.asignaciones||[]).find(a=>a.terminal===terminal);
      if(a) return { ...t, punto_exp:a.punto_exp, nro_actual:a.nro_actual||1 };
    }
    if(tims.length) return tims[0];
  } catch(e){ console.warn('[getTimbrado]', e.message); }
  return null;
}

function getNroFactura(timbrado){
  const t = timbrado || window._timbradoCache;
  if(!t) return null;
  const pad3 = n=>String(n||0).padStart(3,'0');
  const padN = n=>String(n||0).padStart(7,'0');
  return pad3(t.sucursal)+'-'+pad3(t.punto_exp)+'-'+padN(t.nro_actual||t.desde||1);
}

async function avanzarNroFactura(timbrado){
  if(!timbrado) return;
  if(avanzarNroFactura._lock) return;
  avanzarNroFactura._lock = true;
  const terminal = localStorage.getItem('pos_terminal')||'Terminal 1';
  const email    = localStorage.getItem('lic_email');
  // Optimistic local increment
  if(window._timbradoCache) window._timbradoCache.nro_actual=(window._timbradoCache.nro_actual||1)+1;
  const cached = JSON.parse(localStorage.getItem('pos_timbrado_activo')||'null');
  if(cached){ cached.nro_actual=(cached.nro_actual||1)+1; localStorage.setItem('pos_timbrado_activo',JSON.stringify(cached)); }
  // Confirmar en Supabase y sobrescribir con valor autoritativo del servidor
  if(email && !USAR_DEMO){
    try {
      const d = await supaRPC('avanzar_correlativo', { p_email:email, p_terminal:terminal });
      if(d && d.nro_actual){
        if(window._timbradoCache) window._timbradoCache.nro_actual = d.nro_actual;
        const c2 = JSON.parse(localStorage.getItem('pos_timbrado_activo')||'null');
        if(c2){ c2.nro_actual = d.nro_actual; localStorage.setItem('pos_timbrado_activo',JSON.stringify(c2)); }
        _log('[Correlativo] +1 en Supabase → nro_actual:',d.nro_actual);
      }
    } catch(e){ console.warn('[Correlativo]',e.message); }
  }
  avanzarNroFactura._lock = false;
}

// ══════════════════════════════════════════════════════
// PERSISTENCIA DE TURNO EN localStorage
// ══════════════════════════════════════════════════════
const TURNO_KEY = 'pos_turno_activo';

function turnoGuardar(){
  try {
    localStorage.setItem(TURNO_KEY, JSON.stringify(turnoData));
  } catch(e){ console.warn('[Turno] Error guardando:', e.message); }
}

function turnoRestaurar(){
  try {
    const raw = localStorage.getItem(TURNO_KEY);
    if(!raw) return false;
    const data = JSON.parse(raw);
    if(!data || !data.fechaApertura) return false;
    // Restaurar fechas como objetos Date
    if(data.fechaApertura) data.fechaApertura = new Date(data.fechaApertura);
    if(data.ventas) data.ventas.forEach(v=>{ if(v.fecha) v.fecha = new Date(v.fecha); });
    if(data.egresos) data.egresos.forEach(e=>{ if(e.fecha) e.fecha = new Date(e.fecha); });
    Object.assign(turnoData, data);
    _log('[Turno] Restaurado — '+turnoData.ventas.length+' ventas, abierto: '+turnoData.fechaApertura);
    return true;
  } catch(e){
    console.warn('[Turno] Error restaurando:', e.message);
    localStorage.removeItem(TURNO_KEY);
    return false;
  }
}

function turnoBorrar(){
  localStorage.removeItem(TURNO_KEY);
}

function registrarVentaEnTurno(data){
  turnoData.ventas.push({
    items:          data.items,
    total:          data.total,
    metodo:         data.metodo,
    comprobante:    data.comprobante,
    factura:        data.factura,
    fecha:          data.fecha,
    nroTicket:      data.nroTicket,
    divPagos:       data.divPagos || null,
    clienteNombre:  data.clienteNombre || '',
    efectivo:       data.efectivo || '',
    vuelto:         data.vuelto  || '',
    mmPagos:        data.mmPagos || null,
    pixMpPagos:     data.pixMpPagos || null,
  });
  // Persistir en localStorage (sobrevive al cerrar la app)
  turnoGuardar();
  // Guardar en Supabase en background
  supaInsertVenta(data);
}

// Insertar venta en Supabase (en background, no bloquea la UI)
function supaInsertVenta(data){
  const email = localStorage.getItem(SK.email);
  if(!email) return;

  const venta = {
    fecha:          (data.fecha || new Date()).toISOString(),
    turno_id:       turnoData.dbId || null,
    terminal:       licGetTerminal(),
    sucursal:       localStorage.getItem('pos_sucursal') || 'Principal',
    licencia_email: email,
    total:          data.total || 0,
    metodo_pago:    (data.metodo || 'EFECTIVO').toUpperCase(),
    comprobante:    data.comprobante || '',
    items:          JSON.stringify((data.items||[]).map(i=>({
                      id:     i.id,
                      name:   i.name,
                      nombre: i.name,
                      qty:    i.qty,
                      price:  i.price,
                      precio: i.price,
                      costo:  i.costo||0,
                      iva:    i.iva||'10',
                      cat:    i.cat||i.categoria||'',
                      obs:    i.obs||''
                    }))),
    // div_pagos: detalle de pagos cuando la venta fue dividida en varios métodos.
    // Permite al dashboard sumar montos exactos por método en vez de aproximar.
    // Requiere la columna pos_ventas.div_pagos (ver supabase-migrations/add_div_pagos.sql).
    div_pagos:      (Array.isArray(data.divPagos) && data.divPagos.length)
                     ? data.divPagos.map(p => ({
                         metodo:      (p.metodo || '').toUpperCase(),
                         monto:       p.monto || 0,
                         comprobante: p.comprobante || ''
                       }))
                     : null,
    // cliente_nombre: nombre rapido del cliente (no es factura).
    // Requiere la columna pos_ventas.cliente_nombre (ver add_cliente_nombre.sql).
    cliente_nombre: data.clienteNombre || null,
    tiene_factura:  !!(data.factura && data.factura.ruc),
    factura_ruc:    data.factura ? (data.factura.ruc||'')   : '',
    factura_nombre: data.factura ? (data.factura.nombre||'') : '',
  };

  // También guardar en IndexedDB local y guardar el id en turnoData
  if(db) dbSaveVenta({
    ...data,
    turnoId: turnoData.dbId,
  }).then(dbId => {
    // Guardar el dbId en el último elemento de turnoData.ventas para poder actualizarlo después
    if(dbId && turnoData.ventas.length > 0){
      turnoData.ventas[turnoData.ventas.length - 1].dbId = dbId;
      turnoGuardar();
    }
  }).catch(function(e){ console.warn('[Turno] Error guardando dbId en IndexedDB:', e.message); });

  // Enviar a Supabase
  if(USAR_DEMO || !navigator.onLine){
    // Sin conexión — encolar para sync posterior
    if(db) dbQueueSync('ventas','insert', venta);
    return;
  }

  supaPost('pos_ventas', venta, null, true).then(async () => {
    _log('[Venta] Guardada en Supabase OK');
    // Si la venta tenía un pedido satélite vinculado, marcarlo como cobrado
    if(data._supabasePedidoId){
      marcarPedidoSateliteCobrado(data._supabasePedidoId);
    }
    // Descontar stock en background
    try {
      await stockDescontarVenta(data.items, data.comprobante || ('VENTA-'+Date.now()));
    } catch(e){ console.warn('[Stock] Error en stockDescontarVenta:', e.message); }
  })
  .catch(e => {
    console.warn('[Venta] Error Supabase, encolando:', e.message);
    if(db) dbQueueSync('ventas','insert', venta);
  });
}

// ── DESCUENTO DE STOCK POR VENTA ─────────────────────────────────────────
// marcarPedidoSateliteCobrado: definida en pedidos.js (con filtro licencia_email)

async function stockDescontarVenta(items, comprobante){
  const depId    = parseInt(localStorage.getItem('pos_deposito_id'))||null;
  const sucId    = parseInt(localStorage.getItem('pos_sucursal_id'))||null;
  const email    = localStorage.getItem(SK.email);
  if(!depId || !email) return; // terminal sin depósito configurado

  // Filtrar solo items con inventario=true
  const prods = PRODS || [];
  const itemsInv = (items||[]).filter(function(it){
    if(it.esDelivery || it.esDescuento) return false;
    const p = prods.find(function(p){ return p.id===it.id; });
    return p && p.inventario;
  });
  if(!itemsInv.length) return;

  try{
    // Leer licencia_id
    const licId = parseInt(localStorage.getItem('ali')) || null;
    if(!licId) return;

    // Leer stock actual
    const prodIds = itemsInv.map(function(i){ return encodeURIComponent(i.id); }).join(',');
    const stockData = await supaGet('stock',
      'deposito_id=eq.'+depId+'&producto_id=in.('+prodIds+')&select=producto_id,cantidad');
    const stockMap = {};
    (stockData||[]).forEach(function(s){ stockMap[s.producto_id] = parseFloat(s.cantidad)||0; });

    // Crear comprobante de venta
    const compData = await supaPost('stock_comprobantes', {
        licencia_id: licId,
        deposito_id: depId,
        sucursal_id: sucId,
        tipo: 'venta',
        referencia: comprobante || ('VENTA-'+Date.now()),
        observacion: 'Venta registrada desde POS',
        terminal: localStorage.getItem('pos_terminal')||'Terminal',
        usuario: email,
        fecha: new Date().toISOString()
      });
    const compId = Array.isArray(compData) ? compData[0].id : compData.id;

    // Items del comprobante + upsert stock
    const compItems = itemsInv.map(function(it){
      const qty   = parseFloat(it.qty)||1;
      const antes = stockMap[it.id]||0;
      const desp  = antes - qty;
      return {
        comprobante_id: compId,
        producto_id:    it.id,
        nombre_producto: it.name||it.nombre||'',
        cantidad:       -qty,
        cantidad_antes: antes,
        cantidad_despues: desp,
        costo_unitario: 0
      };
    });

    await supaPost('stock_comprobante_items', compItems, null, true);

    // Decremento atómico via RPC — todos los items en una sola transacción PG.
    // Firma: descontar_stock_venta(p_deposito_id, p_items jsonb, p_referencia, p_terminal)
    const rpcItems = itemsInv.map(function(it){
      return {
        producto_id:      it.id,
        cantidad:         parseFloat(it.qty)||1,
        sucursal_id:      sucId,
        licencia_id:      licId,
        nombre_producto:  it.name||it.nombre||''
      };
    });
    try {
      await supaRPC('descontar_stock_venta', {
        p_deposito_id: depId,
        p_items:       rpcItems,
        p_referencia:  comprobante || ('VENTA-'+Date.now()),
        p_terminal:    localStorage.getItem('pos_terminal')||'Terminal'
      });
      _log('[Stock] Descontado atómico — '+itemsInv.length+' prods | depósito:', depId);
    } catch(_rpcErr) {
      // Fallback: upsert clásico por producto (no atómico)
      console.warn('[Stock] RPC no disponible, usando fallback:', _rpcErr.message||_rpcErr);
      for(const it of itemsInv){
        const qty  = parseFloat(it.qty)||1;
        const desp = (stockMap[it.id]||0) - qty;
        try {
          await supaPost('stock', {
              deposito_id: depId, sucursal_id: sucId, licencia_id: licId,
              producto_id: it.id, nombre_producto: it.name||it.nombre||'',
              cantidad: desp, updated_at: new Date().toISOString()
            }, 'deposito_id,producto_id', true);
        } catch(e){ console.warn('[Stock] upsert error prod', it.id, ':', e.message); }
      }
      _log('[Stock] Descontado fallback — '+itemsInv.length+' prods | depósito:', depId);
    }
  }catch(e){
    console.warn('[Stock] Error descontando:', e.message);
  }
}

async function stockRevertirVenta(items, comprobante){
  const depId = parseInt(localStorage.getItem('pos_deposito_id'))||null;
  const sucId = parseInt(localStorage.getItem('pos_sucursal_id'))||null;
  const email = localStorage.getItem(SK.email);
  if(!depId || !email) return;

  const prods = PRODS || [];
  const itemsInv = (items||[]).filter(function(it){
    if(it.esDelivery || it.esDescuento) return false;
    const p = prods.find(function(p){ return p.id===it.id; });
    return p && p.inventario;
  });
  if(!itemsInv.length) return;

  try{
    const licId = parseInt(localStorage.getItem('ali')) || null;
    if(!licId) return;

    const prodIds = itemsInv.map(function(i){ return encodeURIComponent(i.id); }).join(',');
    const stockData = await supaGet('stock',
      'deposito_id=eq.'+depId+'&producto_id=in.('+prodIds+')&select=producto_id,cantidad');
    const stockMap = {};
    (stockData||[]).forEach(function(s){ stockMap[s.producto_id] = parseFloat(s.cantidad)||0; });

    const compData = await supaPost('stock_comprobantes', {
        licencia_id: licId,
        deposito_id: depId,
        sucursal_id: sucId,
        tipo: 'anulacion',
        referencia: comprobante || ('ANULACION-'+Date.now()),
        observacion: 'Venta anulada desde POS — stock revertido',
        terminal: localStorage.getItem('pos_terminal')||'Terminal',
        usuario: email,
        fecha: new Date().toISOString()
      });
    const compId = Array.isArray(compData) ? compData[0].id : compData.id;

    const compItems = itemsInv.map(function(it){
      const qty   = parseFloat(it.qty)||1;
      const antes = stockMap[it.id]||0;
      const desp  = antes + qty;
      return {
        comprobante_id:   compId,
        producto_id:      it.id,
        nombre_producto:  it.name||it.nombre||'',
        cantidad:         +qty,
        cantidad_antes:   antes,
        cantidad_despues: desp,
        costo_unitario:   0
      };
    });
    await supaPost('stock_comprobante_items', compItems, null, true);

    for(const it of itemsInv){
      const qty   = parseFloat(it.qty)||1;
      const antes = stockMap[it.id]||0;
      const desp  = antes + qty;
      try {
        await supaPost('stock', {
            deposito_id:     depId,
            sucursal_id:     sucId,
            licencia_id:     licId,
            producto_id:     it.id,
            nombre_producto: it.name||it.nombre||'',
            cantidad:        desp,
            updated_at:      new Date().toISOString()
          }, 'deposito_id,producto_id', true);
      } catch(e){ console.warn('[Stock] upsert revert prod', it.id, ':', e.message); }
    }
    _log('[Stock] Revertido — '+itemsInv.length+' productos | depósito:', depId);
  }catch(e){
    console.warn('[Stock] Error revirtiendo stock:', e.message);
  }
}

// Sincronizar ventas pendientes de la cola
async function syncVentasPendientes(){
  if(!db || !navigator.onLine || USAR_DEMO) return;
  const email = localStorage.getItem(SK.email);
  if(!email) return;
  try {
    const pending = await db.sync_queue
      .where('sincronizado').equals(0)
      .filter(r => r.tabla === 'ventas')
      .limit(20)
      .toArray();

    for(const item of pending){
      try {
        const datos = JSON.parse(item.datos);
        datos.licencia_email = email;
        await supaPost('pos_ventas', datos, null, true);
        await db.sync_queue.update(item.id, { sincronizado: 1 });
        // Descontar stock de la venta que estaba en cola
        try {
          const itemsSync = typeof datos.items === 'string' ? JSON.parse(datos.items) : (datos.items||[]);
          if(itemsSync.length) await stockDescontarVenta(itemsSync, datos.comprobante||('SYNC-'+item.id));
        } catch(e){ console.warn('[Sync stock] Error descontando stock offline:', e.message); }
      } catch(e){ console.warn('[Sync ventas] Error sincronizando item:', e.message); continue; }
    }
  } catch(e){ console.warn('[Sync ventas]', e.message); }
}

async function renderTurno(){
  const body = document.getElementById('turnoCuerpo');
  if(!body) return;

  // Si hay turno activo y DB disponible, reconstruir ventas desde DB
  // para reflejar cualquier cambio de método de pago
  if(db && turnoData.dbId){
    await reconstruirVentasTurno();
  }

  const ahora = new Date();
  const pad = n => String(n).padStart(2,'0');
  const fmtFecha = d => d ? pad(d.getDate())+'/'+pad(d.getMonth()+1)+'/'+d.getFullYear()+' '+pad(d.getHours())+':'+pad(d.getMinutes()) : '—';

  // Calcular totales
  const totalVentas = turnoData.ventas.reduce((s,v)=>s+v.total, 0);
  const totalEgresos = turnoData.egresos.filter(e=>!e.anulada).reduce((s,e)=>s+e.monto, 0);
  const totalIngresos = turnoData.ingresos.reduce((s,i)=>s+i.monto, 0);
  const saldoEsperado = turnoData.efectivoInicial + totalVentas + totalIngresos - totalEgresos;

  // Por método de pago — desglosa divPagos si existe, o el string compuesto
  const metodos = {};
  const acumMetodo = (m, monto) => {
    m = (m || 'EFECTIVO').toUpperCase().trim();
    if(!metodos[m]) metodos[m] = { total:0, ops:0 };
    metodos[m].total += monto;
    metodos[m].ops++;
  };
  turnoData.ventas.forEach(v => {
    if(v.divPagos && v.divPagos.length > 0){
      // Venta nueva con divPagos detallado
      v.divPagos.forEach(p => acumMetodo(p.metodo, p.monto || 0));
    } else if(v.metodo && v.metodo.includes(' + ')){
      // Venta antigua con string compuesto — dividir el total en partes iguales
      const partes = v.metodo.split(' + ');
      const montoParte = Math.round(v.total / partes.length);
      partes.forEach((p, i) => {
        // Último método absorbe el resto por redondeo
        const m = i === partes.length - 1 ? v.total - montoParte*(partes.length-1) : montoParte;
        acumMetodo(p, m);
      });
    } else {
      acumMetodo(v.metodo, v.total);
    }
  });

  // Otros datos
  const cantVentas = turnoData.ventas.length;
  const ticketProm = cantVentas > 0 ? Math.round(totalVentas / cantVentas) : 0;

  const metodoIcons = {
    'EFECTIVO': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></svg>',
    'POS': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',
    'TRANSFERENCIA': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="9" x2="22" y2="9"/></svg>',
  };

  let html = '';

  // ── Resumen apertura ──
  html += '<div class="turno-section">';
  html += '<div class="turno-section-title">Resumen del turno</div>';
  html += '<div class="turno-row"><span class="turno-row-label">Apertura</span><span class="turno-row-val">' + fmtFecha(turnoData.fechaApertura) + '</span></div>';
  html += '<div class="turno-row"><span class="turno-row-label">Efectivo inicial</span><span class="turno-row-val green">' + gs(turnoData.efectivoInicial) + '</span></div>';
  html += '<div class="turno-row"><span class="turno-row-label">Total ventas</span><span class="turno-row-val green">' + gs(totalVentas) + '</span></div>';
  html += '<div class="turno-row"><span class="turno-row-label sub">' + cantVentas + ' venta' + (cantVentas!==1?'s':'') + ' · Ticket promedio: ' + gs(ticketProm) + '</span><span></span></div>';
  if(totalEgresos > 0)
    html += '<div class="turno-row"><span class="turno-row-label">Total egresos</span><span class="turno-row-val red">−' + gs(totalEgresos) + '</span></div>';
  if(totalIngresos > 0)
    html += '<div class="turno-row"><span class="turno-row-label">Ingresos de caja</span><span class="turno-row-val green">+' + gs(totalIngresos) + '</span></div>';
  html += '<div class="turno-row" style="background:rgba(76,175,80,.06)"><span class="turno-row-label" style="font-weight:700;">Saldo esperado en caja</span><span class="turno-row-val big green">' + gs(saldoEsperado) + '</span></div>';
  html += '</div>';

  // ── Formas de pago ──
  html += '<div class="turno-section">';
  html += '<div class="turno-section-title">Formas de pago</div>';
  if(Object.keys(metodos).length === 0){
    html += '<div class="turno-row"><span class="turno-row-label muted" style="color:#555;">Sin ventas registradas</span></div>';
  } else {
    Object.entries(metodos).forEach(([m, d]) => {
      html += '<div class="turno-metodo-row">';
      html += '<div class="turno-metodo-icon">' + (metodoIcons[m]||metodoIcons['EFECTIVO']) + '</div>';
      html += '<div class="turno-metodo-info"><div class="turno-metodo-name">' + m + '</div><div class="turno-metodo-ops">' + d.ops + ' operación' + (d.ops!==1?'es':'') + '</div></div>';
      html += '<div class="turno-metodo-total">' + gs(d.total) + '</div>';
      html += '</div>';
    });
  }
  html += '</div>';

  // ── Moneda extranjera recibida en efectivo (ventas MM) ──
  var _totalBRL = 0, _totalBRLGs = 0, _totalARS = 0, _totalARSGs = 0;
  // ── Pagos digitales Pix / Mercado Pago ──
  var _pixBRL = 0, _pixBRLGs = 0, _mpARS = 0, _mpARSGs = 0;
  turnoData.ventas.forEach(function(v){
    if(v.mmPagos){
      _totalBRL   += v.mmPagos.pagoBRL   || 0;
      _totalBRLGs += v.mmPagos.pagoBRLGs || 0;
      _totalARS   += v.mmPagos.pagoARS   || 0;
      _totalARSGs += v.mmPagos.pagoARSGs || 0;
    }
    if(v.pixMpPagos){
      if(v.pixMpPagos.tipo === 'pix'){ _pixBRL += v.pixMpPagos.monedaAmt || 0; _pixBRLGs += v.pixMpPagos.monedaGs || 0; }
      if(v.pixMpPagos.tipo === 'mp') { _mpARS  += v.pixMpPagos.monedaAmt || 0; _mpARSGs  += v.pixMpPagos.monedaGs || 0; }
    }
  });
  if(_totalBRL > 0 || _totalARS > 0){
    html += '<div class="turno-section">';
    html += '<div class="turno-section-title">Moneda extranjera efectivo</div>';
    if(_totalBRL > 0)
      html += '<div class="turno-row"><span class="turno-row-label">&#127463;&#127479; Reales</span><span class="turno-row-val">R$ '+_totalBRL.toFixed(2)+' <span style="color:var(--muted);font-size:11px;">(&#8776; '+gs(_totalBRLGs)+' Gs)</span></span></div>';
    if(_totalARS > 0)
      html += '<div class="turno-row"><span class="turno-row-label">&#127462;&#127479; Pesos Arg.</span><span class="turno-row-val">$ '+_totalARS.toFixed(2)+' <span style="color:var(--muted);font-size:11px;">(&#8776; '+gs(_totalARSGs)+' Gs)</span></span></div>';
    html += '</div>';
  }
  if(_pixBRL > 0 || _mpARS > 0){
    html += '<div class="turno-section">';
    html += '<div class="turno-section-title">Pagos digitales</div>';
    if(_pixBRL > 0)
      html += '<div class="turno-row"><span class="turno-row-label">Pix &#127463;&#127479;</span><span class="turno-row-val">R$ '+_pixBRL.toFixed(2)+' <span style="color:var(--muted);font-size:11px;">(= '+gs(_pixBRLGs)+' Gs)</span></span></div>';
    if(_mpARS > 0)
      html += '<div class="turno-row"><span class="turno-row-label">Mercado Pago &#127462;&#127479;</span><span class="turno-row-val">$ '+Number(_mpARS).toLocaleString('es-PY')+' <span style="color:var(--muted);font-size:11px;">(= '+gs(_mpARSGs)+' Gs)</span></span></div>';
    html += '</div>';
  }

  // ── Egresos ──
  html += '<div class="turno-section">';
  html += '<div class="turno-section-title">Egresos de caja</div>';
  const egresosActivos = turnoData.egresos.filter(e => !e.anulada);
  if(egresosActivos.length === 0){
    html += '<div class="turno-row"><span class="turno-row-label muted" style="color:var(--muted);">Sin egresos registrados</span></div>';
  } else {
    turnoData.egresos.forEach((e, idx) => {
      if(e.anulada) return; // ocultar anulados
      html += '<div class="turno-egreso-row" style="display:flex;align-items:center;gap:10px;">';
      html += '<div class="turno-egreso-info" style="flex:1;"><div class="turno-egreso-desc">' + e.desc + '</div><div class="turno-egreso-fecha">' + fmtFecha(e.fecha) + '</div></div>';
      html += '<div class="turno-egreso-monto">−' + gs(e.monto) + '</div>';
      html += '<button onclick="anularEgreso('+idx+')" title="Anular egreso" style="background:none;border:none;cursor:pointer;padding:6px;color:#ef5350;display:flex;align-items:center;flex-shrink:0;" >';
      html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></button>';
      html += '</div>';
    });
    html += '<div class="turno-row"><span class="turno-row-label" style="font-weight:700;">Total egresos</span><span class="turno-row-val red">−' + gs(totalEgresos) + '</span></div>';
  }
  html += '</div>';

  // ── Datos adicionales ──
  const ventasCredito = turnoData.ventas.filter(v=>v.factura).reduce((s,v)=>s+v.total,0);
  html += '<div class="turno-section">';
  html += '<div class="turno-section-title">Datos adicionales</div>';
  html += '<div class="turno-row"><span class="turno-row-label">Ventas con factura</span><span class="turno-row-val">' + turnoData.ventas.filter(v=>v.factura).length + '</span></div>';
  html += '<div class="turno-row"><span class="turno-row-label">Monto facturado</span><span class="turno-row-val">' + gs(ventasCredito) + '</span></div>';
  html += '<div class="turno-row"><span class="turno-row-label">Total descuentos</span><span class="turno-row-val muted">₲0</span></div>';
  html += '</div>';

  // ── Botones ──
  html += '<div class="turno-actions">';
  html += '<button class="turno-btn-egreso" onclick="openEgresoModal()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>REGISTRAR EGRESO</button>';
  html += '<button class="turno-btn-cierre" onclick="cerrarTurno()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>CERRAR TURNO</button>';
  html += '</div>';

  body.innerHTML = html;
}

function openEgresoModal(){
  document.getElementById('egresoDesc').value = '';
  document.getElementById('egresoMonto').value = '';
  document.getElementById('egresoModal').classList.add('open');
  setTimeout(()=>document.getElementById('egresoDesc').focus(), 200);
}

function closeEgresoModal(e){
  if(e === null || e.target === document.getElementById('egresoModal'))
    document.getElementById('egresoModal').classList.remove('open');
}

function guardarEgreso(){
  const desc = document.getElementById('egresoDesc').value.trim();
  const monto = parseInt(document.getElementById('egresoMonto').value)||0;
  if(!desc){ toast('Ingresá la descripción'); return; }
  if(!monto){ toast('Ingresá el monto'); return; }
  const egreso = { desc, monto, fecha: new Date() };
  turnoData.egresos.push(egreso);
  turnoGuardar();
  // Guardar en IndexedDB y persistir el dbId
  if(db){
    dbSaveEgreso(egreso).then(dbId => {
      if(dbId) egreso.dbId = dbId;
      turnoGuardar();
    }).catch(function(e){ console.warn('[Turno] Error guardando egreso en IndexedDB:', e.message); });
  }
  document.getElementById('egresoModal').classList.remove('open');
  renderTurno();
  toast('Egreso registrado');
}

async function emitirFacturaPostCobro(ventaId){
  if(!db) return toast('Sin base de datos local');

  // Validar timbrado primero
  let tims = [];
  try { tims = JSON.parse(localStorage.getItem('pos_timbrados')||'[]'); } catch(e){ /* safe: fallback to empty array */ }
  const hoy = new Date();
  const vigentes = tims.filter(t=>{
    if(t.tipo==='electronico') return true;
    return t.vig_fin ? new Date(t.vig_fin+' 00:00:00') >= hoy : true;
  });
  if(!vigentes.length){
    toast('Sin timbrado configurado. Configurá uno en Panel Admin → Administración');
    return;
  }

  const prev = document.getElementById('facPostOv');
  if(prev) prev.remove();

  // Determinar timbrado a usar
  const tim = getTimbradoActivo() || vigentes[0];
  const pad3 = n=>String(n).padStart(3,'0');
  const padN = n=>String(n).padStart(7,'0');
  const nroPreview = tim ? pad3(tim.sucursal)+'-'+pad3(tim.punto_exp)+'-'+padN(tim.nro_actual||tim.desde) : '—';

  const ov = document.createElement('div');
  ov.id = 'facPostOv';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:500;display:flex;align-items:flex-end;';
  ov.innerHTML = `
    <div style="background:var(--bg-card);width:100%;border-radius:16px 16px 0 0;padding:20px;animation:su .25s ease;max-height:90vh;overflow-y:auto;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
        <div style="width:38px;height:38px;border-radius:8px;background:rgba(33,150,243,.12);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2196f3" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        </div>
        <div>
          <div style="font-size:16px;font-weight:800;color:var(--text);">Emitir factura</div>
          <div style="font-size:12px;color:#2196f3;">Timbrado ${(tim && tim.nro)||'—'} · Próx. nro: ${nroPreview}</div>
        </div>
      </div>

      <div style="margin-bottom:12px;">
        <label style="font-size:11px;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;display:block;margin-bottom:6px;">RUC / C.I. <span style="color:#ef5350;">*</span></label>
        <div style="display:flex;gap:8px;">
          <input id="fpRuc" type="text" placeholder="Ej: 1234567-8" maxlength="20"
            style="flex:1;background:var(--bg-dark);border:none;border-bottom:1.5px solid var(--border2);color:var(--text);font-family:'Barlow',sans-serif;font-size:15px;padding:8px 2px;outline:none;">
          <button onclick="fpBuscarRuc()" style="background:var(--green);border:none;border-radius:4px;color:#fff;padding:8px 12px;cursor:pointer;font-family:'Barlow',sans-serif;font-size:12px;font-weight:700;white-space:nowrap;">BUSCAR</button>
        </div>
        <div id="fpRucStatus" style="font-size:11px;margin-top:4px;min-height:14px;color:var(--muted);"></div>
      </div>

      <div style="margin-bottom:12px;">
        <label style="font-size:11px;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;display:block;margin-bottom:6px;">Razón Social / Nombre <span style="color:#ef5350;">*</span></label>
        <input id="fpNombre" type="text" placeholder="Ej: Juan Pérez / Empresa SA" maxlength="60"
          style="width:100%;background:var(--bg-dark);border:none;border-bottom:1.5px solid var(--border2);color:var(--text);font-family:'Barlow',sans-serif;font-size:15px;padding:8px 2px;outline:none;">
      </div>

      <div style="margin-bottom:18px;">
        <label style="font-size:11px;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;display:block;margin-bottom:6px;">Dirección (opcional)</label>
        <input id="fpDir" type="text" placeholder="Ej: Av. España 123, Asunción" maxlength="80"
          style="width:100%;background:var(--bg-dark);border:none;border-bottom:1.5px solid var(--border2);color:var(--text);font-family:'Barlow',sans-serif;font-size:15px;padding:8px 2px;outline:none;">
      </div>

      <div style="display:flex;gap:10px;">
        <button onclick="document.getElementById('facPostOv').remove()"
          style="flex:1;padding:14px;border-radius:8px;border:1.5px solid var(--border);background:transparent;color:var(--muted);font-family:'Barlow',sans-serif;font-size:13px;font-weight:700;cursor:pointer;">
          Cancelar
        </button>
        <button onclick="fpConfirmar(${ventaId})"
          style="flex:2;padding:14px;border-radius:8px;border:none;background:#2196f3;color:#fff;font-family:'Barlow',sans-serif;font-size:13px;font-weight:800;cursor:pointer;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 1 1V2H4z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="14" y2="15"/></svg> Emitir factura
        </button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  setTimeout(function(){ var _el=document.getElementById('fpRuc'); if(_el)_el.focus(); }, 300);
}

async function fpBuscarRuc(){
  var _fpRuc=document.getElementById('fpRuc'); const ruc = _fpRuc ? _fpRuc.value.trim() : '';
  if(!ruc) return;
  const st = document.getElementById('fpRucStatus');
  if(st) st.textContent = 'Consultando...';
  try {
    const r = await fetch('https://api.facturapi.com.py/ruc/'+encodeURIComponent(ruc));
    if(!r.ok) throw new Error('No encontrado');
    const d = await r.json();
    const nombre = d.razon_social || d.nombre || '';
    if(nombre){
      const inp = document.getElementById('fpNombre');
      if(inp) inp.value = nombre;
      if(st) st.textContent = '' + nombre;
      if(st) st.style.color = 'var(--green)';
    }
  } catch(e){
    if(st){ st.textContent = 'RUC no encontrado en el registro'; st.style.color = '#ef5350'; }
  }
}

async function fpConfirmar(ventaId){
  var _elRuc=document.getElementById('fpRuc'), _elNom=document.getElementById('fpNombre'), _elDir=document.getElementById('fpDir');
  const ruc    = _elRuc ? _elRuc.value.trim() : '';
  const nombre = _elNom ? _elNom.value.trim() : '';
  const dir    = _elDir ? _elDir.value.trim() : '';

  if(!ruc){   toast('RUC / C.I. es obligatorio'); if(_elRuc)_elRuc.focus(); return; }
  if(!nombre){ toast('Razón social es obligatoria'); if(_elNom)_elNom.focus(); return; }

  if(!db) return toast('Sin base de datos local');

  const tim = getTimbradoActivo();
  if(!tim){ toast('Sin timbrado configurado'); return; }

  const pad3 = n=>String(n).padStart(3,'0');
  const padN = n=>String(n).padStart(7,'0');
  const nroFact = pad3(tim.sucursal)+'-'+pad3(tim.punto_exp)+'-'+padN(tim.nro_actual||tim.desde);

  const facturaData = {
    ruc, nombre, direccion: dir,
    timbrado:      tim.nro,
    nro_factura:   nroFact,
    tipo_timbrado: tim.tipo || 'autoimpresor',
    sucursal_nro:  pad3(tim.sucursal),
    punto_exp:     pad3(tim.punto_exp),
    fecha_desde:   tim.fecha_desde || tim.desde_fecha || '',
    fecha_hasta:   tim.fecha_hasta || tim.hasta_fecha || tim.vence || '',
  };

  try {
    // Guardar factura en la venta
    await db.ventas.update(ventaId, {
      tiene_factura:   1,
      factura_ruc:     ruc,
      factura_nombre:  nombre,
      factura:         JSON.stringify(facturaData),
    });

    // Avanzar numeración del timbrado
    avanzarNroFactura(tim);

    // Cerrar modal y refrescar
    var _facPost=document.getElementById('facPostOv'); if(_facPost)_facPost.remove();
    toast('Factura '+nroFact+' emitida');
    await renderVentasList();
  } catch(e){
    toast('Error al emitir factura: '+e.message);
  }
}

function marcarPresupuesto(idx, esPresupuesto){
  if(!pendientes[idx]) return;
  pendientes[idx].esPresupuesto = !!esPresupuesto;
  try{ localStorage.setItem('pos_pendientes', JSON.stringify(pendientes)); }catch(e){ /* safe: pendientes persist best-effort */ }
  toast(esPresupuesto ? 'Ticket marcado como presupuesto' : 'Ticket marcado como pendiente');
  // Si el modal de cierre de turno está abierto, refrescarlo
  const modalAbierto = !!document.getElementById('pendCierreOv');
  if(modalAbierto){
    document.getElementById('pendCierreOv').remove();
    const pendActivos = pendientes.filter(p => !p.esPresupuesto);
    if(pendActivos.length === 0){
      // Ya no hay bloqueantes — continuar cierre
      cerrarTurno();
    } else {
      // Redibujar modal actualizado
      _mostrarModalPendientesCierre(pendActivos);
    }
  }
  // Refrescar lista de ventas si está visible
  var _scV=document.getElementById('scVentas'); if(_scV && _scV.classList.contains('active')){
    renderVentasList();
  }
}

function _mostrarModalPendientesCierre(pendActivos){
  const prev = document.getElementById('pendCierreOv');
  if(prev) prev.remove();
  const ov = document.createElement('div');
  ov.id = 'pendCierreOv';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:600;display:flex;align-items:flex-end;';
  ov.innerHTML = `
    <div style="background:var(--bg-card);width:100%;border-radius:16px 16px 0 0;padding:20px;animation:su .25s ease;max-height:85vh;overflow-y:auto;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
        <div style="width:40px;height:40px;border-radius:50%;background:rgba(255,152,0,.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff9800" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <div>
          <div style="font-size:16px;font-weight:800;color:var(--text);">Hay ${pendActivos.length} ticket${pendActivos.length>1?'s':''} pendiente${pendActivos.length>1?'s':''}</div>
          <div style="font-size:12px;color:var(--muted);">Debés resolver cada ticket antes de cerrar caja</div>
        </div>
      </div>
      <div style="margin-bottom:14px;">
        ${pendActivos.map(t => {
          const idx = pendientes.indexOf(t);
          return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);">
            <div style="flex:1;">
              <div style="font-size:13px;font-weight:700;color:var(--text);">#${String(t.nro).padStart(4,'0')}${t.obs?' — '+t.obs:''}</div>
              <div style="font-size:11px;color:var(--muted);">${t.cart.length} art. · ${gs(t.total)}</div>
            </div>
            <button onclick="marcarPresupuesto(${idx},true)" style="padding:6px 10px;border-radius:6px;border:1.5px solid var(--border);background:transparent;color:var(--muted);font-family:'Barlow',sans-serif;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> Presupuesto
            </button>
            ${t.esSatelite ? `<button onclick="cancelarPedidoSatelite(${idx})" style="padding:6px 10px;border-radius:6px;border:none;background:rgba(244,67,54,.15);color:#f44336;font-family:'Barlow',sans-serif;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Anular</button>` : ''}
            <button onclick="abrirPendienteYCerrarModal(${idx})" style="padding:6px 10px;border-radius:6px;border:none;background:var(--green);color:#fff;font-family:'Barlow',sans-serif;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">
              Abrir
            </button>
          </div>`;
        }).join('')}
      </div>
      <div style="font-size:12px;color:var(--muted);background:var(--bg-dark);border-radius:8px;padding:10px;margin-bottom:14px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.74V17h8v-2.26A7 7 0 0 0 12 2z"/></svg> Marcá como <b style="color:var(--text);">Presupuesto</b> los tickets que no se van a cobrar hoy.
      </div>
      <button onclick="document.getElementById('pendCierreOv').remove()"
        style="width:100%;padding:14px;border-radius:8px;border:1.5px solid var(--border);background:transparent;color:var(--text);font-family:'Barlow',sans-serif;font-size:13px;font-weight:700;cursor:pointer;">
        Volver y resolver
      </button>
    </div>`;
  document.body.appendChild(ov);
}

function abrirPendienteYCerrarModal(idx){
  const ov = document.getElementById('pendCierreOv');
  if(ov) ov.remove();
  cargarTicket(idx);
}

async function cancelarPedidoSatelite(idx){
  const t = pendientes[idx];
  if(!t || !t.esSatelite) return;

  if(t.supabasePedidoId){
    try{
      await supaPatch('pos_pedidos', 'id=eq.'+t.supabasePedidoId, {estado:'cancelado'}, true);
    } catch(e){ console.warn('[cancelarPedido]', e.message); }
  }

  pendientes.splice(idx, 1);
  guardarPendientesLocal();
  if(typeof updBtnGuardar === 'function') updBtnGuardar();

  const ov = document.getElementById('pendCierreOv');
  if(ov) ov.remove();

  toast('Pedido de satélite anulado');

  // Re-evaluar: si no quedan pendientes activos, continuar al cierre
  const restantes = pendientes.filter(p => !p.esPresupuesto);
  if(restantes.length > 0){
    _mostrarModalPendientesCierre(restantes);
  } else {
    cerrarTurno();
  }
}

function imprimirPresupuesto(idx){
  const t = pendientes[idx];
  if(!t) return;
  const size = getPaperSize('ticket');
  const cols = size==='58' ? 32 : 42;
  const sep  = '-'.repeat(cols);
  const neg  = configData.negocio   || 'MI NEGOCIO';
  const ruc  = configData.ruc       || '';
  const dir  = configData.direccion || '';
  const tel  = configData.telefono  || '';

  const ahora = new Date();
  const pad = n=>String(n).padStart(2,'0');
  const fecha = pad(ahora.getDate())+'/'+pad(ahora.getMonth()+1)+'/'+ahora.getFullYear();
  const hora  = pad(ahora.getHours())+':'+pad(ahora.getMinutes());

  let lineas = '';
  lineas += '<p class="c b" style="font-size:1.3em;letter-spacing:2px;">PRESUPUESTO</p>';
  lineas += '<p class="hr"></p>';
  lineas += '<p class="c b">'+neg+'</p>';
  if(ruc) lineas += '<p class="c s">RUC: '+ruc+'</p>';
  if(dir) lineas += '<p class="c s">'+dir+'</p>';
  if(tel) lineas += '<p class="c s">Tel: '+tel+'</p>';
  lineas += '<p class="hr"></p>';
  lineas += '<p class="s">NRO: #'+String(t.nro||idx+1).padStart(4,'0')+'</p>';
  lineas += '<p class="s">FECHA: '+fecha+' HORA: '+hora+'</p>';
  if(t.obs) lineas += '<p class="s">REF: '+t.obs+'</p>';
  lineas += '<p class="hr"></p>';

  // Items
  const c2 = size==='58' ? 20 : 28;
  const c3 = size==='58' ? 5  : 7;
  const c4 = size==='58' ? 7  : 9;
  lineas += '<p class="s b">'+padL('DESCRIPCION',c2)+' '+padR('CANT',c3)+' '+padR('TOTAL',c4)+'</p>';
  lineas += '<p class="hr"></p>';

  let total = 0;
  (t.cart||[]).forEach(it=>{
    const nombre = (it.name||it.nombre||'').substring(0,c2);
    const subtot = (it.price||it.precio||0)*(it.qty||1);
    total += subtot;
    lineas += '<p class="s">'+padL(nombre,c2)+' '+padR(String(it.qty||1),c3)+' '+padR(gs(subtot),c4)+'</p>';
    if(it.obs) lineas += '<p class="s" style="padding-left:4px;color:#777;">  ↳ '+it.obs+'</p>';
  });

  lineas += '<p class="hr"></p>';
  lineas += '<p class="row b"><span class="l1">TOTAL PRESUPUESTADO</span><span class="l2">'+gs(total)+'</span></p>';
  lineas += '<p class="hr"></p>';
  lineas += '<p class="c s" style="margin-top:8px;">Este presupuesto no es una factura.</p>';
  lineas += '<p class="c s">Válido sujeto a confirmación.</p>';

  const html = '<html><head><style>'+getCSSTermico(size)+'</style></head><body>' + lineas + '</body></html>';

  // Abrir preview en recibo
  mostrarPreviewRecibo(html, size);
  const titulo = document.getElementById('reciboTitulo');
  if(titulo) titulo.textContent = 'Presupuesto';
  goTo('scRecibo');
}

function abrirPendienteDesdeVentas(i){
  // Cargar el ticket y navegar a scSale — reutiliza cargarTicket()
  cargarTicket(i);
  // cargarTicket ya hace goTo('scSale'), pero venimos de scVentas
  // así que forzamos la navegación correcta
}

function descartarPendiente(i){
  const t = pendientes[i];
  if(!t) return;
  if(!confirm('¿Descartar el ticket #'+String(t.nro).padStart(4,'0')+'? Se eliminará de la lista de pendientes.')) return;
  // Si es pedido satélite, marcar como cancelado en Supabase para que no vuelva al sync
  if(t.esSatelite && t.supabasePedidoId){
    supaPatch('pos_pedidos', 'id=eq.'+t.supabasePedidoId, {estado:'cancelado', updated_at: new Date().toISOString()}, true)
      .catch(e => console.warn('[descartarPendiente] Error cancelando en Supabase:', e.message));
  }
  // Si es el ticket activo actualmente, limpiar carrito
  if(currentTicketNro === t.nro){
    clearCart();
    setCurrentTicketNro(null);
    updUI();
    updBtnGuardar();
  }
  removePendiente(i);
  try{ localStorage.setItem('pos_pendientes', JSON.stringify(pendientes)); }catch(e){ /* safe: pendientes persist best-effort */ }
  toast('Ticket descartado');
  renderVentasList();
}

async function anularEgreso(idx){
  const e = turnoData.egresos[idx];
  if(!e || e.anulada) return;

  // Mostrar confirmación
  const prev = document.getElementById('anulEgresoOv');
  if(prev) prev.remove();
  const ov = document.createElement('div');
  ov.id = 'anulEgresoOv';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:500;display:flex;align-items:flex-end;';
  ov.innerHTML = `
    <div style="background:var(--bg-card);width:100%;border-radius:16px 16px 0 0;padding:20px;animation:su .25s ease;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
        <div style="width:38px;height:38px;border-radius:50%;background:rgba(239,83,80,.12);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef5350" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        </div>
        <div>
          <div style="font-size:15px;font-weight:800;color:var(--text);">Anular egreso</div>
          <div style="font-size:12px;color:var(--muted);">${e.desc} · ${gs(e.monto)}</div>
        </div>
      </div>
      <div style="background:var(--bg-dark);border-radius:8px;padding:10px 12px;margin-bottom:16px;font-size:13px;color:var(--muted);">
        El monto <b style="color:var(--text);">${gs(e.monto)}</b> volverá a sumarse al saldo esperado en caja. El egreso quedará registrado como anulado.
      </div>
      <div style="display:flex;gap:10px;">
        <button onclick="document.getElementById('anulEgresoOv').remove()"
          style="flex:1;padding:14px;border-radius:8px;border:1.5px solid var(--border);background:transparent;color:var(--muted);font-family:'Barlow',sans-serif;font-size:13px;font-weight:700;cursor:pointer;">
          Cancelar
        </button>
        <button onclick="anularEgresoConfirmar(${idx})"
          style="flex:2;padding:14px;border-radius:8px;border:none;background:#ef5350;color:#fff;font-family:'Barlow',sans-serif;font-size:13px;font-weight:800;cursor:pointer;">
          Anular egreso
        </button>
      </div>
    </div>`;
  document.body.appendChild(ov);
}

async function anularEgresoConfirmar(idx){
  const e = turnoData.egresos[idx];
  if(!e) return;

  // Marcar como anulado en memoria
  e.anulada = true;
  e.fecha_anulacion = new Date().toISOString();
  turnoGuardar();

  // Marcar como anulado en IndexedDB si tiene dbId
  if(db && e.dbId){
    try {
      await db.egresos.update(e.dbId, { anulada: 1, fecha_anulacion: e.fecha_anulacion });
    } catch(err){ console.warn('[Egreso] Error al anular en DB:', err.message); }
  }

  const ov = document.getElementById('anulEgresoOv');
  if(ov) ov.remove();

  toast('Egreso anulado · '+gs(e.monto)+' devuelto al saldo');
  renderTurno();
}

function cerrarTurno(){
  // ── Validar pendientes ────────────────────────────────────
  const pendientesActivos = pendientes.filter(p => !p.esPresupuesto);
  if(pendientesActivos.length > 0){
    _mostrarModalPendientesCierre(pendientesActivos);
    return;
  }

  const metodos = {};
  const acumCierre = (m, monto) => {
    m = (m||'EFECTIVO').toUpperCase().trim();
    if(!metodos[m]) metodos[m]={esperado:0,contado:0};
    metodos[m].esperado += monto;
  };
  turnoData.ventas.forEach(v=>{
    if(v.divPagos && v.divPagos.length > 0){
      v.divPagos.forEach(p => acumCierre(p.metodo, p.monto||0));
    } else if(v.metodo && v.metodo.includes(' + ')){
      const partes = v.metodo.split(' + ');
      const montoParte = Math.round(v.total / partes.length);
      partes.forEach((p,i) => {
        const m = i===partes.length-1 ? v.total-montoParte*(partes.length-1) : montoParte;
        acumCierre(p, m);
      });
    } else {
      acumCierre(v.metodo, v.total);
    }
  });
  if(!metodos['EFECTIVO'])metodos['EFECTIVO']={esperado:0,contado:0};
  metodos['EFECTIVO'].esperado += turnoData.efectivoInicial;
  metodos['EFECTIVO'].esperado -= turnoData.egresos.filter(e=>!e.anulada).reduce((s,e)=>s+e.monto,0);
  cierreTotal = 0; desgloseVisible = false;
  cierreArqueoGS = 0; cierreArqueoBRL = 0; cierreArqueoARS = 0;
  const _td = document.getElementById('cierreVal_TOTAL'); if(_td) _td.textContent='₲0';
  const _db = document.getElementById('cierreDiffBox'); if(_db) _db.style.display='none';
  const _mr = document.getElementById('cierreMetodosRows'); if(_mr) _mr.style.display='none';
  const _btn = document.getElementById('desgloseBtn'); if(_btn) _btn.textContent='▸ DESGLOSAR POR MÉTODO (opcional)';
  cierreMetodos = metodos;
  cierreNpMetodo = null;
  cierreTotal = 0;
  desgloseVisible = false;

  // Multi-moneda: actualizar label del campo GS y mostrar sección si está activo
  var _mmActArqueo = localStorage.getItem('mm_activo') === '1';
  var _lblArqueo = document.getElementById('cierreLabelTotal');
  if(_lblArqueo) _lblArqueo.innerHTML = _mmActArqueo
    ? '<span style="color:#4fc3f7;font-weight:700;">SOLO billetes ₲ Guaraníes</span> <span style="color:#f44336;font-size:11px;font-weight:600;">(NO incluir moneda extranjera acá)</span>'
    : 'Total contado <span style="color:#555;font-size:11px;">(opcional — dejá en 0 para omitir)</span>';
  var _mmSecEl = document.getElementById('cierreMMSection');
  if(_mmSecEl){
    _mmSecEl.style.display = _mmActArqueo ? 'block' : 'none';
    if(_mmActArqueo) renderCierreMMArqueo();
  }

  // Mostrar saldo esperado de referencia
  const saldo = calcSaldoEsperado();
  const refEl = document.getElementById('cierreSaldoRef');
  if(refEl) refEl.textContent = 'Saldo esperado: ' + gs(saldo);
  const dispEl = document.getElementById('cierreTotalDisp');
  if(dispEl) dispEl.textContent = '₲0';

  document.getElementById('cierreDiffBox').style.display='none';
  renderCierreMetodosRows();
  renderCierreResumen();
  goTo('scCierre');

  // Voz: saludo corto al entrar a la pantalla de cierre
  if(typeof hablarCierreInicio === 'function'){
    setTimeout(hablarCierreInicio, 500);
  }
}

// Botón "<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg> Escuchar valores esperados" — recita los montos por método
function escucharValoresEsperados(){
  if(typeof hablarValoresEsperados === 'function'){
    hablarValoresEsperados(cierreMetodos, calcSaldoEsperado());
  }
}

let cierreMetodos = {};
let cierreNpMetodo = null;
let cierreTotal = 0;
let cierreArqueoGS = 0;
let cierreArqueoBRL = 0;
let cierreArqueoARS = 0;
let desgloseVisible = false;

function toggleDesglose(){
  desgloseVisible = !desgloseVisible;
  document.getElementById('cierreMetodosRows').style.display = desgloseVisible ? 'block' : 'none';
  document.getElementById('desgloseArrow').style.transform = desgloseVisible ? 'rotate(180deg)' : '';
}

function calcSaldoEsperado(){
  const totalVentas = turnoData.ventas.reduce((s,v)=>s+v.total,0);
  const totalEgresos = turnoData.egresos.filter(e=>!e.anulada).reduce((s,e)=>s+e.monto,0);
  const totalIngresos = turnoData.ingresos.reduce((s,i)=>s+i.monto,0);
  return turnoData.efectivoInicial + totalVentas + totalIngresos - totalEgresos;
}

const METODO_ICONS = {
  'EFECTIVO':'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></svg>',
  'POS':'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',
  'TRANSFERENCIA':'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="9" x2="22" y2="9"/></svg>',
};

function renderCierreMetodosRows(){
  const cont = document.getElementById('cierreMetodosRows');
  if(!cont) return;
  cont.innerHTML = '';
  Object.entries(cierreMetodos).forEach(([m, d]) => {
    const row = document.createElement('div');
    row.className = 'cierre-metodo-row';

    const icon = METODO_ICONS[m] || METODO_ICONS['EFECTIVO'];
    const inputDiv = document.createElement('div');
    inputDiv.className = 'cierre-metodo-input';
    inputDiv.style.cursor = 'pointer';
    inputDiv.onclick = () => openNP('cierre_' + m);
    inputDiv.innerHTML =
      '<span class="cierre-metodo-val" id="cierreVal_' + m + '">' + (d.contado > 0 ? gs(d.contado) : '₲0') + '</span>' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#777" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';

    row.innerHTML =
      '<div class="cierre-metodo-icon">' + icon + '</div>' +
      '<div class="cierre-metodo-info">' +
        '<div class="cierre-metodo-name">' + m + '</div>' +
        '<div class="cierre-metodo-esperado">Esperado: ' + gs(d.esperado) + '</div>' +
      '</div>';
    row.appendChild(inputDiv);
    cont.appendChild(row);
  });
}

function renderCierreResumen(){
  const totalVentas = turnoData.ventas.reduce((s,v)=>s+v.total,0);
  const totalEgresos = turnoData.egresos.filter(e=>!e.anulada).reduce((s,e)=>s+e.monto,0);
  const saldoEsperado = calcSaldoEsperado();
  const cantVentas = turnoData.ventas.length;
  const pad = n => String(n).padStart(2,'0');
  const fmt = d => d ? pad(d.getDate())+'/'+pad(d.getMonth()+1)+'/'+d.getFullYear()+' '+pad(d.getHours())+':'+pad(d.getMinutes()) : '—';

  // Totales por método — manejar divPagos igual que renderTurno
  const metodos = {};
  const acumResumen = (m, monto) => {
    m = (m || 'EFECTIVO').toUpperCase().trim();
    if(!metodos[m]) metodos[m] = { total: 0, ops: 0 };
    metodos[m].total += monto;
    metodos[m].ops++;
  };
  turnoData.ventas.forEach(v => {
    if(v.divPagos && v.divPagos.length > 0){
      v.divPagos.forEach(p => acumResumen(p.metodo, p.monto || 0));
    } else if(v.metodo && v.metodo.includes(' + ')){
      const partes = v.metodo.split(' + ');
      const montoParte = Math.round(v.total / partes.length);
      partes.forEach((p, i) => {
        const m = i === partes.length - 1 ? v.total - montoParte * (partes.length - 1) : montoParte;
        acumResumen(p, m);
      });
    } else {
      acumResumen(v.metodo, v.total);
    }
  });

  let html = '';
  html += '<div class="cierre-resumen-row"><span class="cierre-resumen-lbl">Apertura</span><span class="cierre-resumen-val">'+fmt(turnoData.fechaApertura)+'</span></div>';
  html += '<div class="cierre-resumen-row"><span class="cierre-resumen-lbl">Efectivo inicial</span><span class="cierre-resumen-val">'+gs(turnoData.efectivoInicial)+'</span></div>';
  html += '<div class="cierre-resumen-row"><span class="cierre-resumen-lbl">Total ventas ('+cantVentas+')</span><span class="cierre-resumen-val" style="color:var(--green)">'+gs(totalVentas)+'</span></div>';
  Object.entries(metodos).forEach(([m,d])=>{
    html += '<div class="cierre-resumen-row" style="padding:6px 14px 6px 24px;"><span class="cierre-resumen-lbl" style="color:#666;">'+m+' ('+d.ops+')</span><span class="cierre-resumen-val" style="color:#888;">'+gs(d.total)+'</span></div>';
  });
  if(totalEgresos>0)
    html += '<div class="cierre-resumen-row"><span class="cierre-resumen-lbl">Total egresos</span><span class="cierre-resumen-val" style="color:#ef5350;">−'+gs(totalEgresos)+'</span></div>';
  html += '<div class="cierre-resumen-row" style="background:rgba(76,175,80,.06)"><span class="cierre-resumen-lbl" style="font-weight:700;">Saldo esperado</span><span class="cierre-resumen-val" style="color:var(--green);font-size:15px;">'+gs(saldoEsperado)+'</span></div>';
  document.getElementById('cierreResumen').innerHTML = html;
}

function updCierreDiff(){
  const saldoEsperado = calcSaldoEsperado();
  if(cierreTotal === 0){ document.getElementById('cierreDiffBox').style.display='none'; return; }
  const diff = cierreTotal - saldoEsperado;
  const box = document.getElementById('cierreDiffBox');
  const lbl = document.getElementById('cierreDiffLbl');
  const val = document.getElementById('cierreDiffVal');
  box.style.display = 'flex';
  box.className = 'cierre-diff-box';
  lbl.className = 'cierre-diff-lbl';
  val.className = 'cierre-diff-val';
  if(diff === 0){
    box.classList.add('ok'); lbl.classList.add('ok'); val.classList.add('ok');
    lbl.textContent = 'CUADRE EXACTO';
    val.textContent = gs(0);
  } else if(diff > 0){
    box.classList.add('sobrante'); lbl.classList.add('sobrante'); val.classList.add('sobrante');
    lbl.textContent = 'SOBRANTE';
    val.textContent = '+'+gs(diff);
  } else {
    box.classList.add('faltante'); lbl.classList.add('faltante'); val.classList.add('faltante');
    lbl.textContent = 'FALTANTE';
    val.textContent = '−'+gs(Math.abs(diff));
  }
}

function renderCierreMMArqueo(){
  var cotBRL = parseFloat(localStorage.getItem('mm_cotBRL')) || 0;
  var cotARS = parseFloat(localStorage.getItem('mm_cotARS')) || 0;
  var rows = document.getElementById('cierreMMRows');
  if(!rows) return;
  var brlGs = Math.round(cierreArqueoBRL * cotBRL);
  var arsGs = Math.round(cierreArqueoARS * cotARS);
  var html = '';
  // Fila Reales
  html += '<div onclick="openNP(\'cierre_arq_BRL\')" style="display:flex;align-items:center;border-bottom:1.5px solid #555;padding-bottom:8px;cursor:pointer;margin-bottom:12px;">';
  html += '<div style="flex:1;">';
  html += '<div style="font-size:11px;color:#888;margin-bottom:3px;">&#127463;&#127479; Reales (R$)</div>';
  html += '<span id="cierreVal_BRL" style="font-size:22px;font-weight:700;color:#fff;">R$ '+cierreArqueoBRL+'</span>';
  if(cotBRL > 0 && cierreArqueoBRL > 0) html += '<span style="color:#666;font-size:11px;margin-left:8px;">&times; '+gs(cotBRL)+' = '+gs(brlGs)+'</span>';
  html += '</div>';
  html += '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#777" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';
  html += '</div>';
  // Fila Pesos Arg.
  html += '<div onclick="openNP(\'cierre_arq_ARS\')" style="display:flex;align-items:center;border-bottom:1.5px solid #555;padding-bottom:8px;cursor:pointer;margin-bottom:12px;">';
  html += '<div style="flex:1;">';
  html += '<div style="font-size:11px;color:#888;margin-bottom:3px;">&#127462;&#127479; Pesos Arg. ($)</div>';
  html += '<span id="cierreVal_ARS" style="font-size:22px;font-weight:700;color:#fff;">$ '+cierreArqueoARS+'</span>';
  if(cotARS > 0 && cierreArqueoARS > 0) html += '<span style="color:#666;font-size:11px;margin-left:8px;">&times; '+cotARS+' = '+gs(arsGs)+'</span>';
  html += '</div>';
  html += '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#777" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';
  html += '</div>';
  rows.innerHTML = html;
  // Total moneda extranjera
  var totalMM = document.getElementById('cierreMMTotal');
  if(totalMM){
    if(cierreArqueoBRL > 0 || cierreArqueoARS > 0){
      totalMM.innerHTML = '<div style="display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid #333;"><span style="color:#aaa;font-size:12px;font-weight:600;">Total moneda extranjera equiv.</span><span style="color:var(--green);font-weight:700;">'+gs(brlGs+arsGs)+'</span></div>';
    } else {
      totalMM.innerHTML = '';
    }
  }
}

function updCierreMMTotal(){
  var cotBRL = parseFloat(localStorage.getItem('mm_cotBRL')) || 0;
  var cotARS = parseFloat(localStorage.getItem('mm_cotARS')) || 0;
  var brlGs = Math.round(cierreArqueoBRL * cotBRL);
  var arsGs = Math.round(cierreArqueoARS * cotARS);
  cierreTotal = cierreArqueoGS + brlGs + arsGs;
  // Actualizar display del campo GS (muestra el GS contado, no el total)
  var dispGS = document.getElementById('cierreVal_TOTAL');
  if(dispGS) dispGS.textContent = gs(cierreArqueoGS);
  renderCierreMMArqueo();
  updCierreDiff();
}
