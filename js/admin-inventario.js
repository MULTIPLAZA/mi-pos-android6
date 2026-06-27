// ── Admin: Inventarios, Stock, Compras, Conteos ──
// ── INVENTARIOS ───────────────────────────────────────────
// Tablas usadas: sucursales, depositos, stock, stock_movimientos
// licencia_id se resuelve via SE (email) → licencias.email_cliente

// ──────────────────────────────────────────────────────────────────────
// DEDUP defensivo: agrupa depósitos por (sucursal_id, UPPER(TRIM(nombre)))
// para que duplicados en la base no aparezcan dos veces en los dropdowns.
// Devuelve [{idsArr, idCanonico, nombre, sucursal_id, sucursal_nombre}].
// El consumidor debe usar `idsArr.join(',')` como value y al filtrar:
//   si value tiene "," → &deposito_id=in.(value)
//   si no → &deposito_id=eq.value
// Cuando el SQL de consolidación corra, cada grupo tendrá 1 solo id y
// este helper queda inocuo. Si no corrió, igual se ven los movimientos.
// ──────────────────────────────────────────────────────────────────────
function depsAgrupados(deps, sucs){
  if(!Array.isArray(deps)) return [];
  var sucMap={};
  if(Array.isArray(sucs)) sucs.forEach(function(s){ sucMap[s.id]=s.nombre; });
  var grupos={}, orden=[];
  deps.forEach(function(d){
    var clave=d.sucursal_id+'::'+String(d.nombre||'').trim().toUpperCase();
    if(!grupos[clave]){
      grupos[clave]={
        idsArr:[d.id],
        idCanonico:d.id,
        nombre:d.nombre,
        sucursal_id:d.sucursal_id,
        sucursal_nombre: sucMap[d.sucursal_id]||''
      };
      orden.push(clave);
    } else {
      grupos[clave].idsArr.push(d.id);
      if(d.id < grupos[clave].idCanonico){
        grupos[clave].idCanonico=d.id;
        grupos[clave].nombre=d.nombre;
      }
    }
  });
  return orden.map(function(k){ return grupos[k]; });
}

// Construye filtro PostgREST para deposito_id a partir del value del select.
// value puede ser "" (todos), "12" (un id) o "12,45,78" (grupo deduplicado).
function depFilterPostgrest(value){
  if(!value) return '';
  if(String(value).indexOf(',')>=0) return '&deposito_id=in.('+value+')';
  return '&deposito_id=eq.'+value;
}
var _inv = {
  licId: null, prds: [], deps: [], suc: [],
  sel: { depId:null, depIds:[], depNom:'', sucId:null, sucNom:'' },
  prodActivo: null
};

// Obtener licencia_id a partir del email de sesión
async function invGetLicId(){
  if(_inv.licId) return _inv.licId;
  var rows = await sg('licencias','email_cliente=ilike.'+encodeURIComponent(SE)+'&select=id&limit=1');
  if(!rows||!rows.length) throw new Error('No se encontró licencia para '+SE);
  _inv.licId = rows[0].id;
  return _inv.licId;
}

async function renderInventarios(){
  var c=document.getElementById('content');
  c.innerHTML='<div class="loading"><span class="sp"></span>Cargando inventarios...</div>';
  try{
    var licId = await invGetLicId();
    // Cargar sucursales + depósitos en paralelo
    var [sucs, deps] = await Promise.all([
      sg('sucursales','licencia_id=eq.'+licId+'&activa=eq.true&order=nombre.asc'),
      sg('depositos','licencia_id=eq.'+licId+'&activo=eq.true&order=nombre.asc')
    ]);
    _inv.suc = sucs; _inv.deps = deps;
    // Inicializar con "todas las sucursales"
    _inv.sel.sucNom = '';
    _inv.sel.depIds = deps.map(function(d){return d.id;});
    _inv.sel.depId  = deps.length?deps[0].id:null;
    renderInvShell();
    await cargarStockDeposito();
  }catch(e){
    document.getElementById('content').innerHTML='<div style="padding:24px;color:var(--red)">Error: '+e.message+'</div>';
  }
}

// Iconos SVG inline (estilo Lucide stroke). Heredan color via currentColor.
function _invIco(n,size){
  var s=size||14;
  var p={
    search:    '<path d="M21 21l-4.35-4.35"/><circle cx="11" cy="11" r="7"/>',
    transfer:  '<path d="M7 7h13M16 3l4 4-4 4"/><path d="M17 17H4M8 13l-4 4 4 4"/>',
    refresh:   '<path d="M3 12a9 9 0 0 1 15.5-6.5L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.5L3 16"/><path d="M3 21v-5h5"/>',
    more:      '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
    box:       '<path d="M21 8L12 3 3 8v8l9 5 9-5V8z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
    alert:     '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    xcircle:   '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
    cash:      '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/>',
    chart:     '<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>',
    edit:      '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
    close:     '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    download:  '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    plus:      '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    history:   '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    trending:  '<polyline points="22 7 13.5 15.5 8.5 10.5 1 18"/><polyline points="16 7 22 7 22 13"/>'
  };
  return '<span class="inv-i"><svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+(p[n]||'')+'</svg></span>';
}

// Estado del filtro de estado actual (chip seleccionado)
var _invEstadoChip = '';

function _invFormatGs(n){
  if(typeof gs==='function') return gs(n);
  return new Intl.NumberFormat('es-PY').format(Math.round(n||0));
}
function _invFormatMonto(n){
  // Compacta 1.5M, 250k para KPIs
  var v=Math.round(n||0);
  if(Math.abs(v)>=1000000) return 'Gs '+(v/1000000).toFixed(2).replace(/\.?0+$/,'')+'M';
  if(Math.abs(v)>=1000)    return 'Gs '+Math.round(v/1000)+'k';
  return 'Gs '+v;
}

function renderInvShell(){
  var deps=_inv.deps, sucs=_inv.suc;
  var selOpts='<option value="">Todas las sucursales</option>';
  var sucsVistas={};
  sucs.forEach(function(s){
    var key=String(s.nombre||'').trim().toUpperCase();
    if(sucsVistas[key]) return;
    sucsVistas[key]=true;
    var sel=(_inv.sel.sucNom===s.nombre)?'selected':'';
    selOpts+='<option value="'+s.nombre+'" '+sel+'>'+s.nombre+'</option>';
  });

  var c=document.getElementById('content');
  c.innerHTML=
    '<div class="ph">'
      +'<div>'
        +'<div class="pt">Inventarios</div>'
        +'<div class="ps" id="invDepLabel">Sucursal: <strong>'+(_inv.sel.sucNom||'Todas')+'</strong></div>'
      +'</div>'
      +'<div class="dbar">'
        +'<button onclick="abrirTransferencia()" class="atab" style="display:inline-flex;align-items:center;gap:6px">'+_invIco('transfer')+'Transferir</button>'
        +'<button onclick="abrirReconciliacion()" class="atab" style="display:inline-flex;align-items:center;gap:6px">'+_invIco('refresh')+'Reconciliar</button>'
      +'</div>'
    +'</div>'

    // KPIs (4 con barra-top de color via --c)
    +'<div class="kg" style="grid-template-columns:repeat(4,1fr)">'
      +'<div class="kc" style="--c:var(--blue)">'
        +'<div class="kc-l">Productos</div>'
        +'<div class="kc-v" id="invKTotal" style="color:var(--blue)">—</div>'
        +'<div class="kc-s">activos en catálogo</div>'
      +'</div>'
      +'<div class="kc" style="--c:var(--orange)">'
        +'<div class="kc-l">Stock bajo</div>'
        +'<div class="kc-v" id="invKBajo" style="color:var(--orange)">—</div>'
        +'<div class="kc-s">por debajo del mínimo</div>'
      +'</div>'
      +'<div class="kc" style="--c:var(--red)">'
        +'<div class="kc-l">Sin stock</div>'
        +'<div class="kc-v" id="invKCero" style="color:var(--red)">—</div>'
        +'<div class="kc-s">requieren reposición</div>'
      +'</div>'
      +'<div class="kc" style="--c:var(--green)">'
        +'<div class="kc-l">Valor en inventario</div>'
        +'<div class="kc-v" id="invKValor" style="color:var(--green)">—</div>'
        +'<div class="kc-s">cantidad × costo unitario</div>'
      +'</div>'
    +'</div>'

    // Toolbar: search + sucursal + chips
    +'<div class="inv-toolbar">'
      +'<div class="inv-search">'
        +'<span class="inv-search-ico">'+_invIco('search',16)+'</span>'
        +'<input id="invSearch" placeholder="Buscar producto por nombre o código..." oninput="filtrInv(this.value)">'
      +'</div>'
      +'<select class="d-inp" id="invDepSel" onchange="cambiarDeposito(this)" style="min-width:160px">'
        +(deps.length?selOpts:'<option>Sin depósitos</option>')
      +'</select>'
      +'<div class="inv-chips" id="invChips" style="margin-left:auto">'
        +'<div class="inv-chip on"          data-est=""     onclick="_invSetEstado(\'\')">Todos <span class="inv-chip-n" id="invChipNAll">—</span></div>'
        +'<div class="inv-chip"             data-est="ok"   onclick="_invSetEstado(\'ok\')">OK <span class="inv-chip-n" id="invChipNOk">—</span></div>'
        +'<div class="inv-chip"             data-est="bajo" onclick="_invSetEstado(\'bajo\')">Bajo <span class="inv-chip-n" id="invChipNBajo">—</span></div>'
        +'<div class="inv-chip"             data-est="cero" onclick="_invSetEstado(\'cero\')">Sin stock <span class="inv-chip-n" id="invChipNCero">—</span></div>'
      +'</div>'
    +'</div>'

    // Tabla productos
    +'<div class="card">'
      +'<div class="card-h">'
        +'<span class="card-t" id="invCount">Cargando...</span>'
        +'<span style="font-size:11px;color:var(--muted)" id="invSubcount"></span>'
      +'</div>'
      +'<div style="overflow-x:auto">'
        +'<table class="inv-tbl"><thead><tr>'
          +'<th>Producto</th>'
          +'<th style="text-align:center">Stock / Mínimo</th>'
          +'<th style="text-align:right">Costo unit.</th>'
          +'<th style="text-align:right">Valor</th>'
          +'<th>Estado</th>'
          +'<th style="text-align:right;width:170px"></th>'
        +'</tr></thead>'
        +'<tbody id="invBody"><tr><td colspan="6" class="loading"><span class="sp"></span></td></tr></tbody>'
        +'</table>'
      +'</div>'
    +'</div>'

    // ── MODAL HISTORIAL — rediseno ────────────────────────────
    +'<div id="invModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:1000;overflow-y:auto;padding:16px 10px">'
      +'<div style="background:var(--card);border:1px solid var(--border);border-radius:14px;max-width:900px;margin:0 auto;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.5)">'
        // Header con producto + stock actual + cerrar
        +'<div class="mh-head">'
          +'<div class="mh-ptl">'
            +'<span class="mh-dot" id="invMDot" style="background:#546e7a"></span>'
            +'<div class="mh-info">'
              +'<div class="mh-name" id="invMTit">Historial</div>'
              +'<div class="mh-meta" id="invMSub"></div>'
            +'</div>'
          +'</div>'
          +'<div class="mh-head-right">'
            +'<div class="mh-stk-now">'
              +'<div class="mh-stk-l">Stock actual</div>'
              +'<div class="mh-stk-v" id="invMStock" style="color:var(--green)">—</div>'
            +'</div>'
            +'<button class="mh-x" onclick="cerrarInvModal()" title="Cerrar">'+_invIco('close',16)+'</button>'
          +'</div>'
        +'</div>'
        // Tabs
        +'<div class="mh-tabs">'
          +'<div class="mh-tab on" data-tab="mov"    onclick="_invModalTab(\'mov\')">'+_invIco('history')+' Movimientos</div>'
          +'<div class="mh-tab"    data-tab="graf"   onclick="_invModalTab(\'graf\')">'+_invIco('trending')+' Gráfico</div>'
          +'<div class="mh-tab"    data-tab="ajuste" onclick="_invModalTab(\'ajuste\')">'+_invIco('edit')+' Ajustar stock</div>'
        +'</div>'
        // Filtros: chips de período + fechas
        +'<div class="mh-filt">'
          +'<div class="mh-period">'
            +'<div class="mh-pchip" data-period="hoy"    onclick="_invSetPeriodo(\'hoy\')">Hoy</div>'
            +'<div class="mh-pchip" data-period="semana" onclick="_invSetPeriodo(\'semana\')">Semana</div>'
            +'<div class="mh-pchip on" data-period="mes" onclick="_invSetPeriodo(\'mes\')">Mes</div>'
            +'<div class="mh-pchip" data-period="anio"   onclick="_invSetPeriodo(\'anio\')">Año</div>'
          +'</div>'
          +'<div class="mh-filt-dates">'
            +'<span>Desde</span><input type="date" id="invFD">'
            +'<span>Hasta</span><input type="date" id="invFH">'
            +'<button onclick="cargarHistorial()" class="btn-sv" style="padding:7px 14px">Filtrar</button>'
          +'</div>'
        +'</div>'

        // ── TAB: MOVIMIENTOS ──────────────────────────────────
        +'<div class="mh-tab-content on" data-tabc="mov">'
          // KPIs secuencia: Inicial → +Entradas → −Salidas → Final
          +'<div class="mh-kpi">'
            +'<div class="mh-kpi-item ini">'
              +'<div class="mh-kpi-l">Saldo inicial</div>'
              +'<div class="mh-kpi-v" id="invMSini">—</div>'
              +'<span class="mh-kpi-arrow">→</span>'
            +'</div>'
            +'<div class="mh-kpi-item ent">'
              +'<div class="mh-kpi-l">Entradas</div>'
              +'<div class="mh-kpi-v" id="invMEnt">—</div>'
              +'<span class="mh-kpi-arrow">−</span>'
            +'</div>'
            +'<div class="mh-kpi-item sal">'
              +'<div class="mh-kpi-l">Salidas</div>'
              +'<div class="mh-kpi-v" id="invMSal">—</div>'
              +'<span class="mh-kpi-arrow">=</span>'
            +'</div>'
            +'<div class="mh-kpi-item fin" id="invMFinBox">'
              +'<div class="mh-kpi-l">Saldo final</div>'
              +'<div class="mh-kpi-v" id="invMSfin">—</div>'
            +'</div>'
          +'</div>'
          // Tabla compacta con saldo acumulado
          +'<div style="overflow-x:auto">'
            +'<table><thead><tr>'
              +'<th>Fecha</th>'
              +'<th>Tipo</th>'
              +'<th>Referencia</th>'
              +'<th style="text-align:right">Movimiento</th>'
              +'<th style="text-align:right">Saldo</th>'
            +'</tr></thead>'
            +'<tbody id="invHistBody"><tr><td colspan="5" class="loading"><span class="sp"></span></td></tr></tbody>'
            +'</table>'
          +'</div>'
        +'</div>'

        // ── TAB: GRÁFICO ──────────────────────────────────────
        +'<div class="mh-tab-content" data-tabc="graf">'
          +'<div class="mh-chart" id="invChartWrap">'
            +'<div class="mh-chart-empty">Cargá movimientos primero — el gráfico se construye con la evolución del saldo.</div>'
          +'</div>'
        +'</div>'

        // ── TAB: AJUSTE MANUAL ────────────────────────────────
        +'<div class="mh-tab-content" data-tabc="ajuste">'
          +'<div id="invAjusteForm" style="padding:20px 22px">'
            +'<div style="font-size:13px;font-weight:800;margin-bottom:14px;color:var(--text)">Nuevo ajuste de stock</div>'
            +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">'
              +'<div><label style="font-size:11px;color:var(--muted);display:block;margin-bottom:6px;font-weight:700;text-transform:uppercase;letter-spacing:.4px">Tipo</label>'
                +'<select id="ajTipo" class="cfg-inp" style="width:100%">'
                  +'<option value="entrada">Entrada — aumenta stock</option>'
                  +'<option value="salida">Salida — disminuye stock</option>'
                  +'<option value="ajuste">Ajuste — fija el stock en</option>'
                +'</select></div>'
              +'<div><label style="font-size:11px;color:var(--muted);display:block;margin-bottom:6px;font-weight:700;text-transform:uppercase;letter-spacing:.4px">Cantidad</label>'
                +'<input type="number" id="ajCant" class="cfg-inp" style="width:100%" min="0" placeholder="0"></div>'
            +'</div>'
            +'<div style="margin-bottom:14px"><label style="font-size:11px;color:var(--muted);display:block;margin-bottom:6px;font-weight:700;text-transform:uppercase;letter-spacing:.4px">Motivo (obligatorio)</label>'
              +'<input type="text" id="ajMotivo" class="cfg-inp" style="width:100%" placeholder="Ej: Compra proveedor, merma, corrección..."></div>'
            +'<div style="display:flex;gap:8px;justify-content:flex-end">'
              +'<button onclick="_invModalTab(\'mov\')" class="btn-dn">Cancelar</button>'
              +'<button onclick="guardarAjuste()" class="btn-sv">Guardar ajuste</button>'
            +'</div>'
          +'</div>'
        +'</div>'

        // Footer del modal
        +'<div class="mh-foot">'
          +'<span id="invMFootInfo">— movimientos</span>'
          +'<div class="mh-foot-acts">'
            +'<button class="atab" onclick="_invModalTab(\'ajuste\')" style="display:inline-flex;align-items:center;gap:6px">'+_invIco('plus')+'Nuevo ajuste</button>'
          +'</div>'
        +'</div>'
      +'</div>'
    +'</div>'

    // ── MODAL TRANSFERENCIA ──────────────────────────────────
    +'<div id="invTransModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:1001;overflow-y:auto;padding:16px 10px">'
      +'<div style="background:var(--card);border:1px solid var(--border);border-radius:14px;max-width:520px;margin:0 auto;overflow:hidden">'
        +'<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border)">'
          +'<div style="font-size:17px;font-weight:800">Transferir stock entre depósitos</div>'
          +'<button onclick="cerrarTransModal()" style="background:var(--card2);border:1px solid var(--border);border-radius:8px;color:var(--text);cursor:pointer;padding:8px 14px;font-family:Barlow,sans-serif;font-size:13px;font-weight:700"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>'
        +'</div>'
        +'<div style="padding:20px">'
          +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">'
            +'<div><label style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:5px">Depósito origen</label>'
              +'<select id="trOrigen" class="cfg-inp" style="width:100%" onchange="actualizarStockOrigen()"></select></div>'
            +'<div><label style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:5px">Depósito destino</label>'
              +'<select id="trDestino" class="cfg-inp" style="width:100%"></select></div>'
          +'</div>'
          +'<div style="margin-bottom:12px"><label style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:5px">Producto</label>'
            +'<select id="trProducto" class="cfg-inp" style="width:100%" onchange="actualizarStockOrigen()"></select></div>'
          +'<div style="background:var(--card2);border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:13px">'
            +'Stock disponible en origen: <strong id="trStockOrigen" style="color:var(--green)">—</strong>'
          +'</div>'
          +'<div style="margin-bottom:12px"><label style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:5px">Cantidad a transferir</label>'
            +'<input type="number" id="trCant" class="cfg-inp" style="width:100%" min="1" placeholder="0"></div>'
          +'<div style="margin-bottom:16px"><label style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:5px">Observación (opcional)</label>'
            +'<input type="text" id="trObs" class="cfg-inp" style="width:100%" placeholder="Ej: Reposición sucursal norte..."></div>'
          +'<div style="display:flex;gap:8px">'
            +'<button onclick="ejecutarTransferencia()" class="btn-sv" style="flex:1">Transferir</button>'
            +'<button onclick="cerrarTransModal()" class="btn-dn">Cancelar</button>'
          +'</div>'
        +'</div>'
      +'</div>'
    +'</div>';
}

async function cambiarDeposito(sel){
  var sucNom=sel.value;
  _inv.sel.sucNom=sucNom;
  var sucIds=_inv.suc.filter(function(s){return !sucNom||s.nombre===sucNom;}).map(function(s){return s.id;});
  _inv.sel.depIds=_inv.deps.filter(function(d){return sucIds.includes(d.sucursal_id);}).map(function(d){return d.id;});
  _inv.sel.depId=_inv.sel.depIds[0]||null;
  document.getElementById('invDepLabel').innerHTML='Sucursal: <strong>'+(sucNom||'Todas')+'</strong>';
  await cargarStockDeposito();
}

async function cargarStockDeposito(){
  if(!document.getElementById('invBody')) return;
  document.getElementById('invBody').innerHTML='<tr><td colspan="7" class="loading"><span class="sp"></span>Cargando...</td></tr>';
  try{
    // 1. Cargar productos con inventario=true
    var prdsDB=await sg('pos_productos',
      'licencia_email=ilike.'+encodeURIComponent(SE)+
      '&inventario=eq.true&activo=eq.true&order=nombre.asc&limit=500'
    );
    // 2. Determinar depósitos a consultar
    var depIds;
    if(_inv.sel.sucNom){
      var sucIdsFilt=_inv.suc.filter(function(s){return s.nombre===_inv.sel.sucNom;}).map(function(s){return s.id;});
      depIds=_inv.deps.filter(function(d){return sucIdsFilt.includes(d.sucursal_id);}).map(function(d){return d.id;});
    } else {
      depIds=_inv.deps.map(function(d){return d.id;});
    }
    var stockRows=[];
    if(depIds.length){
      var inFilter='deposito_id=in.('+depIds.join(',')+')';
      stockRows=await sg('stock',inFilter+'&licencia_id=eq.'+_inv.licId+'&limit=5000');
    }
    // 3. Construir mapa stock por producto_id
    var stockMap={};
    stockRows.forEach(function(r){
      var pid=r.producto_id;
      if(!stockMap[pid]) stockMap[pid]={cantidad:0,cantidad_minima:r.cantidad_minima||0,costo:r.costo_unitario||0,dep_ids:[]};
      stockMap[pid].cantidad+=(r.cantidad||0);
      stockMap[pid].dep_ids.push(r.deposito_id);
      if(r.cantidad_minima>stockMap[pid].cantidad_minima) stockMap[pid].cantidad_minima=r.cantidad_minima;
    });
    // 4. Combinar: para cada producto con inventario, tomar su stock (0 si no existe aún)
    var rows=prdsDB.map(function(p){
      var sk=stockMap[p.id]||{cantidad:0,cantidad_minima:0,costo:0};
      return {
        producto_id:p.id, nombre_producto:p.nombre, categoria:p.categoria||'',
        color:p.color||'#546e7a', codigo:p.codigo||'', precio:p.precio||0,
        precio_variable:p.precio_variable||false,
        cantidad:sk.cantidad, cantidad_minima:sk.cantidad_minima, costo_unitario:sk.costo
      };
    });
    _inv.prds=rows;
    renderInvTabla(rows);
  }catch(e){
    document.getElementById('invBody').innerHTML='<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--red)">Error: '+e.message+'</td></tr>';
  }
}

function _invEstadoDe(r){
  var q=r.cantidad||0, m=r.cantidad_minima||0;
  if(q<=0) return 'cero';
  if(m>0 && q<=m) return 'bajo';
  return 'ok';
}

function renderInvTabla(lista){
  if(!document.getElementById('invBody')) return;
  var est=_invEstadoChip;
  var search=(document.getElementById('invSearch')||{}).value||'';
  var s=search.toLowerCase();
  var mostrar=lista;
  if(s) mostrar=mostrar.filter(function(r){
    return (r.nombre_producto||'').toLowerCase().indexOf(s)>=0
        || (r.codigo||'').toString().toLowerCase().indexOf(s)>=0
        || (r.categoria||'').toLowerCase().indexOf(s)>=0;
  });
  if(est) mostrar=mostrar.filter(function(r){return _invEstadoDe(r)===est;});

  // Ordenar: críticos primero (cero → bajo → ok), después por nombre
  var orden={cero:0,bajo:1,ok:2};
  mostrar=mostrar.slice().sort(function(a,b){
    var ea=orden[_invEstadoDe(a)], eb=orden[_invEstadoDe(b)];
    if(ea!==eb) return ea-eb;
    return (a.nombre_producto||'').localeCompare(b.nombre_producto||'');
  });

  // KPIs sobre la lista TOTAL (no la filtrada)
  var bajoN=lista.filter(function(r){return _invEstadoDe(r)==='bajo';}).length;
  var ceroN=lista.filter(function(r){return _invEstadoDe(r)==='cero';}).length;
  var okN  =lista.filter(function(r){return _invEstadoDe(r)==='ok';}).length;
  var valor=lista.reduce(function(acc,r){return acc+(Math.max(0,r.cantidad||0)*(r.costo_unitario||0));},0);

  var $=function(id){return document.getElementById(id);};
  if($('invKTotal'))   $('invKTotal').textContent=lista.length;
  if($('invKBajo'))    $('invKBajo').textContent=bajoN;
  if($('invKCero'))    $('invKCero').textContent=ceroN;
  if($('invKValor'))   $('invKValor').textContent=_invFormatMonto(valor);
  if($('invChipNAll')) $('invChipNAll').textContent=lista.length;
  if($('invChipNOk'))  $('invChipNOk').textContent=okN;
  if($('invChipNBajo'))$('invChipNBajo').textContent=bajoN;
  if($('invChipNCero'))$('invChipNCero').textContent=ceroN;
  if($('invCount'))    $('invCount').textContent=mostrar.length+' producto'+(mostrar.length===1?'':'s');
  if($('invSubcount')) $('invSubcount').textContent=(ceroN+bajoN>0)?(ceroN+bajoN)+' requieren atención':'';

  if(!mostrar.length){
    $('invBody').innerHTML='<tr><td colspan="6" style="text-align:center;padding:36px;color:var(--muted)">'
      +(lista.length===0
        ?'No hay productos cargados en este depósito. Usá "Ajustar" en cada producto o "Compras" para cargar stock inicial.'
        :'Sin productos con los filtros actuales')
      +'</td></tr>';
    return;
  }

  $('invBody').innerHTML=mostrar.map(function(r){
    var q=r.cantidad||0, m=r.cantidad_minima||0;
    var estCss=_invEstadoDe(r);
    var stag=(estCss==='cero')?'Sin stock':(estCss==='bajo')?'Stock bajo':'Stock OK';
    var tagCls=(estCss==='cero')?'tag-r':(estCss==='bajo')?'tag-o':'tag-g';
    // Barra de progreso: si hay mínimo, % vs mínimo*2 (para que llegado al mín este al 50%); si no hay min, llena al 100% si q>0
    var pct=100;
    if(m>0) pct=Math.max(0,Math.min(100, q/(m*2)*100));
    else if(q<=0) pct=0;
    var barCls=estCss==='cero'?'red':estCss==='bajo'?'orange':'';
    var valorFila = Math.max(0,q) * (r.costo_unitario||0);
    var nombreSafe=String(r.nombre_producto||'Producto '+r.producto_id).replace(/'/g,"\\'");
    return '<tr class="inv-row '+estCss+'">'
      +'<td>'
        +'<div class="inv-prd">'
          +'<span class="inv-dot" style="background:'+(r.color||'#546e7a')+'"></span>'
          +'<div>'
            +'<div class="inv-prd-name">'+(r.nombre_producto||'Producto '+r.producto_id)+'</div>'
            +'<div class="inv-prd-meta">'
              +(r.codigo?'#'+r.codigo+' ':'')
              +(r.categoria?'<span class="inv-cat">'+r.categoria+'</span>':'')
            +'</div>'
          +'</div>'
        +'</div>'
      +'</td>'
      +'<td class="inv-stk">'
        +'<div class="inv-stk-v '+barCls+'">'+q+'</div>'
        +'<div class="inv-stk-bar"><span class="'+barCls+'" style="width:'+pct+'%"></span></div>'
        +'<div class="inv-stk-min">mín. '+(m>0?m:'—')+'</div>'
      +'</td>'
      +'<td style="text-align:right;font-family:Consolas,monospace;color:'+(r.costo_unitario?'var(--text)':'var(--muted)')+'">'
        +(r.costo_unitario?_invFormatGs(r.costo_unitario):'—')
      +'</td>'
      +'<td style="text-align:right;font-family:Consolas,monospace;font-weight:'+(valorFila>0?'700':'400')+';color:'+(valorFila>0?'var(--text)':'var(--muted)')+'">'
        +(valorFila>0?_invFormatGs(valorFila):'—')
      +'</td>'
      +'<td><span class="tag '+tagCls+'">'+stag+'</span></td>'
      +'<td>'
        +'<div class="inv-ract">'
          +'<button class="inv-ab primary" title="Ver historial" '
            +'onclick="abrirHistorial(' +r.producto_id+ ', \'' +nombreSafe+ '\')">'
            +_invIco('chart')+'Historial</button>'
          +'<button class="inv-ab" title="Ajustar stock" '
            +'onclick="abrirHistorial(' +r.producto_id+ ', \'' +nombreSafe+ '\');setTimeout(function(){_invModalTab(&quot;ajuste&quot;)},150)">'
            +_invIco('edit')+'Ajustar</button>'
        +'</div>'
      +'</td>'
    +'</tr>';
  }).join('');
}

function _invSetEstado(est){
  _invEstadoChip = est;
  // Marcar chip activo
  var chips=document.querySelectorAll('#invChips .inv-chip');
  chips.forEach(function(ch){
    ch.classList.remove('on','orange','red');
    if(ch.getAttribute('data-est')===est){
      ch.classList.add('on');
      if(est==='bajo') ch.classList.add('orange');
      if(est==='cero') ch.classList.add('red');
    }
  });
  renderInvTabla(_inv.prds||[]);
}

function filtrInv(){
  // Solo re-render (el input se lee dentro de renderInvTabla)
  renderInvTabla(_inv.prds||[]);
}

// ── HISTORIAL ─────────────────────────────────────────────
async function abrirHistorial(prodId, prodNom){
  _inv.prodActivo={id:prodId, nombre:prodNom};
  var sr=_inv.prds.find(function(r){return r.producto_id===prodId||String(r.producto_id)===String(prodId);});
  var color=(sr&&sr.color)||'#546e7a';
  var cat=(sr&&sr.categoria)||'';
  var codigo=(sr&&sr.codigo)||'';
  var depNom=(_inv.sel.sucNom?_inv.sel.sucNom+' › ':'')+(_inv.sel.depNom||'Todos los depósitos');

  document.getElementById('invMTit').textContent=prodNom;
  document.getElementById('invMSub').innerHTML=
    (codigo?'#'+codigo+' · ':'')+(cat?cat+' · ':'')+depNom;
  var dot=document.getElementById('invMDot');
  if(dot) dot.style.background=color;
  // Stock actual con color por estado
  var stock = sr?(sr.cantidad||0):0;
  var stockEl=document.getElementById('invMStock');
  stockEl.textContent=stock;
  stockEl.style.color = stock<=0 ? 'var(--red)' : (sr&&sr.cantidad_minima>0&&stock<=sr.cantidad_minima ? 'var(--orange)' : 'var(--green)');

  // Reset tabs y form al estado inicial
  _invModalTab('mov');
  document.getElementById('ajCant').value='';
  document.getElementById('ajMotivo').value='';

  // Período default: Mes (últimos 30 días)
  _invSetPeriodo('mes',true);

  document.getElementById('invModal').style.display='block';
  document.body.style.overflow='hidden';
  await cargarHistorial();
}

function cerrarInvModal(){
  document.getElementById('invModal').style.display='none';
  document.body.style.overflow='';
  _inv.prodActivo=null;
}

function _invModalTab(name){
  var tabs=document.querySelectorAll('#invModal .mh-tab');
  var contents=document.querySelectorAll('#invModal .mh-tab-content');
  tabs.forEach(function(t){ t.classList.toggle('on', t.getAttribute('data-tab')===name); });
  contents.forEach(function(c){ c.classList.toggle('on', c.getAttribute('data-tabc')===name); });
  if(name==='ajuste'){
    setTimeout(function(){ var c=document.getElementById('ajCant'); if(c) c.focus(); }, 50);
  }
  if(name==='graf'){
    // Re-renderizar gráfico por si cambió el tamaño del contenedor
    if(_inv._lastRows) _invRenderGrafico(_inv._lastRows, _inv._lastSaldoInicial);
  }
}

function _invSetPeriodo(p, soloFechas){
  var hoy=new Date();
  var d=new Date(hoy), h=new Date(hoy);
  if(p==='hoy'){ /* d=h=hoy */ }
  else if(p==='semana'){ d=new Date(hoy); d.setDate(d.getDate()-d.getDay()); }
  else if(p==='mes'){ d=new Date(hoy.getFullYear(),hoy.getMonth(),1); }
  else if(p==='anio'){ d=new Date(hoy.getFullYear(),0,1); }
  var fmt=function(x){return x.getFullYear()+'-'+pad(x.getMonth()+1)+'-'+pad(x.getDate());};
  var fdEl=document.getElementById('invFD'), fhEl=document.getElementById('invFH');
  if(fdEl) fdEl.value=fmt(d);
  if(fhEl) fhEl.value=fmt(h);
  // Marcar chip activo
  document.querySelectorAll('#invModal .mh-pchip').forEach(function(ch){
    ch.classList.toggle('on', ch.getAttribute('data-period')===p);
  });
  if(!soloFechas) cargarHistorial();
}

async function cargarHistorial(){
  if(!_inv.prodActivo) return;
  var fd=document.getElementById('invFD').value;
  var fh=document.getElementById('invFH').value;
  var $=function(id){return document.getElementById(id);};
  $('invHistBody').innerHTML='<tr><td colspan="5" class="loading"><span class="sp"></span>Cargando...</td></tr>';
  $('invMSini').textContent='\u2014'; $('invMEnt').textContent='\u2014';
  $('invMSal').textContent='\u2014';  $('invMSfin').textContent='\u2014';
  $('invMFootInfo').textContent='\u2014 movimientos';
  var licId=await invGetLicId();
  var addDayInv=function(ds){var p=ds.split('-');var d=new Date(+p[0],+p[1]-1,+p[2]+1);return d.getFullYear()+'-'+(d.getMonth()+1<10?'0':'')+(d.getMonth()+1)+'-'+(d.getDate()<10?'0':'')+d.getDate();};
  try{
    // Buscar comprobantes que tienen este producto como ítem
    // Usando la tabla stock_comprobante_items para filtrar
    var depIds=_inv.sel.depIds&&_inv.sel.depIds.length
      ?_inv.sel.depIds
      :_inv.deps.map(function(d){return d.id;});

    // Items del producto (sin filtro de fecha — la fecha vive en el header)
    var items=await sg('stock_comprobante_items',
      'producto_id=eq.'+_inv.prodActivo.id
      +'&select=comprobante_id,cantidad,cantidad_antes,cantidad_despues'
      +'&limit=5000');

    if(!items.length){
      $('invHistBody').innerHTML='<tr><td colspan="5" style="text-align:center;padding:36px;color:var(--muted)">Sin movimientos registrados para este producto</td></tr>';
      $('invMSini').textContent='0'; $('invMEnt').textContent='+0';
      $('invMSal').textContent='-0'; $('invMSfin').textContent='0';
      _inv._lastRows=null;
      _invRenderGrafico([], 0);
      return;
    }

    var itemsMap={};
    items.forEach(function(i){ itemsMap[i.comprobante_id]=i; });
    var compIds=Object.keys(itemsMap);

    // Comprobantes del período (ASC para saldo acumulado)
    var qComp='id=in.('+compIds.join(',')+')'
      +'&licencia_id=eq.'+licId
      +(depIds.length?'&deposito_id=in.('+depIds.join(',')+')'  :'')
      +(fd?'&fecha=gte.'+fd+'T04:00:00':'')
      +(fh?'&fecha=lte.'+addDayInv(fh)+'T03:59:59':'')
      +'&order=fecha.asc&limit=500';
    var comps=await sg('stock_comprobantes',qComp);

    // Saldo anterior al período
    var saldoInicial=0;
    if(fd && compIds.length){
      var qPrev='id=in.('+compIds.join(',')+')'
        +'&licencia_id=eq.'+licId
        +(depIds.length?'&deposito_id=in.('+depIds.join(',')+')'  :'')
        +'&fecha=lt.'+fd+'T04:00:00&select=id&limit=5000';
      var prev=await sg('stock_comprobantes',qPrev);
      var prevSet={};
      prev.forEach(function(c){ prevSet[c.id]=true; });
      items.forEach(function(it){
        if(prevSet[it.comprobante_id]) saldoInicial += (it.cantidad||0);
      });
    }

    // Calcular saldo acumulado ASC + totales
    var totEnt=0, totSal=0, saldo=saldoInicial;
    var rows=comps.map(function(c){
      var it=itemsMap[c.id]||{};
      var cant=it.cantidad||0;
      if(cant>0) totEnt+=cant; else totSal+=Math.abs(cant);
      saldo += cant;
      return {
        id:c.id, fecha:c.fecha, tipo:c.tipo, referencia:c.referencia||'',
        deposito_id:c.deposito_id, observacion:c.observacion||'',
        terminal:c.terminal||'', cantidad:cant,
        antes:it.cantidad_antes, despues:it.cantidad_despues, saldo:saldo
      };
    });
    var saldoFinal = saldo;

    $('invMSini').textContent=saldoInicial;
    $('invMEnt').textContent='+'+totEnt;
    $('invMSal').textContent='-'+totSal;
    $('invMSfin').textContent=saldoFinal;
    var finBox=$('invMFinBox');
    if(finBox) finBox.classList.toggle('neg', saldoFinal<0);
    $('invMFootInfo').textContent = rows.length+' movimiento'+(rows.length===1?'':'s')+(fd&&fh?' · '+fd+' al '+fh:'');

    _inv._lastRows = rows;
    _inv._lastSaldoInicial = saldoInicial;

    if(!rows.length){
      $('invHistBody').innerHTML='<tr><td colspan="5" style="text-align:center;padding:36px;color:var(--muted)">Sin movimientos en el periodo seleccionado</td></tr>';
      _invRenderGrafico([], saldoInicial);
      return;
    }

    var tipos={
      'venta':'Venta', 'anulacion':'Anulacion', 'compra':'Compra',
      'entrada':'Entrada', 'salida':'Salida', 'ajuste':'Ajuste', 'conteo':'Conteo',
      'transferencia_salida':'Transf. salida', 'transferencia_entrada':'Transf. entrada'
    };

    var rowsDesc = rows.slice().reverse();
    var html = rowsDesc.map(function(r){
      var lbl=tipos[r.tipo]||r.tipo||'-';
      var fecha=r.fecha?new Date(r.fecha):null;
      var fechaStr = fecha
        ? pad(fecha.getDate())+'/'+pad(fecha.getMonth()+1)+' '+pad(fecha.getHours())+':'+pad(fecha.getMinutes())
        : '-';
      var pos = (r.cantidad||0)>=0;
      return '<tr style="cursor:pointer" onclick="togHistRow(\''+r.id+'\')">'
        +'<td style="font-size:12px;color:var(--muted);white-space:nowrap">'+fechaStr+'</td>'
        +'<td><span class="mh-mov-type '+r.tipo+'">'+lbl+'</span></td>'
        +'<td style="font-size:12px;font-weight:600">'+(r.referencia||'-')+'</td>'
        +'<td style="text-align:right" class="mh-mov-cant '+(pos?'pos':'neg')+'">'+(pos?'+':'-')+Math.abs(r.cantidad)+'</td>'
        +'<td style="text-align:right" class="mh-mov-saldo '+(r.saldo<0?'neg':'')+'">'+r.saldo+'</td>'
      +'</tr>'
      +'<tr id="hdet'+r.id+'" style="display:none"><td colspan="5" style="padding:0">'
        +'<div style="background:var(--card2);padding:10px 16px;border-left:3px solid '+(pos?'var(--green)':'var(--red)')+'" id="hdetBody'+r.id+'">'
          +'<span style="color:var(--muted);font-size:12px">Cargando detalle...</span>'
        +'</div>'
      +'</td></tr>';
    }).join('');
    html += '<tr style="background:var(--card2)"><td colspan="4" style="font-size:11px;color:var(--muted);font-style:italic;padding:10px 14px">Saldo anterior al periodo</td>'
      +'<td style="text-align:right" class="mh-mov-saldo">'+saldoInicial+'</td></tr>';
    $('invHistBody').innerHTML = html;

    _invRenderGrafico(rows, saldoInicial);

  }catch(e){
    $('invHistBody').innerHTML='<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--red)">Error: '+e.message+'</td></tr>';
  }
}

function _invRenderGrafico(rows, saldoInicial){
  var wrap=document.getElementById('invChartWrap');
  if(!wrap) return;
  if(!rows || !rows.length){
    wrap.innerHTML='<div class="mh-chart-empty">No hay movimientos en el periodo seleccionado para graficar.</div>';
    return;
  }
  var fd=document.getElementById('invFD').value;
  var puntos=[];
  if(fd) puntos.push({x:new Date(fd+'T00:00:00').getTime(), y:saldoInicial, lbl:'Inicio'});
  rows.forEach(function(r){ puntos.push({x:new Date(r.fecha).getTime(), y:r.saldo, lbl:r.referencia||r.tipo}); });
  if(puntos.length<2){
    wrap.innerHTML='<div class="mh-chart-empty">Hace falta mas de un punto para graficar.</div>';
    return;
  }
  var W=800, H=120, PAD={t:14,b:24,l:36,r:14};
  var gW=W-PAD.l-PAD.r, gH=H-PAD.t-PAD.b;
  var xs=puntos.map(function(p){return p.x;}), ys=puntos.map(function(p){return p.y;});
  var minX=Math.min.apply(null,xs), maxX=Math.max.apply(null,xs);
  var minY=Math.min.apply(null,ys), maxY=Math.max.apply(null,ys);
  if(minY===maxY){ minY-=1; maxY+=1; }
  if(minY>0) minY=Math.min(minY, 0);
  if(maxY<0) maxY=Math.max(maxY, 0);
  var rangeX=Math.max(1, maxX-minX), rangeY=Math.max(1, maxY-minY);
  var xPx=function(v){return PAD.l + (v-minX)/rangeX*gW;};
  var yPx=function(v){return PAD.t + (1-(v-minY)/rangeY)*gH;};
  var zeroY=yPx(0);
  var d='M'+puntos.map(function(p){return xPx(p.x)+','+yPx(p.y);}).join(' L');
  var area=d+' L'+xPx(puntos[puntos.length-1].x)+','+(PAD.t+gH)+' L'+xPx(puntos[0].x)+','+(PAD.t+gH)+' Z';
  var ultimoY = puntos[puntos.length-1].y;
  var colorLinea = ultimoY<0 ? '#ef4444' : (ultimoY===0 ? '#94a3b8' : '#22c55e');
  var labelsY = [{v:maxY, y:yPx(maxY)}];
  if(minY < 0 && maxY > 0) labelsY.push({v:0, y:zeroY});
  if(minY!==maxY) labelsY.push({v:minY, y:yPx(minY)});
  var svg='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none">'
    +'<defs><linearGradient id="grdInv" x1="0" y1="0" x2="0" y2="1">'
      +'<stop offset="0%" stop-color="'+colorLinea+'" stop-opacity="0.3"/>'
      +'<stop offset="100%" stop-color="'+colorLinea+'" stop-opacity="0"/>'
    +'</linearGradient></defs>'
    +(minY<0&&maxY>0?'<line x1="'+PAD.l+'" y1="'+zeroY+'" x2="'+(W-PAD.r)+'" y2="'+zeroY+'" stroke="#3a414e" stroke-width="1" stroke-dasharray="3,3"/>':'')
    +labelsY.map(function(L){return '<text x="'+(PAD.l-6)+'" y="'+(L.y+3)+'" font-size="10" fill="#8a92a3" text-anchor="end">'+L.v+'</text>';}).join('')
    +'<path d="'+area+'" fill="url(#grdInv)"/>'
    +'<path d="'+d+'" stroke="'+colorLinea+'" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
    +puntos.map(function(p,i){
      var fill=(i===puntos.length-1)?colorLinea:'#1a1d24';
      return '<circle cx="'+xPx(p.x)+'" cy="'+yPx(p.y)+'" r="3" fill="'+fill+'" stroke="'+colorLinea+'" stroke-width="1.5"/>';
    }).join('')
    +'<text x="'+(xPx(puntos[puntos.length-1].x)-6)+'" y="'+(yPx(puntos[puntos.length-1].y)-8)+'" font-size="11" fill="'+colorLinea+'" font-weight="700" text-anchor="end">'+ultimoY+'</text>'
    +'</svg>';
  wrap.innerHTML = svg;
}

async function togHistRow(compId){
  var det=document.getElementById('hdet'+compId);
  if(!det) return;
  var open=det.style.display!=='none';
  det.style.display=open?'none':'table-row';
  if(!open){
    var body=document.getElementById('hdetBody'+compId);
    // Cargar todos los ítems del comprobante (no solo este producto)
    try{
      var allItems=await sg('stock_comprobante_items','comprobante_id=eq.'+compId+'&order=nombre_producto.asc');
      if(!allItems.length){body.innerHTML='<span style="color:var(--muted);font-size:12px">Sin ítems</span>';return;}
      body.innerHTML='<table style="width:100%;border-collapse:collapse">'
        +'<thead><tr>'
          +'<th style="padding:5px 8px;font-size:10px;color:var(--muted);text-align:left">Producto</th>'
          +'<th style="padding:5px 8px;font-size:10px;color:var(--muted);text-align:center">Antes</th>'
          +'<th style="padding:5px 8px;font-size:10px;color:var(--muted);text-align:center">Movimiento</th>'
          +'<th style="padding:5px 8px;font-size:10px;color:var(--muted);text-align:center">Después</th>'
        +'</tr></thead><tbody>'
        +allItems.map(function(it){
          var c=it.cantidad||0;
          var marcado=it.producto_id===_inv.prodActivo.id?'font-weight:800;color:var(--text)':'';
          return '<tr style="border-top:1px solid var(--border)">'
            +'<td style="padding:5px 8px;font-size:12px;'+marcado+'">'+esc(it.nombre_producto)+'</td>'
            +'<td style="padding:5px 8px;font-size:12px;text-align:center;color:var(--muted)">'+(it.cantidad_antes!=null?it.cantidad_antes:'\u2014')+'</td>'
            +'<td style="padding:5px 8px;font-size:13px;text-align:center;font-weight:800;color:'+(c>0?'var(--green)':'var(--red)')+'">'+(c>0?'+':'')+c+'</td>'
            +'<td style="padding:5px 8px;font-size:12px;text-align:center;font-weight:700">'+(it.cantidad_despues!=null?it.cantidad_despues:'\u2014')+'</td>'
          +'</tr>';
        }).join('')
        +'</tbody></table>';
    }catch(e){body.innerHTML='<span style="color:var(--red);font-size:12px">Error: '+e.message+'</span>';}
  }
}

// ── AJUSTE MANUAL ─────────────────────────────────────────
function abrirAjuste(){
  // Cambia al tab "Ajustar stock" del modal de historial.
  // El form siempre esta visible dentro del tab; solo limpiamos campos.
  document.getElementById('ajCant').value='';
  document.getElementById('ajMotivo').value='';
  if(typeof _invModalTab==='function') _invModalTab('ajuste');
  var c=document.getElementById('ajCant'); if(c) c.focus();
}

async function guardarAjuste(){
  if(!_inv.prodActivo) return;
  var tipo    = document.getElementById('ajTipo').value;
  var cant    = parseFloat(document.getElementById('ajCant').value)||0;
  var motivo  = document.getElementById('ajMotivo').value.trim();
  if(cant<=0){toast('Ingresá una cantidad válida'); return;}
  if(!motivo){toast('El motivo es obligatorio'); return;}

  var sr=_inv.prds.find(function(r){return String(r.producto_id)===String(_inv.prodActivo.id);});
  var qAct=sr?sr.cantidad||0:0;
  var cantMov = tipo==='entrada'?cant : tipo==='salida'?-cant : (cant-qAct);
  var qNueva  = tipo==='ajuste'?cant : qAct+cantMov;

  var mov={
    licencia_id:      _inv.licId,
    deposito_id:      _inv.sel.depId,
    sucursal_id:      _inv.sel.sucId,
    producto_id:      _inv.prodActivo.id,
    nombre_producto:  _inv.prodActivo.nombre,
    tipo:             tipo,
    cantidad:         cantMov,
    cantidad_antes:   qAct,
    cantidad_despues: qNueva,
    observacion:      motivo,
    terminal:         'admin',
    usuario:          SE,
    fecha:            new Date().toISOString()
  };
  try{
    // Insertar movimiento
    await supaPost('stock_movimientos', mov, null);
    // Actualizar stock en tabla stock (upsert por deposito_id + producto_id)
    var stockRow={
      licencia_id:     _inv.licId,
      deposito_id:     _inv.sel.depId,
      sucursal_id:     _inv.sel.sucId,
      producto_id:     _inv.prodActivo.id,
      nombre_producto: _inv.prodActivo.nombre,
      cantidad:        qNueva,
      updated_at:      new Date().toISOString()
    };
    if(sr && sr.id){
      await supaPatch('stock','id=eq.'+sr.id,{cantidad:qNueva,updated_at:new Date().toISOString()});
    } else {
      await supaPost('stock', stockRow, null);
    }
    // Actualizar local
    if(sr) sr.cantidad=qNueva;
    else _inv.prds.push({...stockRow, id:Date.now()});
    document.getElementById('invMStock').textContent=qNueva;
    renderInvTabla(_inv.prds);
    // Volver al tab de movimientos despues de guardar
    if(typeof _invModalTab==='function') _invModalTab('mov');
    toast('Ajuste guardado. Stock: '+qNueva);
    // Refrescar tabla principal de inventarios + historial
    if(typeof renderInvTabla==='function' && _inv.prds) renderInvTabla(_inv.prds);
    await cargarHistorial();
  }catch(e){ toast('Error: '+e.message); }
}

// ── TRANSFERENCIA ENTRE DEPÓSITOS ─────────────────────────
function abrirTransferencia(){
  // Dedup defensivo: una entrada por (sucursal, nombre) — el id canónico
  // recibe la transferencia; los duplicados quedan ocultos.
  var grupos=depsAgrupados(_inv.deps, _inv.suc);
  if(grupos.length<2){toast('Necesitás al menos 2 depósitos para transferir'); return;}
  var opsDeps=grupos.map(function(g){
    return '<option value="'+g.idCanonico+'">'+(g.sucursal_nombre?g.sucursal_nombre+' › ':'')+g.nombre+'</option>';
  }).join('');
  document.getElementById('trOrigen').innerHTML=opsDeps;
  document.getElementById('trDestino').innerHTML=opsDeps;
  // Destino: el segundo por defecto
  if(grupos.length>1) document.getElementById('trDestino').selectedIndex=1;
  // Poblar productos: solo los que tienen stock en algún depósito
  var prdsUniq={};
  _inv.prds.forEach(function(r){
    if(!prdsUniq[r.producto_id]) prdsUniq[r.producto_id]=r.nombre_producto||'Producto '+r.producto_id;
  });
  var opsPrds=Object.entries(prdsUniq).map(function(e){return '<option value="'+e[0]+'">'+e[1]+'</option>';}).join('');
  document.getElementById('trProducto').innerHTML=opsPrds||'<option value="">Sin productos</option>';
  document.getElementById('trCant').value='';
  document.getElementById('trObs').value='';
  actualizarStockOrigen();
  document.getElementById('invTransModal').style.display='block';
  document.body.style.overflow='hidden';
}

function cerrarTransModal(){
  document.getElementById('invTransModal').style.display='none';
  document.body.style.overflow='';
}

async function actualizarStockOrigen(){
  var origenId=parseInt(document.getElementById('trOrigen').value);
  var prodId=document.getElementById('trProducto').value;
  if(!origenId||!prodId){document.getElementById('trStockOrigen').textContent='—';return;}
  try{
    var rows=await sg('stock','deposito_id=eq.'+origenId+'&producto_id=eq.'+prodId+'&licencia_id=eq.'+_inv.licId+'&select=cantidad&limit=1');
    document.getElementById('trStockOrigen').textContent=rows&&rows.length?(rows[0].cantidad||0):'0';
  }catch(e){document.getElementById('trStockOrigen').textContent='?';}
}

async function ejecutarTransferencia(){
  var origenId = parseInt(document.getElementById('trOrigen').value);
  var destinoId= parseInt(document.getElementById('trDestino').value);
  var prodId   = parseInt(document.getElementById('trProducto').value);
  var cant     = parseFloat(document.getElementById('trCant').value)||0;
  var obs      = document.getElementById('trObs').value.trim();

  if(origenId===destinoId){toast('El origen y destino deben ser diferentes'); return;}
  if(cant<=0){toast('Ingresá una cantidad válida'); return;}

  // Obtener datos de los depósitos
  var depOrigen  = _inv.deps.find(function(d){return d.id===origenId;});
  var depDestino = _inv.deps.find(function(d){return d.id===destinoId;});
  var prodNom    = document.getElementById('trProducto').options[document.getElementById('trProducto').selectedIndex]?.text||'Producto';

  try{
    // Leer stock actual en origen
    var [rowsOrig, rowsDest] = await Promise.all([
      sg('stock','deposito_id=eq.'+origenId+'&producto_id=eq.'+prodId+'&licencia_id=eq.'+_inv.licId+'&limit=1'),
      sg('stock','deposito_id=eq.'+destinoId+'&producto_id=eq.'+prodId+'&licencia_id=eq.'+_inv.licId+'&limit=1')
    ]);
    var qOrig = rowsOrig&&rowsOrig.length?rowsOrig[0].cantidad||0:0;
    var qDest = rowsDest&&rowsDest.length?rowsDest[0].cantidad||0:0;
    if(cant>qOrig){toast('Stock insuficiente en origen (disponible: '+qOrig+')'); return;}

    var qOrigNueva=qOrig-cant, qDestNueva=qDest+cant;
    var ref='Transfer. de '+depOrigen.nombre+' → '+depDestino.nombre;
    var ts=new Date().toISOString();

    // Movimiento salida en origen
    await supaPost('stock_movimientos',{
      licencia_id:_inv.licId, deposito_id:origenId, sucursal_id:depOrigen.sucursal_id,
      producto_id:prodId, nombre_producto:prodNom,
      tipo:'transferencia_salida', cantidad:-cant,
      cantidad_antes:qOrig, cantidad_despues:qOrigNueva,
      referencia:ref, observacion:obs, terminal:'admin', usuario:SE, fecha:ts
    },null);
    // Movimiento entrada en destino
    await supaPost('stock_movimientos',{
      licencia_id:_inv.licId, deposito_id:destinoId, sucursal_id:depDestino.sucursal_id,
      producto_id:prodId, nombre_producto:prodNom,
      tipo:'transferencia_entrada', cantidad:cant,
      cantidad_antes:qDest, cantidad_despues:qDestNueva,
      referencia:ref, observacion:obs, terminal:'admin', usuario:SE, fecha:ts
    },null);
    // Actualizar stock en ambos depósitos
    if(rowsOrig&&rowsOrig.length) await supaPatch('stock','id=eq.'+rowsOrig[0].id,{cantidad:qOrigNueva,updated_at:ts});
    else await supaPost('stock',{licencia_id:_inv.licId,deposito_id:origenId,sucursal_id:depOrigen.sucursal_id,producto_id:prodId,nombre_producto:prodNom,cantidad:qOrigNueva},null);
    if(rowsDest&&rowsDest.length) await supaPatch('stock','id=eq.'+rowsDest[0].id,{cantidad:qDestNueva,updated_at:ts});
    else await supaPost('stock',{licencia_id:_inv.licId,deposito_id:destinoId,sucursal_id:depDestino.sucursal_id,producto_id:prodId,nombre_producto:prodNom,cantidad:qDestNueva},null);

    toast('Transferencia realizada: '+cant+' unidades');
    cerrarTransModal();
    // Refrescar si el depósito activo es origen o destino
    if(_inv.sel.depId===origenId||_inv.sel.depId===destinoId) await cargarStockDeposito();
  }catch(e){ toast('Error: '+e.message); }
}


// ── EXTRACTO DE PRODUCTO ──────────────────────────────────────────────
var _ext = {
  prds: [], sucs: [], deps: [],
  prod: null,   // {id, nombre, codigo, color}
  licId: null
};

async function extGetLicId(){
  if(_ext.licId) return _ext.licId;
  if(SLI){ _ext.licId=SLI; return SLI; }
  var r=await sg('licencias','email_cliente=ilike.'+encodeURIComponent(SE)+'&activa=eq.true&select=id&limit=1');
  if(r&&r.length){_ext.licId=r[0].id; return r[0].id;}
  throw new Error('No se encontró licencia');
}

async function renderExtracto(){
  var c=document.getElementById('content');
  c.innerHTML='<div class="loading"><span class="sp"></span>Cargando...</div>';
  try{
    var licId=await extGetLicId();
    var res=await Promise.all([
      sg('pos_productos','licencia_email=ilike.'+encodeURIComponent(SE)+'&inventario=eq.true&activo=eq.true&order=nombre.asc&select=id,nombre,codigo,color,categoria&limit=500'),
      sg('sucursales','licencia_id=eq.'+licId+'&activa=eq.true&order=nombre.asc'),
      sg('depositos','licencia_id=eq.'+licId+'&activo=eq.true&order=nombre.asc')
    ]);
    _ext.prds=res[0]; _ext.sucs=res[1]; _ext.deps=res[2];
    // Dedup defensivo de sucursales por nombre normalizado — si la base tiene
    // duplicados legacy, el dropdown muestra una sola entrada.
    var _vistas={};
    _ext.sucsUnicas=_ext.sucs.filter(function(s){
      var k=String(s.nombre||'').trim().toUpperCase();
      if(_vistas[k]) return false;
      _vistas[k]=true; return true;
    });
  }catch(e){
    c.innerHTML='<div style="padding:24px;color:var(--red)">Error: '+e.message+'</div>';
    return;
  }

  // Fechas default: este mes
  var hoy=new Date();
  var d1=new Date(hoy.getFullYear(),hoy.getMonth(),1);
  var fdDef=d1.getFullYear()+'-'+pad(d1.getMonth()+1)+'-'+pad(d1.getDate());
  var fhDef=hoy.getFullYear()+'-'+pad(hoy.getMonth()+1)+'-'+pad(hoy.getDate());

  // Construir opciones producto
  var prodOpts='<option value="">— Seleccioná un producto —</option>'
    +_ext.prds.map(function(p){
      return '<option value="'+p.id+'">'+(p.codigo?'['+p.codigo+'] ':'')+p.nombre+'</option>';
    }).join('');

  // Sucursales únicas
  var sucOpts='<option value="">Todas las sucursales</option>'
    +_ext.sucsUnicas.map(function(s){return '<option value="'+s.nombre+'">'+s.nombre+'</option>';}).join('');

  c.innerHTML=
    '<div class="ph">'
      +'<div><div class="pt">Extracto de Producto</div>'
        +'<div class="ps">Evolución de stock — movimientos y saldo acumulado</div></div>'
      +'<div class="dbar">'
        +'<button onclick="extBuscar()" class="btn-sv" style="padding:9px 18px">Buscar</button>'
      +'</div>'
    +'</div>'
    // Filtros
    +'<div class="card" style="margin-bottom:12px">'
      +'<div style="padding:14px 18px;display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">'
        +'<div style="flex:2;min-width:200px">'
          +'<label style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:5px">Producto</label>'
          +'<select id="extProd" class="cfg-inp" style="width:100%">'+prodOpts+'</select>'
        +'</div>'
        +'<div style="flex:1;min-width:140px">'
          +'<label style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:5px">Sucursal</label>'
          +'<select id="extSuc" class="cfg-inp" style="width:100%" onchange="extActualizarDeps()">'+sucOpts+'</select>'
        +'</div>'
        +'<div style="flex:1;min-width:140px">'
          +'<label style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:5px">Depósito</label>'
          +'<select id="extDep" class="cfg-inp" style="width:100%"><option value="">Todos</option></select>'
        +'</div>'
        +'<div>'
          +'<label style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:5px">Desde</label>'
          +'<input type="date" id="extFD" class="cfg-inp" value="'+fdDef+'">'
        +'</div>'
        +'<div>'
          +'<label style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:5px">Hasta</label>'
          +'<input type="date" id="extFH" class="cfg-inp" value="'+fhDef+'">'
        +'</div>'
        +'<div style="display:flex;gap:6px;flex-wrap:wrap">'
          +'<button onclick="extSetPeriodo(\'hoy\')"    class="dbtn" id="extBHoy">Hoy</button>'
          +'<button onclick="extSetPeriodo(\'semana\')" class="dbtn" id="extBSem">Semana</button>'
          +'<button onclick="extSetPeriodo(\'mes\')"    class="dbtn on" id="extBMes">Mes</button>'
          +'<button onclick="extSetPeriodo(\'anio\')"   class="dbtn" id="extBAnio">Año</button>'
        +'</div>'
      +'</div>'
    +'</div>'
    // KPIs (vacíos al inicio)
    +'<div class="kg k4" id="extKpis" style="display:none">'
      +'<div class="kc" style="--c:var(--blue)"><div class="kc-l">Saldo anterior</div><div class="kc-v" id="extKSaldoAnt">0</div></div>'
      +'<div class="kc" style="--c:var(--green)"><div class="kc-l">Entradas</div><div class="kc-v" id="extKEnt">0</div></div>'
      +'<div class="kc" style="--c:var(--red)"><div class="kc-l">Salidas</div><div class="kc-v" id="extKSal">0</div></div>'
      +'<div class="kc" style="--c:var(--orange)"><div class="kc-l">Saldo final</div><div class="kc-v" id="extKSaldoFin">0</div></div>'
    +'</div>'
    // Gráfico
    +'<div class="card" id="extGrafCard" style="display:none;margin-bottom:12px">'
      +'<div class="card-h"><span class="card-t" id="extGrafTit">Evolución de stock</span></div>'
      +'<div style="padding:16px 18px"><canvas id="extCanvas" height="90"></canvas></div>'
    +'</div>'
    // Tabla
    +'<div class="card" id="extTablaCard" style="display:none">'
      +'<div class="card-h">'
        +'<span class="card-t" id="extTabCount">—</span>'
        +'<span style="font-size:12px;color:var(--muted)" id="extTabSaldoLabel"></span>'
      +'</div>'
      +'<div style="overflow-x:auto"><table><thead><tr>'
        +'<th>Fec. Doc.</th><th>Hora</th><th>Movimiento</th>'
        +'<th>Comprobante</th><th>Sucursal</th><th>Depósito</th>'
        +'<th style="text-align:right">Entrada</th>'
        +'<th style="text-align:right">Salida</th>'
        +'<th style="text-align:right">Saldo</th>'
      +'</tr></thead>'
      +'<tbody id="extBody"></tbody>'
      +'</table></div>'
      +'<div style="padding:12px 18px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--border);flex-wrap:wrap;gap:8px">'
        +'<span style="font-size:13px;color:var(--muted)" id="extFooter"></span>'
        +'<div style="display:flex;gap:8px">'
          +'<select id="extTipo" class="d-inp" onchange="extFiltrarTabla()" style="font-size:12px">'
            +'<option value="">Todos los tipos</option>'
            +'<option value="venta">Ventas</option>'
            +'<option value="anulacion">Anulaciones</option>'
            +'<option value="compra">Compras</option>'
            +'<option value="entrada">Entradas</option>'
            +'<option value="salida">Salidas</option>'
            +'<option value="ajuste">Ajustes</option>'
            +'<option value="transferencia_salida">Transfer. salida</option>'
            +'<option value="transferencia_entrada">Transfer. entrada</option>'
          +'</select>'
        +'</div>'
      +'</div>'
    +'</div>'
    +'<div id="extEmpty" style="display:none" class="empty">'
      +'<div class="empty-i"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg></div>'
      +'<div class="empty-t">Sin movimientos</div>'
      +'<div class="empty-s">No hay movimientos para el período y filtros seleccionados</div>'
    +'</div>';

  extActualizarDeps();
}

function extActualizarDeps(){
  var sucNom=(document.getElementById('extSuc')||{}).value||'';
  var sucIds=_ext.sucs.filter(function(s){return !sucNom||s.nombre===sucNom;}).map(function(s){return s.id;});
  var deps=_ext.deps.filter(function(d){return sucIds.includes(d.sucursal_id);});
  var el=document.getElementById('extDep');
  if(!el) return;
  var grupos=depsAgrupados(deps, _ext.sucs);
  el.innerHTML='<option value="">Todos los depósitos</option>'
    +grupos.map(function(g){
       return '<option value="'+g.idsArr.join(',')+'">'+g.nombre+'</option>';
     }).join('');
}

function extSetPeriodo(p){
  var hoy=new Date();
  var d=new Date(hoy), h=new Date(hoy);
  if(p==='hoy'){d=new Date(hoy);h=new Date(hoy);}
  else if(p==='semana'){d=new Date(hoy);d.setDate(d.getDate()-d.getDay());}
  else if(p==='mes'){d=new Date(hoy.getFullYear(),hoy.getMonth(),1);}
  else if(p==='anio'){d=new Date(hoy.getFullYear(),0,1);}
  var fmt=function(x){return x.getFullYear()+'-'+pad(x.getMonth()+1)+'-'+pad(x.getDate());};
  document.getElementById('extFD').value=fmt(d);
  document.getElementById('extFH').value=fmt(h);
  ['Hoy','Sem','Mes','Anio'].forEach(function(x){
    var el=document.getElementById('extB'+x);
    if(el) el.classList.toggle('on', (p==='hoy'&&x==='Hoy')||(p==='semana'&&x==='Sem')||(p==='mes'&&x==='Mes')||(p==='anio'&&x==='Anio'));
  });
}

// Datos crudos guardados para filtrar sin re-fetch
var _extRows=[];

async function extBuscar(){
  var prodId=parseInt((document.getElementById('extProd')||{}).value||'0');
  if(!prodId){toast('Seleccioná un producto');return;}
  var fd=(document.getElementById('extFD')||{}).value||'';
  var fh=(document.getElementById('extFH')||{}).value||'';
  var sucNom=(document.getElementById('extSuc')||{}).value||'';
  // El value del select puede ser "" (todos), "12" o "12,45" (grupo deduplicado)
  var depVal=(document.getElementById('extDep')||{}).value||'';
  var depIdsFromSel = depVal
    ? String(depVal).split(',').map(function(x){return parseInt(x,10);}).filter(function(x){return !!x;})
    : [];

  var licId=await extGetLicId();
  var addDayExt=function(ds){var p=ds.split('-');var d=new Date(+p[0],+p[1]-1,+p[2]+1);return d.getFullYear()+'-'+(d.getMonth()+1<10?'0':'')+(d.getMonth()+1)+'-'+(d.getDate()<10?'0':'')+d.getDate();};

  // Ocultar todo mientras carga
  ['extKpis','extGrafCard','extTablaCard','extEmpty'].forEach(function(id){
    var el=document.getElementById(id);if(el)el.style.display='none';
  });
  document.getElementById('extBody').innerHTML='<tr><td colspan="9" class="loading"><span class="sp"></span>Buscando movimientos...</td></tr>';
  document.getElementById('extTablaCard').style.display='block';

  try{
    // Obtener dep_ids según filtros
    var depIds;
    if(depIdsFromSel.length){
      depIds=depIdsFromSel;
    } else if(sucNom){
      var sucIdsFiltE=_ext.sucs.filter(function(s){return s.nombre===sucNom;}).map(function(s){return s.id;});
      depIds=_ext.deps.filter(function(d){return sucIdsFiltE.includes(d.sucursal_id);}).map(function(d){return d.id;});
    } else {
      depIds=_ext.deps.map(function(d){return d.id;});
    }

    // Saldo anterior al período
    var saldoAnt=0;
    if(fd){
      var prevItems=await sg('stock_comprobante_items',
        'producto_id=eq.'+prodId+'&select=cantidad,comprobante_id&limit=5000'
      );
      var prevCompIds=prevItems.map(function(i){return i.comprobante_id;});
      if(prevCompIds.length){
        var qPrevC='id=in.('+prevCompIds.join(',')+')'
          +'&licencia_id=eq.'+licId
          +(depIds.length?'&deposito_id=in.('+depIds.join(',')+')'  :'')
          +'&fecha=lt.'+fd+'T04:00:00&select=id&limit=5000';
        var prevComps=await sg('stock_comprobantes',qPrevC);
        var prevCompSet=new Set(prevComps.map(function(c){return c.id;}));
        prevItems.forEach(function(i){if(prevCompSet.has(i.comprobante_id))saldoAnt+=(i.cantidad||0);});
      }
    }

    // Items del período
    var items=await sg('stock_comprobante_items',
      'producto_id=eq.'+prodId+'&select=comprobante_id,cantidad,cantidad_antes,cantidad_despues&limit=5000'
    );
    if(!items.length){
      document.getElementById('extTablaCard').style.display='none';
      document.getElementById('extEmpty').style.display='block';
      return;
    }
    var compIds=[...new Set(items.map(function(i){return i.comprobante_id;}))];
    var itemsMap={};
    items.forEach(function(i){itemsMap[i.comprobante_id]=i;});

    var qComp='id=in.('+compIds.join(',')+')'
      +'&licencia_id=eq.'+licId
      +(depIds.length?'&deposito_id=in.('+depIds.join(',')+')'  :'')
      +(fd?'&fecha=gte.'+fd+'T04:00:00':'')
      +(fh?'&fecha=lte.'+addDayExt(fh)+'T03:59:59':'')
      +'&order=fecha.asc,id.asc&limit=5000';
    var comps=await sg('stock_comprobantes',qComp);

    if(!comps.length){
      document.getElementById('extTablaCard').style.display='none';
      document.getElementById('extEmpty').style.display='block';
      if(document.getElementById('extKpis')){
        document.getElementById('extKpis').style.display='grid';
        document.getElementById('extKSaldoAnt').textContent=saldoAnt;
        document.getElementById('extKEnt').textContent='0';
        document.getElementById('extKSal').textContent='0';
        document.getElementById('extKSaldoFin').textContent=saldoAnt;
      }
      return;
    }

    // Construir filas con saldo acumulado
    var saldo=saldoAnt;
    var totEnt=0,totSal=0;
    _extRows=comps.map(function(c){
      var it=itemsMap[c.id]||{};
      var cant=it.cantidad||0;
      if(cant>0) totEnt+=cant; else totSal+=Math.abs(cant);
      saldo+=cant;
      var dep=(_ext.deps.find(function(d){return d.id===c.deposito_id;})||{});
      var suc=(_ext.sucs.find(function(s){return s.id===c.sucursal_id;})||{});
      return {
        fecha:c.fecha, tipo:c.tipo, referencia:c.referencia||'',
        depNom:dep.nombre||('#'+c.deposito_id),
        sucNom:suc.nombre||'',
        entrada:cant>0?cant:0, salida:cant<0?Math.abs(cant):0,
        cant:cant, saldo:saldo,
        antes:it.cantidad_antes, despues:it.cantidad_despues,
        terminal:c.terminal||'', usuario:c.usuario||''
      };
    });

    // KPIs
    document.getElementById('extKpis').style.display='grid';
    document.getElementById('extKSaldoAnt').textContent=saldoAnt;
    document.getElementById('extKEnt').textContent='+'+totEnt;
    document.getElementById('extKSal').textContent='-'+totSal;
    var saldoFin=saldoAnt+totEnt-totSal;
    var sfEl=document.getElementById('extKSaldoFin');
    sfEl.textContent=saldoFin;
    sfEl.style.color=saldoFin<0?'var(--red)':saldoFin===0?'var(--muted)':'var(--green)';

    // Gráfico
    extRenderGrafico(_extRows, saldoAnt, fd, fh);

    // Tabla
    extRenderTabla(_extRows, saldoAnt);

    // Footer
    var prod=_ext.prds.find(function(p){return p.id===prodId;});
    document.getElementById('extTabCount').textContent=(prod?prod.nombre:'Producto')+' — '+comps.length+' movimientos';
    document.getElementById('extTabSaldoLabel').textContent='Saldo final: '+saldoFin;
    document.getElementById('extTablaCard').style.display='block';

  }catch(e){
    document.getElementById('extBody').innerHTML='<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--red)">Error: '+e.message+'</td></tr>';
  }
}

function extFiltrarTabla(){
  extRenderTabla(_extRows, null);
}

var _tiposExt={
  'venta':                {lbl:'Venta',            col:'var(--red)',    bg:'var(--r2)'},
  'anulacion':            {lbl:'Anulación',         col:'var(--blue)',   bg:'var(--b2)'},
  'compra':               {lbl:'Compra',            col:'var(--green)',  bg:'var(--g2)'},
  'entrada':              {lbl:'Entrada',           col:'var(--green)',  bg:'var(--g2)'},
  'salida':               {lbl:'Salida',            col:'var(--orange)', bg:'var(--o2)'},
  'ajuste':               {lbl:'Ajuste',            col:'var(--blue)',   bg:'var(--b2)'},
  'transferencia_salida': {lbl:'Transf. Salida',    col:'var(--orange)', bg:'var(--o2)'},
  'transferencia_entrada':{lbl:'Transf. Entrada',   col:'var(--green)',  bg:'var(--g2)'},
};

function extRenderTabla(rows, saldoAntOverride){
  if(!document.getElementById('extBody')) return;
  var filtTipo=(document.getElementById('extTipo')||{}).value||'';
  var lista=filtTipo?rows.filter(function(r){return r.tipo===filtTipo;}):rows;

  if(!lista.length){
    document.getElementById('extBody').innerHTML='<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--muted)">Sin resultados para este filtro</td></tr>';
    document.getElementById('extFooter').textContent='';
    return;
  }

  // Fila saldo anterior
  var saldoAnt=saldoAntOverride!=null?saldoAntOverride:(lista.length?lista[0].saldo-lista[0].cant:0);
  var htmlRows='<tr style="background:var(--card2)">'
    +'<td colspan="6" style="font-size:12px;color:var(--muted);font-style:italic;padding:8px 14px">SALDO ANTERIOR</td>'
    +'<td style="text-align:right;color:var(--muted)">—</td>'
    +'<td style="text-align:right;color:var(--muted)">—</td>'
    +'<td style="text-align:right;font-weight:700">'+saldoAnt+'</td>'
    +'</tr>';

  htmlRows+=lista.map(function(r){
    var tc=_tiposExt[r.tipo]||{lbl:r.tipo,col:'var(--muted)',bg:'transparent'};
    var fecha=r.fecha?new Date(r.fecha):null;
    var fechaStr=fecha?pad(fecha.getDate())+'/'+pad(fecha.getMonth()+1)+'/'+fecha.getFullYear():'—';
    var horaStr =fecha?pad(fecha.getHours())+':'+pad(fecha.getMinutes())+':'+pad(fecha.getSeconds()):'—';
    var saldoCol=r.saldo<0?'var(--red)':r.saldo===0?'var(--muted)':'inherit';
    return '<tr>'
      +'<td style="font-size:12px;white-space:nowrap">'+fechaStr+'</td>'
      +'<td style="font-size:12px;white-space:nowrap;color:var(--muted)">'+horaStr+'</td>'
      +'<td><span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;background:'+tc.bg+';color:'+tc.col+'">'+tc.lbl+'</span>'
        +(r.terminal?'<div style="font-size:10px;color:var(--muted)">'+esc(r.terminal)+'</div>':'')
      +'</td>'
      +'<td style="font-size:12px;font-weight:600">'+esc(r.referencia)+'</td>'
      +'<td style="font-size:12px;color:var(--muted)">'+esc(r.sucNom)+'</td>'
      +'<td style="font-size:12px;color:var(--muted)">'+esc(r.depNom)+'</td>'
      +'<td style="text-align:right;font-weight:700;color:var(--green)">'+(r.entrada>0?'+'+r.entrada:'')+'</td>'
      +'<td style="text-align:right;font-weight:700;color:var(--red)">' +(r.salida >0?'-'+r.salida :'')+'</td>'
      +'<td style="text-align:right;font-weight:800;font-size:14px;color:'+saldoCol+'">'+r.saldo+'</td>'
    +'</tr>';
  }).join('');

  document.getElementById('extBody').innerHTML=htmlRows;
  var saldoFin=lista[lista.length-1].saldo;
  document.getElementById('extFooter').textContent=
    lista.length+' registros · Saldo final: '+saldoFin;
}

function extRenderGrafico(rows, saldoAnt, fd, fh){
  var card=document.getElementById('extGrafCard');
  if(!card) return;
  card.style.display='block';
  var canvas=document.getElementById('extCanvas');
  if(!canvas) return;

  // Construir puntos: [fecha, saldo]
  var puntos=[];
  if(fd) puntos.push({x:new Date(fd+'T00:00:00'), y:saldoAnt, label:'Inicio'});
  rows.forEach(function(r){ puntos.push({x:new Date(r.fecha), y:r.saldo, label:r.referencia||r.tipo}); });

  var W=canvas.offsetWidth||canvas.parentElement.offsetWidth||600;
  canvas.width=W; canvas.height=180;
  var ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,W,180);

  if(puntos.length<2){card.style.display='none';return;}

  var ys=puntos.map(function(p){return p.y;});
  var minY=Math.min.apply(null,ys), maxY=Math.max.apply(null,ys);
  var rangeY=maxY-minY||1;
  var PAD={t:16,b:32,l:48,r:16};
  var gW=W-PAD.l-PAD.r, gH=180-PAD.t-PAD.b;

  var xs=puntos.map(function(p){return p.x.getTime();});
  var minX=Math.min.apply(null,xs), maxX=Math.max.apply(null,xs);
  var rangeX=maxX-minX||1;

  function px(p){
    return PAD.l+((p.x.getTime()-minX)/rangeX)*gW;
  }
  function py(y){
    return PAD.t+gH-((y-minY)/rangeY)*gH;
  }

  // Grid lines
  ctx.strokeStyle='rgba(255,255,255,0.06)';
  ctx.lineWidth=1;
  for(var i=0;i<=4;i++){
    var yv=minY+(rangeY/4)*i;
    var yp=py(yv);
    ctx.beginPath(); ctx.moveTo(PAD.l,yp); ctx.lineTo(PAD.l+gW,yp); ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,0.35)';
    ctx.font='10px Barlow,sans-serif';
    ctx.textAlign='right';
    ctx.fillText(Math.round(yv),PAD.l-4,yp+3);
  }

  // Zero line
  if(minY<0&&maxY>0){
    var yZero=py(0);
    ctx.strokeStyle='rgba(239,83,80,0.4)';
    ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.moveTo(PAD.l,yZero); ctx.lineTo(PAD.l+gW,yZero); ctx.stroke();
    ctx.setLineDash([]);
  }

  // Área bajo la curva
  var grad=ctx.createLinearGradient(0,PAD.t,0,PAD.t+gH);
  var hasNeg=minY<0;
  grad.addColorStop(0, hasNeg?'rgba(239,83,80,0.18)':'rgba(76,175,80,0.18)');
  grad.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=grad;
  ctx.beginPath();
  ctx.moveTo(px(puntos[0]), py(0<minY?minY:0));
  puntos.forEach(function(p){ ctx.lineTo(px(p),py(p.y)); });
  ctx.lineTo(px(puntos[puntos.length-1]), py(0<minY?minY:0));
  ctx.closePath(); ctx.fill();

  // Línea principal
  ctx.strokeStyle=hasNeg?'#ef5350':'#4caf50';
  ctx.lineWidth=2;
  ctx.lineJoin='round';
  ctx.beginPath();
  puntos.forEach(function(p,i){ i===0?ctx.moveTo(px(p),py(p.y)):ctx.lineTo(px(p),py(p.y)); });
  ctx.stroke();

  // Puntos
  puntos.forEach(function(p){
    ctx.beginPath();
    ctx.arc(px(p),py(p.y),3,0,Math.PI*2);
    ctx.fillStyle=p.y<0?'#ef5350':'#4caf50';
    ctx.fill();
  });

  // Eje X — fechas
  ctx.fillStyle='rgba(255,255,255,0.35)';
  ctx.font='10px Barlow,sans-serif';
  ctx.textAlign='center';
  var labCount=Math.min(puntos.length,6);
  var step=Math.floor(puntos.length/labCount)||1;
  for(var j=0;j<puntos.length;j+=step){
    var p=puntos[j];
    var d=p.x;
    var lbl=pad(d.getDate())+'/'+pad(d.getMonth()+1);
    ctx.fillText(lbl, px(p), 180-PAD.b+14);
  }
}


// ═══════════════════════════════════════════════════════════
// COMPRAS Y MOVIMIENTOS DE STOCK
// ═══════════════════════════════════════════════════════════

// Estado compartido del formulario
var _mov = {
  modo: 'compra',    // 'compra' | 'entrada' | 'salida' | 'transferencia'
  items: [],         // [{prodId, nombre, color, codigo, cantidad, costo}]
  deps: [], sucs: [], prds: [],
  licId: null
};

async function movGetLicId(){
  if(_mov.licId) return _mov.licId;
  // reusar de _ext si ya está cargado
  if(_ext && _ext.licId){ _mov.licId=_ext.licId; return _mov.licId; }
  if(SLI){ _mov.licId=SLI; return SLI; }
  var r=await sg('licencias','email_cliente=ilike.'+encodeURIComponent(SE)+'&activa=eq.true&select=id&limit=1');
  if(r&&r.length){ _mov.licId=r[0].id; return r[0].id; }
  throw new Error('No se encontró licencia');
}

async function movCargarMaestros(){
  if(_mov.deps.length && _mov.prds.length) return; // ya cargados
  var licId=await movGetLicId();
  var res=await Promise.all([
    sg('sucursales','licencia_id=eq.'+licId+'&activa=eq.true&order=nombre.asc'),
    sg('depositos', 'licencia_id=eq.'+licId+'&activo=eq.true&order=nombre.asc'),
    sg('pos_productos','licencia_email=ilike.'+encodeURIComponent(SE)+'&inventario=eq.true&activo=eq.true&order=nombre.asc&select=id,nombre,codigo,color,categoria,precio,costo&limit=500')
  ]);
  _mov.sucs=res[0]; _mov.deps=res[1]; _mov.prds=res[2];
  _mov.sucsU=_mov.sucs; // DB ya normalizada
}

// ── COMPRAS ───────────────────────────────────────────────
async function renderCompras(tab){
  tab=tab||'lista';
  var c=document.getElementById('content');
  c.innerHTML='<div class="loading"><span class="sp"></span>Cargando...</div>';
  try{ await movCargarMaestros(); } catch(e){ c.innerHTML='<div style="padding:24px;color:var(--red)">Error: '+e.message+'</div>'; return; }
  var tabs='<div class="admin-tabs">'
    +'<button class="atab'+(tab==='lista'?' on':'')+'" onclick="renderCompras(&apos;lista&apos;)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> Lista de compras</button>'
    +'<button class="atab'+(tab==='nuevo'?' on':'')+'" onclick="renderCompras(&apos;nuevo&apos;)">+ Nueva compra</button>'
    +'</div>';
  if(tab==='lista'){
    c.innerHTML=tabs+'<div id="movListaWrap"></div>';
    await movCargarLista(['compra'], 'movListaWrap');
  } else {
    _mov.modo='compra'; _mov.items=[];
    var hoy=new Date().toISOString().split('T')[0];
    c.innerHTML=tabs+movBuildShell({
      titulo:'Nueva Compra', subtit:'Ingreso de mercadería al depósito',
      hoy:hoy, tipoFixed:'Compra / Ingreso',
      depEntradaOpts:movBuildDepOpts(null,false), depSalidaOpts:null,
      mostrarCosto:true, mostrarProveedor:true
    });
    movRenderGrilla();
  }
}

// ── MOVIMIENTOS DE STOCK ──────────────────────────────────
async function renderMovStock(tab){
  tab=tab||'lista';
  var c=document.getElementById('content');
  c.innerHTML='<div class="loading"><span class="sp"></span>Cargando...</div>';
  try{ await movCargarMaestros(); } catch(e){ c.innerHTML='<div style="padding:24px;color:var(--red)">Error: '+e.message+'</div>'; return; }
  var tabs='<div class="admin-tabs">'
    +'<button class="atab'+(tab==='lista'?' on':'')+'" onclick="renderMovStock(&apos;lista&apos;)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> Lista de movimientos</button>'
    +'<button class="atab'+(tab==='nuevo'?' on':'')+'" onclick="renderMovStock(&apos;nuevo&apos;)">+ Nuevo movimiento</button>'
    +'</div>';
  if(tab==='lista'){
    c.innerHTML=tabs+'<div id="movListaWrap"></div>';
    await movCargarLista(['entrada','salida','transferencia_salida','transferencia_entrada','ajuste'], 'movListaWrap');
  } else {
    _mov.modo='entrada'; _mov.items=[];
    var hoy=new Date().toISOString().split('T')[0];
    var depOpts=movBuildDepOpts(null,false);
    c.innerHTML=tabs+movBuildShell({
      titulo:'Movimiento de Stock', subtit:'Entrada, salida o transferencia entre depósitos',
      hoy:hoy, tipoFixed:null,
      depEntradaOpts:depOpts, depSalidaOpts:depOpts, mostrarCosto:false
    });
    movTipoChange(); movRenderGrilla();
  }
}

function movBuildDepOpts(selectedId, withAll){
  var opts=(withAll?'<option value="">— Seleccionar —</option>':'');
  // Dedup sucursales y depósitos para que duplicados legacy no aparezcan dos veces.
  // Para sucursales: agrupamos por UPPER(TRIM(nombre)) y nos quedamos con el id más viejo.
  var sucMap={};
  _mov.sucsU.forEach(function(s){
    var key=String(s.nombre||'').trim().toUpperCase();
    if(!sucMap[key]) sucMap[key]={id:s.id, nombre:s.nombre, sucIds:[s.id]};
    else { sucMap[key].sucIds.push(s.id); if(s.id<sucMap[key].id){sucMap[key].id=s.id;sucMap[key].nombre=s.nombre;} }
  });
  Object.keys(sucMap).forEach(function(key){
    var sg=sucMap[key];
    // Depósitos de TODAS las sucursales duplicadas del grupo, deduplicados a su vez
    var deps=_mov.deps.filter(function(d){return sg.sucIds.indexOf(d.sucursal_id)>=0;});
    var grupos=depsAgrupados(deps, [{id:sg.id,nombre:sg.nombre}]);
    if(!grupos.length) return;
    opts+='<optgroup label="'+sg.nombre+'">';
    grupos.forEach(function(g){
      var sel=(selectedId===g.idCanonico)?' selected':'';
      opts+='<option value="'+g.idCanonico+'"'+sel+'>'+g.nombre+'</option>';
    });
    opts+='</optgroup>';
  });
  return opts;
}

function movBuildShell(cfg){
  var tipoSelect='';
  if(cfg.tipoFixed){
    tipoSelect='<div style="background:var(--g2);border:1px solid var(--green);border-radius:8px;padding:10px 14px;font-size:14px;font-weight:700;color:var(--green)">'+cfg.tipoFixed+'</div>';
  } else {
    tipoSelect='<select id="movTipo" class="cfg-inp" style="width:100%" onchange="movTipoChange()">'
      +'<option value="entrada">Entrada</option>'
      +'<option value="salida">Salida</option>'
      +'<option value="transferencia">Transferencia</option>'
      +'</select>';
  }
  return (
    '<div class="ph"><div><div class="pt">'+cfg.titulo+'</div><div class="ps">'+cfg.subtit+'</div></div></div>'
    // ── Encabezado comprobante ──
    +'<div class="card" style="margin-bottom:12px">'
      +'<div class="card-h"><span class="card-t">Encabezado</span></div>'
      +'<div style="padding:16px 18px;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">'
        +'<div>'
          +'<label style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:5px">Fecha</label>'
          +'<input type="date" id="movFecha" class="cfg-inp" style="width:100%" value="'+cfg.hoy+'">'
        +'</div>'
        +'<div>'
          +'<label style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:5px">Tipo</label>'
          +tipoSelect
        +'</div>'
        +'<div>'
          +'<label style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:5px">Comprobante N°</label>'
          +'<input type="text" id="movComp" class="cfg-inp" style="width:100%" placeholder="MOV-001 (opcional)">'
        +'</div>'
        +(cfg.depSalidaOpts!=null?(
          '<div id="movRowSalida">'
            +'<label style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:5px">Depósito salida</label>'
            +'<select id="movDepSalida" class="cfg-inp" style="width:100%"><option value="">— Seleccionar —</option>'+cfg.depSalidaOpts+'</select>'
          +'</div>'
        ):'')
        +'<div id="movRowEntrada">'
          +'<label style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:5px" id="movLblEntrada">'+(cfg.depSalidaOpts!=null?'Depósito entrada':'Depósito destino')+'</label>'
          +'<select id="movDepEntrada" class="cfg-inp" style="width:100%"><option value="">— Seleccionar —</option>'+cfg.depEntradaOpts+'</select>'
        +'</div>'
        +(cfg.mostrarProveedor?
          '<div><label style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:5px">Proveedor</label>'
          +'<input type="text" id="movProveedor" class="cfg-inp" style="width:100%" placeholder="Nombre del proveedor..."></div>'
        :'')
        +'<div style="grid-column:1/-1">'
          +'<label style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:5px">Observación</label>'
          +'<input type="text" id="movObs" class="cfg-inp" style="width:100%" placeholder="Ej: Compra proveedor X, Factura 001-001-0000123...">'
        +'</div>'
      +'</div>'
    +'</div>'
    // ── Grilla de productos ──
    +'<div class="card" style="margin-bottom:12px">'
      +'<div class="card-h">'
        +'<span class="card-t" id="movGrillaCount">0 productos</span>'
        +'<div style="display:flex;gap:8px;align-items:center">'
          +(cfg.mostrarCosto?'<span style="font-size:12px;color:var(--muted)">Total costo: <strong id="movTotalCosto">₲0</strong></span>':'')
        +'</div>'
      +'</div>'
      // Buscador para agregar producto
      +'<div style="padding:12px 18px;border-bottom:1px solid var(--border);display:flex;gap:8px;align-items:center;flex-wrap:wrap">'
        +'<div style="position:relative;flex:1;min-width:200px">'
          +'<input type="text" id="movBusqProd" class="cfg-inp" style="width:100%" placeholder="Buscar producto para agregar..." oninput="movBuscarProd(this.value)" autocomplete="off">'
          +'<div id="movSugDrop" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--card);border:1px solid var(--border);border-radius:8px;z-index:100;max-height:200px;overflow-y:auto;margin-top:2px;box-shadow:0 4px 20px rgba(0,0,0,.4)"></div>'
        +'</div>'
        +'<div style="display:flex;gap:6px;align-items:center">'
          +'<input type="number" id="movCantAdd" class="cfg-inp" style="width:80px" min="1" value="1" placeholder="Cant.">'
          +(cfg.mostrarCosto?'<input type="number" id="movCostoAdd" class="cfg-inp" style="width:100px" min="0" value="0" placeholder="Costo unit.">':'')
          +'<button onclick="movAgregarDesdeInput()" class="btn-sv" style="white-space:nowrap">+ Agregar</button>'
        +'</div>'
      +'</div>'
      // Tabla de items
      +'<div style="overflow-x:auto"><table id="movTabla"><thead><tr>'
        +'<th style="width:36px"></th>'
        +'<th>Producto</th>'
        +'<th style="text-align:center;width:120px">Cantidad</th>'
        +(cfg.mostrarCosto?'<th style="text-align:right;width:140px">Costo unit.</th><th style="text-align:right;width:140px">Total</th>':'')
      +'</tr></thead>'
      +'<tbody id="movItems"><tr><td colspan="'+(cfg.mostrarCosto?'5':'3')+'" style="text-align:center;padding:28px;color:var(--muted)">Agregá productos usando el buscador</td></tr></tbody>'
      +'</table></div>'
    +'</div>'
    // ── Botones ──
    +'<div style="display:flex;gap:10px;justify-content:flex-end;margin-bottom:24px">'
      +'<button onclick="movLimpiar()" class="btn-dn" style="padding:12px 24px">Cancelar</button>'
      +'<button onclick="movGuardar()" class="btn-sv" style="padding:12px 32px;font-size:14px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> GUARDAR</button>'
    +'</div>'
  );
}

// ── TIPO CHANGE (solo movstock) ───────────────────────────
function movTipoChange(){
  var tipo=(document.getElementById('movTipo')||{}).value||'entrada';
  _mov.modo=tipo;
  var rowSal=document.getElementById('movRowSalida');
  var rowEnt=document.getElementById('movRowEntrada');
  var lblEnt=document.getElementById('movLblEntrada');
  if(!rowSal) return;
  if(tipo==='transferencia'){
    rowSal.style.display='block';
    rowEnt.style.display='block';
    if(lblEnt) lblEnt.textContent='Depósito entrada';
  } else if(tipo==='salida'){
    rowSal.style.display='none';
    rowEnt.style.display='block';
    if(lblEnt) lblEnt.textContent='Depósito salida';
  } else { // entrada
    rowSal.style.display='none';
    rowEnt.style.display='block';
    if(lblEnt) lblEnt.textContent='Depósito entrada';
  }
}

// ── BUSCADOR DE PRODUCTOS ─────────────────────────────────
var _movProdSel=null;

function movBuscarProd(q){
  var drop=document.getElementById('movSugDrop');
  if(!drop) return;
  if(!q||q.length<1){drop.style.display='none';_movProdSel=null;return;}
  var f=q.toLowerCase();
  var res=_mov.prds.filter(function(p){
    return (p.nombre||'').toLowerCase().includes(f)||(p.codigo||'').toLowerCase().includes(f);
  }).slice(0,10);
  if(!res.length){drop.style.display='none';return;}
  drop.style.display='block';
  drop.innerHTML=res.map(function(p){
    return '<div onclick="movSelProd('+p.id+')" style="padding:9px 14px;cursor:pointer;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--border)" onmouseover="this.style.background=\'var(--card2)\'" onmouseout="this.style.background=\'\'">'
      +'<div style="width:22px;height:22px;border-radius:5px;background:'+(p.color||'#546e7a')+';flex-shrink:0"></div>'
      +'<div><div style="font-size:13px;font-weight:600">'+p.nombre+'</div>'
        +(p.codigo?'<div style="font-size:11px;color:var(--muted)">'+p.codigo+'</div>':'')
      +'</div>'
    +'</div>';
  }).join('');
}

function movSelProd(id){
  var p=_mov.prds.find(function(x){return x.id===id;});
  if(!p) return;
  _movProdSel=p;
  var inp=document.getElementById('movBusqProd');
  if(inp) inp.value=p.nombre;
  var drop=document.getElementById('movSugDrop');
  if(drop) drop.style.display='none';
  // Precargar costo si está disponible
  var costoInp=document.getElementById('movCostoAdd');
  if(costoInp&&p.costo) costoInp.value=p.costo;
  var cantInp=document.getElementById('movCantAdd');
  if(cantInp){cantInp.focus();cantInp.select();}
}

function movAgregarDesdeInput(){
  var p=_movProdSel;
  if(!p){toast('Seleccioná un producto del buscador');return;}
  var cant=parseFloat(document.getElementById('movCantAdd').value)||0;
  if(!cant||cant<=0){toast('Ingresá una cantidad válida');return;}
  var costoEl=document.getElementById('movCostoAdd');
  var costo=costoEl?parseFloat(costoEl.value)||0:0;
  movAgregarItem(p,cant,costo);
  // limpiar
  document.getElementById('movBusqProd').value='';
  document.getElementById('movCantAdd').value='1';
  if(costoEl) costoEl.value='0';
  _movProdSel=null;
}

function movAgregarItem(p,cant,costo){
  // Si ya existe, sumar cantidad
  var exist=_mov.items.find(function(i){return i.prodId===p.id;});
  if(exist){exist.cantidad+=cant;exist.costo=costo||exist.costo;}
  else{
    _mov.items.push({prodId:p.id,nombre:p.nombre,color:p.color||'#546e7a',
      codigo:p.codigo||'',cantidad:cant,costo:costo});
  }
  movRenderGrilla();
}

function movRenderGrilla(){
  var mostrarCosto=_mov.modo==='compra';
  var cols=mostrarCosto?5:3;
  var tbody=document.getElementById('movItems');
  var cnt=document.getElementById('movGrillaCount');
  var tot=document.getElementById('movTotalCosto');
  if(!tbody) return;
  if(!_mov.items.length){
    tbody.innerHTML='<tr><td colspan="'+cols+'" style="text-align:center;padding:28px;color:var(--muted)">Agregá productos usando el buscador</td></tr>';
    if(cnt) cnt.textContent='0 productos';
    if(tot) tot.textContent='₲0';
    return;
  }
  var totalCosto=0;
  tbody.innerHTML=_mov.items.map(function(it,i){
    var subtotal=(it.cantidad||0)*(it.costo||0);
    totalCosto+=subtotal;
    return '<tr>'
      +'<td style="text-align:center">'
        +'<button onclick="movQuitarItem('+i+')" style="background:var(--r2);border:1px solid var(--red);border-radius:5px;color:var(--red);cursor:pointer;padding:3px 7px;font-size:12px;font-weight:700"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>'
      +'</td>'
      +'<td><div style="display:flex;align-items:center;gap:8px">'
        +'<div style="width:24px;height:24px;border-radius:5px;background:'+it.color+';flex-shrink:0"></div>'
        +'<div><div style="font-weight:600">'+it.nombre+'</div>'
          +(it.codigo?'<div style="font-size:11px;color:var(--muted)">'+it.codigo+'</div>':'')
        +'</div></div></td>'
      +'<td style="text-align:center">'
        +'<div style="display:flex;align-items:center;justify-content:center;gap:6px">'
          +'<button onclick="movAjustarCant('+i+',-1)" style="background:var(--card2);border:1px solid var(--border);border-radius:5px;color:var(--text);cursor:pointer;width:26px;height:26px;font-size:14px;font-weight:700">−</button>'
          +'<input type="number" value="'+it.cantidad+'" min="1" onchange="movSetCant('+i+',this.value)" style="width:60px;text-align:center;background:var(--input-bg);border:1.5px solid var(--input-border);border-radius:6px;color:var(--text);font-family:Barlow,sans-serif;font-size:14px;font-weight:700;padding:4px">'
          +'<button onclick="movAjustarCant('+i+',+1)" style="background:var(--card2);border:1px solid var(--border);border-radius:5px;color:var(--text);cursor:pointer;width:26px;height:26px;font-size:14px;font-weight:700">+</button>'
        +'</div>'
      +'</td>'
      +(mostrarCosto?(
        '<td style="text-align:right">'
          +'<input type="number" value="'+it.costo+'" min="0" onchange="movSetCosto('+i+',this.value)" style="width:110px;text-align:right;background:var(--input-bg);border:1.5px solid var(--input-border);border-radius:6px;color:var(--text);font-family:Barlow,sans-serif;font-size:13px;padding:4px 8px">'
        +'</td>'
        +'<td style="text-align:right;font-weight:700">'+gs(subtotal)+'</td>'
      ):'')
    +'</tr>';
  }).join('');
  if(cnt) cnt.textContent=_mov.items.length+' producto'+(_mov.items.length===1?'':'s');
  if(tot) tot.textContent=gs(totalCosto);
  // Fila de total al pie de la tabla
  if(_mov.modo==='compra'&&_mov.items.length){
    var tfoot=document.getElementById('movTabla').querySelector('tfoot');
    if(!tfoot){tfoot=document.createElement('tfoot');document.getElementById('movTabla').appendChild(tfoot);}
    tfoot.innerHTML='<tr style="background:var(--card2);border-top:2px solid var(--border)">'
      +'<td colspan="3" style="padding:10px 14px;font-size:13px;font-weight:700;color:var(--muted);text-align:right">TOTAL COMPRA</td>'
      +'<td style="padding:10px 14px;text-align:right;font-size:13px;color:var(--muted)">—</td>'
      +'<td style="padding:10px 14px;text-align:right;font-size:16px;font-weight:800;color:var(--green)">'+gs(totalCosto)+'</td>'
    +'</tr>';
  }
}

function movQuitarItem(i){ _mov.items.splice(i,1); movRenderGrilla(); }
function movAjustarCant(i,d){
  var it=_mov.items[i]; if(!it) return;
  it.cantidad=Math.max(0.001,+(it.cantidad||0)+d);
  movRenderGrilla();
}
function movSetCant(i,v){ var it=_mov.items[i];if(it){it.cantidad=Math.max(0.001,parseFloat(v)||0);movRenderGrilla();} }
function movSetCosto(i,v){ var it=_mov.items[i];if(it){it.costo=parseFloat(v)||0;movRenderGrilla();} }

function movLimpiar(){
  _mov.items=[];
  if(_mov.modo==='compra') renderCompras('nuevo');
  else renderMovStock('nuevo');
}

// ── GUARDAR ───────────────────────────────────────────────
async function movGuardar(){
  if(!_mov.items.length){toast('Agregá al menos un producto');return;}
  var licId=await movGetLicId();
  var fecha=document.getElementById('movFecha').value||new Date().toISOString().split('T')[0];
  var comp=document.getElementById('movComp').value.trim();
  var obs=document.getElementById('movObs').value.trim();
  var prov=(document.getElementById('movProveedor')||{value:''}).value.trim();
  var tipo=_mov.modo; // 'compra'|'entrada'|'salida'|'transferencia'

  // Validar depósitos
  var depEntradaId=null,depSalidaId=null;
  var depEntEl=document.getElementById('movDepEntrada');
  var depSalEl=document.getElementById('movDepSalida');
  if(tipo==='salida'){
    depSalidaId=parseInt((depEntEl||{}).value||'0')||null;
    if(!depSalidaId){toast('Seleccioná el depósito de salida');return;}
  } else if(tipo==='transferencia'){
    depSalidaId=parseInt((depSalEl||{}).value||'0')||null;
    depEntradaId=parseInt((depEntEl||{}).value||'0')||null;
    if(!depSalidaId||!depEntradaId){toast('Seleccioná depósito origen y destino');return;}
    if(depSalidaId===depEntradaId){toast('Origen y destino no pueden ser iguales');return;}
  } else { // compra o entrada
    depEntradaId=parseInt((depEntEl||{}).value||'0')||null;
    if(!depEntradaId){toast('Seleccioná el depósito de destino');return;}
  }

  var btn=document.querySelector('[onclick="movGuardar()"]');
  if(btn){btn.disabled=true;btn.textContent='Guardando...';}

  try{
    var now=new Date(fecha+'T'+new Date().toTimeString().split(' ')[0]).toISOString();

    // Función helper: procesar un lado del movimiento (entrada o salida) en un depósito
    async function procesarLado(depId, signo /* +1 entrada, -1 salida */, tipoComp){
      var dep=(_mov.deps.find(function(d){return d.id===depId;})||{});
      var sucId=dep.sucursal_id||null;

      // Leer stock actual
      var prodIds=_mov.items.map(function(i){return i.prodId;});
      var stockR=await sg('stock',
        'deposito_id=eq.'+depId+'&producto_id=in.('+prodIds.join(',')+')'
        +'&licencia_id=eq.'+licId+'&select=producto_id,cantidad'
      );
      var stockMap={};
      stockR.forEach(function(s){stockMap[s.producto_id]=s.cantidad||0;});

      // Crear comprobante encabezado
      var totalMonto=_mov.items.reduce(function(s,i){return s+(i.cantidad||0)*(i.costo||0);},0);
      var compR=await supaPost('stock_comprobantes',{
        licencia_id:licId, deposito_id:depId, sucursal_id:sucId,
        tipo:tipoComp,
        referencia:comp||(tipoComp.toUpperCase()+'-'+Date.now()),
        observacion:obs, terminal:'admin', usuario:SE,
        proveedor:prov||null,
        total_monto:totalMonto,
        fecha:now
      },null);
      var compId=Array.isArray(compR)?compR[0].id:compR.id;

      // Construir items + upserts
      var itemsIns=[];
      for(var k=0;k<_mov.items.length;k++){
        var it=_mov.items[k];
        var antes=stockMap[it.prodId]||0;
        var cantMov=it.cantidad*signo;
        var desp=antes+cantMov;
        itemsIns.push({
          comprobante_id:compId, producto_id:it.prodId,
          nombre_producto:it.nombre,
          cantidad:cantMov, cantidad_antes:antes, cantidad_despues:desp,
          costo_unitario:it.costo||0
        });
        // Upsert stock (fire and forget)
        supaPost('stock',{
            deposito_id:depId, sucursal_id:sucId, licencia_id:licId,
            producto_id:it.prodId, nombre_producto:it.nombre,
            cantidad:desp, costo_unitario:it.costo||0,
            updated_at:now
        },'deposito_id,producto_id',true).catch(function(e){console.warn('[Stock upsert]',e.message);});
      }

      // Insertar items en bloque
      await supaPost('stock_comprobante_items',itemsIns,null);
      return compId;
    }

    if(tipo==='transferencia'){
      await procesarLado(depSalidaId, -1, 'transferencia_salida');
      await procesarLado(depEntradaId, +1, 'transferencia_entrada');
      toast('Transferencia guardada — '+_mov.items.length+' productos');
    } else if(tipo==='salida'){
      await procesarLado(depSalidaId, -1, 'salida');
      toast('Salida guardada — '+_mov.items.length+' productos');
    } else { // compra o entrada
      await procesarLado(depEntradaId, +1, tipo==='compra'?'compra':'entrada');
      // Si es compra: actualizar último costo en pos_productos
      if(tipo==='compra'){
        _mov.items.forEach(function(it){
          if(it.costo>0){
            supaPatch('pos_productos','id=eq.'+it.prodId,{costo:it.costo,updated_at:now},true)
              .catch(function(e){console.warn('[Costo update]',e.message);});
          }
        });
      }
      var totalComp=_mov.items.reduce(function(s,i){return s+(i.cantidad||0)*(i.costo||0);},0);
      toast(''+(tipo==='compra'?'Compra':'Entrada')+' guardada — '+_mov.items.length+' productos — Total: '+gs(totalComp));
    }

    // Limpiar e invalidar cache de stock
    _mov.items=[];
    _inv.prds=[]; // forzar recarga en inventarios
    setTimeout(function(){
      if(btn){btn.disabled=false;btn.textContent='GUARDAR';}
      if(_mov.modo==='compra') renderCompras('lista'); else renderMovStock('lista');
    },800);

  }catch(e){
    toast('Error al guardar: '+e.message);
    if(btn){btn.disabled=false;btn.textContent='GUARDAR';}
  }
}


// ── LISTA DE COMPROBANTES ─────────────────────────────────
async function movCargarLista(tipos, wraId){
  var wrap=document.getElementById(wraId);
  if(!wrap) return;
  wrap.innerHTML='<div class="loading"><span class="sp"></span>Cargando...</div>';
  var licId=await movGetLicId();

  // Fechas default: últimos 90 días
  var hoy=new Date(), d90=new Date(hoy); d90.setDate(d90.getDate()-90);
  var fdDef=d90.getFullYear()+'-'+pad(d90.getMonth()+1)+'-'+pad(d90.getDate());
  var fhDef=hoy.getFullYear()+'-'+pad(hoy.getMonth()+1)+'-'+pad(hoy.getDate());

  var tiposStr=tipos.join(',');
  var depOpts='<option value="">Todos los depósitos</option>'
    +depsAgrupados(_mov.deps, _mov.sucs).map(function(g){
       var s=g.sucursal_nombre;
       return '<option value="'+g.idsArr.join(',')+'">'+g.nombre+(s?' ('+s+')':'')+'</option>';
     }).join('');

  // ¿La lista incluye compras? Si sí, mostramos columna "Total" y KPI con monto total
  var incluyeCompra = tipos.indexOf('compra') >= 0;

  wrap.innerHTML=
    '<div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-bottom:14px">'
      +'<div><label style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:4px">Desde</label>'
        +'<input type="date" id="mlFD" class="d-inp" value="'+fdDef+'"></div>'
      +'<div><label style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:4px">Hasta</label>'
        +'<input type="date" id="mlFH" class="d-inp" value="'+fhDef+'"></div>'
      +'<div><label style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:4px">Depósito</label>'
        +'<select id="mlDep" class="d-inp">'+depOpts+'</select></div>'
      +'<button onclick="movFiltrarLista(\''+tiposStr+'\')" class="btn-sv" style="padding:9px 18px">Buscar</button>'
    +'</div>'
    +(incluyeCompra
      ?'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:14px">'
        +'<div class="kc" style="--c:var(--blue)"><div class="kc-l">Comprobantes</div><div class="kc-v" id="mlKCount">—</div></div>'
        +'<div class="kc" style="--c:var(--green)"><div class="kc-l">Total comprado</div><div class="kc-v" id="mlKTotal">—</div></div>'
      +'</div>'
      :'')
    +'<div class="card"><div class="card-h"><span class="card-t" id="mlCount">—</span></div>'
      +'<div style="overflow-x:auto"><table><thead><tr>'
        +'<th>Fecha</th><th>Tipo</th><th>Comprobante</th>'
        +'<th>Depósito</th><th style="text-align:center">Productos</th>'
        +(incluyeCompra?'<th style="text-align:right">Total</th>':'')
        +'<th>Observación</th><th style="text-align:center">Estado</th>'
        +'<th style="text-align:center">Acciones</th>'
      +'</tr></thead>'
      +'<tbody id="mlBody"><tr><td colspan="'+(incluyeCompra?9:8)+'" class="loading"><span class="sp"></span>Cargando...</td></tr></tbody>'
      +'</table></div></div>';

  await movFiltrarLista(tiposStr);
}

async function movFiltrarLista(tiposStr){
  var licId=await movGetLicId();
  var fd=(document.getElementById('mlFD')||{}).value||'';
  var fh=(document.getElementById('mlFH')||{}).value||'';
  // El value puede ser "", "12" o "12,45" (grupo de duplicados deduplicados)
  var depVal=(document.getElementById('mlDep')||{}).value||'';
  var tbody=document.getElementById('mlBody');
  if(!tbody) return;
  tbody.innerHTML='<tr><td colspan="8" class="loading"><span class="sp"></span>Buscando...</td></tr>';
  var addDayMov=function(ds){var p=ds.split('-');var d=new Date(+p[0],+p[1]-1,+p[2]+1);return d.getFullYear()+'-'+(d.getMonth()+1<10?'0':'')+(d.getMonth()+1)+'-'+(d.getDate()<10?'0':'')+d.getDate();};

  try{
    var tipos=tiposStr.split(',');
    var incluyeCompra = tipos.indexOf('compra') >= 0;
    var q='licencia_id=eq.'+licId
      +'&tipo=in.('+tipos.join(',')+')'
      +depFilterPostgrest(depVal)
      +(fd?'&fecha=gte.'+fd+'T04:00:00':'')
      +(fh?'&fecha=lte.'+addDayMov(fh)+'T03:59:59':'')
      +'&order=fecha.desc&limit=300';
    var comps=await sg('stock_comprobantes',q);

    // Cargar items por comprobante para conteo + total monetario
    var compIds=comps.map(function(c){return c.id;});
    var itemsCount={}, itemsTotal={};
    if(compIds.length){
      var items=await sg('stock_comprobante_items',
        'comprobante_id=in.('+compIds.join(',')+')'
        +'&select=comprobante_id,producto_id,cantidad,costo_unitario&limit=5000'
      );
      items.forEach(function(i){
        itemsCount[i.comprobante_id]=(itemsCount[i.comprobante_id]||0)+1;
        var subt = (parseFloat(i.cantidad)||0) * (parseFloat(i.costo_unitario)||0);
        itemsTotal[i.comprobante_id]=(itemsTotal[i.comprobante_id]||0)+subt;
      });
    }

    // Totales globales del listado (solo compras activas, excluye anulados)
    var totMontoCompras = 0, cantCompras = 0;
    comps.forEach(function(c){
      if(c.tipo!=='compra') return;
      var anul = c.observacion && c.observacion.indexOf('[ANULADO]') >= 0;
      if(anul) return;
      totMontoCompras += itemsTotal[c.id] || 0;
      cantCompras++;
    });
    if(document.getElementById('mlKCount')) document.getElementById('mlKCount').textContent = cantCompras;
    if(document.getElementById('mlKTotal')) document.getElementById('mlKTotal').textContent = gs(totMontoCompras);

    if(document.getElementById('mlCount'))
      document.getElementById('mlCount').textContent=comps.length+' comprobantes';

    if(!comps.length){
      tbody.innerHTML='<tr><td colspan="'+(incluyeCompra?9:8)+'" style="text-align:center;padding:28px;color:var(--muted)">Sin comprobantes en el período</td></tr>';
      return;
    }

    var tcfg={
      'compra':               {lbl:'Compra',           col:'var(--green)',  bg:'var(--g2)'},
      'entrada':              {lbl:'Entrada',           col:'var(--green)',  bg:'var(--g2)'},
      'salida':               {lbl:'Salida',            col:'var(--orange)', bg:'var(--o2)'},
      'ajuste':               {lbl:'Ajuste',            col:'var(--blue)',   bg:'var(--b2)'},
      'transferencia_salida': {lbl:'Transf. Salida',    col:'var(--orange)', bg:'var(--o2)'},
      'transferencia_entrada':{lbl:'Transf. Entrada',   col:'var(--green)',  bg:'var(--g2)'},
      'anulacion':            {lbl:'Anulación',         col:'var(--red)',    bg:'var(--r2)'},
    };

    tbody.innerHTML=comps.map(function(c){
      var tc=tcfg[c.tipo]||{lbl:c.tipo,col:'var(--muted)',bg:'#222'};
      var dep=(_mov.deps.find(function(d){return d.id===c.deposito_id;})||{}).nombre||('#'+c.deposito_id);
      var anulado=c.observacion&&c.observacion.includes('[ANULADO]');
      var esAnulacion=c.tipo==='anulacion'||(c.referencia&&c.referencia.startsWith('ANU-'));
      var canAnular=!anulado&&!esAnulacion;
      var tot = itemsTotal[c.id]||0;
      var totCell = '';
      if(incluyeCompra){
        // Solo mostramos monto en compras. Otros tipos (ajuste, transfer, etc.) no llevan costo.
        totCell = '<td style="text-align:right;font-weight:700;color:'+(tot>0?'var(--green)':'var(--muted)')+'">'
          +(c.tipo==='compra' && tot>0 ? gs(tot) : '—')
          +'</td>';
      }
      return '<tr style="opacity:'+(anulado?'0.5':'1')+'">'
        +'<td style="font-size:12px;white-space:nowrap">'+fmtDT(c.fecha)+'</td>'
        +'<td><span style="padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;background:'+tc.bg+';color:'+tc.col+'">'+tc.lbl+'</span></td>'
        +'<td style="font-weight:600;font-size:13px">'+(c.referencia||'—')+'</td>'
        +'<td style="font-size:12px;color:var(--muted)">'+dep+'</td>'
        +'<td style="text-align:center;font-weight:700">'+(itemsCount[c.id]||0)+'</td>'
        +totCell
        +'<td style="font-size:12px;color:var(--muted);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(c.observacion||'')+'</td>'
        +'<td style="text-align:center">'
          +(anulado
            ?'<span class="tag tag-r">ANULADO</span>'
            :(esAnulacion?'<span class="tag tag-gr">ANULACIÓN</span>':'<span class="tag tag-g">ACTIVO</span>'))
        +'</td>'
        +'<td style="text-align:center;white-space:nowrap;display:flex;gap:5px;justify-content:center">'
          +'<button onclick="movVerDetalle('+c.id+')" style="background:var(--b2);border:1px solid var(--blue);border-radius:6px;color:var(--blue);font-family:Barlow,sans-serif;font-size:11px;font-weight:700;padding:5px 9px;cursor:pointer">Ver</button>'
          +(canAnular?'<button onclick="movConfirmarAnulacion('+c.id+',&quot;'+esc(c.referencia||'').replace(/&quot;/g,'').replace(/"/g,'')+'&quot;)" style="background:var(--r2);border:1px solid var(--red);border-radius:6px;color:var(--red);font-family:Barlow,sans-serif;font-size:11px;font-weight:700;padding:5px 9px;cursor:pointer">Anular</button>':'')
        +'</td>'
      +'</tr>';
    }).join('');
  }catch(e){
    tbody.innerHTML='<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--red)">Error: '+e.message+'</td></tr>';
  }
}

// ── VER DETALLE COMPROBANTE ────────────────────────────────
async function movVerDetalle(compId){
  // Crear modal overlay
  var ov=document.createElement('div');
  ov.id='movDetOv';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:1000;display:flex;align-items:flex-start;justify-content:center;padding:20px 10px;overflow-y:auto';
  ov.innerHTML='<div style="background:var(--card);border:1px solid var(--border);border-radius:14px;width:100%;max-width:620px;overflow:hidden">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border)">'
      +'<div style="font-size:16px;font-weight:800">Detalle del comprobante</div>'
      +'<button onclick="document.getElementById(\'movDetOv\').remove()" style="background:var(--card2);border:1px solid var(--border);border-radius:8px;color:var(--text);cursor:pointer;padding:7px 13px;font-family:Barlow,sans-serif;font-size:13px;font-weight:700"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Cerrar</button>'
    +'</div>'
    +'<div id="movDetBody" style="padding:20px"><div class="loading"><span class="sp"></span>Cargando...</div></div>'
    +'</div>';
  document.body.appendChild(ov);

  try{
    var comps=await sg('stock_comprobantes','id=eq.'+compId+'&select=*');
    var items=await sg('stock_comprobante_items','comprobante_id=eq.'+compId+'&order=nombre_producto.asc');
    if(!comps.length){document.getElementById('movDetBody').innerHTML='<div style="color:var(--red)">No encontrado</div>';return;}
    var c=comps[0];
    var dep=(_mov.deps.find(function(d){return d.id===c.deposito_id;})||{}).nombre||('#'+c.deposito_id);
    var suc=(_mov.sucs.find(function(s){return s.id===c.sucursal_id;})||{}).nombre||'';
    var tcfg={
      'compra':'Compra','entrada':'Entrada','salida':'Salida','ajuste':'Ajuste',
      'transferencia_salida':'Transferencia (Salida)','transferencia_entrada':'Transferencia (Entrada)',
      'anulacion':'Anulación'
    };
    var totEnt=0,totSal=0,totMonto=0;
    items.forEach(function(i){
      var cant = i.cantidad||0;
      if(cant>0) totEnt+=cant; else totSal+=Math.abs(cant);
      totMonto += (parseFloat(i.cantidad)||0) * (parseFloat(i.costo_unitario)||0);
    });
    var esCompra = c.tipo === 'compra';

    document.getElementById('movDetBody').innerHTML=
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">'
        +'<div style="background:var(--card2);border-radius:8px;padding:12px">'
          +'<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin-bottom:8px">Encabezado</div>'
          +'<div class="cj-dr"><span style="color:var(--muted)">Fecha</span><span>'+fmtDT(c.fecha)+'</span></div>'
          +'<div class="cj-dr"><span style="color:var(--muted)">Tipo</span><span style="font-weight:700">'+(tcfg[c.tipo]||c.tipo)+'</span></div>'
          +'<div class="cj-dr"><span style="color:var(--muted)">Comprobante</span><span style="font-weight:600">'+(c.referencia||'—')+'</span></div>'
        +'</div>'
        +'<div style="background:var(--card2);border-radius:8px;padding:12px">'
          +'<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;font-weight:700;margin-bottom:8px">Depósito / Sucursal</div>'
          +'<div class="cj-dr"><span style="color:var(--muted)">Depósito</span><span style="font-weight:600">'+dep+'</span></div>'
          +(suc?'<div class="cj-dr"><span style="color:var(--muted)">Sucursal</span><span>'+suc+'</span></div>':'')
          +'<div class="cj-dr"><span style="color:var(--muted)">Terminal</span><span>'+(c.terminal||'—')+'</span></div>'
          +'<div class="cj-dr"><span style="color:var(--muted)">Usuario</span><span>'+(c.usuario||'—')+'</span></div>'
        +'</div>'
      +'</div>'
      +(c.observacion?'<div style="background:var(--card2);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:13px;color:var(--text2)">'+esc(c.observacion)+'</div>':'')
      +'<div style="display:flex;gap:16px;margin-bottom:12px;flex-wrap:wrap;align-items:center">'
        +'<span style="font-size:12px;color:var(--muted)">'+items.length+' productos</span>'
        +(totEnt?'<span style="font-size:12px;font-weight:700;color:var(--green)">+'+totEnt+' uds entrada</span>':'')
        +(totSal?'<span style="font-size:12px;font-weight:700;color:var(--red)">-'+totSal+' uds salida</span>':'')
        +(esCompra && totMonto>0
          ?'<span style="margin-left:auto;background:var(--g2);border:1px solid var(--green);border-radius:8px;padding:6px 14px;font-size:14px;font-weight:800;color:var(--green)">Total compra: '+gs(totMonto)+'</span>'
          :'')
      +'</div>'
      +'<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><thead><tr>'
        +'<th style="padding:8px 12px;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;text-align:left;background:var(--card2)">Producto</th>'
        +'<th style="padding:8px 12px;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;text-align:center;background:var(--card2)">Antes</th>'
        +'<th style="padding:8px 12px;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;text-align:center;background:var(--card2)">Movimiento</th>'
        +'<th style="padding:8px 12px;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;text-align:center;background:var(--card2)">Después</th>'
        +'<th style="padding:8px 12px;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;text-align:right;background:var(--card2)">Costo unit.</th>'
        +(esCompra?'<th style="padding:8px 12px;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;text-align:right;background:var(--card2)">Subtotal</th>':'')
      +'</tr></thead><tbody>'
      +items.map(function(i){
        var cant=i.cantidad||0;
        var subt = (parseFloat(i.cantidad)||0) * (parseFloat(i.costo_unitario)||0);
        return '<tr style="border-bottom:1px solid var(--border)">'
          +'<td style="padding:9px 12px;font-size:13px;font-weight:600">'+esc(i.nombre_producto)+'</td>'
          +'<td style="padding:9px 12px;text-align:center;color:var(--muted)">'+(i.cantidad_antes!=null?i.cantidad_antes:'—')+'</td>'
          +'<td style="padding:9px 12px;text-align:center;font-weight:800;font-size:14px;color:'+(cant>0?'var(--green)':'var(--red)')+'">'+(cant>0?'+':'')+cant+'</td>'
          +'<td style="padding:9px 12px;text-align:center;font-weight:700">'+(i.cantidad_despues!=null?i.cantidad_despues:'—')+'</td>'
          +'<td style="padding:9px 12px;text-align:right;color:var(--muted)">'+(i.costo_unitario?gs(i.costo_unitario):'—')+'</td>'
          +(esCompra?'<td style="padding:9px 12px;text-align:right;font-weight:700">'+(subt>0?gs(subt):'—')+'</td>':'')
        +'</tr>';
      }).join('')
      +(esCompra && totMonto>0
        ?'<tr style="background:var(--card2)"><td colspan="5" style="padding:10px 12px;text-align:right;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;font-size:11px">Total</td>'
          +'<td style="padding:10px 12px;text-align:right;font-weight:800;font-size:15px;color:var(--green)">'+gs(totMonto)+'</td></tr>'
        :'')
      +'</tbody></table></div>';
  }catch(e){
    document.getElementById('movDetBody').innerHTML='<div style="color:var(--red)">Error: '+e.message+'</div>';
  }
}

// ── ANULAR COMPROBANTE ────────────────────────────────────
function movConfirmarAnulacion(compId, referencia){
  var ov=document.createElement('div');
  ov.id='movAnulOv';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:1001;display:flex;align-items:center;justify-content:center;padding:20px';
  ov.innerHTML='<div style="background:var(--card);border:1px solid var(--red);border-radius:14px;max-width:420px;width:100%;padding:28px 24px;text-align:center">'
    +'<div style="font-size:32px;margin-bottom:12px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>️</div>'
    +'<div style="font-size:17px;font-weight:800;margin-bottom:8px">¿Anular comprobante?</div>'
    +'<div style="font-size:13px;color:var(--muted);margin-bottom:6px">Comprobante: <strong>'+(referencia||('#'+compId))+'</strong></div>'
    +'<div style="font-size:13px;color:var(--muted);margin-bottom:20px">Se creará un comprobante inverso que revierte todos los movimientos de stock. Esta acción queda registrada.</div>'
    +'<div style="margin-bottom:12px"><label style="font-size:11px;color:var(--muted);display:block;margin-bottom:5px;text-align:left">Motivo de anulación (obligatorio)</label>'
      +'<input type="text" id="movAnulMotivo" class="cfg-inp" style="width:100%" placeholder="Ej: Error de carga, proveedor devuelto..."></div>'
    +'<div style="display:flex;gap:10px">'
      +'<button onclick="document.getElementById(\'movAnulOv\').remove()" class="btn-dn" style="flex:1;padding:12px">Cancelar</button>'
      +'<button onclick="movEjecutarAnulacion('+compId+')" class="btn-sv" style="flex:1;padding:12px;background:var(--red);border-color:var(--red)">Confirmar anulación</button>'
    +'</div>'
    +'</div>';
  document.body.appendChild(ov);
  document.getElementById('movAnulMotivo').focus();
}

async function movEjecutarAnulacion(compId){
  var motivo=(document.getElementById('movAnulMotivo')||{}).value||'';
  if(!motivo.trim()){toast('El motivo de anulación es obligatorio');return;}
  var btn=document.querySelector('[onclick="movEjecutarAnulacion('+compId+')"]');
  if(btn){btn.disabled=true;btn.textContent='Procesando...';}

  try{
    var licId=await movGetLicId();
    // Leer comprobante original
    var comps=await sg('stock_comprobantes','id=eq.'+compId+'&select=*');
    var items=await sg('stock_comprobante_items','comprobante_id=eq.'+compId+'&select=*');
    if(!comps.length) throw new Error('Comprobante no encontrado');
    var orig=comps[0];

    // Verificar no anulado ya
    if(orig.observacion&&orig.observacion.includes('[ANULADO]')) throw new Error('Este comprobante ya fue anulado');

    var now=new Date().toISOString();
    var dep=(_mov.deps.find(function(d){return d.id===orig.deposito_id;})||{});

    // Leer stock actual
    var prodIds=items.map(function(i){return i.producto_id;});
    var stockR=await sg('stock',
      'deposito_id=eq.'+orig.deposito_id
      +'&producto_id=in.('+prodIds.join(',')+')'
      +'&licencia_id=eq.'+licId
      +'&select=producto_id,cantidad'
    );
    var stockMap={};
    stockR.forEach(function(s){stockMap[s.producto_id]=s.cantidad||0;});

    // Crear comprobante de anulación (cantidades invertidas)
    var compAnulR=await supaPost('stock_comprobantes',{
      licencia_id:licId,
      deposito_id:orig.deposito_id,
      sucursal_id:orig.sucursal_id,
      tipo:'anulacion',
      referencia:'ANU-'+(orig.referencia||orig.id),
      observacion:'Anulación de: '+(orig.referencia||('#'+orig.id))+' | '+motivo,
      terminal:'admin', usuario:SE, fecha:now
    },null);
    var newCompId=Array.isArray(compAnulR)?compAnulR[0].id:compAnulR.id;

    // Items invertidos
    var itemsInv=items.map(function(i){
      var cantInv=-(i.cantidad||0);
      var antes=stockMap[i.producto_id]||0;
      var desp=antes+cantInv;
      return {
        comprobante_id:newCompId,
        producto_id:i.producto_id,
        nombre_producto:i.nombre_producto,
        cantidad:cantInv,
        cantidad_antes:antes,
        cantidad_despues:desp,
        costo_unitario:i.costo_unitario||0
      };
    });
    await supaPost('stock_comprobante_items',itemsInv,null);

    // Actualizar stock — invertir cada item
    for(var k=0;k<items.length;k++){
      var it=items[k];
      var antes2=stockMap[it.producto_id]||0;
      var cantInv2=-(it.cantidad||0);
      supaPost('stock',{
          deposito_id:orig.deposito_id, sucursal_id:orig.sucursal_id,
          licencia_id:licId, producto_id:it.producto_id,
          nombre_producto:it.nombre_producto,
          cantidad:antes2+cantInv2, updated_at:now
      },'deposito_id,producto_id',true).catch(function(e){console.warn('[Stock anul]',e.message);});
    }

    // Marcar comprobante original como anulado
    await supaPatch('stock_comprobantes','id=eq.'+compId,{
      observacion:(orig.observacion?orig.observacion+' ':'')+'[ANULADO] '+now+' | '+motivo
    });

    // Invalidar cache
    _inv.prds=[];

    var ovAnul=document.getElementById('movAnulOv');
    if(ovAnul) ovAnul.remove();
    toast('Comprobante anulado — stock revertido');

    // Recargar lista
    var mlBody=document.getElementById('mlBody');
    if(mlBody){
      var tiposStr=mlBody.closest('[id="movListaWrap"]')?'compra':
        'entrada,salida,transferencia_salida,transferencia_entrada,ajuste';
      // determine mode from current page
      if(curPage==='compras') await movFiltrarLista('compra');
      else await movFiltrarLista('entrada,salida,transferencia_salida,transferencia_entrada,ajuste');
    }

  }catch(e){
    toast('Error: '+e.message);
    if(btn){btn.disabled=false;btn.textContent='Confirmar anulación';}
  }
}


// ── RECONCILIACIÓN DE STOCK ───────────────────────────────────────────────
async function abrirReconciliacion(){
  // Crear overlay modal
  var ov=document.createElement('div');
  ov.id='reconOv';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:1000;overflow-y:auto;padding:14px 8px';
  ov.innerHTML=
    '<div style="background:var(--card);border:1px solid var(--border);border-radius:14px;max-width:780px;margin:0 auto;overflow:hidden">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border)">'
        +'<div>'
          +'<div style="font-size:17px;font-weight:800"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M3 12a9 9 0 0 1 15.5-6.5L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.5L3 16"/><path d="M3 21v-5h5"/></svg> Reconciliación de Stock</div>'
          +'<div style="font-size:12px;color:var(--muted);margin-top:2px">Compara tabla stock vs comprobantes y corrige diferencias</div>'
        +'</div>'
        +'<button onclick="document.getElementById(\'reconOv\').remove()" style="background:var(--card2);border:1px solid var(--border);border-radius:8px;color:var(--text);cursor:pointer;padding:8px 14px;font-family:Barlow,sans-serif;font-size:13px;font-weight:700"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Cerrar</button>'
      +'</div>'
      +'<div style="padding:16px 20px;border-bottom:1px solid var(--border);background:var(--card2);font-size:13px;color:var(--muted)">'
        +'<strong style="color:var(--text)">¿Cómo funciona?</strong> Calcula el saldo real sumando todos los comprobantes por producto+depósito, '
        +'lo compara con la tabla <code>stock</code>, y muestra las diferencias. Podés corregir todo de una vez o producto por producto.'
      +'</div>'
      +'<div id="reconBody" style="padding:16px 20px">'
        +'<div class="loading"><span class="sp"></span>Analizando diferencias...</div>'
      +'</div>'
    +'</div>';
  document.body.appendChild(ov);
  await reconCargar();
}

async function reconCargar(){
  var body=document.getElementById('reconBody');
  if(!body) return;
  body.innerHTML='<div class="loading"><span class="sp"></span>Calculando...</div>';
  var licId=await invGetLicId();

  try{
    // 1. Leer stock actual de la tabla stock
    var stockRows=await sg('stock','licencia_id=eq.'+licId+'&select=deposito_id,producto_id,cantidad&limit=5000');
    var stockMap={}; // key: depId_prodId → cantidad
    stockRows.forEach(function(r){
      stockMap[r.deposito_id+'_'+r.producto_id]=parseFloat(r.cantidad)||0;
    });

    // 2. Calcular saldo real desde comprobantes
    // Traer todos los items de comprobantes de esta licencia
    var compIds_r=await sg('stock_comprobantes',
      'licencia_id=eq.'+licId+'&select=id,deposito_id&limit=10000'
    );
    var compDepMap={}; // compId → depId
    compIds_r.forEach(function(c){compDepMap[c.id]=c.deposito_id;});

    var allCompIds=compIds_r.map(function(c){return c.id;});
    var saldosComp={}; // key: depId_prodId → suma cantidad

    if(allCompIds.length){
      // Fetch en batches de 200 para no reventar la URL
      var batchSize=200;
      for(var bi=0;bi<allCompIds.length;bi+=batchSize){
        var batch=allCompIds.slice(bi,bi+batchSize);
        var items=await sg('stock_comprobante_items',
          'comprobante_id=in.('+batch.join(',')+')'
          +'&select=comprobante_id,producto_id,cantidad&limit=10000'
        );
        items.forEach(function(i){
          var depId=compDepMap[i.comprobante_id];
          if(!depId) return;
          var key=depId+'_'+i.producto_id;
          saldosComp[key]=(saldosComp[key]||0)+(parseFloat(i.cantidad)||0);
        });
      }
    }

    // 3. Comparar: buscar diferencias
    var diffs=[];
    var todasKeys=new Set(Object.keys(stockMap).concat(Object.keys(saldosComp)));
    todasKeys.forEach(function(key){
      var parts=key.split('_');
      var depId=parseInt(parts[0]), prodId=parseInt(parts[1]);
      var enStock=stockMap[key]||0;
      var enComp=saldosComp[key]||0;
      var diff=enComp-enStock;
      if(Math.abs(diff)>0.001){ // diferencia real
        var dep=(_inv.deps.find(function(d){return d.id===depId;})||{});
        var suc=(_inv.suc.find(function(s){return s.id===dep.sucursal_id;})||{});
        // Buscar nombre producto
        var prodNom='Producto #'+prodId;
        if(_inv.prds&&_inv.prds.length){
          var pr=_inv.prds.find(function(p){return p.producto_id===prodId||p.id===prodId;});
          if(pr) prodNom=pr.nombre_producto||pr.nombre||prodNom;
        }
        diffs.push({
          key:key, depId:depId, prodId:prodId,
          depNom:dep.nombre||('#'+depId), sucNom:suc.nombre||'',
          prodNom:prodNom,
          enStock:enStock, enComp:enComp, diff:diff
        });
      }
    });

    if(!diffs.length){
      body.innerHTML=
        '<div style="text-align:center;padding:40px">'
          +'<div style="font-size:40px;margin-bottom:12px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 16 9"/></svg></div>'
          +'<div style="font-size:16px;font-weight:800;color:var(--green)">Sin diferencias</div>'
          +'<div style="font-size:13px;color:var(--muted);margin-top:6px">La tabla stock coincide exactamente con los comprobantes</div>'
        +'</div>';
      return;
    }

    // Guardar diffs en closure para usar en corrección
    window._reconDiffs=diffs;

    body.innerHTML=
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px">'
        +'<div>'
          +'<span style="font-size:15px;font-weight:800;color:var(--red)">'+diffs.length+' diferencia'+(diffs.length===1?'':'s')+' encontrada'+(diffs.length===1?'':'s')+'</span>'
          +'<span style="font-size:12px;color:var(--muted);margin-left:10px">La columna "Comp." es la fuente de verdad</span>'
        +'</div>'
        +'<button onclick="reconCorregirTodo()" style="background:var(--green);border:none;border-radius:8px;color:#fff;font-family:Barlow,sans-serif;font-size:13px;font-weight:800;padding:10px 20px;cursor:pointer"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><polyline points="20 6 9 17 4 12"/></svg> Corregir todo</button>'
      +'</div>'
      +'<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><thead><tr>'
        +'<th style="padding:9px 12px;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;text-align:left;background:var(--card2)">Producto</th>'
        +'<th style="padding:9px 12px;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;text-align:left;background:var(--card2)">Depósito</th>'
        +'<th style="padding:9px 12px;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;text-align:center;background:var(--card2)">Tabla stock</th>'
        +'<th style="padding:9px 12px;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;text-align:center;background:var(--card2)">Comprobantes</th>'
        +'<th style="padding:9px 12px;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;text-align:center;background:var(--card2)">Diferencia</th>'
        +'<th style="padding:9px 12px;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;text-align:center;background:var(--card2)">Acción</th>'
      +'</tr></thead><tbody>'
      +diffs.map(function(d,i){
        var difCol=d.diff>0?'var(--green)':'var(--red)';
        var difSign=d.diff>0?'+':'';
        return '<tr style="border-bottom:1px solid var(--border)">'
          +'<td style="padding:10px 12px;font-weight:600">'+d.prodNom+'</td>'
          +'<td style="padding:10px 12px"><div style="font-weight:600;font-size:13px">'+d.depNom+'</div>'
            +(d.sucNom?'<div style="font-size:11px;color:var(--muted)">'+d.sucNom+'</div>':'')+'</td>'
          +'<td style="padding:10px 12px;text-align:center;font-size:15px;font-weight:700">'+d.enStock+'</td>'
          +'<td style="padding:10px 12px;text-align:center;font-size:15px;font-weight:800;color:var(--green)">'+d.enComp+'</td>'
          +'<td style="padding:10px 12px;text-align:center;font-size:15px;font-weight:800;color:'+difCol+'">'+difSign+d.diff+'</td>'
          +'<td style="padding:10px 12px;text-align:center">'
            +'<button onclick="reconCorregirUno('+i+')" '
              +'style="background:var(--g2);border:1px solid var(--green);border-radius:6px;color:var(--green);'
              +'font-family:Barlow,sans-serif;font-size:11px;font-weight:700;padding:6px 12px;cursor:pointer">'
              +'Corregir</button>'
          +'</td>'
        +'</tr>';
      }).join('')
      +'</tbody></table></div>'
      +'<div style="margin-top:14px;padding:12px 16px;background:var(--o2);border:1px solid var(--orange);border-radius:8px;font-size:12px;color:var(--orange)">'
        +'<strong>Corregir</strong> actualiza la tabla <code>stock</code> para que coincida con los comprobantes. '
        +'Los comprobantes son la fuente de verdad y no se modifican.'
      +'</div>';

  }catch(e){
    body.innerHTML='<div style="color:var(--red);padding:16px">Error: '+e.message+'</div>';
  }
}

async function reconCorregirUno(idx){
  var d=window._reconDiffs[idx];
  if(!d) return;
  await reconAplicarCorrecciones([d]);
}

async function reconCorregirTodo(){
  if(!window._reconDiffs||!window._reconDiffs.length) return;
  await reconAplicarCorrecciones(window._reconDiffs);
}

async function reconAplicarCorrecciones(diffs){
  var licId=await invGetLicId();
  var btn=event&&event.target;
  if(btn){btn.disabled=true;btn.textContent='Corrigiendo...';}

  var errores=0;
  for(var i=0;i<diffs.length;i++){
    var d=diffs[i];
    try{
      // Upsert stock con el valor correcto (el de comprobantes)
      await supaPost('stock',{
        deposito_id:d.depId,
        sucursal_id:(_inv.deps.find(function(x){return x.id===d.depId;})||{}).sucursal_id||null,
        licencia_id:licId,
        producto_id:d.prodId,
        nombre_producto:d.prodNom,
        cantidad:d.enComp,
        updated_at:new Date().toISOString()
      },'deposito_id,producto_id');
    }catch(e){
      console.warn('[Recon] Error en',d.key,':',e.message);
      errores++;
    }
  }

  if(errores===0){
    toast(''+diffs.length+' corrección'+(diffs.length===1?'':'es')+' aplicada'+(diffs.length===1?'':'s'));
  } else {
    toast(''+errores+' error'+(errores===1?'':'s')+' al corregir — revisá la consola');
  }

  // Recargar modal y tabla de inventario
  await reconCargar();
  // Invalidar cache para que inventario se refresque al volver
  _inv.prds=[];
}


// ═══════════════════════════════════════════════════════════
// CONTEO FÍSICO DE INVENTARIO
// ═══════════════════════════════════════════════════════════
var _cnt = {
  licId: null, deps: [], sucs: [],
  conteoActual: null,   // {id, numero, deposito_id, estado, items:[]}
  itemsOrig: []         // snapshot del stock al abrir el conteo
};

async function cntGetLicId(){
  if(_cnt.licId) return _cnt.licId;
  if(SLI){ _cnt.licId=SLI; return SLI; }
  var r=await sg('licencias','email_cliente=ilike.'+encodeURIComponent(SE)+'&activa=eq.true&select=id&limit=1');
  if(r&&r.length){ _cnt.licId=r[0].id; return r[0].id; }
  throw new Error('No se encontró licencia');
}

async function cntCargarMaestros(){
  if(_cnt.deps.length) return;
  var licId=await cntGetLicId();
  var res=await Promise.all([
    sg('sucursales','licencia_id=eq.'+licId+'&activa=eq.true&order=nombre.asc'),
    sg('depositos', 'licencia_id=eq.'+licId+'&activo=eq.true&order=nombre.asc')
  ]);
  _cnt.sucs=res[0]; _cnt.deps=res[1];
}

async function renderConteo(tab){
  tab=tab||'lista';
  var c=document.getElementById('content');
  c.innerHTML='<div class="loading"><span class="sp"></span>Cargando...</div>';
  try{ await cntCargarMaestros(); }
  catch(e){ c.innerHTML='<div style="padding:24px;color:var(--red)">Error: '+e.message+'</div>'; return; }

  var tabs='<div class="admin-tabs">'
    +'<button class="atab'+(tab==='lista'?' on':'')+'" onclick="renderConteo(&apos;lista&apos;)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> Historial de conteos</button>'
    +'<button class="atab'+(tab==='nuevo'?' on':'')+'" onclick="renderConteo(&apos;nuevo&apos;)">+ Nuevo conteo</button>'
    +(tab==='activo'?'<button class="atab on"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Conteo en curso</button>':'')
    +'</div>';

  if(tab==='lista'){
    c.innerHTML=tabs+'<div id="cntListaWrap"><div class="loading"><span class="sp"></span></div></div>';
    await cntCargarLista();
  } else if(tab==='activo' && _cnt.conteoActual){
    c.innerHTML=tabs;
    cntRenderFormulario();
  } else {
    // Nuevo conteo
    _cnt.conteoActual=null;
    var hoy=new Date().toISOString().split('T')[0];
    // Para conteo SI usamos solo el id canónico (no CSV) — el conteo
    // se crea contra UN solo depósito y queda asociado a ese id.
    var depOpts='<option value="">— Seleccionar depósito —</option>';
    depsAgrupados(_cnt.deps, _cnt.sucs).forEach(function(g){
      var s=g.sucursal_nombre;
      depOpts+='<option value="'+g.idCanonico+'">'+g.nombre+(s?' ('+s+')':'')+'</option>';
    });
    c.innerHTML=tabs
      +'<div class="card" style="max-width:500px">'
        +'<div class="card-h"><span class="card-t">Iniciar nuevo conteo</span></div>'
        +'<div style="padding:20px;display:flex;flex-direction:column;gap:14px">'
          +'<div><label style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:5px">Depósito a contar</label>'
            +'<select id="cntDep" class="cfg-inp" style="width:100%">'+depOpts+'</select></div>'
          +'<div><label style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:5px">Fecha del conteo</label>'
            +'<input type="date" id="cntFecha" class="cfg-inp" style="width:100%" value="'+hoy+'"></div>'
          +'<div><label style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:5px">Observación (opcional)</label>'
            +'<input type="text" id="cntObs" class="cfg-inp" style="width:100%" placeholder="Ej: Conteo mensual, cierre de mes..."></div>'
          +'<button onclick="cntIniciar()" class="btn-sv" style="padding:13px;font-size:14px">Iniciar conteo →</button>'
        +'</div>'
      +'</div>';
  }
}

async function cntIniciar(){
  var depId=parseInt(document.getElementById('cntDep').value)||null;
  var fecha=document.getElementById('cntFecha').value;
  var obs=document.getElementById('cntObs').value.trim();
  if(!depId){ toast('Seleccioná un depósito'); return; }
  var licId=await cntGetLicId();
  var dep=_cnt.deps.find(function(d){return d.id===depId;})||{};
  var suc=_cnt.sucs.find(function(s){return s.id===dep.sucursal_id;})||{};

  var btn=document.querySelector('[onclick="cntIniciar()"]');
  if(btn){ btn.disabled=true; btn.textContent='Cargando productos...'; }

  try{
    // Generar número de conteo
    var prevs=await sg('stock_conteos','licencia_id=eq.'+licId+'&select=numero&order=created_at.desc&limit=1');
    var lastNum=0;
    if(prevs&&prevs.length){
      var m=(prevs[0].numero||'').match(/(\d+)$/);
      if(m) lastNum=parseInt(m[1]);
    }
    var numero='CONTEO-'+String(lastNum+1).padStart(3,'0');

    // Cargar productos con inventario=true y su stock en este depósito
    var prds=await sg('pos_productos',
      'licencia_email=ilike.'+encodeURIComponent(SE)+
      '&inventario=eq.true&activo=eq.true&order=nombre.asc&select=id,nombre,codigo,color,categoria&limit=500'
    );
    var stockRows=await sg('stock',
      'deposito_id=eq.'+depId+'&licencia_id=eq.'+licId+'&select=producto_id,cantidad&limit=1000'
    );
    var stockMap={};
    stockRows.forEach(function(r){ stockMap[r.producto_id]=parseFloat(r.cantidad)||0; });

    // Crear conteo en DB
    var conteoR=await supaPost('stock_conteos',{
      licencia_id:licId, deposito_id:depId, sucursal_id:dep.sucursal_id||null,
      numero:numero, estado:'borrador', observacion:obs||null,
      usuario:SE, fecha:fecha
    },null);
    var conteoId=Array.isArray(conteoR)?conteoR[0].id:conteoR.id;

    // Crear ítems
    var items=prds.map(function(p){
      return {
        conteo_id:conteoId, producto_id:p.id,
        nombre_producto:p.nombre, stock_sistema:stockMap[p.id]||0,
        stock_fisico:null, diferencia:null, ajustado:false,
        // campos UI (no van a DB)
        _color:p.color||'#546e7a', _codigo:p.codigo||''
      };
    });
    var itemsForDB=items.map(function(i){
      return {conteo_id:i.conteo_id, producto_id:i.producto_id,
        nombre_producto:i.nombre_producto, stock_sistema:i.stock_sistema,
        stock_fisico:null, diferencia:null, ajustado:false};
    });
    if(itemsForDB.length){
      await supaPost('stock_conteo_items',itemsForDB,null);
    }

    // Recargar items con IDs desde DB
    var dbItems=await sg('stock_conteo_items','conteo_id=eq.'+conteoId+'&order=nombre_producto.asc');
    // Mezclar con info UI
    var itemsMerged=dbItems.map(function(i){
      var p=prds.find(function(x){return x.id===i.producto_id;})||{};
      return Object.assign({},i,{_color:p.color||'#546e7a',_codigo:p.codigo||''});
    });

    _cnt.conteoActual={
      id:conteoId, numero:numero, deposito_id:depId,
      depNom:dep.nombre||'', sucNom:suc.nombre||'',
      fecha:fecha, obs:obs, estado:'borrador',
      items:itemsMerged, licId:licId
    };

    toast('Conteo '+numero+' iniciado — '+prds.length+' productos');
    renderConteo('activo');
  }catch(e){
    toast('Error: '+e.message);
    if(btn){ btn.disabled=false; btn.textContent='Iniciar conteo →'; }
  }
}

function cntRenderFormulario(){
  var ct=_cnt.conteoActual;
  if(!ct) return;
  var c=document.getElementById('content');
  var tabs='<div class="admin-tabs">'
    +'<button class="atab" onclick="renderConteo(&apos;lista&apos;)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> Historial</button>'
    +'<button class="atab" onclick="renderConteo(&apos;nuevo&apos;)">+ Nuevo</button>'
    +'<button class="atab on"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> En curso</button>'
    +'</div>';

  // Calcular stats
  var contados=ct.items.filter(function(i){return i.stock_fisico!==null;}).length;
  var total=ct.items.length;
  var conDif=ct.items.filter(function(i){return i.stock_fisico!==null&&i.diferencia!==0;}).length;

  c.innerHTML=tabs
    // Header info
    +'<div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px">'
      +'<div>'
        +'<div style="font-size:20px;font-weight:800">'+ct.numero+'</div>'
        +'<div style="font-size:13px;color:var(--muted);margin-top:2px">'+ct.depNom+(ct.sucNom?' · '+ct.sucNom:'')+'  &nbsp;·&nbsp;  '+fmt(ct.fecha)+'</div>'
        +(ct.obs?'<div style="font-size:12px;color:var(--muted);margin-top:2px;font-style:italic">'+ct.obs+'</div>':'')
      +'</div>'
      +'<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">'
        +'<div style="text-align:center;background:var(--card);border:1px solid var(--border);border-radius:8px;padding:8px 16px">'
          +'<div style="font-size:18px;font-weight:800;color:var(--green)">'+contados+'/'+total+'</div>'
          +'<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">Contados</div>'
        +'</div>'
        +'<div style="text-align:center;background:var(--card);border:1px solid var(--border);border-radius:8px;padding:8px 16px">'
          +'<div style="font-size:18px;font-weight:800;color:'+(conDif>0?'var(--red)':'var(--muted)')+'">'+conDif+'</div>'
          +'<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px">Con diferencia</div>'
        +'</div>'
        +'<button onclick="cntConfirmar()" class="btn-sv" style="padding:10px 20px;font-size:13px" '+(contados===0?'disabled title="Contá al menos un producto"':'')+'>'
          +'Confirmar y ajustar</button>'
      +'</div>'
    +'</div>'
    // Barra de progreso
    +'<div style="background:var(--card2);border-radius:6px;height:6px;margin-bottom:16px;overflow:hidden">'
      +'<div style="background:var(--green);height:100%;width:'+Math.round(contados/Math.max(total,1)*100)+'%;transition:width .3s"></div>'
    +'</div>'
    // Tabla
    +'<div class="card">'
      +'<div class="card-h">'
        +'<span class="card-t">'+total+' productos a contar</span>'
        +'<div style="display:flex;gap:8px">'
          +'<input class="d-inp" id="cntBusq" placeholder="Buscar..." oninput="cntFiltrar(this.value)" style="min-width:150px">'
          +'<select class="d-inp" id="cntFiltroEst" onchange="cntFiltrar(document.getElementById(&apos;cntBusq&apos;).value)">'
            +'<option value="">Todos</option>'
            +'<option value="contado">Contados</option>'
            +'<option value="pendiente">Pendientes</option>'
            +'<option value="diferencia">Con diferencia</option>'
          +'</select>'
        +'</div>'
      +'</div>'
      +'<div style="overflow-x:auto"><table><thead><tr>'
        +'<th>Producto</th>'
        +'<th style="text-align:center">Sistema</th>'
        +'<th style="text-align:center">Conteo físico</th>'
        +'<th style="text-align:center">Diferencia</th>'
      +'</tr></thead>'
      +'<tbody id="cntItems"></tbody>'
      +'</table></div>'
    +'</div>';

  cntFiltrar('');
}

function cntFiltrar(q){
  var ct=_cnt.conteoActual;
  if(!ct||!document.getElementById('cntItems')) return;
  var f=(q||'').toLowerCase();
  var est=(document.getElementById('cntFiltroEst')||{}).value||'';
  var lista=ct.items.filter(function(i){
    var matchQ=!f||(i.nombre_producto||'').toLowerCase().includes(f)||(i._codigo||'').toLowerCase().includes(f);
    var matchE=!est
      ||(est==='contado'&&i.stock_fisico!==null)
      ||(est==='pendiente'&&i.stock_fisico===null)
      ||(est==='diferencia'&&i.stock_fisico!==null&&i.diferencia!==0);
    return matchQ&&matchE;
  });
  document.getElementById('cntItems').innerHTML=lista.map(function(item){
    var contado=item.stock_fisico!==null;
    var dif=item.diferencia||0;
    var difCol=dif>0?'var(--green)':dif<0?'var(--red)':'var(--muted)';
    var idx=ct.items.indexOf(item);
    return '<tr style="background:'+(contado&&dif!==0?'rgba(239,83,80,.04)':'')+'">'
      +'<td><div style="display:flex;align-items:center;gap:8px">'
        +'<div style="width:26px;height:26px;border-radius:6px;background:'+item._color+';flex-shrink:0"></div>'
        +'<div><div style="font-weight:600">'+esc(item.nombre_producto)+'</div>'
          +(item._codigo?'<div style="font-size:11px;color:var(--muted)">'+esc(item._codigo)+'</div>':'')
        +'</div></div></td>'
      +'<td style="text-align:center;font-size:16px;font-weight:700">'+item.stock_sistema+'</td>'
      +'<td style="text-align:center">'
        +'<input type="number" id="cntF'+idx+'" value="'+(contado?item.stock_fisico:'')+'" '
          +'placeholder="—" min="0" step="1" '
          +'onchange="cntSetFisico('+idx+',this.value)" '
          +'style="width:80px;text-align:center;background:var(--input-bg);border:1.5px solid '+(contado?'var(--green)':'var(--input-border)')+';border-radius:6px;color:var(--text);font-family:Barlow,sans-serif;font-size:15px;font-weight:700;padding:6px">'
      +'</td>'
      +'<td style="text-align:center;font-size:16px;font-weight:800;color:'+(contado?difCol:'var(--muted)')+'">'
        +(contado?(dif>0?'+':'')+dif:'—')
      +'</td>'
    +'</tr>';
  }).join('');
}

async function cntSetFisico(idx, val){
  var ct=_cnt.conteoActual;
  var item=ct.items[idx];
  if(!item) return;
  var v=val===''?null:parseFloat(val);
  if(v!==null&&isNaN(v)) return;
  item.stock_fisico=v;
  item.diferencia=v!==null?v-item.stock_sistema:null;

  // Guardar en DB (debounced)
  clearTimeout(item._saveTimer);
  item._saveTimer=setTimeout(async function(){
    try{
      await supaPatch('stock_conteo_items','id=eq.'+item.id,{
        stock_fisico:v, diferencia:item.diferencia
      });
    }catch(e){ console.warn('[Conteo] save item error:',e.message); }
  },600);

  // Re-render solo los stats y la fila (no todo)
  cntFiltrar((document.getElementById('cntBusq')||{}).value||'');
  // Actualizar header stats
  var contados=ct.items.filter(function(i){return i.stock_fisico!==null;}).length;
  var conDif=ct.items.filter(function(i){return i.stock_fisico!==null&&i.diferencia!==0;}).length;
  // Actualizar barra de progreso
  var barra=document.querySelector('[style*="transition:width"]');
  if(barra) barra.style.width=Math.round(contados/Math.max(ct.items.length,1)*100)+'%';
}

async function cntConfirmar(){
  var ct=_cnt.conteoActual;
  if(!ct) return;
  var contados=ct.items.filter(function(i){return i.stock_fisico!==null;});
  if(!contados.length){ toast('Contá al menos un producto'); return; }

  var conDif=contados.filter(function(i){return i.diferencia!==0;}).length;
  var msg='¿Confirmar el conteo '+ct.numero+'?\n\n'
    +'• '+contados.length+' productos contados\n'
    +'• '+conDif+' con diferencias\n\n'
    +'Los ajustes se aplicarán automáticamente al stock.';
  if(!confirm(msg)) return;

  var btn=document.querySelector('[onclick="cntConfirmar()"]');
  if(btn){ btn.disabled=true; btn.textContent='Procesando...'; }

  try{
    var licId=ct.licId||await cntGetLicId();
    var dep=_cnt.deps.find(function(d){return d.id===ct.deposito_id;})||{};
    var now=new Date().toISOString();

    // Solo ajustar los que tienen diferencia ≠ 0
    var conAjuste=contados.filter(function(i){return i.diferencia!==0;});

    if(conAjuste.length){
      // Crear comprobante de ajuste tipo 'conteo'
      var compR=await supaPost('stock_comprobantes',{
        licencia_id:licId, deposito_id:ct.deposito_id, sucursal_id:dep.sucursal_id||null,
        tipo:'conteo', referencia:ct.numero,
        observacion:'Conteo físico — ajuste de inventario'+(ct.obs?' | '+ct.obs:''),
        usuario:SE, terminal:'admin', fecha:now
      },null);
      var compId=Array.isArray(compR)?compR[0].id:compR.id;

      // Items del comprobante (solo los que tienen diferencia)
      var compItems=conAjuste.map(function(i){
        return {
          comprobante_id:compId, producto_id:i.producto_id,
          nombre_producto:i.nombre_producto,
          cantidad:i.diferencia,          // puede ser + o -
          cantidad_antes:i.stock_sistema,
          cantidad_despues:i.stock_fisico,
          costo_unitario:0
        };
      });
      await supaPost('stock_comprobante_items',compItems,null);

      // Actualizar stock en tabla stock
      for(var k=0;k<conAjuste.length;k++){
        var it=conAjuste[k];
        supaPost('stock',{
            deposito_id:ct.deposito_id, sucursal_id:dep.sucursal_id||null,
            licencia_id:licId, producto_id:it.producto_id,
            nombre_producto:it.nombre_producto,
            cantidad:it.stock_fisico, updated_at:now
        },'deposito_id,producto_id',true).catch(function(e){ console.warn('[Conteo] stock upsert:',e.message); });

        // Marcar ítem como ajustado
        await supaPatch('stock_conteo_items','id=eq.'+it.id,{ajustado:true});
      }
    }

    // Cerrar el conteo
    await supaPatch('stock_conteos','id=eq.'+ct.id,{
      estado:'confirmado', fecha_confirm:now
    });

    _cnt.conteoActual=null;
    _inv.prds=[]; // invalidar cache inventario

    toast('Conteo confirmado — '+conAjuste.length+' ajuste'+(conAjuste.length===1?'':'s')+' aplicado'+(conAjuste.length===1?'':'s'));
    renderConteo('lista');
  }catch(e){
    toast('Error: '+e.message);
    if(btn){ btn.disabled=false; btn.textContent='Confirmar y ajustar'; }
  }
}

// ── HISTORIAL DE CONTEOS ──────────────────────────────────
async function cntCargarLista(){
  var wrap=document.getElementById('cntListaWrap');
  if(!wrap) return;
  var licId=await cntGetLicId();

  wrap.innerHTML=
    '<div class="card">'
      +'<div class="card-h"><span class="card-t" id="cntListCount">Cargando...</span></div>'
      +'<div style="overflow-x:auto"><table><thead><tr>'
        +'<th>N° Conteo</th><th>Fecha</th><th>Depósito</th>'
        +'<th style="text-align:center">Productos</th>'
        +'<th style="text-align:center">Con diferencia</th>'
        +'<th style="text-align:center">Estado</th>'
        +'<th style="text-align:center">Acciones</th>'
      +'</tr></thead>'
      +'<tbody id="cntListBody"><tr><td colspan="7" class="loading"><span class="sp"></span></td></tr></tbody>'
      +'</table></div>'
    +'</div>';

  try{
    var conteos=await sg('stock_conteos',
      'licencia_id=eq.'+licId+'&order=created_at.desc&limit=100'
    );
    if(document.getElementById('cntListCount'))
      document.getElementById('cntListCount').textContent=conteos.length+' conteos';

    if(!conteos.length){
      document.getElementById('cntListBody').innerHTML='<tr><td colspan="7" style="text-align:center;padding:28px;color:var(--muted)">Sin conteos registrados. Creá el primero.</td></tr>';
      return;
    }

    // Cargar stats de items para cada conteo
    var cIds=conteos.map(function(c){return c.id;});
    var allItems=await sg('stock_conteo_items',
      'conteo_id=in.('+cIds.join(',')+')'
      +'&select=conteo_id,stock_fisico,diferencia&limit=5000'
    );
    var statsMap={};
    allItems.forEach(function(i){
      if(!statsMap[i.conteo_id]) statsMap[i.conteo_id]={total:0,contados:0,conDif:0};
      statsMap[i.conteo_id].total++;
      if(i.stock_fisico!==null){ statsMap[i.conteo_id].contados++; }
      if(i.diferencia!==null&&i.diferencia!==0) statsMap[i.conteo_id].conDif++;
    });

    var estCfg={
      'borrador': {lbl:'BORRADOR', cls:'tag-o'},
      'confirmado':{lbl:'CONFIRMADO',cls:'tag-g'},
      'anulado':  {lbl:'ANULADO',  cls:'tag-r'}
    };

    document.getElementById('cntListBody').innerHTML=conteos.map(function(ct){
      var st=statsMap[ct.id]||{total:0,contados:0,conDif:0};
      var dep=(_cnt.deps.find(function(d){return d.id===ct.deposito_id;})||{}).nombre||('#'+ct.deposito_id);
      var suc=(_cnt.sucs.find(function(s){return s.id===ct.sucursal_id;})||{}).nombre||'';
      var ec=estCfg[ct.estado]||{lbl:ct.estado,cls:'tag-gr'};
      var esBorrador=ct.estado==='borrador';
      return '<tr>'
        +'<td style="font-weight:700">'+ct.numero+'</td>'
        +'<td style="font-size:12px;color:var(--muted)">'+fmt(ct.fecha)+'</td>'
        +'<td><div style="font-weight:600">'+dep+'</div>'
          +(suc?'<div style="font-size:11px;color:var(--muted)">'+suc+'</div>':'')+'</td>'
        +'<td style="text-align:center">'
          +'<span style="font-size:13px;font-weight:700">'+st.contados+'</span>'
          +'<span style="font-size:11px;color:var(--muted)">/'+st.total+'</span>'
        +'</td>'
        +'<td style="text-align:center;font-weight:800;color:'+(st.conDif>0?'var(--red)':'var(--muted)')+'">'+st.conDif+'</td>'
        +'<td style="text-align:center"><span class="tag '+ec.cls+'">'+ec.lbl+'</span></td>'
        +'<td style="text-align:center;white-space:nowrap;display:flex;gap:5px;justify-content:center">'
          +(esBorrador
            ?'<button onclick="cntReanudar('+ct.id+')" style="background:var(--o2);border:1px solid var(--orange);border-radius:6px;color:var(--orange);font-family:Barlow,sans-serif;font-size:11px;font-weight:700;padding:5px 9px;cursor:pointer">Continuar</button>'
            :'')
          +'<button onclick="cntVerDetalle('+ct.id+')" style="background:var(--b2);border:1px solid var(--blue);border-radius:6px;color:var(--blue);font-family:Barlow,sans-serif;font-size:11px;font-weight:700;padding:5px 9px;cursor:pointer">Ver</button>'
        +'</td>'
      +'</tr>';
    }).join('');
  }catch(e){
    document.getElementById('cntListBody').innerHTML='<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--red)">Error: '+e.message+'</td></tr>';
  }
}

async function cntReanudar(conteoId){
  try{
    var licId=await cntGetLicId();
    var comps=await sg('stock_conteos','id=eq.'+conteoId+'&select=*');
    var items=await sg('stock_conteo_items','conteo_id=eq.'+conteoId+'&order=nombre_producto.asc');
    if(!comps.length) return toast('Conteo no encontrado');
    var ct=comps[0];
    var dep=_cnt.deps.find(function(d){return d.id===ct.deposito_id;})||{};
    var suc=_cnt.sucs.find(function(s){return s.id===ct.sucursal_id;})||{};
    // Recargar stocks actuales del sistema
    var prodIds=items.map(function(i){return i.producto_id;});
    var stockRows=await sg('stock',
      'deposito_id=eq.'+ct.deposito_id+'&licencia_id=eq.'+licId
      +'&producto_id=in.('+prodIds.join(',')+')'
      +'&select=producto_id,cantidad&limit=1000'
    );
    var stockMap={};
    stockRows.forEach(function(r){ stockMap[r.producto_id]=parseFloat(r.cantidad)||0; });
    // Enriquecer items
    var prds=await sg('pos_productos',
      'id=in.('+prodIds.join(',')+')'+'&select=id,color,codigo&limit=500'
    );
    var prdMap={};
    prds.forEach(function(p){ prdMap[p.id]=p; });
    var itemsMerged=items.map(function(i){
      var p=prdMap[i.producto_id]||{};
      return Object.assign({},i,{
        stock_sistema:stockMap[i.producto_id]||i.stock_sistema,
        stock_fisico:i.stock_fisico,
        diferencia:i.diferencia,
        _color:p.color||'#546e7a', _codigo:p.codigo||''
      });
    });
    _cnt.conteoActual={
      id:conteoId, numero:ct.numero, deposito_id:ct.deposito_id,
      depNom:dep.nombre||'', sucNom:suc.nombre||'',
      fecha:ct.fecha, obs:ct.observacion, estado:ct.estado,
      items:itemsMerged, licId:licId
    };
    renderConteo('activo');
  }catch(e){ toast('Error: '+e.message); }
}

async function cntVerDetalle(conteoId){
  var ov=document.createElement('div');
  ov.id='cntDetOv';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:1000;overflow-y:auto;padding:14px 8px';
  ov.innerHTML='<div style="background:var(--card);border:1px solid var(--border);border-radius:14px;max-width:700px;margin:0 auto;overflow:hidden">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border)">'
      +'<div style="font-size:16px;font-weight:800">Detalle del conteo</div>'
      +'<button onclick="document.getElementById(&apos;cntDetOv&apos;).remove()" style="background:var(--card2);border:1px solid var(--border);border-radius:8px;color:var(--text);cursor:pointer;padding:7px 13px;font-family:Barlow,sans-serif;font-size:13px;font-weight:700"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Cerrar</button>'
    +'</div>'
    +'<div id="cntDetBody" style="padding:20px"><div class="loading"><span class="sp"></span></div></div>'
    +'</div>';
  document.body.appendChild(ov);

  try{
    var comps=await sg('stock_conteos','id=eq.'+conteoId+'&select=*');
    var items=await sg('stock_conteo_items','conteo_id=eq.'+conteoId+'&order=nombre_producto.asc');
    var ct=comps[0];
    var dep=(_cnt.deps.find(function(d){return d.id===ct.deposito_id;})||{}).nombre||'';
    var contados=items.filter(function(i){return i.stock_fisico!==null;});
    var conDif=items.filter(function(i){return i.diferencia!==null&&i.diferencia!==0;});

    document.getElementById('cntDetBody').innerHTML=
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">'
        +'<div style="background:var(--card2);border-radius:8px;padding:12px">'
          +'<div class="cj-dr"><span style="color:var(--muted)">N° Conteo</span><span style="font-weight:700">'+ct.numero+'</span></div>'
          +'<div class="cj-dr"><span style="color:var(--muted)">Fecha</span><span>'+fmt(ct.fecha)+'</span></div>'
          +'<div class="cj-dr"><span style="color:var(--muted)">Depósito</span><span>'+dep+'</span></div>'
          +'<div class="cj-dr"><span style="color:var(--muted)">Usuario</span><span>'+(ct.usuario||'—')+'</span></div>'
        +'</div>'
        +'<div style="background:var(--card2);border-radius:8px;padding:12px">'
          +'<div class="cj-dr"><span style="color:var(--muted)">Estado</span><span style="font-weight:700">'+(ct.estado||'').toUpperCase()+'</span></div>'
          +'<div class="cj-dr"><span style="color:var(--muted)">Productos</span><span>'+contados.length+'/'+items.length+' contados</span></div>'
          +'<div class="cj-dr"><span style="color:var(--muted)">Con diferencia</span><span style="color:'+(conDif.length>0?'var(--red)':'var(--green)')+'">'+conDif.length+'</span></div>'
          +(ct.observacion?'<div class="cj-dr"><span style="color:var(--muted)">Obs.</span><span style="font-size:12px">'+esc(ct.observacion)+'</span></div>':'')
        +'</div>'
      +'</div>'
      // Solo mostrar productos con diferencia o todos
      +'<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><thead><tr>'
        +'<th style="padding:8px 12px;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;text-align:left;background:var(--card2)">Producto</th>'
        +'<th style="padding:8px 12px;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;text-align:center;background:var(--card2)">Sistema</th>'
        +'<th style="padding:8px 12px;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;text-align:center;background:var(--card2)">Físico</th>'
        +'<th style="padding:8px 12px;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;text-align:center;background:var(--card2)">Diferencia</th>'
        +'<th style="padding:8px 12px;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;text-align:center;background:var(--card2)">Ajustado</th>'
      +'</tr></thead><tbody>'
      +items.map(function(i){
        var dif=i.diferencia;
        var difCol=dif>0?'var(--green)':dif<0?'var(--red)':'var(--muted)';
        return '<tr style="border-bottom:1px solid var(--border);background:'+(dif&&dif!==0?'rgba(239,83,80,.03)':'')+'">'
          +'<td style="padding:9px 12px;font-size:13px;font-weight:600">'+esc(i.nombre_producto)+'</td>'
          +'<td style="padding:9px 12px;text-align:center;font-weight:700">'+i.stock_sistema+'</td>'
          +'<td style="padding:9px 12px;text-align:center;font-weight:700">'+(i.stock_fisico!==null?i.stock_fisico:'—')+'</td>'
          +'<td style="padding:9px 12px;text-align:center;font-weight:800;color:'+(i.stock_fisico!==null?difCol:'var(--muted)')+'">'
            +(i.stock_fisico!==null?(dif>0?'+':'')+dif:'—')
          +'</td>'
          +'<td style="padding:9px 12px;text-align:center">'+(i.ajustado?'<span class="tag tag-g"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><polyline points="20 6 9 17 4 12"/></svg></span>':'<span class="tag tag-gr">—</span>')+'</td>'
        +'</tr>';
      }).join('')
      +'</tbody></table></div>';
  }catch(e){
    document.getElementById('cntDetBody').innerHTML='<div style="color:var(--red)">Error: '+e.message+'</div>';
  }
}


