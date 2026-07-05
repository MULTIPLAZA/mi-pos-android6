// ============================================================
// ventas.js — Lógica de ventas, tickets y pagos
// Ampersand POS
// ============================================================
// Este módulo maneja:
//   - Estado del carrito (cart, tipoPedido, descuentos)
//   - Tickets pendientes
//   - Cobro simple y pago dividido
//   - Cálculos de totales
// ============================================================

// gs, toast, goTo → disponibles globalmente desde js/ui.js
// Parchear goTo para trackear pantalla actual y manejar historial
(function patchGoTo(){
  if(typeof goTo === 'function' && !goTo._parchado){
    var _orig = goTo;
    window.goTo = function(sc){
      _orig(sc);
      if(window._goToWrapper) window._goToWrapper(sc);
    };
    window.goTo._parchado = true;
  } else if(typeof goTo === 'undefined'){
    // ui.js aún no cargó — reintentar después
    setTimeout(patchGoTo, 50);
  }
})();

// ── ESTADO ──────────────────────────────────────────────────
// Variables globales centralizadas en js/state.js
// (cart, ticketDescuento, currentTicketNro, ticketCounter,
//  tipoPedido, pendientes, showTkt, npCtx, npVal,
//  divPagos, divNpIdx, divMethodIdx, PAY_METHODS, mesaActual)
// curCat → js/state.js

// ── CARRITO ─────────────────────────────────────────────────

// ── LONG-PRESS en tiles de producto ──
// Tap corto: agrega al carrito (rápido)
// Long-press (500ms): abre flujo completo con mitades/modificadores opcionales
var _longPressTimer = null;
var _longPressFired = false;

function _setupLongPressGrid(){
  var grid = document.getElementById('pgrid');
  if(!grid || grid._longPressSetup) return;
  grid._longPressSetup = true;

  function iniciarLongPress(e, tile){
    _longPressFired = false;
    clearTimeout(_longPressTimer);
    _longPressTimer = setTimeout(function(){
      _longPressFired = true;
      // Extraer el id del producto del onclick del tile
      var onclickStr = tile.getAttribute('onclick') || '';
      var m = onclickStr.match(/addCart\((\d+)/);
      if(!m) return;
      var id = parseInt(m[1]);
      var p = PRODS.find(function(x){ return x.id === id; });
      if(!p || p.esInsumo) return;
      // Abrir el flujo completo
      var mods = typeof modificadores !== 'undefined'
        ? modificadores.filter(function(mm){ return mm.productos && mm.productos.includes(p.id); })
        : [];
      if((p.mitad || mods.length > 0) && typeof abrirFlujoPizza === 'function'){
        if(navigator.vibrate) navigator.vibrate(30);
        abrirFlujoPizza(p, mods.length > 0);
      }
    }, 500);
  }

  function cancelarLongPress(){
    clearTimeout(_longPressTimer);
  }

  grid.addEventListener('touchstart', function(e){
    var tile = e.target.closest('.ptile');
    if(tile) iniciarLongPress(e, tile);
  }, { passive: true });
  grid.addEventListener('touchend', cancelarLongPress);
  grid.addEventListener('touchmove', cancelarLongPress);
  grid.addEventListener('touchcancel', cancelarLongPress);
  // Mouse para desktop
  grid.addEventListener('mousedown', function(e){
    var tile = e.target.closest('.ptile');
    if(tile) iniciarLongPress(e, tile);
  });
  grid.addEventListener('mouseup', cancelarLongPress);
  grid.addEventListener('mouseleave', cancelarLongPress);

  // Prevenir que el onclick dispare si ya se ejecutó el long-press
  grid.addEventListener('click', function(e){
    if(_longPressFired){
      e.stopPropagation();
      e.preventDefault();
      _longPressFired = false;
    }
  }, true);
}

// Inicializar cuando el DOM esté listo
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', _setupLongPressGrid);
} else {
  _setupLongPressGrid();
}

function addCart(id, tileEl){
  // Bloqueo modo lectura — no se puede agregar a una venta ya cobrada
  if(typeof _modoLectura !== 'undefined' && _modoLectura){
    if(typeof toast === 'function') toast('Venta cobrada — apretá NUEVA VENTA para empezar otra');
    return;
  }
  const p=PRODS.find(x=>x.id===id); if(!p)return;
  if(p.esInsumo){
    if(typeof toast === 'function') toast('No se puede vender un insumo');
    return;
  }
  if(p.esKilo){ addCartConPeso(id); return; }
  if(p.precioVariable){ addCartConPrecioVariable(id); return; }

  // Detectar modificadores del producto
  var mods = typeof modificadores !== 'undefined'
    ? modificadores.filter(m => m.productos && m.productos.includes(p.id))
    : [];
  var tieneModif = mods.length > 0;
  var tieneModifObligatorio = mods.some(m => m.obligatorio);

  // Abrir flujo SOLO si hay modificadores obligatorios.
  // Si el producto tiene mitad o modificadores opcionales, se agrega
  // como entera/sin modificadores directamente (tap rápido).
  // Para acceder al flujo completo (mitad, modificadores opcionales),
  // el usuario debe usar long-press sobre el tile.
  if(tieneModifObligatorio && typeof abrirFlujoPizza === 'function'){
    abrirFlujoPizza(p, tieneModif);
    if(tileEl) animAddToCart(tileEl, getProductColor(p));
    return;
  }

  // Producto simple
  const existing = cart.find(l=>l.id===id && !l.obs && !l.enviado);
  if(existing){
    existing.qty++;
  } else {
    cart.push({lineId:Date.now()*1000+Math.floor(Math.random()*1000), ...p, qty:1, obs:'', enviado:false});
  }
  updUI(); updBtnGuardar(); toast('+'+p.name.substring(0,16));
  if(typeof sndTap === 'function') sndTap();
  if(showTkt)renderTkt();
  if(tileEl) animAddToCart(tileEl, getProductColor(p));
  if(typeof avisarStockSiCorresponde === 'function') avisarStockSiCorresponde(p);
}
function chgQty(lineId,d){
  if(typeof _modoLectura !== 'undefined' && _modoLectura){
    if(typeof toast === 'function') toast('Venta cobrada — solo lectura');
    return;
  }
  const idx=cart.findIndex(l=>l.lineId===lineId);
  if(idx<0)return;
  if(cart[idx].esDelivery) return;
  if(cart[idx].esKilo){
    if(d > 0){ addCartConPeso(cart[idx].id); return; }
    cart.splice(idx, 1);
    updUI(); updBtnGuardar();
    if(showTkt) renderTkt();
    return;
  }
  cart[idx].qty+=d;
  if(cart[idx].qty<=0) cart.splice(idx,1);
  updUI(); updBtnGuardar(); renderTkt();
}

function calcItemTotal(item) {
  if (item.esDescuento) return item.price;
  const base = item.price * item.qty;
  if (item.desc && item.desc > 0) return Math.round(base * (1 - item.desc / 100));
  // Redondear: en venta por peso, price × qty puede ser fraccionario
  // (ej. 6000 × 0.83333 = 4999.98) y debe cerrar en Gs entero.
  return Math.round(base);
}

function calcSubtotal() {
  return cart.filter(i => !i.esDescuento).reduce((s, i) => s + calcItemTotal(i), 0);
}

function calcTotalDescuentos() {
  return cart.filter(i => i.esDescuento).reduce((s, i) => s + (i.montoDesc || 0), 0);
}

function calcTotal() {
  const sub = calcSubtotal();
  const desc = calcTotalDescuentos();
  const conTicketDesc = ticketDescuento > 0 ? Math.round(sub * (1 - ticketDescuento / 100)) : sub;
  return conTicketDesc - desc;
}

function calcDescuentoMonto() { return calcSubtotal() - calcTotal(); }

function vaciarTicket(){
  if(!cart.length) return;
  // Si es un ticket guardado siendo editado, confirmar antes de vaciar
  if(currentTicketNro !== null){
    if(!confirm('¿Vaciar el ticket #'+String(currentTicketNro).padStart(4,'0')+'? Los cambios no se guardarán.')) return;
  }
  _cartEnCursoNavSnap = null; // vaciar rompe el flujo de navegacion
  clearCart(); resetTicketDescuento(); setCurrentTicketNro(null); clearMesaActual();
  setTipoPedido('llevar'); updTabTicketHeader(); updMesaBtn?.();
  const dBar=document.getElementById('tabDeliveryBar'); if(dBar)dBar.classList.remove('visible');
  updUI(); updBtnGuardar(); goTo('scSale'); toast('Ticket vaciado');
}

// ── TIPO DE PEDIDO ──────────────────────────────────────────

function setTipoPedido(tipo) {
  tipoPedido = tipo;
  ['local', 'llevar', 'delivery'].forEach(function (t) {
    const btn = document.getElementById('tipoBtn' + t.charAt(0).toUpperCase() + t.slice(1));
    if (btn) btn.classList.toggle('sel', t === tipo);
  });
  ['local', 'llevar', 'delivery'].forEach(function (t) {
    const btn = document.getElementById('mobTipoBtn' + t.charAt(0).toUpperCase() + t.slice(1));
    if (btn) btn.classList.toggle('sel', t === tipo);
  });
  const bar = document.getElementById('tabDeliveryBar');
  if (bar) bar.classList.toggle('visible', tipo === 'delivery');
  const mobBar = document.getElementById('mobDeliveryBar');
  if (mobBar) mobBar.style.display = tipo === 'delivery' ? 'flex' : 'none';
  if (tipo !== 'delivery') quitarItemDelivery(null, null);
}

function quitarItemDelivery(){
  const idx=cart.findIndex(i=>i.esDelivery); if(idx>=0){cart.splice(idx,1); updUI(); updBtnGuardar();}
}

function agregarMontoDelivery(){
  const inp=document.getElementById('tabDeliveryMonto');
  const monto=parseInt((inp||{}).value||0)||0;
  if(!monto||monto<=0){toast('Ingresá el monto del envío');inp&&inp.focus();return;}
  quitarItemDelivery();
  cart.push({lineId:Date.now()*1000+999,id:'delivery_item',name:'Envío delivery',price:monto,qty:1,obs:'',iva:'10',esDelivery:true,color:'#e65100',colorPropio:true,enviado:false});
  updUI(); updBtnGuardar(); toast('Envío ₲'+monto.toLocaleString('es-PY')+' agregado'); if(inp)inp.value='';
}

// ── TICKETS PENDIENTES ───────────────────────────────────────

function guardarPendientesLocal() {
  try { localStorage.setItem('pos_pendientes', JSON.stringify(pendientes)); } catch (e) { }
}

function updTabTicketHeader() {
  updMesaBtn?.();
  const nro = currentTicketNro !== null
    ? String(currentTicketNro).padStart(4, '0')
    : String(ticketCounter).padStart(4, '0');
  // Solo el numero — la mesa ya se ve en el boton verde abajo, no repetir
  const nroEl = document.getElementById('tabTicketNro');
  if (nroEl) nroEl.textContent = '#' + nro;
  const mobNroEl = document.getElementById('mobTicketNro');
  if (mobNroEl) mobNroEl.textContent = '#' + nro;
  // El nombre del cliente se muestra dentro del cart (renderTkt/renderTabletTicket),
  // no en el header — para no invadir la pantalla con el dato repetido.
  if (typeof renderTkt === 'function') renderTkt();
  if (typeof renderTabletTicket === 'function') renderTabletTicket();
  // Refrescar badge de estado + flechas de navegacion + boton COBRAR/REIMPRIMIR
  if (typeof actualizarBadgeEstado === 'function') actualizarBadgeEstado();
  if (typeof actualizarBotonCobrarLectura === 'function') actualizarBotonCobrarLectura();
}

// ══════════════════════════════════════════════════════════════════════════════
// NAVEGACION ENTRE TICKETS (flechas en el header)
// ══════════════════════════════════════════════════════════════════════════════
// Lista combinada del turno actual:
//   1. Cart en curso (si tiene items y no se esta editando un pendiente)
//   2. Pendientes (no cobrados)
//   3. Ventas cobradas del turno
// Ordenadas por fecha descendente (mas reciente primero).
// Las flechas dejan navegar por todo. Pendiente y En Curso son editables;
// Cobrada/Anulada muestran un modal de solo-lectura con opcion de reimprimir.
// ══════════════════════════════════════════════════════════════════════════════
var _ticketViewMode = 'edit'; // 'edit' (cart normal) | 'readonly' (modal venta cobrada)
// Cuando estamos viendo una venta cobrada en el modal, recordamos su indice
// en la lista navegable. Asi un nuevo ◀/▶ avanza desde esa posicion, en vez
// de volver a calcular desde currentTicketNro (que sigue apuntando al cart).
// Se resetea al cerrar el modal o al volver a un ticket editable.
var _ticketNavViewingIdx = -1;
// Snapshot del cart en curso cuando se navega a un pendiente por flecha.
// Distinto de _cartEnCursoSnap (que es para MODO LECTURA de cobradas).
// Vive hasta que: (a) el usuario vuelve al "enCurso" con ▶ — se restaura;
// (b) el usuario abandona la nav (click en pendiente, cobra, nuevaVenta) — se descarta.
var _cartEnCursoNavSnap = null;

function _ticketsNavegables(){
  var lista = [];
  // 1. Ventas cobradas del turno (las mas viejas tipicamente)
  if(typeof turnoData !== 'undefined' && turnoData.ventas){
    turnoData.ventas.forEach(function(v){
      lista.push({
        tipo:     v.anulada ? 'anulada' : 'cobrada',
        nro:      v.nroTicket,
        ventaId:  v.dbId,
        fecha:    v.fecha ? new Date(v.fecha).getTime() : 0,
        nomCli:   v.clienteNombre || '',
      });
    });
  }
  // 2. Pendientes locales (incluye satelites)
  if(typeof pendientes !== 'undefined'){
    pendientes.forEach(function(p, i){
      lista.push({
        tipo: p.esPresupuesto ? 'presupuesto' : (p.esSatelite ? 'satelite' : 'pendiente'),
        nro:  p.nro,
        idx:  i,
        fecha: p.fecha ? new Date(p.fecha).getTime() : 0,
        nomCli: p.clienteNombre || '',
      });
    });
  }
  // 3. Cart en curso al FINAL — siempre presente para que la cajera pueda
  // volver a su cart en curso desde una venta cobrada/anulada (modo lectura).
  // Si esta en modo lectura, el cart vivo es la cobrada → usamos snapshot
  // pre-lectura como referencia. Si no, el cart vivo (incluso vacio o con
  // pendiente cargado) es lo que vamos a tener al volver.
  if(typeof _modoLectura !== 'undefined' && _modoLectura){
    // Modo lectura activo — agregamos 'enCurso' si habia algo antes
    if(typeof _cartEnCursoSnap !== 'undefined' && _cartEnCursoSnap){
      lista.push({
        tipo:    'enCurso',
        nro:     ticketCounter,
        fecha:   Date.now(),
        snapshot: true,
      });
    }
  } else {
    // No modo lectura
    if(_cartEnCursoNavSnap && currentTicketNro !== null){
      // Estamos editando un pendiente PERO hay cart en curso guardado
      // por nav con flechas — mostrarlo en la lista para poder volver.
      lista.push({
        tipo:    'enCurso',
        nro:     _cartEnCursoNavSnap.nro || ticketCounter,
        fecha:   Date.now(),
        snapshot: true,
      });
    } else if(typeof cart !== 'undefined' && cart && cart.length > 0 && currentTicketNro === null){
      // Cart vivo (no proviene de pendiente) — el "enCurso" natural
      lista.push({ tipo:'enCurso', nro:ticketCounter, fecha:Date.now() });
    } else if(currentTicketNro === null){
      // Cart vacio sin pendiente — igual permite "volver al inicio"
      lista.push({ tipo:'enCurso', nro:ticketCounter, fecha:Date.now(), vacio:true });
    }
  }
  // Mas VIEJO primero — para que las flechas se sientan naturales:
  //   < (izq, anterior) = mas viejo
  //   > (der, siguiente) = mas nuevo
  // Ordenamos por NUMERO de ticket (estable, no cambia al auto-guardar)
  // con desempate por fecha. El 'enCurso' usa ticketCounter, que siempre es
  // mayor o igual al resto del turno, asi que queda al final natural.
  lista.sort(function(a, b){
    var na = (a.nro != null) ? a.nro : 0;
    var nb = (b.nro != null) ? b.nro : 0;
    if(na !== nb) return na - nb;
    return (a.fecha || 0) - (b.fecha || 0);
  });
  return lista;
}

function _posicionActualNav(lista){
  // Si estamos viendo una venta cobrada en el modal, esa es nuestra posicion
  if(_ticketNavViewingIdx >= 0 && _ticketNavViewingIdx < lista.length){
    return _ticketNavViewingIdx;
  }
  // Editando un pendiente
  if(currentTicketNro !== null){
    var idx = lista.findIndex(function(t){
      return (t.tipo==='pendiente' || t.tipo==='satelite' || t.tipo==='presupuesto')
        && t.nro === currentTicketNro;
    });
    if(idx >= 0) return idx;
  }
  // Cart en curso
  var idxEnCurso = lista.findIndex(function(t){ return t.tipo === 'enCurso'; });
  if(idxEnCurso >= 0) return idxEnCurso;
  return -1;
}

function navegarTicket(dir){
  var lista = _ticketsNavegables();
  if(!lista.length){ toast('No hay tickets para navegar'); return; }
  // Lista ordenada ASC: idx 0 = mas viejo, idx N = mas nuevo (ticket actual)
  // dir=-1 (flecha izq) → ir a mas viejo
  // dir=+1 (flecha der) → ir a mas nuevo
  var pos = _posicionActualNav(lista);
  if(pos < 0){
    // No estamos sobre ningun ticket — flecha izq abre el mas reciente,
    // flecha der no tiene sentido (vamos al mas viejo para que algo pase)
    pos = lista.length; // dir=-1 → lista.length-1 = mas nuevo
  }
  var nueva = pos + dir;
  if(nueva < 0){ toast('No hay tickets mas antiguos'); return; }
  if(nueva >= lista.length){ toast('Ya estas en el ticket mas reciente'); return; }
  var t = lista[nueva];
  if(t.tipo === 'cobrada' || t.tipo === 'anulada'){
    _ticketNavViewingIdx = nueva; // recordar para que el proximo ◀/▶ avance desde aca
    cargarVentaCobradaAlCart(t);
  } else if(t.tipo === 'enCurso'){
    _ticketNavViewingIdx = -1;
    // Restaurar el estado pre-lectura (cart vivo + variables) si lo teniamos
    if(_modoLectura){
      salirDeModoLectura(); // restaura desde _cartEnCursoSnap
    } else if(_cartEnCursoNavSnap){
      // Volviendo al cart en curso despues de haber navegado a un pendiente
      // con flechas — restaurar el cart vivo guardado.
      var s = _cartEnCursoNavSnap;
      if(typeof setCart === 'function') setCart(s.cart || []);
      if(typeof setCurrentTicketNro === 'function') setCurrentTicketNro(s.currentTicketNro);
      if(s.mesaActual && typeof setMesaActual === 'function') setMesaActual(s.mesaActual);
      else if(typeof clearMesaActual === 'function') clearMesaActual();
      if(s.tipoPedido && typeof setTipoPedido === 'function') setTipoPedido(s.tipoPedido);
      if(typeof setTicketDescuento === 'function') setTicketDescuento(s.ticketDescuento || 0);
      var _nomRestaurar = s.clienteNombre || '';
      if(typeof setClienteNombre === 'function') setClienteNombre(_nomRestaurar);
      if(typeof clienteNombre !== 'undefined') clienteNombre = _nomRestaurar;
      _cartEnCursoNavSnap = null;
    }
    updUI();
    // Forzar render de ambos paneles del cart (ver nota en cargarTicket)
    if(typeof renderTkt === 'function') renderTkt();
    if(typeof renderTabletTicket === 'function') renderTabletTicket();
    updBtnGuardar(); updTabTicketHeader();
    toast(cart && cart.length ? 'Ticket en curso' : 'Listo para nueva venta');
  } else {
    // Cargando pendiente/satelite/presupuesto — recordar posicion en lista
    // para que la proxima flecha avance desde aca (sin recalcular contra
    // currentTicketNro, que podria caer en otro lugar si la lista cambio).
    _ticketNavViewingIdx = nueva;
    // Saliendo del modo lectura para ir a un pendiente. Si _cartEnCursoSnap
    // contiene el cart VIVO original (currentTicketNro=null) y todavia no
    // teniamos snapshot de nav, transferirlo — sigue siendo "el cart en curso".
    if(_modoLectura){
      _modoLectura = false;
      _viewingCobradaVenta = null;
      if(_cartEnCursoSnap && _cartEnCursoSnap.currentTicketNro === null && !_cartEnCursoNavSnap){
        _cartEnCursoNavSnap = Object.assign({}, _cartEnCursoSnap, {
          nro: (_cartEnCursoSnap.nro != null) ? _cartEnCursoSnap.nro : ticketCounter,
        });
      }
      _cartEnCursoSnap = null;
      if(typeof actualizarBotonCobrarLectura === 'function') actualizarBotonCobrarLectura();
    }
    if(t.tipo === 'satelite' && typeof cajaAbrirPedidoSatelite === 'function'){
      cajaAbrirPedidoSatelite(t.idx, { viaNav: true });
    } else {
      cargarTicket(t.idx, { viaNav: true });
    }
  }
}

// Carga una venta cobrada/anulada al cart en MODO LECTURA.
// El usuario ve los items pero no puede modificarlos. El boton COBRAR
// se transforma en REIMPRIMIR. Antes de pisar el cart, GUARDA un snapshot
// del estado actual para poder restaurarlo cuando la cajera apriete ▶ y
// vuelva al ticket en curso.
function cargarVentaCobradaAlCart(item){
  // Buscar la venta completa por dbId
  if(typeof turnoData === 'undefined' || !turnoData.ventas){
    toast('No se pudo cargar la venta'); return;
  }
  var v = turnoData.ventas.find(function(x){ return x.dbId === item.ventaId; });
  if(!v){ toast('Venta no encontrada'); return; }

  // Guardar snapshot del estado ACTUAL — solo si no estabamos ya en modo lectura
  // (al navegar entre cobradas el snapshot ya fue guardado la primera vez).
  if(!_modoLectura){
    _cartEnCursoSnap = {
      cart:            JSON.parse(JSON.stringify(cart || [])),
      currentTicketNro: currentTicketNro,
      mesaActual:      (typeof mesaActual !== 'undefined' && mesaActual)
                         ? JSON.parse(JSON.stringify(mesaActual)) : null,
      tipoPedido:      (typeof tipoPedido !== 'undefined') ? tipoPedido : 'llevar',
      clienteNombre:   (typeof clienteNombre !== 'undefined') ? clienteNombre : '',
      ticketDescuento: (typeof ticketDescuento !== 'undefined') ? ticketDescuento : 0,
    };
  }

  // Activar modo lectura
  _modoLectura = true;
  _viewingCobradaVenta = v;

  // Cargar items al cart (clone para no afectar la venta original)
  setCart(JSON.parse(JSON.stringify(v.items || [])));
  setCurrentTicketNro(null); // no es un pendiente
  if(typeof setClienteNombre === 'function') setClienteNombre(v.clienteNombre || '');
  if(typeof setTipoPedido === 'function') setTipoPedido('llevar');
  if(typeof clearMesaActual === 'function') clearMesaActual();

  // Refrescar UI — forzar render de ambos paneles del cart
  if(typeof updUI === 'function') updUI();
  if(typeof renderTkt === 'function') renderTkt();
  if(typeof renderTabletTicket === 'function') renderTabletTicket();
  if(typeof updBtnGuardar === 'function') updBtnGuardar();
  if(typeof updMesaBtn === 'function') updMesaBtn();
  if(typeof actualizarBotonCobrarLectura === 'function') actualizarBotonCobrarLectura();
  if(typeof goTo === 'function') goTo('scSale');
  if(typeof toast === 'function'){
    toast('Venta #' + String(v.nroTicket||'').padStart(4,'0') + ' — solo lectura');
  }
}

// Salir del modo lectura.
// Si hay snapshot del cart en curso pre-lectura, lo RESTAURA (vuelve el cart
// vivo o el pendiente que estaba cargado). Si no hay snapshot, simplemente
// limpia y deja el cart vacio para empezar.
function salirDeModoLectura(){
  if(!_modoLectura) return;
  _modoLectura = false;
  _viewingCobradaVenta = null;

  if(_cartEnCursoSnap){
    // Restaurar exactamente el estado pre-lectura
    var s = _cartEnCursoSnap;
    // IMPORTANTE: setCart() pisa el cart pero NO toca clienteNombre.
    // Tenemos que restaurar clienteNombre EXPLICITAMENTE despues de setCart
    // para que el render del cart muestre el cliente correcto.
    if(typeof setCart === 'function') setCart(s.cart || []);
    if(typeof setCurrentTicketNro === 'function') setCurrentTicketNro(s.currentTicketNro);
    if(s.mesaActual && typeof setMesaActual === 'function') setMesaActual(s.mesaActual);
    else if(typeof clearMesaActual === 'function') clearMesaActual();
    if(s.tipoPedido && typeof setTipoPedido === 'function') setTipoPedido(s.tipoPedido);
    if(typeof setTicketDescuento === 'function') setTicketDescuento(s.ticketDescuento || 0);
    // Restaurar clienteNombre AL FINAL para que no lo pisen otras llamadas.
    // Asignamos directo a la variable global tambien por si setClienteNombre no
    // alcanza (al setear cart=[] el render se llama y lee la variable global).
    var _nomRestaurar = s.clienteNombre || '';
    if(typeof setClienteNombre === 'function') setClienteNombre(_nomRestaurar);
    if(typeof clienteNombre !== 'undefined') clienteNombre = _nomRestaurar;
    _cartEnCursoSnap = null;
  } else {
    // Sin snapshot — limpiar para empezar
    if(typeof clearCart === 'function') clearCart();
    if(typeof clearClienteNombre === 'function') clearClienteNombre();
  }

  if(typeof actualizarBotonCobrarLectura === 'function') actualizarBotonCobrarLectura();
  // Forzar re-render explicito para asegurar que el cliente vuelve a verse
  if(typeof renderTkt === 'function') renderTkt();
  if(typeof renderTabletTicket === 'function') renderTabletTicket();
}

// Cambia el boton COBRAR a REIMPRIMIR cuando hay venta cobrada en pantalla.
function actualizarBotonCobrarLectura(){
  // Modo hospedaje ("+ CONSUMO"): este botón tiene su propia etiqueta
  // ("CARGAR A HAB. X") mientras dura ese modo — no pisarla acá. Sin esto,
  // el label volvía a "COBRAR" apenas se actualizaba el carrito (que es
  // justo lo que pasa al agregar el primer producto).
  if(typeof window !== 'undefined' && window._hospedajeCargandoConsumo) return;

  var modoON = _modoLectura;

  // Movil — btn-cobrar tiene un <span> con el texto y otro con el monto
  var btnMob = document.querySelector('#scSale .btn-cobrar');
  if(btnMob){
    var sp = btnMob.querySelector('span:first-child');
    if(sp) sp.textContent = modoON ? 'REIMPRIMIR' : 'COBRAR';
    btnMob.style.background = modoON ? '#42a5f5' : '';
  }
  // Tablet — tab-btn-cobrar
  var btnTab = document.querySelector('.tab-btn-cobrar');
  if(btnTab){
    var spT = btnTab.querySelector('span:first-child');
    if(spT) spT.textContent = modoON ? 'REIMPRIMIR' : 'COBRAR';
    btnTab.style.background = modoON ? '#42a5f5' : '';
  }
  // Detalle ticket
  var btnsDet = document.querySelectorAll('.det-cobrar-btn');
  btnsDet.forEach(function(btn){
    if(btn.getAttribute('onclick') && btn.getAttribute('onclick').indexOf('goCobrar') >= 0){
      btn.textContent = modoON ? 'REIMPRIMIR' : 'COBRAR';
      btn.style.background = modoON ? '#42a5f5' : '';
      if(modoON) btn.style.color = '#fff';
    }
  });
}

// ── BADGE DE ESTADO ──────────────────────────────────────────────────────
function actualizarBadgeEstado(){
  // Etiquetas: mob mas corta (ahorra ancho), tab texto completo
  var estados = {
    enCurso:     { mob:'CURSO', tab:'EN CURSO',    bg:'rgba(76,175,80,.22)',  color:'#4caf50' },
    pendiente:   { mob:'PEND',  tab:'PENDIENTE',   bg:'rgba(255,152,0,.22)',  color:'#ff9800' },
    satelite:    { mob:'SAT',   tab:'SATELITE',    bg:'rgba(124,109,255,.22)',color:'#7c6dff' },
    presupuesto: { mob:'PRES',  tab:'PRESUPUESTO', bg:'rgba(186,104,200,.22)',color:'#ba68c8' },
    cobrada:     { mob:'COB',   tab:'COBRADO',     bg:'rgba(66,165,245,.22)', color:'#42a5f5' },
    anulada:     { mob:'ANUL',  tab:'ANULADA',     bg:'rgba(239,83,80,.22)',  color:'#ef5350' },
  };

  // Estado actual: si hay currentTicketNro y existe en pendientes → ese estado.
  // Si no, si cart tiene items → enCurso. Si no, vacio (ocultar).
  var estadoActual = null;
  if(currentTicketNro !== null && typeof pendientes !== 'undefined'){
    var p = pendientes.find(function(x){ return x.nro === currentTicketNro; });
    if(p){
      estadoActual = p.esPresupuesto ? 'presupuesto' : (p.esSatelite ? 'satelite' : 'pendiente');
    }
  } else if(typeof cart !== 'undefined' && cart && cart.length > 0){
    estadoActual = 'enCurso';
  }

  // Mostrar/ocultar badges con texto segun el prefix (mob/tab)
  [['mob','mob'],['tab','tab']].forEach(function(pair){
    var prefix = pair[0], txtKey = pair[1];
    var el = document.getElementById(prefix + 'TicketEstado');
    if(!el) return;
    if(estadoActual && estados[estadoActual]){
      var e = estados[estadoActual];
      el.textContent = e[txtKey];
      el.style.background = e.bg;
      el.style.color = e.color;
      el.style.display = 'inline-block';
    } else {
      el.style.display = 'none';
    }
  });

  // Flechas: solo mostrar si hay al menos UN ticket adicional para navegar
  // (la lista tiene mas de 1 elemento, o tiene 1 que no es el actual)
  var lista = _ticketsNavegables();
  var pos = _posicionActualNav(lista);
  var hayAnterior = pos > 0 || (pos < 0 && lista.length > 0);
  var haySiguiente = pos >= 0 && pos < lista.length - 1;
  function setVis(id, vis){
    var el = document.getElementById(id);
    if(el) el.style.display = vis ? 'inline-flex' : 'none';
  }
  setVis('mobNavAnt', hayAnterior);
  setVis('tabNavAnt', hayAnterior);
  setVis('mobNavSig', haySiguiente);
  setVis('tabNavSig', haySiguiente);
}

// ── MODAL VENTA COBRADA (solo lectura) ───────────────────────────────────
function verVentaCobradaModal(item){
  var prev = document.getElementById('ventaCobradaOv');
  if(prev) prev.remove();

  // Recuperar la venta completa de turnoData.ventas
  var v = null;
  if(typeof turnoData !== 'undefined' && turnoData.ventas){
    v = turnoData.ventas.find(function(x){ return x.dbId === item.ventaId; });
  }
  if(!v){ toast('Venta no encontrada'); return; }

  var anulada = !!v.anulada;
  var fecha = v.fecha ? new Date(v.fecha) : new Date();
  var pad = function(n){ return String(n).padStart(2,'0'); };
  var fechaStr = pad(fecha.getDate())+'/'+pad(fecha.getMonth()+1)+'/'+fecha.getFullYear()
              +' · '+pad(fecha.getHours())+':'+pad(fecha.getMinutes());

  var nomCli = v.clienteNombre || (v.factura && v.factura.nombre) || '';
  var nroFact = (v.factura && v.factura.nro_factura) || '';

  var itemsHTML = (v.items||[]).map(function(it){
    var sub = (it.price||it.precio||0) * (it.qty||1);
    return '<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:13px;">'+
      '<span>'+(it.qty||1)+'× '+(it.name||it.nombre||'')+'</span>'+
      '<span style="font-weight:700;">'+gs(sub)+'</span>'+
    '</div>';
  }).join('');

  var ov = document.createElement('div');
  ov.id = 'ventaCobradaOv';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:600;display:flex;align-items:center;justify-content:center;padding:14px;animation:fadeIn .15s ease;';
  ov.innerHTML =
    '<div style="background:var(--bg-card);width:100%;max-width:420px;max-height:90vh;overflow-y:auto;border-radius:14px;padding:0;animation:fadeIn .2s ease;border:1px solid var(--border);box-shadow:0 12px 40px rgba(0,0,0,.5);">'+
      '<div style="padding:18px 20px;border-bottom:1px solid var(--border);background:'+(anulada?'rgba(239,83,80,.08)':'rgba(33,150,243,.06)')+';border-radius:14px 14px 0 0;">'+
        '<div style="display:flex;align-items:center;gap:10px;">'+
          '<span style="font-size:10px;font-weight:800;padding:3px 9px;border-radius:5px;letter-spacing:.5px;background:'+(anulada?'rgba(239,83,80,.18)':'rgba(33,150,243,.2)')+';color:'+(anulada?'#ef5350':'#42a5f5')+';">'+(anulada?'ANULADA':'COBRADO')+'</span>'+
          '<span style="font-size:18px;font-weight:800;color:var(--text);">#'+String(v.nroTicket).padStart(4,'0')+'</span>'+
          (nroFact ? '<span style="font-size:11px;color:var(--muted);font-weight:700;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 1 1V2H4z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="14" y2="15"/></svg> '+nroFact+'</span>' : '')+
        '</div>'+
        '<div style="font-size:12px;color:var(--muted);margin-top:4px;">'+fechaStr+'</div>'+
        (nomCli ? '<div style="margin-top:6px;display:flex;align-items:center;gap:5px;font-size:13px;color:var(--text);font-weight:700;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="opacity:.7"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>'+esc(nomCli)+'</div>' : '')+
      '</div>'+
      '<div style="padding:16px 20px;">'+
        '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;font-weight:700;margin-bottom:8px;">Artículos</div>'+
        '<div style="max-height:200px;overflow-y:auto;margin-bottom:14px;">'+(itemsHTML||'<div style="font-size:12px;color:var(--muted);font-style:italic;">Sin detalle</div>')+'</div>'+
        '<div style="display:flex;justify-content:space-between;align-items:baseline;padding:10px 0;border-top:2px solid var(--border);">'+
          '<span style="font-size:13px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Total</span>'+
          '<span style="font-size:22px;font-weight:800;color:var(--text);">'+gs(v.total||0)+'</span>'+
        '</div>'+
        '<div style="font-size:12px;color:var(--muted);margin-top:2px;text-align:right;">'+ (v.metodo||'EFECTIVO').toUpperCase() +'</div>'+
      '</div>'+
      '<div style="padding:8px 20px 14px;display:flex;gap:6px;align-items:center;">'+
        '<button onclick="navegarTicket(-1)" title="Ticket anterior" style="padding:11px 10px;border-radius:8px;background:transparent;border:1.5px solid var(--border);color:var(--text);cursor:pointer;flex-shrink:0;display:flex;align-items:center;">'+
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="15 18 9 12 15 6"/></svg>'+
        '</button>'+
        '<button onclick="cerrarVentaCobradaModal()" style="flex:1;padding:11px;border-radius:8px;background:transparent;border:1.5px solid var(--border);color:var(--text);font-family:Barlow,sans-serif;font-size:13px;font-weight:800;cursor:pointer;letter-spacing:.3px;">CERRAR</button>'+
        (anulada ? '' : '<button onclick="cerrarVentaCobradaModal();reimprimirVentaTurno('+v.dbId+');" style="flex:1.4;padding:11px;border-radius:8px;background:var(--green);border:none;color:#fff;font-family:Barlow,sans-serif;font-size:13px;font-weight:800;cursor:pointer;letter-spacing:.3px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> REIMPRIMIR</button>')+
        '<button onclick="navegarTicket(1)" title="Ticket siguiente" style="padding:11px 10px;border-radius:8px;background:transparent;border:1.5px solid var(--border);color:var(--text);cursor:pointer;flex-shrink:0;display:flex;align-items:center;">'+
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="9 18 15 12 9 6"/></svg>'+
        '</button>'+
      '</div>'+
    '</div>';
  ov.addEventListener('click', function(e){ if(e.target === ov) cerrarVentaCobradaModal(); });
  document.body.appendChild(ov);
}

// Cerrar modal y resetear el viewing index para que la proxima navegacion
// vuelva a calcular desde el ticket actual del cart.
function cerrarVentaCobradaModal(){
  var ov = document.getElementById('ventaCobradaOv');
  if(ov) ov.remove();
  _ticketNavViewingIdx = -1;
  if(typeof actualizarBadgeEstado === 'function') actualizarBadgeEstado();
}

// ══════════════════════════════════════════════════════════════════════════════
// CLIENTE NOMBRE — input rapido para identificar la venta sin mesa
// ══════════════════════════════════════════════════════════════════════════════
// Se accede desde el icono de persona en el header de scSale. Abre un modal
// con input de texto y botones Aceptar / Quitar / Cancelar. Coherente con el
// resto de la UI (no usa prompt() nativo).
function abrirInputClienteNombre(){
  // No duplicar overlay si ya esta abierto
  var prev = document.getElementById('clienteNombreOv');
  if(prev) prev.remove();

  var actual = (typeof clienteNombre !== 'undefined') ? clienteNombre : '';

  var ov = document.createElement('div');
  ov.id = 'clienteNombreOv';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:600;display:flex;align-items:center;justify-content:center;padding:16px;animation:fadeIn .15s ease;';
  ov.innerHTML =
    '<div style="background:var(--bg-card);width:100%;max-width:380px;border-radius:14px;padding:22px 20px;animation:fadeIn .2s ease;border:1px solid var(--border);box-shadow:0 12px 40px rgba(0,0,0,.5);">'+
      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">'+
        '<div style="width:42px;height:42px;border-radius:50%;background:rgba(76,175,80,.12);display:flex;align-items:center;justify-content:center;flex-shrink:0;">'+
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2.2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>'+
        '</div>'+
        '<div>'+
          '<div style="font-size:15px;font-weight:800;color:var(--text);line-height:1.2;">Nombre del cliente</div>'+
          '<div style="font-size:11px;color:var(--muted);margin-top:2px;">Para identificar el pedido (opcional)</div>'+
        '</div>'+
      '</div>'+
      '<input id="clienteNombreInput" type="text" placeholder="Ej: Juan, Maria, Don Carlos..." autocomplete="off" maxlength="40" '+
        'style="width:100%;padding:13px 14px;background:var(--bg-dark);border:1.5px solid var(--border);border-radius:8px;color:var(--text);font-family:Barlow,sans-serif;font-size:15px;font-weight:700;outline:none;margin-bottom:14px;box-sizing:border-box;" />'+
      '<div style="display:flex;gap:8px;">'+
        (actual ? '<button onclick="confirmarClienteNombre(\'\')" style="flex:1;padding:11px;border-radius:8px;background:transparent;border:1.5px solid rgba(239,83,80,.4);color:#ef5350;font-family:Barlow,sans-serif;font-size:13px;font-weight:800;cursor:pointer;letter-spacing:.3px;">QUITAR</button>' : '')+
        '<button onclick="document.getElementById(\'clienteNombreOv\').remove()" style="flex:1;padding:11px;border-radius:8px;background:transparent;border:1.5px solid var(--border);color:var(--text);font-family:Barlow,sans-serif;font-size:13px;font-weight:800;cursor:pointer;letter-spacing:.3px;">CANCELAR</button>'+
        '<button onclick="confirmarClienteNombre(document.getElementById(\'clienteNombreInput\').value)" style="flex:1.4;padding:11px;border-radius:8px;background:var(--green);border:none;color:#fff;font-family:Barlow,sans-serif;font-size:13px;font-weight:800;cursor:pointer;letter-spacing:.3px;">ACEPTAR</button>'+
      '</div>'+
    '</div>';

  // Click en fondo cierra
  ov.addEventListener('click', function(e){
    if(e.target === ov) ov.remove();
  });

  document.body.appendChild(ov);

  var inp = document.getElementById('clienteNombreInput');
  if(inp){
    inp.value = actual;
    setTimeout(function(){ inp.focus(); inp.select(); }, 50);
    // Enter confirma, Escape cancela
    inp.addEventListener('keydown', function(e){
      if(e.key === 'Enter'){ e.preventDefault(); confirmarClienteNombre(inp.value); }
      else if(e.key === 'Escape'){ e.preventDefault(); ov.remove(); }
    });
  }
}

// Aplica el nombre (o lo limpia si viene vacio) y cierra el modal
function confirmarClienteNombre(valor){
  if(typeof setClienteNombre === 'function') setClienteNombre(valor || '');
  var ov = document.getElementById('clienteNombreOv');
  if(ov) ov.remove();
  // Si la cajera esta editando un pendiente con mesa, persistir el nombre
  // en el pendiente para que se vea tambien en el panel de mesas.
  if(currentTicketNro !== null && typeof pendientes !== 'undefined'){
    var idx = pendientes.findIndex(function(p){ return p.nro === currentTicketNro; });
    if(idx >= 0){
      pendientes[idx].clienteNombre = (typeof clienteNombre !== 'undefined') ? clienteNombre : '';
      if(typeof guardarPendientesLocal === 'function') guardarPendientesLocal();
    }
  }
  if(typeof renderClienteNombreBar === 'function') renderClienteNombreBar();
  if(typeof updTabTicketHeader === 'function') updTabTicketHeader();
  if(typeof renderMesasScreen === 'function') renderMesasScreen();
}

// Compat no-op: la barra azul fue removida; ahora el cliente solo aparece
// dentro del cart (renderTkt/renderTabletTicket) y en el panel de mesas.
function renderClienteNombreBar(){ /* removed */ }

function onBtnGuardar() {
  if(typeof _modoLectura !== 'undefined' && _modoLectura){
    if(typeof toast === 'function') toast('Venta cobrada — apretá NUEVA VENTA');
    return;
  }
  if (typeof mesaActual!=='undefined' && mesaActual) { guardarConMesa(); return; }
  const tieneProductos = calcTotal() > 0;
  if (tieneProductos) {
    goGuardar();
  } else if (pendientes.length > 0) {
    goPendientes();
  } else {
    toast('Agregá productos primero');
  }
}

function goGuardar() {
  const total = calcTotal();
  if (total === 0) { toast('Agregá productos primero'); return; }
  const nro = currentTicketNro !== null
    ? String(currentTicketNro).padStart(4, '0')
    : String(ticketCounter).padStart(4, '0');
  document.getElementById('guardNro').textContent = '#' + nro;
  const existente = currentTicketNro !== null
    ? pendientes.find(t => t.nro === currentTicketNro)
    : null;
  // Precargar Observacion del pendiente si existe
  document.getElementById('guardObs').value = existente ? (existente.obs || '') : '';
  // Precargar Cliente — prioridad: variable global, despues lo guardado en el pendiente
  var nomClienteActual = (typeof clienteNombre !== 'undefined' && clienteNombre)
    ? clienteNombre
    : (existente && existente.clienteNombre ? existente.clienteNombre : '');
  document.getElementById('guardCliente').value = nomClienteActual;
  document.getElementById('guardItemsList').innerHTML = cart.map(i =>
    `<div class="guard-item-row">
      <span class="gin">${i.qty}× ${i.name}${i.obs ? ' <span style="color:#777;font-weight:400;font-size:11px;">('+i.obs+')</span>' : ''}</span>
      <span class="gip">${gs(i.price * i.qty)}</span>
    </div>`
  ).join('');
  goTo('scGuardar');
  setTimeout(() => document.getElementById('guardCliente').focus(), 300);
}

function doGuardar() {
  const obs = document.getElementById('guardObs').value.trim();
  const nomCli = document.getElementById('guardCliente').value.trim();
  // Sincronizar variable global de clienteNombre con lo que ingreso en el modal
  if(typeof setClienteNombre === 'function') setClienteNombre(nomCli);

  if (currentTicketNro !== null) {
    const idx = pendientes.findIndex(t => t.nro === currentTicketNro);
    if (idx >= 0) {
      pendientes[idx].cart = JSON.parse(JSON.stringify(cart));
      pendientes[idx].total = calcTotal();
      pendientes[idx].obs = obs;
      pendientes[idx].clienteNombre = nomCli;
      pendientes[idx].fecha = new Date().toISOString();
      pendientes[idx].tipoPedido = tipoPedido || 'local';
      pendientes[idx].descuentoTicket = ticketDescuento || 0;
    }
    const nro = currentTicketNro;
    setCurrentTicketNro(null);
    clearCart();
    updUI(); updBtnGuardar();
    guardarPendientesLocal();
    goTo('scSale');
    toast('Ticket #' + String(nro).padStart(4, '0') + ' actualizado');
  } else {
    const nro = ticketCounter;
    incrementTicketCounter();
    pendientes.push({
      nro,
      obs: obs || '',
      clienteNombre: nomCli || '',
      cart: JSON.parse(JSON.stringify(cart)),
      total: calcTotal(),
      fecha: new Date().toISOString(),
      esPresupuesto: false,
      tipoPedido: tipoPedido || 'local',
      descuentoTicket: ticketDescuento || 0,
    });
    setCurrentTicketNro(null);
    clearCart();
    updUI(); updBtnGuardar();
    guardarPendientesLocal();
    goTo('scSale');
    toast('Ticket #' + String(nro).padStart(4, '0') + ' guardado');
  }
}

function goPendientes() {
  renderPendientes();
  goTo('scPendientes');
}

function renderPendientes() {
  const list = document.getElementById('pendList');
  if (!pendientes.length) {
    list.innerHTML = `<div class="pend-empty">
      <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:.3"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
      <p>No hay tickets pendientes</p>
    </div>`;
    return;
  }
  // Helper: color de fondo del cuadradito del número según tipo de pedido
  function colorCuadradito(tipo){
    var map = {
      'local':    '#3b82f6',  // azul
      'llevar':   '#10b981',  // verde
      'delivery': '#ff9800',  // naranja
    };
    return map[tipo] || '';
  }
  // Helper: hora HH:MM desde ISO o Date
  function horaCorta(fecha){
    if (!fecha) return '';
    try {
      var d = (typeof fecha === 'string') ? new Date(fecha) : fecha;
      if (isNaN(d.getTime())) return '';
      var hh = String(d.getHours()).padStart(2,'0');
      var mm = String(d.getMinutes()).padStart(2,'0');
      return hh + ':' + mm;
    } catch(e){ return ''; }
  }

  list.innerHTML = pendientes.map((t, i) => {
    // Pedido de terminal satélite — va directo a cobrar, no se edita
    var esSat = !!t.esSatelite;
    // Badge visual: satélite, presupuesto o tipo de pedido
    var badge = '';
    if (esSat) {
      badge = ' <span style="font-size:10px;font-weight:800;background:rgba(83,74,183,.15);' +
              'color:#a78bfa;border:1px solid rgba(83,74,183,.3);padding:1px 6px;' +
              'border-radius:4px;letter-spacing:.5px;vertical-align:middle;">SATELITE</span>';
      if (t.tipoPedido === 'delivery') {
        badge = ' <span style="font-size:10px;font-weight:800;background:rgba(255,152,0,.15);' +
                'color:#ff9800;border:1px solid rgba(255,152,0,.3);padding:1px 6px;' +
                'border-radius:4px;letter-spacing:.5px;vertical-align:middle;">DELIVERY</span>';
      }
    } else if (t.esPresupuesto) {
      badge = ' <span style="font-size:10px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg></span>';
    }
    // Color del cuadradito del número según tipo de pedido (solo tickets normales)
    var bgNum = '';
    if (!esSat && !t.esPresupuesto && t.tipoPedido) {
      var cBg = colorCuadradito(t.tipoPedido);
      if (cBg) bgNum = ' style="background:' + cBg + ';color:#fff;"';
    }
    // Acción al tocar: satélite → cobrar directo | local → cargar al carrito
    var onclickAccion = esSat
      ? 'cajaAbrirPedidoSatelite(' + i + ')'
      : 'cargarTicket(' + i + ')';
    // Hora a la derecha del título — fuera de .pend-item-obs porque ese div
    // tiene overflow:hidden + text-overflow:ellipsis y la cortaba.
    var hora = horaCorta(t.fecha);
    var horaHtml = hora
      ? ' <span style="font-size:11px;color:var(--muted);font-weight:600;margin-left:6px;font-family:Courier,monospace;">' + hora + '</span>'
      : '';
    // Info secundaria: obs · cant art. · (terminal si es satélite)
    var artCount = (t.cart || []).reduce(function(s, it) { return s + it.qty; }, 0);
    var infoObs  = (t.obs || 'Sin observación') + ' · ' + artCount + ' art.';
    if (esSat && t.terminalOrigen) infoObs += ' · ' + t.terminalOrigen;
    // Bloque del cliente — destacado abajo del titulo si hay nombre
    var cliBadge = t.clienteNombre
      ? '<div style="display:flex;align-items:center;gap:4px;font-size:11.5px;color:var(--text);font-weight:700;margin-top:2px;">'+
          '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="opacity:.7"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>'+
          '<span>'+esc(t.clienteNombre)+'</span>'+
        '</div>'
      : '';
    return '<div class="pend-item" style="display:flex;align-items:center;gap:0;' +
           (esSat ? 'border-left:3px solid #534AB7;' : '') + '">' +
      '<div style="flex:1;display:flex;align-items:center;gap:10px;padding:14px 0 14px 14px;cursor:pointer;" onclick="' + onclickAccion + '">' +
        '<div class="pend-item-num"' + bgNum + '>#' + String(t.nro).padStart(4, '0') + '</div>' +
        '<div class="pend-item-info">' +
          '<div class="pend-item-title">Ticket #' + String(t.nro).padStart(4, '0') + badge + horaHtml + '</div>' +
          cliBadge +
          '<div class="pend-item-obs">' + infoObs + '</div>' +
        '</div>' +
        '<div class="pend-item-total">' + gs(t.total) + '</div>' +
      '</div>' +
      '<button onclick="event.stopPropagation();imprimirTicketPendiente(' + i + ')" title="Imprimir"' +
        ' style="background:none;border:none;cursor:pointer;color:var(--muted);padding:14px 12px;display:flex;align-items:center;flex-shrink:0;border-left:1px solid var(--border);">' +
        '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>' +
      '</button>' +
    '</div>';
  }).join('');
}

async function cargarTicket(i, opts) {
  let t = pendientes[i];
  if(!t){ toast('Ticket no encontrado'); return; }
  // Si NO es navegacion por flechas (click directo en pendiente, etc),
  // descartar cualquier snapshot de cart en curso pendiente — el usuario
  // rompio el flujo de navegacion al elegir manualmente.
  if(!(opts && opts.viaNav)) _cartEnCursoNavSnap = null;

  // ── GUARDA: si soy satélite y el pendiente está enlazado a un pedido
  // de Supabase, validar que ese pedido NO esté cobrado/cancelado por la caja.
  // Si está cobrado, no permitir abrir el ticket — la mesa ya fue cerrada.
  if(typeof MODO_TERMINAL !== 'undefined' && MODO_TERMINAL === 'satelite'
     && t.esSatelite && t.supabasePedidoId
     && navigator.onLine && typeof USAR_DEMO !== 'undefined' && !USAR_DEMO){
    try {
      if(typeof sateliteSyncPedidosPendientes === 'function'){
        await sateliteSyncPedidosPendientes();
      }
    } catch(e){ /* si falla el sync, seguimos — el peor caso es que ya quedó pisado */ }
    // Tras el sync, el pendiente puede haber desaparecido si estaba cobrado
    const idxRefrescado = pendientes.findIndex(function(p){
      return p.supabasePedidoId === t.supabasePedidoId;
    });
    if(idxRefrescado < 0){
      toast('Este pedido ya fue cobrado por caja');
      if(typeof renderVentasList === 'function') renderVentasList();
      if(typeof renderMesasScreen === 'function') renderMesasScreen();
      return;
    }
    // El índice pudo cambiar tras el sync — usar el actualizado
    i = idxRefrescado;
    t = pendientes[i];
  }

  const totalActual = calcTotal();
  if (totalActual > 0) {
    if (currentTicketNro !== null) {
      const idx = pendientes.findIndex(p => p.nro === currentTicketNro);
      if (idx >= 0) {
        pendientes[idx].cart = JSON.parse(JSON.stringify(cart));
        pendientes[idx].total = totalActual;
        // NO tocar fecha — preservamos fecha de creacion para que el orden
        // de navegacion (por nro con desempate por fecha) sea estable.
        pendientes[idx].descuentoTicket = ticketDescuento || 0;
        // Persistir cliente al auto-guardar el pendiente activo
        pendientes[idx].clienteNombre = (typeof clienteNombre !== 'undefined') ? clienteNombre : '';
      }
    } else if (opts && opts.viaNav) {
      // Navegacion por flechas — NO convertir el cart en pendiente nuevo.
      // Guardar snapshot para poder restaurar el cart en curso al volver con ▶.
      // Solo creamos snapshot si NO hay uno ya (podria existir de una nav
      // anterior o transferido desde el modo lectura — no lo pisamos con el
      // cart actual, que puede ser de una venta cobrada).
      if(!_cartEnCursoNavSnap){
        _cartEnCursoNavSnap = {
          cart:             JSON.parse(JSON.stringify(cart || [])),
          currentTicketNro: null,
          mesaActual:       (typeof mesaActual !== 'undefined' && mesaActual)
                              ? JSON.parse(JSON.stringify(mesaActual)) : null,
          tipoPedido:       (typeof tipoPedido !== 'undefined') ? tipoPedido : 'llevar',
          clienteNombre:    (typeof clienteNombre !== 'undefined') ? clienteNombre : '',
          ticketDescuento:  (typeof ticketDescuento !== 'undefined') ? ticketDescuento : 0,
          nro:              ticketCounter,
        };
      }
    } else {
      pendientes.push({
        nro: ticketCounter,
        obs: 'Auto-guardado',
        cart: JSON.parse(JSON.stringify(cart)),
        total: totalActual,
        fecha: new Date(),
        esPresupuesto: false,
        descuentoTicket: ticketDescuento || 0,
        // Persistir cliente al auto-guardar el cart vivo como pendiente nuevo
        clienteNombre: (typeof clienteNombre !== 'undefined') ? clienteNombre : '',
      });
      incrementTicketCounter();
    }
  }
  if(typeof resetTicketDescuento === 'function') resetTicketDescuento();
  if(t.descuentoTicket && t.descuentoTicket > 0 && typeof setTicketDescuento === 'function'){
    setTicketDescuento(t.descuentoTicket);
  }
  setCart(JSON.parse(JSON.stringify(t.cart)));
  setCurrentTicketNro(t.nro);
  // Restaurar nombre del cliente si el pendiente lo tenia
  if(typeof setClienteNombre === 'function') setClienteNombre(t.clienteNombre || '');

  // ── REGLA: la caja se vuelve dueña al cargar un pedido satélite ──────────
  // Mismo motivo que en cajaAbrirPedidoSatelite: evitar que el sync de
  // Supabase pise los cambios que la caja haga sobre el ticket.
  if(t.esSatelite){
    pendientes[i].esSatelite = false;
    pendientes[i]._tomadoPorCaja = true;
    if(typeof guardarPendientesLocal === 'function') guardarPendientesLocal();
    if(t.supabasePedidoId && navigator.onLine && typeof USAR_DEMO !== 'undefined' && !USAR_DEMO && typeof supaPatch === 'function'){
      supaPatch('pos_pedidos',
        'id=eq.' + encodeURIComponent(t.supabasePedidoId),
        { estado: 'en_cobro', updated_at: new Date().toISOString() },
        true
      ).catch(function(e){ console.warn('[Caja] No se pudo marcar en_cobro:', e.message); });
    }
  }

  updUI();
  // Re-render explicito de AMBOS paneles del cart — updUI solo refresca el
  // panel tablet (renderTabletTicket); el panel mobile (renderTkt) solo se
  // refresca cuando se abre el tpanel. Al navegar tickets con flechas hay
  // que forzar ambos para que el detalle del cart muestre los items nuevos.
  if(typeof renderTkt === 'function') renderTkt();
  if(typeof renderTabletTicket === 'function') renderTabletTicket();
  updBtnGuardar();
  goTo('scSale');
  const origen = t.esSatelite ? ' (de ' + (t.terminalOrigen || 'satélite') + ')' : '';
  toast('Ticket #' + String(t.nro).padStart(4, '0') + origen + ' cargado');
}

// ── cajaAbrirPedidoSatelite — abre pedido satélite directo al cobro ──────────
// Los pedidos de satélite no se "editan" — el cajero los cobra tal cual.
// Carga el carrito del pedido y va directo a la pantalla de cobro.
// El pedido queda en pendientes[] hasta que se confirme el cobro en pos_ventas.
function cajaAbrirPedidoSatelite(i, opts) {
  var t = pendientes[i];
  if (!t || !t.esSatelite) { if (typeof cargarTicket !== 'undefined') cargarTicket(i, opts); return; }
  // Si NO es nav por flechas, descartar snapshot de cart en curso (flujo roto)
  if(!(opts && opts.viaNav)) _cartEnCursoNavSnap = null;

  // Si hay carrito activo, preguntar antes de pisar — salvo que sea nav por flechas
  // (la nav guarda snapshot y no pierde el cart, asi que no necesita confirm).
  var totalActual = typeof calcTotal === 'function' ? calcTotal() : 0;
  if (totalActual > 0) {
    if (!(opts && opts.viaNav) && !confirm('Hay un ticket en curso. ¿Descartar y abrir el pedido de ' + (t.obs || 'mesero') + '?')) return;
    if (currentTicketNro !== null) {
      // Editando un pendiente — auto-guardar antes de pisar
      var idx = pendientes.findIndex(function(p){ return p.nro === currentTicketNro; });
      if (idx >= 0) {
        pendientes[idx].cart = JSON.parse(JSON.stringify(cart));
        pendientes[idx].total = totalActual;
        // NO tocar fecha — preservamos fecha de creacion (orden estable de nav)
        pendientes[idx].clienteNombre = (typeof clienteNombre !== 'undefined') ? clienteNombre : '';
      }
      t = pendientes[i];
      if (!t || !t.esSatelite) return;
    } else if (opts && opts.viaNav) {
      // Cart vivo sin pendiente activo + nav por flechas — preservar en snapshot
      // (solo si no hay uno ya, mismo criterio que cargarTicket)
      if(!_cartEnCursoNavSnap){
        _cartEnCursoNavSnap = {
          cart:             JSON.parse(JSON.stringify(cart || [])),
          currentTicketNro: null,
          mesaActual:       (typeof mesaActual !== 'undefined' && mesaActual)
                              ? JSON.parse(JSON.stringify(mesaActual)) : null,
          tipoPedido:       (typeof tipoPedido !== 'undefined') ? tipoPedido : 'llevar',
          clienteNombre:    (typeof clienteNombre !== 'undefined') ? clienteNombre : '',
          ticketDescuento:  (typeof ticketDescuento !== 'undefined') ? ticketDescuento : 0,
          nro:              ticketCounter,
        };
      }
    }
    // Si currentTicketNro === null y NO es viaNav, el carrito es nuevo sin guardar — descartar
  }

  // Cargar el carrito del pedido satélite
  if(typeof resetTicketDescuento === 'function') resetTicketDescuento();
  if(t.descuentoTicket && t.descuentoTicket > 0 && typeof setTicketDescuento === 'function'){
    setTicketDescuento(t.descuentoTicket);
  }
  setCart(JSON.parse(JSON.stringify(t.cart || [])));
  setCurrentTicketNro(t.nro);
  // Restaurar nombre del cliente si el pedido satelite lo tenia
  if(typeof setClienteNombre === 'function') setClienteNombre(t.clienteNombre || '');

  // ── REGLA: la caja se vuelve dueña del pedido al tocarlo ──────────────────
  // Marcar el pendiente como local (no satélite) para que el polling/realtime
  // de Supabase no lo pise. Esto resuelve el bug "vuelve a lo que mandó el mozo":
  // a partir de acá, cualquier cambio que la caja haga al cart no se pierde.
  // El supabasePedidoId se preserva para que al cobrar siga el flujo de
  // marcarPedidoSateliteCobrado y el pos_pedidos en Supabase quede en estado 'cobrado'.
  pendientes[i].esSatelite = false;
  pendientes[i]._tomadoPorCaja = true; // marca informativa
  if(typeof guardarPendientesLocal === 'function') guardarPendientesLocal();

  // Informar a Supabase (best-effort, no bloquea la UI) — pasa de 'abierto' a 'en_cobro'.
  // Si está offline o falla, no importa: la dueñería local ya está aplicada.
  if(t.supabasePedidoId && navigator.onLine && typeof USAR_DEMO !== 'undefined' && !USAR_DEMO){
    if(typeof supaPatch === 'function'){
      supaPatch('pos_pedidos',
        'id=eq.' + encodeURIComponent(t.supabasePedidoId),
        { estado: 'en_cobro', updated_at: new Date().toISOString() },
        true
      ).catch(function(e){ console.warn('[Caja] No se pudo marcar en_cobro:', e.message); });
    }
  }

  // Setear tipo de pedido y mesa si corresponde
  if (typeof setTipoPedido === 'function') {
    setTipoPedido(t.tipoPedido || 'local');
  }
  if (t.mesa_id && typeof mesasMesas !== 'undefined') {
    var mesa = mesasMesas.find(function(m) { return m.id === t.mesa_id; });
    if (mesa) {
      setMesaActual(mesa);
      if (typeof updMesaBtn === 'function') updMesaBtn();
    }
  }

  if (typeof updUI === 'function') updUI();
  // Forzar render de ambos paneles del cart (mobile + tablet) — updUI solo
  // refresca el panel tablet; el panel mobile no se refresca solo.
  if (typeof renderTkt === 'function') renderTkt();
  if (typeof renderTabletTicket === 'function') renderTabletTicket();
  if (typeof updBtnGuardar === 'function') updBtnGuardar();

  // Ir al POS para que el cajero pueda agregar items antes de cobrar
  goTo('scSale');
  if (typeof renderCatPills === 'function') renderCatPills();
  if (typeof filterP === 'function') filterP();
  if (typeof toast === 'function') {
    var _mesaTxt = '';
    if(t.mesa_id && typeof mesasMesas !== 'undefined'){
      var _m = mesasMesas.find(function(m){ return m.id === t.mesa_id; });
      if(_m) _mesaTxt = ' · ' + _m.nombre;
    } else if(t.tipoPedido === 'delivery'){
      _mesaTxt = ' · Delivery';
    } else if(t.obs && t.obs !== (t.terminalOrigen||'')){
      _mesaTxt = ' · ' + t.obs;
    }
    toast('Pedido de ' + (t.terminalOrigen || 'mesero') + _mesaTxt + ' cargado — agregá items o cobrá');
  }
}

function nuevaVenta() {
  guardarPendientesLocal();
  _cartEnCursoNavSnap = null; // nueva venta rompe el flujo de navegacion
  const totalActual = calcTotal();
  const _nomCliAct = (typeof clienteNombre !== 'undefined') ? clienteNombre : '';
  if (totalActual > 0) {
    if (currentTicketNro !== null) {
      // Editando ticket existente — actualizar en lugar de crear duplicado
      const idx = pendientes.findIndex(p => p.nro === currentTicketNro);
      if (idx !== -1) {
        pendientes[idx] = { ...pendientes[idx], cart: JSON.parse(JSON.stringify(cart)), total: totalActual, fecha: new Date(), descuentoTicket: ticketDescuento || 0, clienteNombre: _nomCliAct };
      } else {
        pendientes.push({ nro: currentTicketNro, obs: 'Auto-guardado', cart: JSON.parse(JSON.stringify(cart)), total: totalActual, fecha: new Date(), esPresupuesto: false, descuentoTicket: ticketDescuento || 0, clienteNombre: _nomCliAct });
      }
    } else {
      pendientes.push({
        nro: ticketCounter,
        obs: 'Auto-guardado',
        cart: JSON.parse(JSON.stringify(cart)),
        total: totalActual,
        fecha: new Date(),
        esPresupuesto: false,
        descuentoTicket: ticketDescuento || 0,
        clienteNombre: _nomCliAct,
      });
      incrementTicketCounter();
    }
  }
  clearCart();
  setCurrentTicketNro(null);
  updUI();
  updBtnGuardar();
  if (updMesaBtn) updMesaBtn();
  goTo('scSale');
}

function updBtnGuardar() {
  const n = pendientes.length;
  const tieneProductos = calcTotal() > 0;
  const badge = document.getElementById('pendingBadge');
  const txt = document.getElementById('btnGuardarTxt');
  const icon = document.getElementById('btnGuardarIcon');
  const tabBadge = document.getElementById('tabPendingBadge');
  const tabTxt = document.getElementById('tabBtnTxt');
  if (tieneProductos) {
    txt.textContent = 'GUARDAR';
    if (tabTxt) tabTxt.textContent = 'GUARDAR';
    icon.innerHTML = '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>';
    if (n > 0) {
      badge.textContent = n > 9 ? '9+' : n; badge.classList.add('show');
      if (tabBadge) { tabBadge.textContent = badge.textContent; tabBadge.style.display = 'flex'; }
    } else {
      badge.classList.remove('show');
      if (tabBadge) tabBadge.style.display = 'none';
    }
  } else if (n > 0) {
    badge.textContent = n > 9 ? '9+' : n; badge.classList.add('show');
    txt.textContent = 'PENDIENTES';
    icon.innerHTML = '<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>';
    if (tabBadge) { tabBadge.textContent = badge.textContent; tabBadge.style.display = 'flex'; }
    if (tabTxt) tabTxt.textContent = 'PENDIENTES';
  } else {
    badge.classList.remove('show');
    txt.textContent = 'GUARDAR';
    icon.innerHTML = '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>';
    if (tabBadge) tabBadge.style.display = 'none';
    if (tabTxt) tabTxt.textContent = 'GUARDAR';
  }
}

// ── PAGO DIVIDIDO ────────────────────────────────────────────

function goDividir() {
  const total = calcTotal();
  if (!total) { toast('Agregá productos primero'); return; }
  clearDivPagos();
  divChgCount(0, 2);
  goTo('scDividir');
}

function divChgCount(delta, forceN) {
  const total = calcTotal();
  let n = forceN !== undefined ? forceN : (divPagos.length + delta);
  if (n < 1) n = 1;
  if (n > 6) n = 6;
  while (divPagos.length < n) {
    const base = Math.floor(total / n);
    divPagos.push({ metodo: 'Efectivo', monto: base, comprobante: '', cobrado: false });
  }
  while (divPagos.length > n) divPagos.pop();
  const base = Math.floor(total / n);
  const resto = total - base * n;
  divPagos.forEach((p, i) => { if (!p.cobrado) { p.monto = base + (i === 0 ? resto : 0); } });
  document.getElementById('divCount').textContent = n;
  document.getElementById('divMinus').disabled = (n <= 1);
  renderDivList();
  updDivRestante();
}

function renderDivList() {
  const container = document.getElementById('divList');
  container.innerHTML = divPagos.map((p, i) => {
    const needsComp = p.metodo === 'POS' || p.metodo === 'Transferencia';
    return `
    <div class="div-pago-item" id="divItem${i}">
      <div class="div-pago-row1">
        <button class="div-trash" onclick="divRemove(${i})">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
        <div class="div-method-sel" onclick="openDivMethodSheet(${i})">
          <span>${p.metodo}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#aaa" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>
      <div class="div-pago-row2">
        <input class="div-monto" id="divMonto${i}" type="text" readonly
          value="${gs(p.monto)}"
          onclick="openDivNumpad(${i})"
          ${p.cobrado ? 'disabled style="opacity:.5"' : ''}>
        <button class="div-cobrar-btn ${p.cobrado ? 'cobrado' : ''}"
          onclick="${p.cobrado ? '' : 'divCobrar(' + i + ')'}"
          ${p.cobrado ? 'disabled' : ''}>
          ${p.cobrado ? 'COBRADO' : 'COBRAR'}
        </button>
      </div>
      <div class="div-comp ${needsComp ? 'open' : ''}" id="divComp${i}">
        <label>Nro. Comprobante / Observación</label>
        <div class="efec-row" style="margin-top:4px;${p.cobrado ? 'opacity:.5;pointer-events:none' : ''}" onclick="openDivNPComp(${i})">
          <span class="efec-val" id="divCompDisp${i}" style="font-size:16px;color:${p.comprobante ? '#fff' : '#666'}">${p.comprobante || '—'}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#777" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>
    </div>`;
  }).join('');
}

function updDivRestante() {
  const total = calcTotal();
  const cobrado = divPagos.filter(p => p.cobrado).reduce((s, p) => s + p.monto, 0);
  const restante = total - cobrado;
  document.getElementById('divRestante').innerHTML =
    restante <= 0 ? 'Pagado <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><polyline points="20 6 9 17 4 12"/></svg>' : 'Restante ' + gs(restante);
}

// Al editar el monto de un pago, ajusta los OTROS pagos no cobrados para que
// la suma de todos los pagos no cobrados cubra el restante (total - ya cobrado).
// Si hay más de un "otro" no cobrado, reparte equitativo con resto al primero.
// Si el monto editado supera el restante, los otros quedan en 0.
function divAjustarRestantes(idxModificado) {
  const total    = calcTotal();
  const cobrado  = divPagos.filter(p => p.cobrado).reduce((s, p) => s + p.monto, 0);
  const editado  = divPagos[idxModificado].monto || 0;
  const idxs     = [];
  for (let k = 0; k < divPagos.length; k++) {
    if (!divPagos[k].cobrado && k !== idxModificado) idxs.push(k);
  }
  if (idxs.length === 0) return;
  let porRepartir = total - cobrado - editado;
  if (porRepartir < 0) porRepartir = 0;
  const base  = Math.floor(porRepartir / idxs.length);
  const resto = porRepartir - base * idxs.length;
  idxs.forEach((k, j) => { divPagos[k].monto = base + (j === 0 ? resto : 0); });
}

function divRemove(i) {
  if (divPagos.length <= 1) { toast('Mínimo 1 pago'); return; }
  if (divPagos[i].cobrado) { toast('Ya fue cobrado'); return; }
  divPagos.splice(i, 1);
  document.getElementById('divCount').textContent = divPagos.length;
  document.getElementById('divMinus').disabled = (divPagos.length <= 1);
  renderDivList();
  updDivRestante();
}

function divCobrar(i) {
  const p = divPagos[i];
  if (p.monto <= 0) { toast('El monto debe ser mayor a 0'); return; }
  p.cobrado = true;
  renderDivList();
  updDivRestante();
  toast('Pago cobrado');
  if (divPagos.every(p => p.cobrado)) {
    toast('Todos los pagos cobrados — presioná HECHO');
  }
}

function dividirHecho() {
  if (!divPagos.every(p => p.cobrado)) { toast('Faltan cobrar algunos pagos'); return; }
  confirmarPago();
}

function openDivMethodSheet(i) {
  setDivMethodIdx(i);
  const sheet = document.getElementById('catSheetContent');
  let html = '';
  PAY_METHODS.forEach(m => {
    const sel = divPagos[i].metodo === m ? 'sel' : '';
    html += '<div class="cat-item ' + sel + '" onclick="pickDivMethod(this)">' + m + '</div>';
  });
  sheet.innerHTML = html;
  document.getElementById('catOv').classList.add('open');
}

function pickDivMethod(el) {
  if (divMethodIdx < 0) return;
  const m = typeof el === 'string' ? el : el.textContent.trim();
  divPagos[divMethodIdx].metodo = m;
  divPagos[divMethodIdx].comprobante = '';
  document.getElementById('catOv').classList.remove('open');
  renderDivList();
}

function openDivNumpad(i) {
  if (divPagos[i].cobrado) return;
  setDivNpIdx(i);
  setNpCtx('div');
  setNpVal(String(divPagos[i].monto));
  document.getElementById('npLbl').textContent = 'Monto pago ' + (i + 1);
  document.getElementById('npDisp').textContent = gs(divPagos[i].monto);
  document.getElementById('billetesRow').classList.remove('show');
  document.getElementById('npOverlay').classList.add('open');
}

function openDivNPComp(i) {
  if (divPagos[i].cobrado) return;
  setDivNpIdx(i);
  setNpCtx('divComp');
  setNpVal(divPagos[i].comprobante || '');
  document.getElementById('npLbl').textContent = 'Nro. Comprobante - Pago ' + (i + 1);
  document.getElementById('npDisp').textContent = npVal || '—';
  document.getElementById('billetesRow').classList.remove('show');
  document.getElementById('npOverlay').classList.add('open');
}

// ── Render Tablet Ticket (panel lateral de items) ───────────────────────────

function renderTabletTicket(){
  var tl = document.getElementById('tabTlist');
  var empty = document.getElementById('tabEmpty');
  if(!tl) return;
  // Limpiar children excepto el placeholder vacio
  Array.from(tl.children).forEach(function(c){ if(c.id!=='tabEmpty') c.remove(); });

  // Banner de modo LECTURA (venta cobrada) — siempre que aplique, hay items o no
  var _enLecturaTab = (typeof _modoLectura !== 'undefined' && _modoLectura && _viewingCobradaVenta);
  if(_enLecturaTab){
    var _esAnulTab = !!_viewingCobradaVenta.anulada;
    var ban = document.createElement('div');
    ban.style.cssText = 'background:'+(_esAnulTab?'rgba(239,83,80,.12)':'rgba(66,165,245,.12)')+';border:1.5px solid '+(_esAnulTab?'rgba(239,83,80,.35)':'rgba(66,165,245,.35)')+';border-radius:6px;padding:9px 12px;margin-bottom:8px;display:flex;align-items:center;gap:10px;';
    ban.innerHTML =
      '<span style="font-size:11px;font-weight:800;padding:3px 9px;border-radius:5px;letter-spacing:.4px;background:'+(_esAnulTab?'rgba(239,83,80,.25)':'rgba(66,165,245,.28)')+';color:'+(_esAnulTab?'#ef5350':'#42a5f5')+';">'+(_esAnulTab?'ANULADA':'COBRADO')+'</span>'+
      '<span style="font-size:12px;color:var(--muted);">Solo lectura · NUEVA VENTA para empezar otra</span>';
    tl.appendChild(ban);
  }

  // Cabecera del cart con el nombre del cliente (si hay) — siempre, aun con cart vacio
  var _nomCliTab = (typeof clienteNombre !== 'undefined' && clienteNombre) ? clienteNombre : '';
  if(_nomCliTab){
    var hdrCliVacio = document.createElement('div');
    hdrCliVacio.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 10px;margin-bottom:6px;border-bottom:1px dashed var(--border);font-size:13px;color:var(--text);font-weight:700;';
    hdrCliVacio.innerHTML =
      '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="opacity:.7"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>'+
      '<span style="opacity:.6;font-size:10px;text-transform:uppercase;letter-spacing:.5px;font-weight:700;">Cliente:</span>'+
      '<span>'+esc(_nomCliTab)+'</span>';
    tl.appendChild(hdrCliVacio);
  }

  if(!cart.length){
    if(empty) empty.style.display='flex';
    return;
  }
  if(empty) empty.style.display='none';

  cart.forEach(function(i){
    var div = document.createElement('div');
    div.className='tab-titem';
    if(i.esDelivery){
      div.style.cssText='border-left:3px solid var(--orange);background:rgba(255,152,0,.06)';
      div.innerHTML=
        '<div style="width:7px;height:7px;border-radius:50%;background:var(--orange);flex-shrink:0"></div>'+
        '<div class="tab-tiname" style="color:var(--orange)">'+i.name+'</div>'+
        '<div class="tab-tictrl">'+
          '<button class="tab-qbtn" onclick="quitarItemDelivery();setTipoPedido(\'local\')" title="Quitar delivery" style="background:var(--orange);color:#fff">\u2715</button>'+
        '</div>'+
        '<div class="tab-tiprice" style="color:var(--orange);font-weight:800">'+gs(i.price)+'</div>';
    } else {
      div.style.cursor = 'pointer';
      div.title = 'Toc\u00e1 para abrir detalle (descuento por producto)';
      div.onclick = goDetalle;
      var _obsBtnColor = i.obs ? 'var(--orange)' : 'var(--muted)';
      var _obsTitle    = i.obs ? 'Editar observaci\u00f3n' : 'Agregar observaci\u00f3n';
      div.innerHTML=
        '<div style="width:7px;height:7px;border-radius:50%;background:'+i.color+';flex-shrink:0"></div>'+
        '<div class="tab-tiname">'+i.name+(i.obs?'<div class="tab-tiobs">'+i.obs+'</div>':'')+'</div>'+
        '<div class="tab-tictrl">'+
          '<button class="tab-qbtn" onclick="event.stopPropagation();abrirObsRapida('+i.lineId+')" title="'+_obsTitle+'" style="color:'+_obsBtnColor+';">'+
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:auto;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'+
          '</button>'+
          '<button class="tab-qbtn" onclick="event.stopPropagation();chgQty('+i.lineId+',-1)">\u2212</button>'+
          '<span class="tab-qnum">'+i.qty+'</span>'+
          '<button class="tab-qbtn" onclick="event.stopPropagation();chgQty('+i.lineId+',1)">+</button>'+
        '</div>'+
        '<div class="tab-tiprice">'+gs(i.price*i.qty)+'</div>';
    }
    tl.appendChild(div);
  });
}
