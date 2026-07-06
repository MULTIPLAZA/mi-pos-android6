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

// ── Catálogo de precios por tipo de habitación ────────────────────────
// Cada tipo define un precio fijo (aplicado a TODAS las habitaciones de
// ese tipo al guardar — ver hospGuardarPreciosTipo), un precio de fin de
// semana opcional (viernes/sábado, ver _hospTarifaParaNoche) y la
// capacidad por defecto que se autocompleta al elegir el tipo en el
// formulario de habitación. "Otro" queda sin precio fijo (variable,
// se carga a mano por habitación).
var HOSP_PRECIOS_TIPO_DEFAULT = {
  individual:  { precio:200000, precioFinde:null, capacidad:1 },
  matrimonial: { precio:350000, precioFinde:null, capacidad:2 },
  triplo:      { precio:350000, precioFinde:null, capacidad:3 },
  quadruplo:   { precio:450000, precioFinde:null, capacidad:4 },
  quintuplo:   { precio:500000, precioFinde:null, capacidad:5 },
  otro:        { precio:null,   precioFinde:null, capacidad:null },
};
var hospPreciosTipo = {}; // se llena en hospCargarPreciosTipo()

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
    _hospCargarPreciosTipoCache();
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
    await hospCargarPreciosTipo();
    // "Night audit": después del horario de corte, cualquier huésped que
    // siga alojado ya le corresponde una noche más — se carga sola, sin
    // que nadie tenga que acordarse de tocar "+ NOCHE" cada día.
    await hospAutoCargarNochesVencidas();
  }catch(e){ console.warn('[Hospedaje] Error cargando:', e.message); toast('Error al cargar habitaciones'); }
}

// ── Catálogo de precios por tipo: carga/guarda/cascada ────────────────
function _hospPreciosTipoConDefaults(parcial){
  var out = {};
  for(var tipo in HOSP_PRECIOS_TIPO_DEFAULT){
    var base = HOSP_PRECIOS_TIPO_DEFAULT[tipo];
    var pers = (parcial && parcial[tipo]) || {};
    out[tipo] = {
      precio:      pers.precio      !== undefined ? pers.precio      : base.precio,
      precioFinde: pers.precioFinde !== undefined ? pers.precioFinde : base.precioFinde,
      capacidad:   pers.capacidad   !== undefined ? pers.capacidad   : base.capacidad,
    };
  }
  return out;
}

function _hospCargarPreciosTipoCache(){
  try{
    var raw = localStorage.getItem('hosp_precios_tipo');
    hospPreciosTipo = _hospPreciosTipoConDefaults(raw ? JSON.parse(raw) : null);
  }catch(e){ hospPreciosTipo = _hospPreciosTipoConDefaults(null); }
}

async function hospCargarPreciosTipo(){
  const email = localStorage.getItem('lic_email');
  if(!email){ _hospCargarPreciosTipoCache(); return; }
  try{
    const rows = await supaGet('pos_config',
      'licencia_email=eq.'+encodeURIComponent(email)+'&clave=eq.hosp_precios_tipo&select=valor&limit=1');
    const cfg = (rows && rows[0]) ? JSON.parse(rows[0].valor || '{}') : null;
    hospPreciosTipo = _hospPreciosTipoConDefaults(cfg);
    localStorage.setItem('hosp_precios_tipo', JSON.stringify(hospPreciosTipo));
  }catch(e){
    console.warn('[Hospedaje] Error cargando precios por tipo (uso cache):', e.message);
    _hospCargarPreciosTipoCache();
  }
}

/**
 * Guarda el catálogo de precios por tipo y CASCADEA el precio (no la
 * capacidad — esa solo se usa como default al elegir el tipo en el form)
 * a todas las habitaciones activas de cada tipo modificado.
 */
async function hospGuardarPreciosTipo(nuevoCatalogo){
  const email = localStorage.getItem('lic_email');
  hospPreciosTipo = _hospPreciosTipoConDefaults(nuevoCatalogo);
  localStorage.setItem('hosp_precios_tipo', JSON.stringify(hospPreciosTipo));
  if(!email) return;
  try{
    await supaPost('pos_config',
      { licencia_email: email, clave: 'hosp_precios_tipo', valor: JSON.stringify(hospPreciosTipo) },
      'licencia_email,clave', true);
  }catch(e){ console.warn('[Hospedaje] Error guardando precios por tipo:', e.message); }

  // Cascada: toda habitación cuyo tipo tenga un precio fijo configurado
  // pasa a usar ESE precio, sin importar el que tuviera antes.
  const afectadas = hospHabitaciones.filter(function(h){
    var cat = hospPreciosTipo[h.tipo];
    return cat && cat.precio != null && h.precio_noche !== cat.precio;
  });
  for(const h of afectadas){
    h.precio_noche = hospPreciosTipo[h.tipo].precio; // optimista
  }
  if(afectadas.length){
    try{
      await Promise.all(Object.keys(hospPreciosTipo).map(function(tipo){
        var cat = hospPreciosTipo[tipo];
        if(cat.precio == null) return Promise.resolve();
        var hayAlguna = hospHabitaciones.some(function(h){ return h.tipo === tipo; });
        if(!hayAlguna) return Promise.resolve();
        return supaPatch('pos_habitaciones', 'licencia_email=eq.'+encodeURIComponent(email)+'&tipo=eq.'+encodeURIComponent(tipo), { precio_noche: cat.precio }, true);
      }));
    }catch(e){ console.warn('[Hospedaje] Error en cascada de precios:', e.message); }
  }
  _hospRefrescarVista();
}

/** ¿La fecha (YYYY-MM-DD) cae en viernes o sábado? */
function _hospEsFinde(fechaStr){
  if(!fechaStr) return false;
  const d = new Date(fechaStr+'T00:00:00');
  const dow = d.getDay(); // 0=domingo..6=sábado
  return dow === 5 || dow === 6;
}

/**
 * Precio a cobrar por LA NOCHE de una fecha puntual: si cae en fin de
 * semana y el tipo de esa habitación tiene precioFinde configurado, se
 * usa ese; si no, se usa la tarifa base (la acordada/frozen en el check-in).
 */
function _hospTarifaParaNoche(habId, fechaStr, tarifaBase){
  if(_hospEsFinde(fechaStr)){
    const h = hospHabitaciones.find(function(x){ return x.id === habId; });
    const cat = h && hospPreciosTipo[h.tipo];
    if(cat && cat.precioFinde != null && cat.precioFinde > 0) return cat.precioFinde;
  }
  return tarifaBase;
}

// ── NIGHT AUDIT: cargo automático de noches vencidas ──────────────────
// Regla del hotel: el "día" cierra a las HOSP_CUTOFF_HORA (11:00 por
// default). Un huésped que sigue en_estadia después de ese horario ya
// consumió una noche más, se haya acordado el personal de cargarla o no.
var HOSP_CUTOFF_HORA = 11;

/** "Hoy" en términos de día de hotel — antes del corte, seguimos en el día de ayer. */
function _hospDiaHotelActual(){
  const ahora = new Date();
  const d = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  if(ahora.getHours() < HOSP_CUTOFF_HORA) d.setDate(d.getDate()-1);
  return d;
}

/** Cuántas noches corresponden desde el check-in hasta el día de hotel actual (mínimo 1). */
function _hospNochesEsperadas(checkinStr){
  const checkin = new Date(checkinStr+'T00:00:00');
  const dias = Math.round((_hospDiaHotelActual() - checkin) / 86400000);
  return Math.max(1, dias + 1);
}

async function hospAutoCargarNochesVencidas(){
  const activas = hospEstadias.filter(function(e){ return e.estado === 'en_estadia'; });
  for(const est of activas){
    const esperadas = _hospNochesEsperadas(est.checkin);
    const cargadas = (est.cargos || []).filter(function(c){ return c.descripcion && c.descripcion.indexOf('Noche') === 0; }).length;
    const faltantes = esperadas - cargadas;
    if(faltantes <= 0) continue;
    const h = hospHabitaciones.find(function(x){ return x.id === est.habitacion_id; });
    const tarifa = est.tarifa_noche || (h && h.precio_noche) || 0;
    const hoyIso = _hospFechaISO(new Date());
    const checkinDate = new Date(est.checkin+'T00:00:00');
    for(let i=0;i<faltantes;i++){
      // Fecha real de esta noche faltante (checkin + su posición en la
      // estadía) — necesaria para saber si cae en fin de semana, aunque
      // el registro del cargo se siga fechando "hoy" (día en que se auditó).
      const nocheFecha = _hospFechaISO(new Date(checkinDate.getTime() + (cargadas+i)*86400000));
      const tarifaNoche = _hospTarifaParaNoche(est.habitacion_id, nocheFecha, tarifa);
      est.cargos.push({
        fecha: hoyIso, descripcion: 'Noche — Hab. ' + (h ? h.numero : ''),
        cantidad: 1, precio_unitario: tarifaNoche, monto: tarifaNoche, iva: '10',
      });
    }
    est.total = est.cargos.reduce(function(s,c){ return s + (c.monto || 0); }, 0);
    try{
      await supaPatch('pos_estadias', 'id=eq.'+est.id, { cargos: est.cargos, total: est.total }, true);
      _log('[Hospedaje] Night audit: +' + faltantes + ' noche(s) auto-cargadas — ' + est.huesped_nombre);
    }catch(e){ console.warn('[Hospedaje] Error en night audit:', e.message); }
  }
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
    if(ok){ goTo('scHabitaciones'); _hospRefrescarVista(); abrirFormHabitacion(); }
    else { goTo('scHabitaciones'); _hospRefrescarVista(); }
    return;
  }
  goTo('scHabitaciones');
  _hospRefrescarVista();
}

function _hospColorEstado(estadoVisual){
  if(estadoVisual === 'ocupada')       return '#e53935';
  if(estadoVisual === 'reservada')     return '#3b82f6';
  if(estadoVisual === 'limpieza')      return '#ff9800';
  if(estadoVisual === 'mantenimiento') return '#757575';
  return '#4caf50'; // libre
}

function _hospLabelTipo(tipo){
  var labels = {
    individual:'Individual', matrimonial:'Matrimonial', triplo:'Triplo',
    quadruplo:'Quadruplo', quintuplo:'Quintuplo', otro:'Otro',
    // valores viejos (simple/doble/suite) — se conservan para habitaciones
    // ya guardadas con el catálogo anterior, no se ofrecen más en el form.
    simple:'Simple', doble:'Doble', suite:'Suite',
  };
  return labels[tipo] || '';
}

function _hospLabelEstado(estadoVisual){
  if(estadoVisual === 'ocupada')       return 'Ocupada';
  if(estadoVisual === 'reservada')     return 'Reserva';
  if(estadoVisual === 'limpieza')      return 'Limpieza';
  if(estadoVisual === 'mantenimiento') return 'Mantto.';
  return 'Libre';
}

function renderHabitacionesScreen(){
  const cont = document.getElementById('habitacionesGrid');
  if(!cont) return;
  if(!hospHabitaciones.length){
    cont.innerHTML = '<div style="padding:30px;text-align:center;color:var(--muted);">Sin habitaciones — tocá + para crear una</div>';
    return;
  }
  cont.innerHTML = hospHabitaciones.map(function(h){
    const est = hospEstadiaDeHabitacion(h.id);
    const reserva = !est ? hospReservaProximaDeHabitacion(h.id) : null;
    const estadoVisual = est ? 'ocupada' : (reserva ? 'reservada' : (h.estado || 'libre'));
    const color = _hospColorEstado(estadoVisual);
    // Contar las noches REALMENTE cargadas (cargos), no una resta de fechas —
    // eso se desincroniza apenas el check-in queda con fecha futura/pasada
    // distinta a "hoy", o se agregan noches extra a mano (bug real: la
    // tarjeta decía "1 noche" con 3 cargos de noche ya en el folio).
    const noches = est ? (est.cargos || []).filter(function(c){ return c.descripcion && c.descripcion.indexOf('Noche') === 0; }).length : 0;
    let sub;
    if(est){
      sub = escapeHtml(est.huesped_nombre) + '<br><span style="font-size:11px;opacity:.9;">' + noches + ' noche' + (noches!==1?'s':'') + ' · ' + gs(est.total||0) + '</span>';
    } else if(reserva){
      sub = escapeHtml(reserva.huesped_nombre) + '<br><span style="font-size:11px;opacity:.9;">' + (_hospEsHoy(reserva.checkin) ? 'Llega HOY' : 'Llega ' + fmtFechaCorta(reserva.checkin)) + '</span>';
    } else {
      sub = _hospLabelEstado(estadoVisual);
    }
    const tipoLabel = _hospLabelTipo(h.tipo);
    return '<div class="hosp-card" onclick="onHabitacionTap(' + h.id + ')" oncontextmenu="event.preventDefault();hospMenuHabitacion(' + h.id + ');return false;" '
      + 'style="background:' + color + ';">'
      + '<div>'
      + '<div class="hosp-card-num">' + escapeHtml(h.numero) + '</div>'
      + (tipoLabel ? '<div style="font-size:11px;font-weight:600;opacity:.85;margin-top:1px;">' + tipoLabel + '</div>' : '')
      + '</div>'
      + '<div class="hosp-card-sub">' + sub + '</div>'
      + '</div>';
  }).join('');
}

/**
 * Refresca el tablero de habitaciones esté donde esté visible: la pantalla
 * completa (#habitacionesGrid) y/o la vista embebida en Cobrar (#pgrid,
 * cuando la categoría activa es "Habitaciones"). Ambos render son no-op
 * si su contenedor no existe/no está visible, así que llamar a los dos es
 * seguro sin importar desde qué pantalla se disparó el cambio.
 */
function _hospRefrescarVista(){
  renderHabitacionesScreen();
  if(typeof curCat !== 'undefined' && curCat === 'Habitaciones' && document.getElementById('pgrid')){
    renderHabitacionesEnGrid();
  }
}

/**
 * Tablero de habitaciones embebido en la grilla de productos de Cobrar
 * (categoría especial "Habitaciones" en el desplegable). Reutiliza el mismo
 * diseño de tarjeta y las mismas acciones (onHabitacionTap/hospMenuHabitacion)
 * que la pantalla completa de Habitaciones — así el cajero puede cargar un
 * consumo a una habitación sin salir de la pantalla de venta.
 */
async function renderHabitacionesEnGrid(){
  const g = document.getElementById('pgrid');
  if(!g) return;
  if(!hospHabitaciones.length){
    g.innerHTML = '<div style="padding:30px;text-align:center;color:var(--muted);">Cargando habitaciones…</div>';
    await hospCargar();
  }
  if(!hospHabitaciones.length){
    g.innerHTML = '<div style="padding:30px;text-align:center;color:var(--muted);">Sin habitaciones — configurá en el módulo Habitaciones</div>';
    return;
  }
  g.innerHTML = hospHabitaciones.map(function(h){
    const est = hospEstadiaDeHabitacion(h.id);
    const reserva = !est ? hospReservaProximaDeHabitacion(h.id) : null;
    const estadoVisual = est ? 'ocupada' : (reserva ? 'reservada' : (h.estado || 'libre'));
    const color = _hospColorEstado(estadoVisual);
    const tipoLabel = _hospLabelTipo(h.tipo);
    let sub;
    if(est){
      const noches = (est.cargos || []).filter(function(c){ return c.descripcion && c.descripcion.indexOf('Noche') === 0; }).length;
      sub = escapeHtml(est.huesped_nombre) + ' · ' + noches + ' noche' + (noches!==1?'s':'') + ' · ' + gs(est.total || 0);
    } else if(reserva){
      sub = escapeHtml(reserva.huesped_nombre) + ' · ' + (_hospEsHoy(reserva.checkin) ? 'Llega HOY' : 'Llega ' + fmtFechaCorta(reserva.checkin));
    } else {
      sub = _hospLabelEstado(estadoVisual);
    }
    return '<div class="hosp-card" onclick="onHabitacionTap(' + h.id + ')" oncontextmenu="event.preventDefault();hospMenuHabitacion(' + h.id + ');return false;" '
      + 'style="background:' + color + ';min-height:96px;">'
      + '<div>'
      + '<div class="hosp-card-num">' + escapeHtml(h.numero) + '</div>'
      + (tipoLabel ? '<div style="font-size:11px;font-weight:600;opacity:.85;margin-top:1px;">' + tipoLabel + '</div>' : '')
      + '</div>'
      + '<div class="hosp-card-sub" style="font-size:11.5px;">' + sub + '</div>'
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

var _hospMenuHabId = null;

/** Long-press / click derecho: acciones rápidas sobre una habitación libre */
function hospMenuHabitacion(habId){
  const h = hospHabitaciones.find(function(x){ return x.id === habId; });
  if(!h || hospEstadiaDeHabitacion(habId) || hospReservaProximaDeHabitacion(habId)) return; // no aplica si está ocupada o reservada
  _hospMenuHabId = habId;
  document.getElementById('hospMenuHabTitulo').textContent = 'Habitación ' + h.numero;
  document.getElementById('hospMenuHabOv').style.display = 'flex';
}

function cerrarMenuHabitacion(){
  document.getElementById('hospMenuHabOv').style.display = 'none';
  _hospMenuHabId = null;
}

function hospMenuHabAccion(accion){
  const habId = _hospMenuHabId;
  cerrarMenuHabitacion();
  if(!habId) return;
  if(accion === 'editar') abrirFormHabitacion(habId);
  else hospCambiarEstadoHabitacion(habId, accion);
}

async function hospCambiarEstadoHabitacion(habId, estado){
  const h = hospHabitaciones.find(function(x){ return x.id === habId; });
  if(h) h.estado = estado; // optimista
  _hospRefrescarVista();
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
  document.getElementById('hospNochesLbl').textContent = '';
  document.getElementById('hospCheckinOv').style.display = 'flex';
  setTimeout(function(){ document.getElementById('hospCkNombre').focus(); }, 200);
}

/**
 * Empujoncito para que "Salida prevista" se cargue seguido en vez de
 * quedar en blanco (necesario para una futura vista tipo calendario de
 * ocupación) — un toque calcula la fecha en vez de tener que navegar el
 * date picker. No es obligatorio, solo más fácil de llenar.
 */
function hospSetNoches(n){
  const ckEl = document.getElementById('hospCkCheckin');
  const base = ckEl.value ? new Date(ckEl.value+'T00:00:00') : new Date();
  if(!ckEl.value) ckEl.value = _hospFechaISO(base);
  const salida = new Date(base.getTime() + n*86400000);
  document.getElementById('hospCkCheckout').value = _hospFechaISO(salida);
  hospRecalcNoches();
}

function _hospFechaISO(d){
  const pad = n => String(n).padStart(2,'0');
  return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
}

function hospRecalcNoches(){
  const lbl = document.getElementById('hospNochesLbl');
  const ci = document.getElementById('hospCkCheckin').value;
  const co = document.getElementById('hospCkCheckout').value;
  if(!ci || !co){ lbl.textContent = ''; return; }
  const noches = Math.round((new Date(co+'T00:00:00') - new Date(ci+'T00:00:00')) / 86400000);
  lbl.textContent = noches > 0 ? noches + ' noche' + (noches!==1?'s':'') : (noches === 0 ? 'Misma fecha' : 'Fecha inválida');
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
  const tarifaPrimeraNoche = esReserva ? tarifa : _hospTarifaParaNoche(_hospHabSel.id, checkin, tarifa);

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
      cantidad: 1, precio_unitario: tarifaPrimeraNoche, monto: tarifaPrimeraNoche, iva: '10',
    }],
    total: esReserva ? 0 : tarifaPrimeraNoche,
    estado: modo,
  };

  const numeroHab = _hospHabSel.numero; // capturar ANTES de cerrarCheckIn(), que limpia _hospHabSel
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
    _hospRefrescarVista();
    toast(esReserva
      ? 'Reserva OK — Habitación ' + numeroHab + ' · ' + nombre
      : 'Check-in OK — Habitación ' + numeroHab + ' · ' + nombre);
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
    _hospRefrescarVista();
    toast('Reserva cancelada');
  }catch(e){ toast('Error al cancelar: ' + e.message); }
}

/** Convierte una reserva en check-in real (el huésped llegó) — carga la primera noche recién ahora. */
async function hospConvertirReservaEnCheckin(){
  const res = _hospReservaSel;
  if(!res) return;
  const tarifa = res.tarifa_noche || 0;
  const fechaHoy = new Date().toISOString().substring(0,10);
  const tarifaNoche = _hospTarifaParaNoche(res.habitacion_id, fechaHoy, tarifa);
  const cargos = [{
    fecha: fechaHoy,
    descripcion: 'Noche — Hab. ' + (hospHabitaciones.find(function(h){ return h.id === res.habitacion_id; })||{}).numero,
    cantidad: 1, precio_unitario: tarifaNoche, monto: tarifaNoche, iva: '10',
  }];
  try{
    await supaPatch('pos_estadias', 'id=eq.'+res.id, { estado: 'en_estadia', cargos: cargos, total: tarifaNoche }, true);
    res.estado = 'en_estadia'; res.cargos = cargos; res.total = tarifaNoche;
    cerrarReserva();
    _hospRefrescarVista();
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

// ── CALENDARIO DE OCUPACIÓN (vista semanal tipo "tape chart") ────────────
// Filas = habitaciones, columnas = días de la semana visible. Una
// estadía/reserva "cubre" un día si checkin <= día < checkout_previsto
// (si no hay checkout_previsto, se considera abierta indefinidamente —
// por eso el empujoncito de chips de duración en el check-in: cuantas
// más estadías tengan fecha de salida, más útil es esta vista).
var _hospCalWeekStart = null;
var _hospCalOrigen = 'scHabitaciones';

function _hospLunesDeSemana(d){
  var dia = d.getDay(); // 0=domingo..6=sábado
  var offset = dia === 0 ? -6 : 1 - dia;
  var lunes = new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset);
  return lunes;
}

function abrirCalendarioOcupacion(){
  // Recordar desde qué pantalla se abrió (Habitaciones completa o Cobrar)
  // para que "atrás" vuelva ahí y no siempre a Habitaciones.
  const activa = document.querySelector('.screen.active');
  _hospCalOrigen = (activa && activa.id === 'scSale') ? 'scSale' : 'scHabitaciones';
  _hospCalWeekStart = _hospLunesDeSemana(new Date());
  goTo('scHospCalendario');
  renderCalendarioOcupacion();
}

function cerrarCalendarioOcupacion(){
  goTo(_hospCalOrigen);
  if(_hospCalOrigen === 'scHabitaciones' && typeof _hospRefrescarVista === 'function') _hospRefrescarVista();
  if(_hospCalOrigen === 'scSale' && curCat === 'Habitaciones' && typeof renderHabitacionesEnGrid === 'function') renderHabitacionesEnGrid();
}

function hospCalMoverSemana(delta){
  _hospCalWeekStart = new Date(_hospCalWeekStart.getFullYear(), _hospCalWeekStart.getMonth(), _hospCalWeekStart.getDate() + delta*7);
  renderCalendarioOcupacion();
}

function hospCalHoy(){
  _hospCalWeekStart = _hospLunesDeSemana(new Date());
  renderCalendarioOcupacion();
}

function _hospEstadiaCubreDia(e, diaStr){
  if(e.checkin > diaStr) return false;
  if(e.checkout_previsto && diaStr >= e.checkout_previsto) return false;
  return true;
}

function renderCalendarioOcupacion(){
  const dias = [];
  for(let i=0;i<7;i++){ dias.push(new Date(_hospCalWeekStart.getFullYear(), _hospCalWeekStart.getMonth(), _hospCalWeekStart.getDate()+i)); }
  const diasStr = dias.map(_hospFechaISO);
  const nombresDia = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const hoyStr = _hospFechaISO(new Date());

  document.getElementById('hospCalRango').textContent = fmtFechaCorta(diasStr[0]) + ' — ' + fmtFechaCorta(diasStr[6]);

  const theadHtml = '<tr>'
    + '<th style="padding:14px 16px;background:#1a1a1a;position:sticky;left:0;z-index:1;width:110px;text-align:left;font-size:12px;color:#888;text-transform:uppercase;">Habitación</th>'
    + dias.map(function(d, i){
        const esHoy = diasStr[i] === hoyStr;
        return '<th style="padding:12px 6px;text-align:center;font-size:13px;color:' + (esHoy?'#4caf50':'#aaa') + ';font-weight:800;">' + nombresDia[d.getDay()] + '<br><span style="font-size:16px;">' + d.getDate() + '</span></th>';
      }).join('')
    + '</tr>';

  const rowsHtml = hospHabitaciones.map(function(h){
    const celdas = diasStr.map(function(dStr){
      const est = hospEstadias.find(function(e){
        return e.habitacion_id === h.id && (e.estado === 'en_estadia' || e.estado === 'reservado') && _hospEstadiaCubreDia(e, dStr);
      });
      const esHoy = dStr === hoyStr;
      const color = est ? (est.estado === 'en_estadia' ? '#e53935' : '#3b82f6') : '#1e1e1e';
      const texto = est ? escapeHtml((est.huesped_nombre||'').split(' ')[0]) : '';
      const onclick = est
        ? 'onclick="' + (est.estado === 'en_estadia' ? 'abrirFolio(\'' + est.id + '\')' : 'abrirReserva(\'' + est.id + '\')') + '"'
        : '';
      return '<td ' + onclick + ' style="background:' + color + ';color:#fff;text-align:center;font-size:13.5px;font-weight:700;padding:20px 6px;'
        + 'cursor:' + (est ? 'pointer' : 'default') + ';border:1px solid #2a2a2a;' + (esHoy ? 'outline:2px solid #4caf50;outline-offset:-2px;' : '') + '">'
        + texto + '</td>';
    }).join('');
    return '<tr><td style="padding:14px 16px;font-weight:800;color:#fff;font-size:15px;background:#1a1a1a;position:sticky;left:0;white-space:nowrap;border:1px solid #2a2a2a;">' + escapeHtml(h.numero) + '</td>' + celdas + '</tr>';
  }).join('');

  document.getElementById('hospCalTabla').innerHTML = hospHabitaciones.length
    ? '<table style="border-collapse:collapse;width:100%;table-layout:fixed;"><thead>' + theadHtml + '</thead><tbody>' + rowsHtml + '</tbody></table>'
    : '<div style="text-align:center;color:#888;padding:30px;">Sin habitaciones configuradas</div>';
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
  _hospRefrescarVista();
  abrirFolio(est.id);
}

/** Atajo directo: agregar una noche más con la tarifa configurada */
function hospAgregarNoche(){
  if(!_hospEstadiaSel) return;
  const h = hospHabitaciones.find(function(x){ return x.id === _hospEstadiaSel.habitacion_id; });
  const tarifa = _hospEstadiaSel.tarifa_noche || (h && h.precio_noche) || 0;
  const fechaHoy = new Date().toISOString().substring(0,10);
  const tarifaNoche = _hospTarifaParaNoche(_hospEstadiaSel.habitacion_id, fechaHoy, tarifa);
  hospAgregarCargo({
    fecha: fechaHoy,
    descripcion: 'Noche — Hab. ' + (h ? h.numero : ''),
    cantidad: 1, precio_unitario: tarifaNoche, monto: tarifaNoche, iva: '10',
  });
}

async function hospAgregarCargo(cargo){
  const est = _hospEstadiaSel;
  if(!est) return;
  est.cargos = est.cargos || [];
  est.cargos.push(cargo);
  est.total = est.cargos.reduce(function(s, c){ return s + (c.monto || 0); }, 0);
  renderFolioCargos();
  _hospRefrescarVista();
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
    if(typeof renderHabitacionesScreen === 'function') _hospRefrescarVista();
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
  const tipoDefault = hospPreciosTipo['individual'] || HOSP_PRECIOS_TIPO_DEFAULT.individual;
  document.getElementById('hospFormTitulo').textContent = h ? 'Editar habitación' : 'Nueva habitación';
  document.getElementById('hospFormId').value = h ? h.id : '';
  document.getElementById('hospFormNumero').value = h ? h.numero : '';
  document.getElementById('hospFormTipo').value = h ? (h.tipo || 'individual') : 'individual';
  document.getElementById('hospFormPiso').value = h ? (h.piso || '') : '';
  document.getElementById('hospFormCapacidad').value = h ? (h.capacidad || 2) : (tipoDefault.capacidad || 2);
  document.getElementById('hospFormPrecio').value = h ? (h.precio_noche || 0) : (tipoDefault.precio || 0);
  document.getElementById('hospFormOv').style.display = 'flex';
}

/** Al elegir un tipo en el form, autocompletar su precio y capacidad de catálogo. */
function hospFormTipoCambio(){
  const tipo = document.getElementById('hospFormTipo').value;
  const cat = hospPreciosTipo[tipo];
  if(!cat) return;
  if(cat.precio != null) document.getElementById('hospFormPrecio').value = cat.precio;
  if(cat.capacidad != null) document.getElementById('hospFormCapacidad').value = cat.capacidad;
}

function cerrarFormHabitacion(){
  document.getElementById('hospFormOv').style.display = 'none';
}

// ── Modal: precios por tipo de habitación ─────────────────────────────
function abrirPreciosTipo(){
  const cont = document.getElementById('hospPreciosTipoRows');
  const tipos = ['individual','matrimonial','triplo','quadruplo','quintuplo','otro'];
  cont.innerHTML = tipos.map(function(tipo){
    const cat = hospPreciosTipo[tipo] || HOSP_PRECIOS_TIPO_DEFAULT[tipo];
    const cantHabs = hospHabitaciones.filter(function(h){ return h.tipo === tipo; }).length;
    const esOtro = tipo === 'otro';
    return '<div style="border-bottom:1px solid #2a2a2a;padding-bottom:12px;">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">'
        + '<span style="font-size:14px;font-weight:700;color:#fff;">' + _hospLabelTipo(tipo) + '</span>'
        + '<span style="font-size:11px;color:#666;">' + cantHabs + ' habitación' + (cantHabs!==1?'es':'') + '</span>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr 0.7fr;gap:8px;">'
        + '<div><label style="font-size:10px;color:#888;text-transform:uppercase;font-weight:700;display:block;margin-bottom:3px;">Precio</label>'
          + '<input id="hospPT_precio_' + tipo + '" type="number" min="0" value="' + (cat.precio != null ? cat.precio : '') + '" placeholder="' + (esOtro ? 'variable' : '0') + '" style="width:100%;background:#111;border:1.5px solid #333;border-radius:8px;color:#fff;font-size:13px;padding:9px 10px;outline:none;box-sizing:border-box;"></div>'
        + '<div><label style="font-size:10px;color:#888;text-transform:uppercase;font-weight:700;display:block;margin-bottom:3px;">Precio finde</label>'
          + '<input id="hospPT_finde_' + tipo + '" type="number" min="0" value="' + (cat.precioFinde != null ? cat.precioFinde : '') + '" placeholder="= normal" style="width:100%;background:#111;border:1.5px solid #333;border-radius:8px;color:#fff;font-size:13px;padding:9px 10px;outline:none;box-sizing:border-box;"></div>'
        + '<div><label style="font-size:10px;color:#888;text-transform:uppercase;font-weight:700;display:block;margin-bottom:3px;">Capac.</label>'
          + '<input id="hospPT_capacidad_' + tipo + '" type="number" min="1" value="' + (cat.capacidad != null ? cat.capacidad : '') + '" placeholder="' + (esOtro ? '—' : '1') + '" style="width:100%;background:#111;border:1.5px solid #333;border-radius:8px;color:#fff;font-size:13px;padding:9px 10px;outline:none;box-sizing:border-box;"></div>'
      + '</div>'
    + '</div>';
  }).join('');
  document.getElementById('hospPreciosTipoOv').style.display = 'flex';
}

function cerrarPreciosTipo(){
  document.getElementById('hospPreciosTipoOv').style.display = 'none';
}

async function guardarPreciosTipoDesdeForm(){
  const tipos = ['individual','matrimonial','triplo','quadruplo','quintuplo','otro'];
  const nuevo = {};
  tipos.forEach(function(tipo){
    const pEl = document.getElementById('hospPT_precio_' + tipo);
    const fEl = document.getElementById('hospPT_finde_' + tipo);
    const cEl = document.getElementById('hospPT_capacidad_' + tipo);
    nuevo[tipo] = {
      precio:      pEl.value !== '' ? parseInt(pEl.value) || 0 : null,
      precioFinde: fEl.value !== '' ? parseInt(fEl.value) || 0 : null,
      capacidad:   cEl.value !== '' ? parseInt(cEl.value) || null : null,
    };
  });
  cerrarPreciosTipo();
  toast('Guardando precios...');
  await hospGuardarPreciosTipo(nuevo);
  toast('Precios actualizados');
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
    _hospRefrescarVista();
    toast('Habitación guardada');
  }catch(e){
    toast('Error al guardar: ' + e.message);
  }
}
