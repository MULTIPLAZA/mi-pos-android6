// ============================================================
// credito.js — Sistema de fiado / crédito para Ampersand POS
// ============================================================

var _CRED_CLI_KEY   = 'pos_cred_clientes';
var _CRED_FIADO_KEY = 'pos_cred_fiado';

// ── CLIENTES ─────────────────────────────────────────────────
function cliCargar()     { try { return JSON.parse(localStorage.getItem(_CRED_CLI_KEY)||'[]'); } catch(e) { return []; } }
function cliGuardar(arr) { try { localStorage.setItem(_CRED_CLI_KEY, JSON.stringify(arr)); } catch(e) {} }

function cliNuevo(nombre, limiteGs) {
  var arr = cliCargar();
  var cli = { id: Date.now(), nombre: nombre.toUpperCase().trim(), limiteGs: parseInt(limiteGs)||0 };
  arr.push(cli);
  cliGuardar(arr);
  _credSupaUpsertCli(cli);
  return cli;
}

function cliEditar(id, nombre, limiteGs) {
  var arr = cliCargar();
  var idx = -1;
  for (var i = 0; i < arr.length; i++) { if (arr[i].id === id) { idx = i; break; } }
  if (idx >= 0) {
    arr[idx].nombre   = nombre.toUpperCase().trim();
    arr[idx].limiteGs = parseInt(limiteGs) || 0;
    cliGuardar(arr);
    _credSupaUpsertCli(arr[idx]);
  }
}

function cliSaldo(clienteId) {
  var fiados = fiadoCargar();
  var s = 0;
  for (var i = 0; i < fiados.length; i++) {
    if (fiados[i].clienteId === clienteId && !fiados[i].pagado) s += (fiados[i].total || 0);
  }
  return s;
}

// ── VENTAS FIADAS ─────────────────────────────────────────────
function fiadoCargar()     { try { return JSON.parse(localStorage.getItem(_CRED_FIADO_KEY)||'[]'); } catch(e) { return []; } }
function fiadoGuardar(arr) { try { localStorage.setItem(_CRED_FIADO_KEY, JSON.stringify(arr)); } catch(e) {} }

function fiadoRegistrar(clienteId, clienteNombreStr, nroTicket, total, fecha) {
  var arr = fiadoCargar();
  var fechaStr;
  if (fecha instanceof Date)     fechaStr = fecha.toISOString();
  else if (typeof fecha === 'string') fechaStr = fecha;
  else fechaStr = new Date().toISOString();
  var nuevo = { id: 'f'+Date.now(), clienteId: clienteId, clienteNombre: clienteNombreStr, nroTicket: nroTicket, total: total, fecha: fechaStr, pagado: false, fechaPago: null, metodoPago: '' };
  arr.push(nuevo);
  fiadoGuardar(arr);
  _credSupaUpsertFiado(nuevo);
}

function fiadoCobrar(clienteId, montoGs, metodoPago) {
  var arr        = fiadoCargar();
  var pendientes = [];
  for (var i = 0; i < arr.length; i++) {
    if (arr[i].clienteId === clienteId && !arr[i].pagado) pendientes.push(arr[i]);
  }
  pendientes.sort(function(a, b) { return new Date(a.fecha) - new Date(b.fecha); });
  var restante = montoGs;
  var pagadas   = [];
  for (var j = 0; j < pendientes.length; j++) {
    if (restante <= 0) break;
    if (restante >= pendientes[j].total) {
      for (var k = 0; k < arr.length; k++) {
        if (arr[k].id === pendientes[j].id) {
          arr[k].pagado     = true;
          arr[k].fechaPago  = new Date().toISOString();
          arr[k].metodoPago = metodoPago;
          pagadas.push(arr[k]);
          break;
        }
      }
      restante -= pendientes[j].total;
    }
  }
  fiadoGuardar(arr);
  for (var pi = 0; pi < pagadas.length; pi++) _credSupaUpsertFiado(pagadas[pi]);
  return montoGs - restante;
}

// ── VARIABLE GLOBAL para cobro.js ────────────────────────────
var creditoClienteSel = null;

// ── PANTALLA CRÉDITO ─────────────────────────────────────────
function abrirCredito() {
  goTo('scCredito');
  renderCreditoScreen();
  // Sincronizar desde Supabase en background
  _credSupaSincronizar().then(function(){ renderCreditoScreen(); }).catch(function(){});
}

function renderCreditoScreen() {
  var clientes = cliCargar();
  var fiados   = fiadoCargar();
  var saldoMap = {};
  for (var i = 0; i < fiados.length; i++) {
    if (!fiados[i].pagado) saldoMap[fiados[i].clienteId] = (saldoMap[fiados[i].clienteId]||0) + (fiados[i].total||0);
  }
  var totalPend = 0;
  var countPend = 0;
  for (var k in saldoMap) { if (saldoMap[k] > 0) { totalPend += saldoMap[k]; countPend++; } }

  var html = '';
  html += '<div style="background:rgba(229,57,53,.08);border:1px solid rgba(229,57,53,.3);border-radius:10px;padding:14px 16px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">';
  html += '<div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;font-weight:700;margin-bottom:3px;">Total pendiente</div><div style="font-size:26px;font-weight:900;color:#e53935;letter-spacing:-1px;">₲'+gs(totalPend)+'</div></div>';
  html += '<div style="text-align:right;"><div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;font-weight:700;margin-bottom:3px;">Clientes</div><div style="font-size:24px;font-weight:800;color:var(--text);">'+countPend+'</div></div>';
  html += '</div>';

  if (clientes.length === 0) {
    html += '<div style="text-align:center;padding:48px 24px;color:var(--muted);"><div style="font-size:40px;margin-bottom:12px;">💳</div><div style="font-size:14px;font-weight:700;margin-bottom:4px;">Sin clientes</div><div style="font-size:12px;">Tocá + para agregar el primero</div></div>';
    document.getElementById('creditoContent').innerHTML = html;
    return;
  }

  var conSaldo = [], sinSaldo = [];
  for (var ci = 0; ci < clientes.length; ci++) {
    if (saldoMap[clientes[ci].id] > 0) conSaldo.push(clientes[ci]);
    else sinSaldo.push(clientes[ci]);
  }
  conSaldo.sort(function(a,b){ return (saldoMap[b.id]||0)-(saldoMap[a.id]||0); });

  for (var ii = 0; ii < conSaldo.length; ii++) {
    var c   = conSaldo[ii];
    var sal = saldoMap[c.id]||0;
    var cnt = 0;
    for (var fi = 0; fi < fiados.length; fi++) { if (fiados[fi].clienteId === c.id && !fiados[fi].pagado) cnt++; }
    html += '<div onclick="abrirDetalleCliente('+c.id+')" style="padding:14px 16px;border-bottom:1px solid var(--border);cursor:pointer;display:flex;justify-content:space-between;align-items:center;">';
    html += '<div><div style="font-size:15px;font-weight:800;color:var(--text);margin-bottom:2px;">'+c.nombre+'</div>';
    html += '<div style="font-size:11px;color:var(--muted);">'+cnt+' venta'+(cnt!==1?'s':'')+'</div></div>';
    html += '<div style="text-align:right;"><div style="font-size:17px;font-weight:900;color:#e53935;">₲'+gs(sal)+'</div>';
    if (c.limiteGs > 0) {
      var pct = Math.min(100, Math.round(sal/c.limiteGs*100));
      html += '<div style="font-size:10px;color:'+(pct>=90?'#e53935':pct>=70?'#ff9800':'var(--muted)')+';">Límite ₲'+gs(c.limiteGs)+'</div>';
    }
    html += '</div></div>';
  }
  if (sinSaldo.length > 0) {
    html += '<div style="padding:10px 16px 4px;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;font-weight:700;">Al día</div>';
    for (var si = 0; si < sinSaldo.length; si++) {
      var c2 = sinSaldo[si];
      html += '<div onclick="abrirDetalleCliente('+c2.id+')" style="padding:12px 16px;border-bottom:1px solid var(--border);cursor:pointer;display:flex;justify-content:space-between;align-items:center;">';
      html += '<span style="font-size:14px;font-weight:600;color:var(--text);">'+c2.nombre+'</span>';
      html += '<span style="font-size:12px;color:#4caf50;font-weight:700;">✓ Sin deuda</span></div>';
    }
  }
  document.getElementById('creditoContent').innerHTML = html;
}

var _detalleCliId = null;

function abrirDetalleCliente(clienteId) {
  var clientes   = cliCargar();
  var c          = null;
  for (var i = 0; i < clientes.length; i++) { if (clientes[i].id === clienteId) { c = clientes[i]; break; } }
  if (!c) return;
  _detalleCliId  = clienteId;
  var fiados     = fiadoCargar();
  var pendientes = [];
  for (var j = 0; j < fiados.length; j++) { if (fiados[j].clienteId === clienteId && !fiados[j].pagado) pendientes.push(fiados[j]); }
  pendientes.sort(function(a,b){ return new Date(a.fecha)-new Date(b.fecha); });
  var saldo = 0;
  for (var x = 0; x < pendientes.length; x++) saldo += pendientes[x].total;

  var html = '';
  html += '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:14px 16px;margin-bottom:12px;">';
  html += '<div style="font-size:18px;font-weight:900;color:var(--text);margin-bottom:10px;">'+c.nombre+'</div>';
  html += '<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:12px;">';
  html += '<div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:700;">Saldo</div><div style="font-size:28px;font-weight:900;color:#e53935;">₲'+gs(saldo)+'</div></div>';
  if (c.limiteGs > 0) {
    var pct = saldo > 0 ? Math.min(100,Math.round(saldo/c.limiteGs*100)) : 0;
    html += '<div style="text-align:right;"><div style="font-size:10px;color:var(--muted);">Límite</div><div style="font-size:16px;font-weight:700;">₲'+gs(c.limiteGs)+'</div><div style="font-size:10px;color:'+(pct>=90?'#e53935':pct>=70?'#ff9800':'#4caf50')+';">'+pct+'% usado</div></div>';
  }
  html += '</div>';
  if (saldo > 0) html += '<button onclick="abrirCobrarFiado('+clienteId+')" style="width:100%;padding:13px;background:#4caf50;color:white;border:none;border-radius:8px;font-family:\'Barlow\',sans-serif;font-size:14px;font-weight:800;letter-spacing:.5px;cursor:pointer;margin-bottom:8px;">💰 COBRAR FIADO</button>';
  html += '<div style="display:flex;gap:8px;">';
  html += '<button onclick="abrirEditarCliente('+clienteId+')" style="flex:1;padding:10px;background:transparent;border:1px solid var(--border);color:var(--muted);border-radius:8px;font-family:\'Barlow\',sans-serif;font-size:12px;font-weight:700;cursor:pointer;">✏️ Editar</button>';
  html += '<button onclick="cliImprimirCuenta('+clienteId+')" style="flex:1;padding:10px;background:transparent;border:1px solid var(--border);color:var(--muted);border-radius:8px;font-family:\'Barlow\',sans-serif;font-size:12px;font-weight:700;cursor:pointer;">🖨️ Imprimir cuenta</button>';
  html += '</div>';
  html += '</div>';

  if (pendientes.length > 0) {
    html += '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;font-weight:700;padding:4px 0 8px;">Ventas pendientes</div>';
    for (var pi = 0; pi < pendientes.length; pi++) {
      var f  = pendientes[pi];
      var d  = new Date(f.fecha);
      var ds = ('0'+d.getDate()).slice(-2)+'/'+('0'+(d.getMonth()+1)).slice(-2)+'/'+d.getFullYear();
      var ts = ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--border);">';
      html += '<div><div style="font-size:13px;font-weight:700;color:var(--text);">Ticket #'+String(f.nroTicket||'?').padStart(4,'0')+'</div><div style="font-size:11px;color:var(--muted);">'+ds+' '+ts+'</div></div>';
      html += '<div style="font-size:15px;font-weight:800;color:var(--text);">₲'+gs(f.total)+'</div></div>';
    }
  } else {
    html += '<div style="text-align:center;padding:24px;color:var(--muted);font-size:13px;">Sin ventas pendientes</div>';
  }

  var pagadas = [];
  for (var qi = 0; qi < fiados.length; qi++) { if (fiados[qi].clienteId === clienteId && fiados[qi].pagado) pagadas.push(fiados[qi]); }
  pagadas.sort(function(a,b){ return new Date(b.fechaPago)-new Date(a.fechaPago); });
  pagadas = pagadas.slice(0, 5);
  if (pagadas.length > 0) {
    html += '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;font-weight:700;padding:12px 0 8px;">Pagadas (recientes)</div>';
    for (var gi = 0; gi < pagadas.length; gi++) {
      var fp = pagadas[gi];
      var dp = new Date(fp.fechaPago);
      var dps = ('0'+dp.getDate()).slice(-2)+'/'+('0'+(dp.getMonth()+1)).slice(-2)+'/'+dp.getFullYear();
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);opacity:.6;">';
      html += '<div><div style="font-size:12px;color:var(--text);">Ticket #'+String(fp.nroTicket||'?').padStart(4,'0')+'</div><div style="font-size:10px;color:var(--muted);">Pagado: '+dps+'</div></div>';
      html += '<div style="font-size:13px;font-weight:700;color:#4caf50;">✓ ₲'+gs(fp.total)+'</div></div>';
    }
  }

  document.getElementById('creditoDetalleContent').innerHTML = html;
  document.getElementById('creditoDetalle').style.display = 'flex';
  document.getElementById('creditoList').style.display    = 'none';
}

function volverListaCredito() {
  document.getElementById('creditoDetalle').style.display = 'none';
  document.getElementById('creditoList').style.display    = 'block';
  _detalleCliId = null;
  renderCreditoScreen();
}

// ── COBRAR FIADO ─────────────────────────────────────────────
var _cobFiadoCId = null;

function abrirCobrarFiado(clienteId) {
  var clientes = cliCargar();
  var c = null;
  for (var i = 0; i < clientes.length; i++) { if (clientes[i].id === clienteId) { c = clientes[i]; break; } }
  if (!c) return;
  _cobFiadoCId = clienteId;
  var saldo = cliSaldo(clienteId);
  document.getElementById('cobrarFiadoNombre').textContent = c.nombre;
  document.getElementById('cobrarFiadoSaldo').textContent  = '₲'+gs(saldo);
  document.getElementById('cobrarFiadoMonto').value        = '';
  document.getElementById('cobrarFiadoModal').style.display = 'flex';
}

function cerrarCobrarFiado() {
  document.getElementById('cobrarFiadoModal').style.display = 'none';
  _cobFiadoCId = null;
}

function confirmarCobrarFiado() {
  if (!_cobFiadoCId) return;
  var monto = parseInt((document.getElementById('cobrarFiadoMonto').value||'').replace(/[^0-9]/g,'')) || 0;
  if (monto <= 0) { if(typeof toast==='function') toast('Ingresá el monto'); return; }
  var saldo = cliSaldo(_cobFiadoCId);
  if (monto > saldo) {
    if (!confirm('El monto ₲'+gs(monto)+' supera el saldo ₲'+gs(saldo)+'. Se registrará ₲'+gs(saldo)+'.')) return;
    monto = saldo;
  }
  var metodo  = document.getElementById('cobrarFiadoMetodo').value || 'efectivo';
  var cobrado = fiadoCobrar(_cobFiadoCId, monto, metodo);
  var nomStr  = document.getElementById('cobrarFiadoNombre').textContent;
  if (typeof registrarIngreso === 'function') registrarIngreso('Cobro fiado — '+nomStr, cobrado, metodo);
  cerrarCobrarFiado();
  if(typeof toast==='function') toast('Cobrado: ₲'+gs(cobrado));
  if (_detalleCliId) abrirDetalleCliente(_detalleCliId);
  else renderCreditoScreen();
}

// ── EDITAR / NUEVO CLIENTE ───────────────────────────────────
var _editCliId = null;

function abrirNuevoCliente() {
  _editCliId = null;
  document.getElementById('editCliTitle').textContent  = 'NUEVO CLIENTE';
  document.getElementById('editCliNombre').value       = '';
  document.getElementById('editCliLimite').value       = '';
  document.getElementById('editCliModal').style.display = 'flex';
  setTimeout(function(){ document.getElementById('editCliNombre').focus(); }, 150);
}

function abrirEditarCliente(clienteId) {
  var clientes = cliCargar();
  var c = null;
  for (var i = 0; i < clientes.length; i++) { if (clientes[i].id === clienteId) { c = clientes[i]; break; } }
  if (!c) return;
  _editCliId = clienteId;
  document.getElementById('editCliTitle').textContent  = 'EDITAR CLIENTE';
  document.getElementById('editCliNombre').value       = c.nombre;
  document.getElementById('editCliLimite').value       = c.limiteGs > 0 ? c.limiteGs : '';
  document.getElementById('editCliModal').style.display = 'flex';
  setTimeout(function(){ document.getElementById('editCliNombre').focus(); }, 150);
}

function cerrarEditCli() {
  document.getElementById('editCliModal').style.display = 'none';
  _editCliId = null;
}

function guardarEditCli() {
  var nombre = (document.getElementById('editCliNombre').value||'').trim();
  var lim    = parseInt(document.getElementById('editCliLimite').value)||0;
  if (!nombre) { if(typeof toast==='function') toast('Ingresá el nombre'); return; }
  if (_editCliId) {
    cliEditar(_editCliId, nombre, lim);
    if(typeof toast==='function') toast('Cliente actualizado');
  } else {
    cliNuevo(nombre, lim);
    if(typeof toast==='function') toast('Cliente creado');
  }
  cerrarEditCli();
  renderCreditoScreen();
  if (_detalleCliId) abrirDetalleCliente(_detalleCliId);
}

// ── PICKER DE CLIENTE EN COBRO ────────────────────────────────
function abrirClientePicker() {
  document.getElementById('clientePickerSearch').value = '';
  renderClientePickerList();
  document.getElementById('clientePickerModal').style.display = 'flex';
  setTimeout(function(){ document.getElementById('clientePickerSearch').focus(); }, 150);
}

function cerrarClientePicker() {
  document.getElementById('clientePickerModal').style.display = 'none';
}

function renderClientePickerList() {
  var q        = ((document.getElementById('clientePickerSearch').value)||'').toUpperCase().trim();
  var clientes = cliCargar();
  if (q) {
    var filtered = [];
    for (var i = 0; i < clientes.length; i++) { if (clientes[i].nombre.indexOf(q) >= 0) filtered.push(clientes[i]); }
    clientes = filtered;
  }
  var total = (typeof calcTotal==='function') ? calcTotal() : 0;
  var html  = '';
  for (var ci = 0; ci < clientes.length; ci++) {
    var c         = clientes[ci];
    var saldo     = cliSaldo(c.id);
    var afterSale = saldo + total;
    var over      = c.limiteGs > 0 && afterSale > c.limiteGs;
    html += '<div onclick="seleccionarClienteCredito('+c.id+')" style="padding:14px 16px;border-bottom:1px solid var(--border);cursor:pointer;display:flex;justify-content:space-between;align-items:center;'+(over?'opacity:.5;':'')+'">';
    html += '<div><div style="font-size:15px;font-weight:700;color:var(--text);">'+c.nombre+'</div>';
    html += '<div style="font-size:11px;color:'+(saldo>0?'#e53935':'#4caf50')+';">'+(saldo>0?'Saldo: ₲'+gs(saldo):'Sin deuda')+'</div></div>';
    if (over) html += '<span style="font-size:10px;background:#e53935;color:#fff;padding:3px 7px;border-radius:10px;font-weight:700;">LÍMITE</span>';
    html += '</div>';
  }
  if (clientes.length === 0) html += '<div style="text-align:center;padding:24px;color:var(--muted);font-size:13px;">No se encontraron clientes</div>';
  document.getElementById('clientePickerList').innerHTML = html;
}

function seleccionarClienteCredito(clienteId) {
  var clientes = cliCargar();
  var c = null;
  for (var i = 0; i < clientes.length; i++) { if (clientes[i].id === clienteId) { c = clientes[i]; break; } }
  if (!c) return;
  var total     = (typeof calcTotal==='function') ? calcTotal() : 0;
  var saldo     = cliSaldo(clienteId);
  var afterSale = saldo + total;
  if (c.limiteGs > 0 && afterSale > c.limiteGs) {
    if (!confirm(c.nombre+': el saldo llegaría a ₲'+gs(afterSale)+', superando el límite de ₲'+gs(c.limiteGs)+'.\n¿Continuar de todas formas?')) return;
  }
  creditoClienteSel = c;
  // También setear clienteNombre global para que aparezca en el ticket
  if (typeof clienteNombre !== 'undefined') clienteNombre = c.nombre;
  cerrarClientePicker();
  updCreditoSecUI();
}

function nuevoClienteRapido() {
  var nombre = prompt('Nombre del cliente:');
  if (!nombre || !nombre.trim()) return;
  var limStr = prompt('Límite de crédito en ₲ (0 = sin límite):', '0');
  var lim    = parseInt(limStr) || 0;
  var c      = cliNuevo(nombre.trim(), lim);
  renderClientePickerList();
  seleccionarClienteCredito(c.id);
}

// ── UI DEL PANEL CRÉDITO EN PANTALLA DE COBRO ────────────────
function updCreditoSecUI() {
  var btn     = document.getElementById('creditoClienteBtn');
  var saldoEl = document.getElementById('creditoClienteSaldo');
  if (creditoClienteSel) {
    if (btn)     btn.textContent = creditoClienteSel.nombre;
    if (saldoEl) {
      var s = cliSaldo(creditoClienteSel.id);
      saldoEl.textContent = s > 0 ? 'Saldo actual: ₲'+gs(s) : 'Sin deuda previa ✔';
      saldoEl.style.color = s > 0 ? '#ff9800' : '#4caf50';
    }
  } else {
    if (btn)     btn.textContent = 'Seleccionar cliente…';
    if (saldoEl) { saldoEl.textContent = ''; }
  }
}

// ── SUPABASE SYNC ─────────────────────────────────────────────
function _credSupaOk() {
  return typeof SUPA_URL !== 'undefined' && !SUPA_URL.includes('XXXX') && typeof supaPost === 'function';
}

function _credSupaEmail() {
  return (typeof SK !== 'undefined' && localStorage.getItem(SK.email)) || '';
}

function _credSupaUpsertCli(cli) {
  if (!_credSupaOk()) return;
  var email = _credSupaEmail();
  if (!email) return;
  supaPost('pos_cred_clientes',
    { id: cli.id, email: email, nombre: cli.nombre, limite_gs: cli.limiteGs || 0 },
    'id', true
  ).catch(function(){});
}

function _credSupaUpsertFiado(f) {
  if (!_credSupaOk()) return;
  var email = _credSupaEmail();
  if (!email) return;
  supaPost('pos_cred_fiado', {
    id:             f.id,
    email:          email,
    cliente_id:     f.clienteId,
    cliente_nombre: f.clienteNombre,
    nro_ticket:     f.nroTicket || null,
    total:          f.total,
    fecha:          f.fecha,
    pagado:         f.pagado,
    fecha_pago:     f.fechaPago || null,
    metodo_pago:    f.metodoPago || ''
  }, 'id', true).catch(function(){});
}

async function _credSupaSincronizar() {
  if (!_credSupaOk()) return;
  var email = _credSupaEmail();
  if (!email) return;
  try {
    // Clientes
    var rCli = await fetch(
      SUPA_URL + '/rest/v1/pos_cred_clientes?email=eq.' + encodeURIComponent(email) + '&select=*',
      { headers: supaHeaders({}) }
    );
    if (rCli.ok) {
      var dbClis = await rCli.json();
      if (Array.isArray(dbClis) && dbClis.length > 0) {
        var cliMap = {};
        cliCargar().forEach(function(c){ cliMap[c.id] = c; });
        dbClis.forEach(function(c){
          cliMap[c.id] = { id: c.id, nombre: c.nombre, limiteGs: c.limite_gs || 0 };
        });
        var vals = [];
        var keys = Object.keys(cliMap);
        for (var ki = 0; ki < keys.length; ki++) vals.push(cliMap[keys[ki]]);
        cliGuardar(vals);
      }
    }
    // Fiados
    var rFiado = await fetch(
      SUPA_URL + '/rest/v1/pos_cred_fiado?email=eq.' + encodeURIComponent(email) + '&select=*&order=fecha.asc',
      { headers: supaHeaders({}) }
    );
    if (rFiado.ok) {
      var dbFiados = await rFiado.json();
      if (Array.isArray(dbFiados) && dbFiados.length > 0) {
        var fMap = {};
        fiadoCargar().forEach(function(f){ fMap[f.id] = f; });
        dbFiados.forEach(function(f){
          fMap[f.id] = {
            id:            f.id,
            clienteId:     f.cliente_id,
            clienteNombre: f.cliente_nombre,
            nroTicket:     f.nro_ticket,
            total:         f.total,
            fecha:         f.fecha,
            pagado:        f.pagado,
            fechaPago:     f.fecha_pago,
            metodoPago:    f.metodo_pago || ''
          };
        });
        var fVals = [];
        var fKeys = Object.keys(fMap);
        for (var fi = 0; fi < fKeys.length; fi++) fVals.push(fMap[fKeys[fi]]);
        fiadoGuardar(fVals);
      }
    }
  } catch(e) {}
}

// ── IMPRIMIR RESUMEN DE CUENTA ────────────────────────────────
function cliImprimirCuenta(clienteId) {
  var clientes = cliCargar();
  var c = null;
  for (var i = 0; i < clientes.length; i++) { if (clientes[i].id === clienteId) { c = clientes[i]; break; } }
  if (!c) return;

  var fiados = fiadoCargar();
  var pendientes = [];
  for (var j = 0; j < fiados.length; j++) {
    if (fiados[j].clienteId === clienteId && !fiados[j].pagado) pendientes.push(fiados[j]);
  }
  pendientes.sort(function(a, b) { return new Date(a.fecha) - new Date(b.fecha); });
  var saldo = 0;
  for (var x = 0; x < pendientes.length; x++) saldo += pendientes[x].total;

  var cfg = (typeof configData !== 'undefined') ? configData : {};
  var cols = parseInt(localStorage.getItem('printerSize_ticket') || '58') === 80 ? 42 : 32;
  var sep  = '='.repeat(cols);
  var sep2 = '-'.repeat(cols);
  var n    = '\n';

  function _pad(l, r) {
    var sp = Math.max(1, cols - String(l).length - String(r).length);
    return String(l) + ' '.repeat(sp) + String(r);
  }
  function _ctr(t) {
    t = String(t); var sp = Math.max(0, Math.floor((cols - t.length) / 2));
    return ' '.repeat(sp) + t;
  }
  function _gs(v) { var s = String(Math.round(v || 0)); return s.replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function _fmt(iso) {
    var d = new Date(iso);
    return ('0'+d.getDate()).slice(-2)+'/'+('0'+(d.getMonth()+1)).slice(-2)+'/'+String(d.getFullYear()).slice(-2);
  }

  var txt = '';
  if (cfg.negocio) txt += '[BOLD]' + _ctr(cfg.negocio.toUpperCase().replace(/[ÁÀÄÂ]/g,'A').replace(/[ÉÈËÊ]/g,'E').replace(/[ÍÌÏÎ]/g,'I').replace(/[ÓÒÖÔ]/g,'O').replace(/[ÚÙÜÛ]/g,'U').replace(/Ñ/g,'N')) + '[/BOLD]' + n;
  txt += sep2 + n;
  txt += '[BOLD]' + _ctr('RESUMEN DE CUENTA') + '[/BOLD]' + n;
  txt += sep2 + n;
  txt += _ctr(c.nombre) + n;

  var now = new Date();
  var ds = ('0'+now.getDate()).slice(-2)+'/'+('0'+(now.getMonth()+1)).slice(-2)+'/'+now.getFullYear();
  var ts = ('0'+now.getHours()).slice(-2)+':'+('0'+now.getMinutes()).slice(-2);
  txt += _ctr(ds + ' ' + ts) + n;
  txt += sep + n;

  if (pendientes.length === 0) {
    txt += _ctr('Sin deudas pendientes') + n;
  } else {
    for (var pi = 0; pi < pendientes.length; pi++) {
      var f = pendientes[pi];
      txt += _pad('Tkt #'+String(f.nroTicket||'?').padStart(4,'0')+' '+_fmt(f.fecha), 'Gs.'+_gs(f.total)) + n;
    }
    txt += sep2 + n;
    txt += '[BOLD]' + _pad('TOTAL PENDIENTE', 'Gs.' + _gs(saldo)) + '[/BOLD]' + n;
  }

  if (c.limiteGs > 0) {
    txt += sep2 + n;
    txt += _pad('Limite credito', 'Gs.' + _gs(c.limiteGs)) + n;
    txt += _pad('Disponible', 'Gs.' + _gs(Math.max(0, c.limiteGs - saldo))) + n;
  }

  txt += sep + n;
  txt += _ctr('Gracias!') + n;
  txt += '[CUT]';

  if (typeof BTPrinter !== 'undefined' && typeof BTPrinter.print === 'function') {
    BTPrinter.print(txt).then(function(r) {
      if (r && r.status === 'ok') toast('Impreso correctamente');
      else toast('Error al imprimir');
    });
  } else {
    toast('Impresora no disponible');
  }
}
