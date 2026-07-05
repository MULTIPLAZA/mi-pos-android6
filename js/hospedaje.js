// ── Hospedaje: habitaciones + estadías (folio de huésped) ──
//
// Patrón: la ocupación de una habitación se DERIVA de si existe una
// estadía activa para ella — igual que mesas.js deriva "ocupada" de los
// pendientes en vez de guardar un flag separado que puede desincronizarse.
//
// Ciclo: check-in (crea estadía) → agregar cargos (noches, extras,
// acumulan en la estadía mientras dura la visita, sin facturar) →
// check-out (los cargos acumulados se cargan al carrito y se cobran con
// el flujo normal de cobro.js — misma factura, misma FE, mismo todo).

var hospHabitaciones = [];   // [{id, numero, tipo, piso, capacidad, precio_noche, estado, ...}]
var hospEstadias     = [];   // estadías con estado='en_estadia' o 'reservado' (filtrado local por estado)
var _hospHabSel      = null; // habitación tocada (para abrir check-in o folio)
var _hospEstadiaSel  = null; // estadía abierta en el modal de folio
var _hospReservaSel  = null; // reserva abierta en el modal de reserva

// ── Carga (con cache offline en IndexedDB, mismo patrón que mesas_cache) ──
async function hospCargar(){
  const licId = parseInt(localStorage.getItem('ali')) || null;
  const email = localStorage.getItem('lic_email');
  if(!licId || !email || USAR_DEMO) return;

  if(!navigator.onLine){
    if(db){
      try{
        const habRow = await db.mesas_cache.get('hosp_habitaciones');
        const estRow = await db.mesas_cache.get('hosp_estadias');
        if(habRow) hospHabitaciones = JSON.parse(habRow.valor);
        if(estRow) hospEstadias     = JSON.parse(estRow.valor);
      }catch(e){ console.warn('[Hospedaje] Error cache offline:', e.message); }
    }
    return;
  }

  try{
    hospHabitaciones = await supaGet('pos_habitaciones',
      'licencia_email=ilike.'+encodeURIComponent(email)+'&activo=eq.true&order=orden.asc,numero.asc');
    // en_estadia (ocupación real) + reservado (reservas futuras) — se
    // separan localmente, no hace falta otra consulta.
    hospEstadias = await supaGet('pos_estadias',
      'licencia_email=ilike.'+encodeURIComponent(email)+'&estado=in.(en_estadia,reservado)&select=*');
    if(db){
      try{
        await db.mesas_cache.put({ clave:'hosp_habitaciones', valor: JSON.stringify(hospHabitaciones) });
        await db.mesas_cache.put({ clave:'hosp_estadias',     valor: JSON.stringify(hospEstadias) });
      }catch(e){ console.warn('[Hospedaje] Error cacheando:', e.message); }
    }
  }catch(e){ console.warn('[Hospedaje] Error cargando:', e.message); toast('Error al cargar habitaciones'); }
}

/** Estadía EN CURSO (huésped ya adentro) de una habitación, o null */
function hospEstadiaDeHabitacion(habId){
  return hospEstadias.find(function(e){ return e.habitacion_id === habId && e.estado === 'en_estadia'; }) || null;
}

/** Próxima reserva (estado='reservado', aún no llegó) de una habitación, o null */
function hospReservaProximaDeHabitacion(habId){
  var reservas = hospEstadias.filter(function(e){ return e.habitacion_id === habId && e.estado === 'reservado'; });
  if(!reservas.length) return null;
  reservas.sort(function(a,b){ return a.checkin < b.checkin ? -1 : (a.checkin > b.checkin ? 1 : 0); });
  return reservas[0];
}

function _hospEsHoy(fechaIso){
  if(!fechaIso) return false;
  var hoy = new Date(); var pad = function(n){ return String(n).padStart(2,'0'); };
  return fechaIso === hoy.getFullYear()+'-'+pad(hoy.getMonth()+1)+'-'+pad(hoy.getDate());
}

// ── Pantalla principal: tablero de habitaciones ──────────
async function abrirPantallaHabitaciones(){
  await hospCargar();
  if(hospHabitaciones.length === 0){
    const ok = confirm('No hay habitaciones configuradas. ¿Ir a crear una ahora?');
    if(ok){ goTo('scHabitaciones'); renderHabitacionesScreen(); abrirFormHabitacion(); }
    else { goTo('scHabitaciones'); renderHabitacionesScreen(); }
    return;
  }
  goTo('scHabitaciones');
  renderHabitacionesScreen();
}

function _hospColorEstado(estadoVisual){
  if(estadoVisual === 'ocupada')       return '#e53935';
  if(estadoVisual === 'reservada')     return '#3b82f6';
  if(estadoVisual === 'limpieza')      return '#ff9800';
  if(estadoVisual === 'mantenimiento') return '#757575';
  return '#4caf50'; // libre
}

function renderHabitacionesScreen(){
  const cont = document.getElementById('habitacionesGrid');
  if(!cont) return;
  if(!hospHabitaciones.length){
    cont.innerHTML = '<div style="padding:30px;text-align:center;color:#888;">Sin habitaciones — tocá + para crear una</div>';
    return;
  }
  cont.innerHTML = hospHabitaciones.map(function(h){
    const est = hospEstadiaDeHabitacion(h.id);
    const reserva = !est ? hospReservaProximaDeHabitacion(h.id) : null;
    const estadoVisual = est ? 'ocupada' : (reserva ? 'reservada' : (h.estado || 'libre'));
    const color = _hospColorEstado(estadoVisual);
    const noches = est ? Math.max(1, Math.ceil((new Date() - new Date(est.checkin+'T00:00:00')) / 86400000)) : 0;
    let sub;
    if(est){
      sub = escapeHtml(est.huesped_nombre) + '<br><span style="font-size:11px;opacity:.85;">' + noches + ' noche' + (noches!==1?'s':'') + ' · ' + gs(est.total||0) + '</span>';
    } else if(reserva){
      sub = escapeHtml(reserva.huesped_nombre) + '<br><span style="font-size:11px;opacity:.85;">' + (_hospEsHoy(reserva.checkin) ? 'Llega HOY' : 'Llega ' + fmtFechaCorta(reserva.checkin)) + '</span>';
    } else {
      sub = (estadoVisual === 'libre' ? 'Libre' : (estadoVisual === 'limpieza' ? 'En limpieza' : 'Mantenimiento'));
    }
    return '<div class="hosp-card" onclick="onHabitacionTap(' + h.id + ')" oncontextmenu="event.preventDefault();hospMenuHabitacion(' + h.id + ');return false;" '
      + 'style="background:' + color + ';color:#fff;border-radius:10px;padding:14px;cursor:pointer;min-height:88px;display:flex;flex-direction:column;justify-content:space-between;">'
      + '<div style="font-size:17px;font-weight:800;">' + escapeHtml(h.numero) + '</div>'
      + '<div style="font-size:12.5px;line-height:1.35;">' + sub + '</div>'
      + '</div>';
  }).join('');
}

/**
 * Tap en una habitación:
 *   - LIBRE      → abrir Check-in
 *   - OCUPADA    → abrir el Folio (ver/agregar cargos, check-out)
 *   - LIMPIEZA/MANTENIMIENTO → preguntar si se libera (vuelve a libre)
 */
function onHabitacionTap(habId){
  const h = hospHabitaciones.find(function(x){ return x.id === habId; });
  if(!h) return;
  const est = hospEstadiaDeHabitacion(habId);

  if(est){
    abrirFolio(est.id);
    return;
  }
  const reserva = hospReservaProximaDeHabitacion(habId);
  if(reserva){
    abrirReserva(reserva.id);
    return;
  }
  if(h.estado === 'limpieza' || h.estado === 'mantenimiento'){
    if(confirm('Habitación ' + h.numero + ' está en "' + h.estado + '". ¿Marcarla como libre?')){
      hospCambiarEstadoHabitacion(habId, 'libre');
    }
    return;
  }
  abrirCheckIn(habId);
}

/** Long-press / click derecho: acciones rápidas sobre una habitación libre */
function hospMenuHabitacion(habId){
  const h = hospHabitaciones.find(function(x){ return x.id === habId; });
  if(!h || hospEstadiaDeHabitacion(habId) || hospReservaProximaDeHabitacion(habId)) return; // no aplica si está ocupada o reservada
  const opciones = ['Libre', 'Limpieza', 'Mantenimiento', 'Editar habitación'];
  const idx = prompt('Habitación ' + h.numero + ' — elegí (1-4):\n1. Marcar Libre\n2. Marcar en Limpieza\n3. Marcar en Mantenimiento\n4. Editar habitación', '1');
  if(idx === '1') hospCambiarEstadoHabitacion(habId, 'libre');
  else if(idx === '2') hospCambiarEstadoHabitacion(habId, 'limpieza');
  else if(idx === '3') hospCambiarEstadoHabitacion(habId, 'mantenimiento');
  else if(idx === '4') abrirFormHabitacion(habId);
}

async function hospCambiarEstadoHabitacion(habId, estado){
  const h = hospHabitaciones.find(function(x){ return x.id === habId; });
  if(h) h.estado = estado; // optimista
  renderHabitacionesScreen();
  try{ await supaPatch('pos_habitaciones', 'id=eq.'+habId, { estado: estado }, true); }
  catch(e){ toast('Error al cambiar estado: '+e.message); }
}

// ── CHECK-IN ──────────────────────────────────────────────
function abrirCheckIn(habId){
  const h = hospHabitaciones.find(function(x){ return x.id === habId; });
  if(!h) return;
  _hospHabSel = h;
  const hoy = new Date();
  const pad = n => String(n).padStart(2,'0');
  const hoyStr = hoy.getFullYear()+'-'+pad(hoy.getMonth()+1)+'-'+pad(hoy.getDate());

  document.getElementById('hospCkNombre').value = '';
  document.getElementById('hospCkDoc').value = '';
  document.getElementById('hospCkTel').value = '';
  document.getElementById('hospCkNacionalidad').value = 'Paraguaya';
  document.getElementById('hospCkHuespedes').value = '1';
  document.getElementById('hospCkCheckin').value = hoyStr;
  document.getElementById('hospCkCheckout').value = '';
  document.getElementById('hospCkTarifa').value = h.precio_noche || 0;
  document.getElementById('hospCkTitulo').textContent = 'Check-in — Habitación ' + h.numero;
  document.getElementById('hospCheckinOv').style.display = 'flex';
  setTimeout(function(){ document.getElementById('hospCkNombre').focus(); }, 200);
}

function cerrarCheckIn(){
  document.getElementById('hospCheckinOv').style.display = 'none';
  _hospHabSel = null;
}

/**
 * @param {string} modo 'en_estadia' (check-in ahora, huésped ya está acá —
 *   se carga la primera noche) o 'reservado' (reserva a futuro, no se
 *   carga nada todavía — recién al convertirla en check-in real).
 */
async function confirmarCheckIn(modo){
  if(!_hospHabSel) return;
  const nombre = document.getElementById('hospCkNombre').value.trim();
  if(!nombre){ toast('Ingresá el nombre del huésped'); return; }
  const checkin = document.getElementById('hospCkCheckin').value;
  if(!checkin){ toast('Ingresá la fecha de check-in'); return; }
  const tarifa = parseInt(document.getElementById('hospCkTarifa').value) || 0;
  const esReserva = modo === 'reservado';

  const email = localStorage.getItem('lic_email');
  const licId = parseInt(localStorage.getItem('ali')) || null;
  const payload = {
    licencia_id: licId,
    licencia_email: email,
    sucursal: localStorage.getItem('pos_sucursal') || null,
    habitacion_id: _hospHabSel.id,
    huesped_nombre: nombre,
    huesped_documento: document.getElementById('hospCkDoc').value.trim() || null,
    huesped_tel: document.getElementById('hospCkTel').value.trim() || null,
    huesped_nacionalidad: document.getElementById('hospCkNacionalidad').value.trim() || null,
    cantidad_huespedes: parseInt(document.getElementById('hospCkHuespedes').value) || 1,
    checkin: checkin,
    checkout_previsto: document.getElementById('hospCkCheckout').value || null,
    tarifa_noche: tarifa,
    // Reserva: todavía no llegó, no se cobra nada hasta el check-in real.
    // Check-in ahora: la primera noche se carga de una, es lo mínimo que corresponde cobrar.
    cargos: esReserva ? [] : [{
      fecha: checkin, descripcion: 'Noche — Hab. ' + _hospHabSel.numero,
      cantidad: 1, precio_unitario: tarifa, monto: tarifa, iva: '10',
    }],
    total: esReserva ? 0 : tarifa,
    estado: modo,
  };

  const btnId = esReserva ? 'hospCkBtnReservar' : 'hospCkBtnGuardar';
  const btn = document.getElementById(btnId);
  const txtOriginal = btn ? btn.textContent : '';
  if(btn){ btn.disabled = true; btn.textContent = 'Guardando...'; }
  try{
    const result = await supaPost('pos_estadias', payload, null, false);
    const saved = Array.isArray(result) ? result[0] : result;
    if(!saved || !saved.id) throw new Error('Sin ID de estadía');
    hospEstadias.push(saved);
    cerrarCheckIn();
    renderHabitacionesScreen();
    toast(esReserva
      ? 'Reserva OK — Habitación ' + _hospHabSel.numero + ' · ' + nombre
      : 'Check-in OK — Habitación ' + _hospHabSel.numero + ' · ' + nombre);
  }catch(e){
    toast('Error al guardar: ' + e.message);
  }
  if(btn){ btn.disabled = false; btn.textContent = txtOriginal; }
}

// ── RESERVAS (reservado — habitación separada para el futuro) ────────────
function abrirReserva(estadiaId){
  const res = hospEstadias.find(function(e){ return e.id === estadiaId; });
  if(!res) return;
  _hospReservaSel = res;
  const h = hospHabitaciones.find(function(x){ return x.id === res.habitacion_id; });
  document.getElementById('hospResTitulo').textContent = 'Habitación ' + (h ? h.numero : '?') + ' — ' + res.huesped_nombre;
  document.getElementById('hospResSub').textContent =
    'Llega: ' + fmtFechaCorta(res.checkin) + (res.checkout_previsto ? ' · Salida prevista: ' + fmtFechaCorta(res.checkout_previsto) : '')
    + ' · Tarifa: ' + gs(res.tarifa_noche || 0) + '/noche'
    + (res.huesped_tel ? ' · Tel: ' + res.huesped_tel : '');
  document.getElementById('hospReservaOv').style.display = 'flex';
}

function cerrarReserva(){
  document.getElementById('hospReservaOv').style.display = 'none';
  _hospReservaSel = null;
}

async function hospCancelarReserva(){
  const res = _hospReservaSel;
  if(!res) return;
  if(!confirm('¿Cancelar la reserva de ' + res.huesped_nombre + '?')) return;
  try{
    await supaPatch('pos_estadias', 'id=eq.'+res.id, { estado: 'cancelado' }, true);
    hospEstadias = hospEstadias.filter(function(e){ return e.id !== res.id; });
    cerrarReserva();
    renderHabitacionesScreen();
    toast('Reserva cancelada');
  }catch(e){ toast('Error al cancelar: ' + e.message); }
}

/** Convierte una reserva en check-in real (el huésped llegó) — carga la primera noche recién ahora. */
async function hospConvertirReservaEnCheckin(){
  const res = _hospReservaSel;
  if(!res) return;
  const tarifa = res.tarifa_noche || 0;
  const cargos = [{
    fecha: new Date().toISOString().substring(0,10),
    descripcion: 'Noche — Hab. ' + (hospHabitaciones.find(function(h){ return h.id === res.habitacion_id; })||{}).numero,
    cantidad: 1, precio_unitario: tarifa, monto: tarifa, iva: '10',
  }];
  try{
    await supaPatch('pos_estadias', 'id=eq.'+res.id, { estado: 'en_estadia', cargos: cargos, total: tarifa }, true);
    res.estado = 'en_estadia'; res.cargos = cargos; res.total = tarifa;
    cerrarReserva();
    renderHabitacionesScreen();
    toast('Check-in confirmado — ' + res.huesped_nombre);
  }catch(e){ toast('Error al confirmar check-in: ' + e.message); }
}

/** Lista simple de todas las reservas futuras, ordenadas por fecha de llegada */
function abrirReservasList(){
  const cont = document.getElementById('hospReservasListCont');
  const reservas = hospEstadias.filter(function(e){ return e.estado === 'reservado'; })
    .sort(function(a,b){ return a.checkin < b.checkin ? -1 : (a.checkin > b.checkin ? 1 : 0); });
  if(!reservas.length){
    cont.innerHTML = '<div style="text-align:center;color:#888;padding:20px;">Sin reservas próximas</div>';
  } else {
    cont.innerHTML = reservas.map(function(r){
      const h = hospHabitaciones.find(function(x){ return x.id === r.habitacion_id; });
      return '<div onclick="cerrarReservasList();abrirReserva(\'' + r.id + '\')" style="display:flex;justify-content:space-between;align-items:center;padding:12px 4px;border-bottom:1px solid #2a2a2a;cursor:pointer;">'
        + '<div><div style="font-weight:700;color:#fff;">Hab. ' + escapeHtml(h ? h.numero : '?') + ' — ' + escapeHtml(r.huesped_nombre) + '</div>'
        + '<div style="font-size:11.5px;color:#888;margin-top:2px;">' + (_hospEsHoy(r.checkin) ? 'Llega HOY' : 'Llega ' + fmtFechaCorta(r.checkin)) + '</div></div>'
        + '<span style="color:#3b82f6;font-size:18px;">›</span>'
        + '</div>';
    }).join('');
  }
  document.getElementById('hospReservasListOv').style.display = 'flex';
}

function cerrarReservasList(){
  document.getElementById('hospReservasListOv').style.display = 'none';
}

// ── FOLIO (cuenta acumulada del huésped) ──────────────────
function abrirFolio(estadiaId){
  const est = hospEstadias.find(function(e){ return e.id === estadiaId; });
  if(!est) return;
  _hospEstadiaSel = est;
  const h = hospHabitaciones.find(function(x){ return x.id === est.habitacion_id; });

  document.getElementById('hospFolioTitulo').textContent = 'Habitación ' + (h ? h.numero : '?') + ' — ' + est.huesped_nombre;
  document.getElementById('hospFolioSub').textContent =
    'Check-in: ' + fmtFechaCorta(est.checkin) + (est.checkout_previsto ? ' · Salida prevista: ' + fmtFechaCorta(est.checkout_previsto) : '')
    + (est.huesped_documento ? ' · Doc: ' + est.huesped_documento : '')
    + (est.huesped_nacionalidad ? ' · ' + est.huesped_nacionalidad : '');

  renderFolioCargos();
  document.getElementById('hospFolioOv').style.display = 'flex';
}

function fmtFechaCorta(iso){
  if(!iso) return '—';
  const p = String(iso).split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso;
}

function renderFolioCargos(){
  const est = _hospEstadiaSel;
  const cont = document.getElementById('hospFolioCargos');
  if(!est || !cont) return;
  const cargos = est.cargos || [];
  cont.innerHTML = cargos.length
    ? cargos.map(function(c, i){
        return '<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #2a2a2a;font-size:13px;">'
          + '<span>' + escapeHtml(c.descripcion) + (c.cantidad > 1 ? ' ×' + c.cantidad : '') + '</span>'
          + '<span style="font-weight:700;">' + gs(c.monto) + '</span>'
          + '</div>';
      }).join('')
    : '<div style="text-align:center;color:#888;padding:14px;">Sin cargos todavía</div>';
  document.getElementById('hospFolioTotal').textContent = gs(est.total || 0);
}

// ── "+ CONSUMO": reusa la pantalla NORMAL de venta (categorías, buscador,
// favoritos, todo) en vez de duplicar un selector de productos aparte —
// el mozo/recepcionista ya sabe usarla. Se activa un "modo carga a
// habitación": el carrito arranca vacío, el botón COBRAR se convierte en
// "CARGAR A HAB. X" (interceptado en goCobrar(), ver pedidos.js), y un
// banner arriba deja claro en qué modo está y permite cancelar.
var _hospConsumoEstadiaId = null;

function hospAbrirConsumo(){
  if(!_hospEstadiaSel) return;
  const est = _hospEstadiaSel;
  const h = hospHabitaciones.find(function(x){ return x.id === est.habitacion_id; });
  _hospConsumoEstadiaId = est.id;
  window._hospedajeCargandoConsumo = { estadiaId: est.id, habNumero: h ? h.numero : '' };
  setCart([]);
  cerrarFolio();
  const banner = document.getElementById('hospConsumoBanner');
  const bannerTxt = document.getElementById('hospConsumoBannerTxt');
  const label = 'CARGAR A HAB. ' + (h ? h.numero : '');
  if(banner) banner.style.display = 'flex';
  if(bannerTxt) bannerTxt.textContent = 'Agregando consumo — Habitación ' + (h ? h.numero : '') + ' (' + est.huesped_nombre + ')';
  ['btnCobrarLabel','tabCobrarLabel'].forEach(function(id){
    var el = document.getElementById(id); if(el) el.textContent = label;
  });
  var detBtn = document.getElementById('detCobrarBtn'); if(detBtn) detBtn.textContent = label;
  goTo('scSale');
  if(typeof updUI === 'function') updUI();
}

/** Sale del modo consumo sin cargar nada (vuelve todo a la normalidad) */
function hospCancelarConsumo(){
  const estadiaId = _hospConsumoEstadiaId;
  window._hospedajeCargandoConsumo = null;
  _hospConsumoEstadiaId = null;
  setCart([]);
  const banner = document.getElementById('hospConsumoBanner');
  if(banner) banner.style.display = 'none';
  ['btnCobrarLabel','tabCobrarLabel'].forEach(function(id){
    var el = document.getElementById(id); if(el) el.textContent = 'COBRAR';
  });
  var detBtn = document.getElementById('detCobrarBtn'); if(detBtn) detBtn.textContent = 'COBRAR';
  if(typeof updUI === 'function') updUI();
  goTo('scHabitaciones');
  if(estadiaId) abrirFolio(estadiaId);
}

/**
 * Llamada desde goCobrar() (pedidos.js) cuando window._hospedajeCargandoConsumo
 * está seteado — en vez de facturar, vuelca el carrito como cargos de la
 * estadía y descuenta stock de lo que corresponda, YA (el consumo es real
 * en el momento, no hay que esperar al check-out que puede ser días después).
 */
async function hospConfirmarConsumoDesdeCart(){
  const modo = window._hospedajeCargandoConsumo;
  if(!modo) return;
  if(!cart || !cart.length){ toast('No agregaste ningún producto'); return; }
  const est = hospEstadias.find(function(e){ return e.id === modo.estadiaId; });
  if(!est){ toast('No se encontró la estadía'); hospCancelarConsumo(); return; }

  const fecha = new Date().toISOString().substring(0,10);
  const itemsCargables = cart.filter(function(it){ return !it.esDescuento; });
  est.cargos = est.cargos || [];
  itemsCargables.forEach(function(it){
    est.cargos.push({
      fecha: fecha, descripcion: it.name, cantidad: it.qty,
      precio_unitario: it.price, monto: Math.round(it.price * it.qty), iva: it.iva || '10',
    });
  });
  est.total = est.cargos.reduce(function(s, c){ return s + (c.monto || 0); }, 0);

  try{
    await supaPatch('pos_estadias', 'id=eq.'+est.id, { cargos: est.cargos, total: est.total }, true);
  }catch(e){
    toast('Error al guardar el consumo: ' + e.message); return;
  }

  // Stock de lo que controla inventario — best-effort, no bloquea el cargo
  // si falla (el huésped ya consumió, el registro contable no se pierde).
  if(typeof stockEstricto === 'function' && stockEstricto()){
    const itemsStock = itemsCargables.filter(function(it){
      const p = (PRODS || []).find(function(x){ return x.id === it.id; });
      return p && p.inventario;
    });
    if(itemsStock.length){
      try{ await stockDescontarVenta(itemsStock, 'HOSP-' + est.id); }
      catch(e){ console.warn('[Hospedaje] Error descontando stock del consumo:', e.message); }
    }
  }

  window._hospedajeCargandoConsumo = null;
  _hospConsumoEstadiaId = null;
  setCart([]);
  const banner = document.getElementById('hospConsumoBanner');
  if(banner) banner.style.display = 'none';
  ['btnCobrarLabel','tabCobrarLabel'].forEach(function(id){
    var el = document.getElementById(id); if(el) el.textContent = 'COBRAR';
  });
  var detBtn = document.getElementById('detCobrarBtn'); if(detBtn) detBtn.textContent = 'COBRAR';
  if(typeof updUI === 'function') updUI();

  toast('Consumo cargado a Habitación ' + modo.habNumero);
  goTo('scHabitaciones');
  renderHabitacionesScreen();
  abrirFolio(est.id);
}

/** Atajo directo: agregar una noche más con la tarifa configurada */
function hospAgregarNoche(){
  if(!_hospEstadiaSel) return;
  const h = hospHabitaciones.find(function(x){ return x.id === _hospEstadiaSel.habitacion_id; });
  const tarifa = _hospEstadiaSel.tarifa_noche || (h && h.precio_noche) || 0;
  hospAgregarCargo({
    fecha: new Date().toISOString().substring(0,10),
    descripcion: 'Noche — Hab. ' + (h ? h.numero : ''),
    cantidad: 1, precio_unitario: tarifa, monto: tarifa, iva: '10',
  });
}

async function hospAgregarCargo(cargo){
  const est = _hospEstadiaSel;
  if(!est) return;
  est.cargos = est.cargos || [];
  est.cargos.push(cargo);
  est.total = est.cargos.reduce(function(s, c){ return s + (c.monto || 0); }, 0);
  renderFolioCargos();
  renderHabitacionesScreen();
  try{
    await supaPatch('pos_estadias', 'id=eq.'+est.id, { cargos: est.cargos, total: est.total }, true);
    toast('+ ' + cargo.descripcion + ' · ' + gs(cargo.monto));
  }catch(e){
    toast('Error al guardar el cargo: ' + e.message);
  }
}

function cerrarFolio(){
  document.getElementById('hospFolioOv').style.display = 'none';
  _hospEstadiaSel = null;
}

// ── CHECK-OUT: puente estadía → carrito → cobro normal ────
// No reinventa el cobro: carga los cargos acumulados como líneas del
// carrito y navega a la pantalla de venta de siempre — así la estadía
// sale con factura, FE y todos los métodos de pago igual que cualquier
// venta. El registro de la estadía se cierra recién cuando la venta se
// confirma de verdad (ver hospedajeLiquidarEstadiaTrasVenta, enganchado
// desde turno.js).
function checkOutFolio(){
  const est = _hospEstadiaSel;
  if(!est) return;
  if(!est.cargos || !est.cargos.length){ toast('Esta estadía no tiene cargos para cobrar'); return; }
  if(cart.length > 0 && !confirm('Hay productos en el ticket actual — se van a reemplazar por la cuenta de esta habitación. ¿Continuar?')) return;

  const nuevoCart = est.cargos.map(function(c){
    return {
      lineId: Date.now()*1000 + Math.floor(Math.random()*1000),
      id: 'hosp-' + est.id + '-' + Math.random().toString(36).slice(2,7),
      name: c.descripcion, price: c.precio_unitario, qty: c.cantidad,
      obs: '', enviado: false, iva: c.iva || '10', color: '#4caf50', cat: 'Hospedaje',
    };
  });
  setCart(nuevoCart);
  setClienteNombre(est.huesped_nombre);
  window._hospedajeEstadiaCheckout = est.id; // hook leído por turno.js al confirmar la venta
  cerrarFolio();
  goTo('scSale');
  updUI(); updBtnGuardar();
  toast('Cuenta de ' + est.huesped_nombre + ' cargada — elegí forma de pago y COBRAR');
}

/**
 * Se llama desde turno.js DESPUÉS de que la venta de check-out se guardó
 * con éxito. Cierra la estadía y libera la habitación (a "limpieza", no a
 * "libre" — el personal la marca libre a mano cuando ya la preparó).
 */
async function hospedajeLiquidarEstadiaTrasVenta(estadiaId, comprobante){
  const est = hospEstadias.find(function(e){ return e.id === estadiaId; });
  try{
    await supaPatch('pos_estadias', 'id=eq.'+estadiaId, {
      estado: 'checkout',
      checkout_real: new Date().toISOString(),
      comprobante_venta: comprobante || null,
    }, true);
    if(est && est.habitacion_id){
      await supaPatch('pos_habitaciones', 'id=eq.'+est.habitacion_id, { estado: 'limpieza' }, true);
      const h = hospHabitaciones.find(function(x){ return x.id === est.habitacion_id; });
      if(h) h.estado = 'limpieza';
    }
    hospEstadias = hospEstadias.filter(function(e){ return e.id !== estadiaId; });
    if(typeof renderHabitacionesScreen === 'function') renderHabitacionesScreen();
    _log('[Hospedaje] Estadía liquidada:', estadiaId);
  }catch(e){
    console.warn('[Hospedaje] Error liquidando estadía:', e.message);
  }
}

// ── ADMIN LIVIANO DE HABITACIONES (alta/edición desde el POS) ──
// Un hotel chico no necesita ir al panel admin para dar de alta cuartos —
// se hace directo desde la pantalla de Habitaciones (long-press → Editar,
// o el botón + cuando no hay ninguna todavía).
function abrirFormHabitacion(habId){
  const h = habId ? hospHabitaciones.find(function(x){ return x.id === habId; }) : null;
  document.getElementById('hospFormTitulo').textContent = h ? 'Editar habitación' : 'Nueva habitación';
  document.getElementById('hospFormId').value = h ? h.id : '';
  document.getElementById('hospFormNumero').value = h ? h.numero : '';
  document.getElementById('hospFormTipo').value = h ? (h.tipo || 'simple') : 'simple';
  document.getElementById('hospFormPiso').value = h ? (h.piso || '') : '';
  document.getElementById('hospFormCapacidad').value = h ? (h.capacidad || 2) : 2;
  document.getElementById('hospFormPrecio').value = h ? (h.precio_noche || 0) : 0;
  document.getElementById('hospFormOv').style.display = 'flex';
}

function cerrarFormHabitacion(){
  document.getElementById('hospFormOv').style.display = 'none';
}

async function guardarHabitacion(){
  const id = document.getElementById('hospFormId').value;
  const numero = document.getElementById('hospFormNumero').value.trim();
  if(!numero){ toast('Ingresá el número/nombre de la habitación'); return; }
  const email = localStorage.getItem('lic_email');
  const licId = parseInt(localStorage.getItem('ali')) || null;
  const payload = {
    licencia_id: licId, licencia_email: email,
    sucursal: localStorage.getItem('pos_sucursal') || null,
    numero: numero,
    tipo: document.getElementById('hospFormTipo').value,
    piso: document.getElementById('hospFormPiso').value.trim() || null,
    capacidad: parseInt(document.getElementById('hospFormCapacidad').value) || 2,
    precio_noche: parseInt(document.getElementById('hospFormPrecio').value) || 0,
    activo: true,
  };
  try{
    if(id){
      await supaPatch('pos_habitaciones', 'id=eq.'+id, payload, true);
    } else {
      payload.estado = 'libre';
      await supaPost('pos_habitaciones', payload, null, true);
    }
    cerrarFormHabitacion();
    await hospCargar();
    renderHabitacionesScreen();
    toast('Habitación guardada');
  }catch(e){
    toast('Error al guardar: ' + e.message);
  }
}
