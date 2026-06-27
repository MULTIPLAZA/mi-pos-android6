// ── Mesas y Salones ──

// ════════════════════════════════════════════════════════
// SISTEMA DE MESAS
// ════════════════════════════════════════════════════════

let mesasSalones  = [];   // [{id, nombre, color, activo}]
let mesasMesas    = [];   // [{id, salon_id, nombre, capacidad}]
let mesaSalonSel  = null; // id del salón activo en la pantalla
// mesaActual — declared in state.js

// ── Cargar desde Supabase o IndexedDB (offline) ───────
async function mesasCargar(){
  const licId = parseInt(localStorage.getItem('ali'))||null;
  if(!licId || USAR_DEMO) return;

  // Sin internet — cargar desde IndexedDB
  if(!navigator.onLine){
    if(db){
      try{
        const salRow = await db.mesas_cache.get('salones');
        const mesRow = await db.mesas_cache.get('mesas');
        if(salRow) mesasSalones = JSON.parse(salRow.valor);
        if(mesRow) mesasMesas   = JSON.parse(mesRow.valor);
        if(mesasSalones.length) _log('[Mesas] Cargadas desde cache offline:', mesasSalones.length, 'salones');
      }catch(e){ console.warn('[Mesas] Error cache offline:', e.message); }
    }
    return;
  }

  // Con internet — cargar desde Supabase y cachear
  try{
    mesasSalones = await supaGet('pos_salones',
      'licencia_id=eq.'+licId+'&activo=eq.true&order=orden.asc,id.asc');

    mesasMesas = await supaGet('pos_mesas',
      'licencia_id=eq.'+licId+'&activo=eq.true&order=orden.asc,id.asc');

    // Cachear en IndexedDB para uso offline
    if(db){
      try{
        await db.mesas_cache.put({ clave:'salones', valor: JSON.stringify(mesasSalones) });
        await db.mesas_cache.put({ clave:'mesas',   valor: JSON.stringify(mesasMesas)   });
        _log('[Mesas] Cacheadas en IndexedDB:', mesasSalones.length, 'salones,', mesasMesas.length, 'mesas');
      }catch(e){ console.warn('[Mesas] Error cacheando:', e.message); }
    }
  }catch(e){ console.warn('[Mesas] Error cargando:', e.message); toast('Error al cargar mesas'); }
}

// ── Abrir pantalla mesas ──────────────────────────────
async function abrirPantallaMesas(){
  // Sync de pedidos satélite antes de mostrar las mesas
  // para que las mesas ocupadas (rojo) reflejen el estado real de Supabase
  cajaSyncPedidosSatelite().catch(function(e){ console.warn('[Mesas] Error sincronizando pedidos satélite:', e.message); });
  await mesasCargar();
  if(mesasSalones.length === 0){
    const ok = confirm('No hay salones configurados. ¿Deseas crear uno ahora?');
    if(ok) { goTo('scMesas'); renderMesasScreen(); abrirGestionMesas(); }
    return;
  }
  // Si hay mesa activa, ir al salón de esa mesa
  if(mesaActual){
    const mesa = mesasMesas.find(m => m.id === mesaActual.id);
    if(mesa) mesaSalonSel = mesa.salon_id;
  }
  if(!mesaSalonSel && mesasSalones.length) mesaSalonSel = mesasSalones[0].id;
  goTo('scMesas');
  renderMesasScreen();
}

// ── Render pantalla principal ─────────────────────────
function renderMesasScreen(){
  // Tabs de salones
  const bar = document.getElementById('mesasSalonesBar');
  if(!bar) return;
  bar.innerHTML = mesasSalones.map(s =>
    '<button class="salon-tab'+(mesaSalonSel===s.id?' sel':'')+
    '" style="border-bottom-color:'+(mesaSalonSel===s.id?s.color:'transparent')+
    ';color:'+(mesaSalonSel===s.id?s.color:'var(--muted)')+
    '" onclick="mesaSelSalon('+s.id+')">'+s.nombre+'</button>'
  ).join('');

  // Mesas del salón seleccionado
  const salon = mesasSalones.find(s => s.id === mesaSalonSel);
  const mesas = mesasMesas.filter(m => m.salon_id === mesaSalonSel);
  const grid  = document.getElementById('mesasGrid');
  const empty = document.getElementById('mesasEmpty');

  if(!salon || !mesas.length){
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  grid.innerHTML = mesas.map(m => {
    const pend    = pendientes.find(p => p.mesa_id === m.id);
    const ocupada = !!pend;
    const esActiva = mesaActual && mesaActual.id === m.id;
    const estado  = esActiva ? 'activa' : ocupada ? 'ocupada' : 'libre';
    const info    = ocupada
      ? ('₲'+Math.round(pend.total||0).toLocaleString('es-PY'))
      : (m.capacidad ? m.capacidad+' pers.' : '');
    // Si la mesa esta ocupada y el pendiente tiene nombre de cliente, mostrarlo
    const cliBloque = (ocupada && pend.clienteNombre)
      ? '<div class="mesa-tile-cliente" style="font-size:10px;font-weight:700;color:var(--text);opacity:.85;margin-top:2px;display:flex;align-items:center;gap:3px;justify-content:center;line-height:1.1;">'+
          '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="opacity:.7"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>'+
          '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:90%;">'+esc(pend.clienteNombre)+'</span>'+
        '</div>'
      : '';
    // Long-press en mesa ocupada → opcion de liberar forzado
    var lpAttrs = ocupada
      ? ' oncontextmenu="event.preventDefault();liberarMesaForzado('+m.id+');return false;"'
        + ' ontouchstart="_mesaLpStart(event,'+m.id+')"'
        + ' ontouchend="_mesaLpEnd()"'
        + ' ontouchcancel="_mesaLpEnd()"'
        + ' ontouchmove="_mesaLpEnd()"'
      : '';
    return '<div class="mesa-tile '+estado+'" onclick="onMesaTap('+m.id+')"'+lpAttrs+'>' +
      '<div class="mesa-tile-nombre">'+m.nombre+'</div>'+
      (info ? '<div class="mesa-tile-info">'+info+'</div>' : '')+
      cliBloque+
      '</div>';
  }).join('');
}

function mesaSelSalon(id){
  mesaSalonSel = id;
  renderMesasScreen();
}

// ── Long-press helpers (mobile) ─────────────────────────
// Apretar y mantener 700ms sobre una mesa ocupada → ofrece liberar
var _mesaLpTimer = null;
function _mesaLpStart(ev, mesaId){
  _mesaLpEnd();
  _mesaLpTimer = setTimeout(function(){
    _mesaLpTimer = null;
    if(navigator.vibrate) try{ navigator.vibrate(40); }catch(e){}
    liberarMesaForzado(mesaId);
  }, 700);
}
function _mesaLpEnd(){
  if(_mesaLpTimer){ clearTimeout(_mesaLpTimer); _mesaLpTimer = null; }
}

// ── Tap en una mesa ───────────────────────────────────
function onMesaTap(mesaId){
  const mesa = mesasMesas.find(m => m.id === mesaId);
  if(!mesa) return;
  const pend = pendientes.find(p => p.mesa_id === mesaId);

  // GUARDA: si estamos en MODO LECTURA viendo una venta cobrada, NO permitir
  // asignar mesa — la venta ya esta cerrada y no se puede modificar.
  // Esto evita que la mesa quede "ocupada" sin pendiente asociable.
  if(typeof _modoLectura !== 'undefined' && _modoLectura && !pend){
    toast('Estas viendo una venta cobrada (solo lectura). Salí con NUEVA VENTA antes de asignar mesa.');
    return;
  }

  if(pend){
    // Mesa OCUPADA → cargar su ticket y volver al POS
    setMesaActual(mesa);
    cargarTicket(pendientes.indexOf(pend));  // cargarTicket ya hace goTo('scSale')
    setTipoPedido('local');
    updMesaBtn();
    updTabTicketHeader();
    toast('Mesa '+mesa.nombre+' — Ticket #'+String(pend.nro).padStart(4,'0'));
  } else {
    // Mesa LIBRE → asignar al ticket actual (vaciar si había otro)
    if(mesaActual && mesaActual.id !== mesa.id){
      if(!confirm('Tenés la mesa '+mesaActual.nombre+' asignada. ¿Cambiar a '+mesa.nombre+'?')) return;
      clearMesaActual();
    }
    // Si hay carrito activo de otra fuente, preguntar
    if(cart.length > 0 && currentTicketNro === null){
      if(!confirm('Hay productos en el ticket actual. ¿Asignar esta mesa y continuar?')){
        return;
      }
    }
    setMesaActual(mesa);
    setTipoPedido('local');
    updMesaBtn();
    updTabTicketHeader();
    goTo('scSale');
    toast('Mesa '+mesa.nombre+' lista — agregá productos');
  }
}

// ── Long-press en una mesa OCUPADA → liberar forzado ─────
// Para casos atascados donde una mesa queda marcada como ocupada pero
// el pendiente asociado tiene datos basura (caso legacy del bug de
// vincular mesa estando en modo lectura).
function liberarMesaForzado(mesaId){
  const mesa = mesasMesas.find(m => m.id === mesaId);
  if(!mesa) return;
  const pend = pendientes.find(p => p.mesa_id === mesaId);
  if(!pend){
    // No hay pendiente — la mesa figuraba ocupada por error de cache. Refrescar.
    if(typeof renderMesasScreen === 'function') renderMesasScreen();
    toast('Mesa '+mesa.nombre+' ya estaba libre. Pantalla actualizada.');
    return;
  }
  var resumen = '#'+String(pend.nro).padStart(4,'0')+' ('+(pend.cart||[]).length+' items · Gs '+Math.round(pend.total||0).toLocaleString('es-PY')+')';
  if(!confirm('Liberar mesa '+mesa.nombre+'?\n\nEsto elimina el ticket pendiente '+resumen+'. No se puede deshacer.')) return;
  // Eliminar el pendiente
  var idx = pendientes.indexOf(pend);
  if(idx >= 0){
    pendientes.splice(idx, 1);
    if(typeof guardarPendientesLocal === 'function') guardarPendientesLocal();
  }
  if(typeof renderMesasScreen === 'function') renderMesasScreen();
  if(typeof updBtnGuardar === 'function') updBtnGuardar();
  toast('Mesa '+mesa.nombre+' liberada — ticket '+resumen+' eliminado');
}

// ── Guardar ticket con mesa asignada ──────────────────
function guardarConMesa(){
  if(!mesaActual) return;
  if(!cart.length){ toast('Agregá productos primero'); return; }
  const obs = mesaActual.nombre;

  if(currentTicketNro !== null){
    // Actualizar pendiente existente
    const idx = pendientes.findIndex(t => t.nro === currentTicketNro);
    if(idx >= 0){
      pendientes[idx].cart    = JSON.parse(JSON.stringify(cart));
      pendientes[idx].total   = calcTotal();
      pendientes[idx].obs     = obs;
      pendientes[idx].mesa_id = mesaActual.id;
      pendientes[idx].fecha   = new Date().toISOString();
      pendientes[idx].descuentoTicket = ticketDescuento || 0;
      // Persistir nombre del cliente si estaba cargado en la venta
      pendientes[idx].clienteNombre = (typeof clienteNombre !== 'undefined') ? clienteNombre : '';
      const mesaNombreUpd = mesaActual.nombre;
      guardarPendientesLocal();
      // Limpiar y volver a mesas
      clearCart();
      setCurrentTicketNro(null);
      clearMesaActual();
      setTipoPedido('llevar');
      updMesaBtn();
      updUI();
      updBtnGuardar();
      updTabTicketHeader();
      toast('Mesa '+mesaNombreUpd+' — actualizada');
      if(mesasSalones.length > 0){
        abrirPantallaMesas();
      } else {
        goTo('scSale');
      }
      return;
    }
  }
  // Crear nuevo pendiente
  const nro = incrementTicketCounter();
  const mesaNombre = mesaActual.nombre;
  addPendiente({
    nro,
    obs:           obs,
    clienteNombre: (typeof clienteNombre !== 'undefined') ? clienteNombre : '',
    cart:          JSON.parse(JSON.stringify(cart)),
    total:         calcTotal(),
    fecha:         new Date().toISOString(),
    mesa_id:       mesaActual.id,
    esPresupuesto: false,
    descuentoTicket: ticketDescuento || 0,
  });
  guardarPendientesLocal();

  // Limpiar carrito y mesa para nueva venta
  clearCart();
  setCurrentTicketNro(null);
  clearMesaActual();
  setTipoPedido('llevar');
  updMesaBtn();
  updUI();
  updBtnGuardar();
  updTabTicketHeader();

  toast('Mesa '+mesaNombre+' — Ticket #'+String(nro).padStart(4,'0')+' guardado');

  // Volver a pantalla de mesas para seguir atendiendo
  if(mesasSalones.length > 0){
    abrirPantallaMesas();
  } else {
    goTo('scSale');
  }
}

// ── onBtnLocal: abrir pantalla mesas ──────────────────
function onBtnLocal(){
  if(mesasSalones.length > 0){
    abrirPantallaMesas();
  } else {
    setTipoPedido('local');
  }
}

// ── updMesaBtn: actualiza texto del botón Local con la mesa actual ──
function updMesaBtn(){
  var label = mesaActual ? mesaActual.nombre : 'Local';
  // Botón móvil
  var mbtn = document.getElementById('mobTipoBtnLocal');
  if(mbtn) mbtn.textContent = label;
  // Botón tablet/PC
  var tbtn = document.getElementById('tipoBtnLocal');
  if(tbtn) tbtn.textContent = label;
}

// ── Limpiar mesa al confirmar pago ────────────────────
function mesaLimpiarAlPagar(){
  clearMesaActual();
  updMesaBtn();
}

// ── Helpers ───────────────────────────────────────────
function hexToRgb(hex){
  hex = hex.replace('#','');
  if(hex.length===3) hex = hex.split('').map(x=>x+x).join('');
  const n = parseInt(hex,16);
  return ((n>>16)&255)+','+(((n>>8)&255))+','+(n&255);
}

// ══════════════════════════════════════════════════════
// GESTIÓN SALONES Y MESAS (modal)
// ══════════════════════════════════════════════════════
const MESA_COLORES = [
  '#e53935','#e91e63','#9c27b0','#673ab7','#3f51b5',
  '#1565c0','#0288d1','#00838f','#2e7d32','#558b2f',
  '#f57f17','#e65100','#4e342e','#546e7a','#37474f',
];

let mesaEditSalonId = null;  // salón en edición
let mesaEditMesaId  = null;  // mesa en edición
let mesaColorSel    = '#1565c0';

function cerrarModalMesas(){
  document.getElementById('mesasModal').classList.remove('open');
}

function abrirGestionMesas(){
  mesaEditSalonId = null;
  mesaEditMesaId  = null;
  renderModalGestion();
  document.getElementById('mesasModal').classList.add('open');
}

function renderModalGestion(){
  const mc = document.getElementById('mesasModalContent');
  const salonItems = mesasSalones.map(s =>
    '<div class="mesas-salon-item">'+
    '<div class="mesas-salon-color" style="background:'+s.color+'"></div>'+
    '<span class="mesas-salon-name">'+s.nombre+'</span>'+
    '<button class="mesas-btn-sm" onclick="editarSalon('+s.id+')">Editar</button>'+
    '<button class="mesas-btn-sm danger" onclick="eliminarSalon('+s.id+')">Borrar</button>'+
    '</div>'
  ).join('') || '<p style="color:var(--muted);font-size:13px;">Sin salones aún.</p>';

  mc.innerHTML =
    '<div class="mesas-modal-title">Gestión de Salones y Mesas</div>'+

    '<div class="mesas-section-title">Salones</div>'+
    '<div class="mesas-salon-list">'+salonItems+'</div>'+
    '<button class="mesas-btn-primary" onclick="abrirFormSalon(null)">+ Nuevo Salón</button>'+

    (mesasSalones.length > 0 ?
      '<div class="mesas-section-title" style="margin-top:20px;">Mesas por Salón</div>'+
      mesasSalones.map(s => {
        const mm = mesasMesas.filter(m => m.salon_id === s.id);
        return '<div style="margin-bottom:12px;">'+
          '<div style="font-size:12px;font-weight:700;color:'+s.color+';margin-bottom:6px;text-transform:uppercase;">'+s.nombre+'</div>'+
          '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px;">'+
          mm.map(m =>
            '<div style="display:flex;align-items:center;gap:4px;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:5px 8px;">'+
            '<span style="font-size:13px;font-weight:700;color:var(--text);">'+m.nombre+'</span>'+
            '<button class="mesas-btn-sm" style="padding:3px 7px;" onclick="editarMesa('+m.id+')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>'+
            '<button class="mesas-btn-sm danger" style="padding:3px 7px;" onclick="eliminarMesa('+m.id+')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>'+
            '</div>'
          ).join('')+
          '</div>'+
          '<button class="mesas-btn-sm" onclick="abrirFormMesa('+s.id+')">+ Agregar mesa a '+s.nombre+'</button>'+
          '</div>';
      }).join('') : '')+

    '<div style="height:12px;"></div>'+
    '<button class="mesas-btn-sm" style="width:100%;padding:12px;" onclick="cerrarModalMesas()">Cerrar</button>';
}

function abrirFormSalon(salonId){
  const s = salonId ? mesasSalones.find(x => x.id === salonId) : null;
  mesaColorSel = s ? s.color : '#1565c0';
  const mc = document.getElementById('mesasModalContent');
  const coloresHTML = MESA_COLORES.map(c =>
    '<div class="mesas-color-swatch'+(c===mesaColorSel?' sel':'')+
    '" style="background:'+c+'" onclick="selMesaColor(this)" data-color="'+c+'"></div>'
  ).join('');
  mc.innerHTML =
    '<div class="mesas-modal-title">'+(s?'Editar':'Nuevo')+' Salón</div>'+
    '<div class="mesas-form-row">'+
      '<label class="mesas-form-label">Nombre del salón</label>'+
      '<input class="mesas-form-input" id="formSalonNombre" placeholder="Ej: Terraza, Salón Principal" value="'+(s?s.nombre:'')+'" maxlength="40">'+
    '</div>'+
    '<div class="mesas-form-row">'+
      '<label class="mesas-form-label">Color del salón</label>'+
      '<div class="mesas-color-row" id="mesasColorRow">'+coloresHTML+'</div>'+
    '</div>'+
    (!s ?
      '<div class="mesas-form-row">'+
        '<label class="mesas-form-label">Cantidad de mesas a crear</label>'+
        '<input class="mesas-form-input" id="formSalonCantMesas" type="number" min="0" max="50" value="4" placeholder="Ej: 6">'+
        '<div style="font-size:11px;color:var(--muted);margin-top:3px;">Se crearán automáticamente: Mesa 1, Mesa 2...</div>'+
      '</div>'
    : '')+
    '<button class="mesas-btn-primary" style="margin-top:12px;" onclick="guardarSalon('+(salonId||'null')+')">'+
      (s ? 'Guardar cambios' : 'Crear Salón')+'</button>'+
    '<button class="mesas-btn-sm" style="width:100%;margin-top:8px;padding:12px;" onclick="abrirGestionMesas()">← Volver</button>';
}

function selMesaColor(el){
  mesaColorSel = el.dataset.color || el.style.backgroundColor;
  document.querySelectorAll('.mesas-color-swatch').forEach(s => s.classList.remove('sel'));
  el.classList.add('sel');
}

async function guardarSalon(salonId){
  const nombre = document.getElementById('formSalonNombre').value.trim();
  if(!nombre){ toast('Ingresá el nombre del salón'); return; }

  // Obtener licId — intentar varias fuentes
  let licId = parseInt(localStorage.getItem('ali'))||null;
  if(!licId){
    // Intentar recuperar desde Supabase por email
    const email = localStorage.getItem('lic_email');
    if(email && !USAR_DEMO){
      try{
        const ld = await supaGet('licencias',
          'email_cliente=ilike.'+encodeURIComponent(email)+'&activa=eq.true&select=id&limit=1');
        if(ld&&ld[0]){ licId=ld[0].id; localStorage.setItem('ali',String(licId)); }
      }catch(e){ console.warn('[Mesas] Error recuperando licencia:', e.message); }
    }
  }
  if(!licId){ toast('Error: sin licencia configurada'); return; }

  const sucId = parseInt(localStorage.getItem('pos_sucursal_id'))||null;
  const cantEl = document.getElementById('formSalonCantMesas');
  const cantMesas = cantEl ? (parseInt(cantEl.value)||0) : 0;

  try{
    if(salonId){
      // Solo editar nombre y color
      await supaPatch('pos_salones', 'id=eq.'+salonId+'&licencia_id=eq.'+licId,
        {nombre, color:mesaColorSel}, true);
    } else {
      // Crear salón y obtener su id
      const data = await supaPost('pos_salones',
        {licencia_id:licId, sucursal_id:sucId, nombre, color:mesaColorSel});
      const nuevoSalonId = Array.isArray(data) ? data[0].id : data.id;

      // Crear mesas automáticamente si cantMesas > 0
      if(cantMesas > 0 && nuevoSalonId){
        const mesasPayload = [];
        for(let i=1; i<=cantMesas; i++){
          mesasPayload.push({
            salon_id:    nuevoSalonId,
            licencia_id: licId,
            sucursal_id: sucId,
            nombre:      'Mesa '+i,
            capacidad:   4,
          });
        }
        try {
          await supaPost('pos_mesas', mesasPayload, null, true);
        } catch(em){ console.warn('[Mesas] Error creando mesas:', em.message); toast('Error al crear mesas automáticas'); }
      }
    }
    await mesasCargar();
    if(!mesaSalonSel && mesasSalones.length) mesaSalonSel = mesasSalones[0].id;
    const msg = salonId ? 'Salón actualizado' : 'Salón creado'+(cantMesas>0?' con '+cantMesas+' mesas':'');
    toast(msg);
    renderMesasScreen();
    abrirGestionMesas();
  }catch(e){ console.error('[Mesas]', e); toast('Error: '+e.message); }
}

async function eliminarSalon(id){
  if(!confirm('¿Borrar este salón y todas sus mesas?')) return;
  try{
    var _licId = parseInt(localStorage.getItem('ali'))||null;
    await supaDelete('pos_salones', 'id=eq.'+id+(_licId ? '&licencia_id=eq.'+_licId : ''));
    await mesasCargar();
    if(mesaSalonSel===id) mesaSalonSel = (mesasSalones[0] && mesasSalones[0].id)||null;
    toast('Salón eliminado');
    abrirGestionMesas();
  }catch(e){ toast('Error: '+e.message); }
}

function editarSalon(id){ abrirFormSalon(id); }

function abrirFormMesa(salonId, mesaId){
  const m = mesaId ? mesasMesas.find(x => x.id === mesaId) : null;
  const s = mesasSalones.find(x => x.id === (salonId || (m?m.salon_id:null)));
  const mc = document.getElementById('mesasModalContent');
  mc.innerHTML =
    '<div class="mesas-modal-title">'+(m?'Editar':'Nueva')+' Mesa — '+(s?s.nombre:'')+' </div>'+
    '<div class="mesas-form-row">'+
      '<label class="mesas-form-label">Nombre de la mesa</label>'+
      '<input class="mesas-form-input" id="formMesaNombre" placeholder="Ej: Mesa 1, Barra 2, VIP..." value="'+(m?m.nombre:'')+'" maxlength="30">'+
    '</div>'+
    '<div class="mesas-form-row">'+
      '<label class="mesas-form-label">Capacidad (personas)</label>'+
      '<input class="mesas-form-input" id="formMesaCap" type="number" min="1" max="50" value="'+(m?m.capacidad:4)+'">'+
    '</div>'+
    '<button class="mesas-btn-primary" onclick="guardarMesa('+(salonId||s.id)+','+(mesaId||'null')+')">'+
      (m?'Guardar cambios':'Crear Mesa')+'</button>'+
    '<button class="mesas-btn-sm" style="width:100%;margin-top:8px;padding:12px;" onclick="abrirGestionMesas()">← Volver</button>';
}

async function guardarMesa(salonId, mesaId){
  const nombre = document.getElementById('formMesaNombre').value.trim();
  const cap    = parseInt(document.getElementById('formMesaCap').value)||4;
  if(!nombre){ toast('Ingresá un nombre'); return; }
  const licId = parseInt(localStorage.getItem('ali'))||null;
  const sucId = parseInt(localStorage.getItem('pos_sucursal_id'))||null;
  try{
    if(mesaId){
      await supaPatch('pos_mesas', 'id=eq.'+mesaId, {nombre, capacidad:cap}, true);
    } else {
      await supaPost('pos_mesas', {salon_id:salonId, licencia_id:licId, sucursal_id:sucId, nombre, capacidad:cap}, null, true);
    }
    await mesasCargar();
    toast('Mesa guardada');
    abrirGestionMesas();
  }catch(e){ toast('Error: '+e.message); }
}

async function eliminarMesa(id){
  if(!confirm('¿Borrar esta mesa?')) return;
  try{
    await supaDelete('pos_mesas', 'id=eq.'+id);
    await mesasCargar();
    toast('Mesa eliminada');
    abrirGestionMesas();
  }catch(e){ toast('Error: '+e.message); }
}

function editarMesa(id){
  const m = mesasMesas.find(x => x.id === id);
  if(m) abrirFormMesa(m.salon_id, id);
}
