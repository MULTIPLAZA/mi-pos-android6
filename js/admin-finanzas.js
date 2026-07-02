// ── Admin: Gastos, Timbrados ──

// Polyfill defensivo: lib/index.mjs carga async (type="module") y puede no
// haber seteado window._log/_warn/_err todavía cuando este archivo ejecuta.
// Fix BUG-07.
if (typeof window !== 'undefined') {
  if (typeof window._log  !== 'function') window._log  = function(){};
  if (typeof window._warn !== 'function') window._warn = function(){ console.warn.apply(console, arguments); };
  if (typeof window._err  !== 'function') window._err  = function(){ console.error.apply(console, arguments); };
}

// ═══════════════════════════════════════════════════════════
// GASTOS FIJOS
// ═══════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════
// PLAN DE CONCEPTOS DE GASTOS
// ═══════════════════════════════════════════════════════════
var _plan = { cats: [], cons: [], licId: null };

async function planGetLicId(){
  if(_plan.licId) return _plan.licId;
  if(SLI){ _plan.licId=SLI; return SLI; }
  var r=await sg('licencias','email_cliente=ilike.'+encodeURIComponent(SE)+'&activa=eq.true&select=id&limit=1');
  if(r&&r.length){ _plan.licId=r[0].id; return r[0].id; }
  throw new Error('No se encontró licencia');
}

async function planCargar(){
  var licId=await planGetLicId();
  var res=await Promise.all([
    sg('gasto_categorias','licencia_id=eq.'+licId+'&activa=eq.true&order=orden.asc,nombre.asc'),
    sg('gasto_conceptos','licencia_id=eq.'+licId+'&activo=eq.true&order=orden.asc,nombre.asc')
  ]);
  _plan.cats=res[0]; _plan.cons=res[1];
}

async function renderPlanGastos(){
  var c=document.getElementById('content');
  c.innerHTML='<div class="loading"><span class="sp"></span>Cargando...</div>';
  try{ await planCargar(); } catch(e){ c.innerHTML='<div style="padding:24px;color:var(--red)">'+e.message+'</div>'; return; }

  c.innerHTML=
    '<div class="ph"><div><div class="pt">Plan de Gastos</div>'
      +'<div class="ps">Categorías y conceptos para clasificar tus gastos</div></div></div>'
    // Nueva categoría
    +'<div class="card" style="margin-bottom:12px">'
      +'<div class="card-h"><span class="card-t">Categorías</span>'
        +'<div style="display:flex;gap:8px;align-items:center">'
          +'<input type="text" id="planNomCat" class="d-inp" placeholder="Nueva categoría..." style="min-width:180px">'
          +'<button onclick="planCrearCat()" class="btn-sv" style="padding:7px 14px">+ Agregar</button>'
        +'</div>'
      +'</div>'
      +'<div id="planCatsList" style="padding:8px 0">'
        +(_plan.cats.length===0
          ?'<div style="padding:20px;text-align:center;color:var(--muted)">Sin categorías. Creá la primera.</div>'
          :_plan.cats.map(function(cat){
            var cons=_plan.cons.filter(function(c){return c.categoria_id===cat.id;});
            return '<div style="border-bottom:1px solid var(--border)">'
              // Categoría header
              +'<div style="display:flex;align-items:center;gap:10px;padding:10px 18px;background:var(--card2)">'
                +'<div style="font-size:14px;font-weight:800;flex:1">'+cat.nombre+'</div>'
                +'<span style="font-size:11px;color:var(--muted)">'+cons.length+' conceptos</span>'
                +'<button onclick="planEliminarCat('+cat.id+')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:16px;padding:2px 6px" title="Eliminar categoría"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>'
              +'</div>'
              // Conceptos de esta categoría
              +'<div style="padding:4px 18px 8px 36px">'
                +cons.map(function(con){
                  return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">'
                    +'<div style="flex:1"><div style="font-size:13px;font-weight:600">'+con.nombre+'</div>'
                      +(con.descripcion?'<div style="font-size:11px;color:var(--muted)">'+con.descripcion+'</div>':'')
                    +'</div>'
                    +'<button onclick="planEliminarCon('+con.id+')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:14px;padding:2px 6px" title="Eliminar concepto"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>'
                  +'</div>';
                }).join('')
                // Input para agregar concepto a esta categoría
                +'<div style="display:flex;gap:6px;margin-top:8px">'
                  +'<input type="text" id="planNomCon'+cat.id+'" class="d-inp" placeholder="Nuevo concepto en '+cat.nombre+'..." style="flex:1;font-size:12px">'
                  +'<input type="text" id="planDescCon'+cat.id+'" class="d-inp" placeholder="Descripción (opcional)" style="width:180px;font-size:12px">'
                  +'<button onclick="planCrearCon('+cat.id+')" style="background:var(--b2);border:1px solid var(--blue);border-radius:6px;color:var(--blue);font-family:Barlow,sans-serif;font-size:11px;font-weight:700;padding:6px 12px;cursor:pointer;white-space:nowrap">+ Concepto</button>'
                +'</div>'
              +'</div>'
            +'</div>';
          }).join(''))
      +'</div>'
    +'</div>';
}

async function planCrearCat(){
  var nom=document.getElementById('planNomCat').value.trim();
  if(!nom){ toast('Ingresá el nombre de la categoría'); return; }
  var licId=await planGetLicId();
  try{
    await supaPost('gasto_categorias',{licencia_id:licId,nombre:nom,orden:_plan.cats.length},null);
    document.getElementById('planNomCat').value='';
    toast('Categoría creada');
    await planCargar();
    renderPlanGastos();
  }catch(e){ toast('Error: '+e.message); }
}

async function planCrearCon(catId){
  var nom=(document.getElementById('planNomCon'+catId)||{}).value||'';
  var desc=(document.getElementById('planDescCon'+catId)||{}).value||'';
  nom=nom.trim(); desc=desc.trim();
  if(!nom){ toast('Ingresá el nombre del concepto'); return; }
  var licId=await planGetLicId();
  try{
    await supaPost('gasto_conceptos',{
      licencia_id:licId, categoria_id:catId,
      nombre:nom, descripcion:desc||null,
      orden:_plan.cons.filter(function(c){return c.categoria_id===catId;}).length
    },null);
    toast('Concepto creado');
    await planCargar();
    renderPlanGastos();
  }catch(e){ toast('Error: '+e.message); }
}

async function planEliminarCat(id){
  var cons=_plan.cons.filter(function(c){return c.categoria_id===id;});
  if(cons.length>0){
    if(!confirm('Esta categoría tiene '+cons.length+' conceptos. ¿Eliminar todo?')) return;
  }
  try{
    // Eliminar conceptos primero
    if(cons.length){
      await supaDelete('gasto_conceptos','categoria_id=eq.'+id);
    }
    await supaDelete('gasto_categorias','id=eq.'+id);
    toast('Categoría eliminada');
    await planCargar();
    renderPlanGastos();
  }catch(e){ toast('Error: '+e.message); }
}

async function planEliminarCon(id){
  if(!confirm('¿Eliminar este concepto?')) return;
  try{
    await supaDelete('gasto_conceptos','id=eq.'+id);
    toast('Concepto eliminado');
    await planCargar();
    renderPlanGastos();
  }catch(e){ toast('Error: '+e.message); }
}

// ═══════════════════════════════════════════════════════════
// GASTOS FIJOS — versión con plan de conceptos
// ═══════════════════════════════════════════════════════════
var _gastosLicId=null;



// ═══════════════════════════════════════════════════════════
// GASTOS FIJOS — con plan de conceptos
// ═══════════════════════════════════════════════════════════
async function renderGastos(tab){
  tab=tab||'lista';
  var c=document.getElementById('content');
  c.innerHTML='<div class="loading"><span class="sp"></span>Cargando...</div>';
  if(!_gastosLicId){
    try{
      if(SLI){ _gastosLicId=SLI; }
      else {
        var lr=await sg('licencias','email_cliente=ilike.'+encodeURIComponent(SE)+'&activa=eq.true&select=id&limit=1');
        if(lr && lr[0] && lr[0].id) _gastosLicId=lr[0].id;
      }
    }catch(e){ console.warn('[Gastos] Error obteniendo licencia:', e.message); }
  }
  // BUG-03 fix: si no se pudo obtener la licencia, mostrar empty state amigable
  // en vez de seguir y enviar `licencia_id=null` literal a Supabase.
  if(!_gastosLicId){
    c.innerHTML='<div style="padding:24px;color:var(--muted);text-align:center">'
      +'<div style="font-size:14px;margin-bottom:8px">No pudimos cargar tu licencia.</div>'
      +'<div style="font-size:12px;color:var(--muted);margin-bottom:14px">Esperá unos segundos y reintentá.</div>'
      +'<button onclick="renderGastos(&apos;'+tab+'&apos;)" class="btn-sv" style="padding:8px 18px">Reintentar</button>'
      +'</div>';
    return;
  }
  _plan.licId=_gastosLicId;
  if(!_plan.cats.length) await planCargar().catch(function(e){ console.warn('[Gastos] Error cargando plan:', e.message); });

  var tabs='<div class="admin-tabs">'
    +'<button class="atab'+(tab==='lista'?' on':'')+'" onclick="renderGastos(&apos;lista&apos;)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> Listado</button>'
    +'<button class="atab'+(tab==='nuevo'?' on':'')+'" onclick="renderGastos(&apos;nuevo&apos;)">+ Nuevo gasto</button>'
    +'</div>';

  if(tab==='nuevo'){
    var hoy=new Date().toISOString().split('T')[0];
    var conOpts='<option value="">— Seleccioná un concepto —</option>';
    _plan.cats.forEach(function(cat){
      var cons=_plan.cons.filter(function(c){return c.categoria_id===cat.id;});
      if(!cons.length) return;
      conOpts+='<optgroup label="'+cat.nombre+'">';
      cons.forEach(function(con){ conOpts+='<option value="'+con.id+'">'+con.nombre+'</option>'; });
      conOpts+='</optgroup>';
    });
    if(!_plan.cats.length){
      c.innerHTML=tabs+'<div class="empty"><div class="empty-i"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg></div>'
        +'<div class="empty-t">Sin conceptos de gasto</div>'
        +'<div class="empty-s">Primero creá tus categorías y conceptos en <strong>Plan de Gastos</strong></div>'
        +'<button onclick="goTo(&apos;plan-gastos&apos;)" class="btn-sv" style="margin-top:14px">Ir a Plan de Gastos</button>'
        +'</div>';
      return;
    }
    c.innerHTML=tabs
      +'<div class="card" style="max-width:580px">'
        +'<div class="card-h"><span class="card-t">Registrar gasto</span></div>'
        +'<div style="padding:20px;display:grid;grid-template-columns:1fr 1fr;gap:14px">'
          +'<div style="grid-column:1/-1"><label style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:5px">Concepto de gasto</label>'
            +'<select id="gConceptoId" class="cfg-inp" style="width:100%">'+conOpts+'</select>'
            +'<div style="font-size:11px;color:var(--muted);margin-top:4px">¿No está? <button onclick="goTo(&apos;plan-gastos&apos;)" style="background:none;border:none;color:var(--blue);cursor:pointer;font-size:11px;text-decoration:underline;font-family:Barlow,sans-serif">Administrá el Plan de Gastos</button></div>'
          +'</div>'
          +'<div style="grid-column:1/-1"><label style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:5px">Descripción / Detalle</label>'
            +'<input type="text" id="gConcepto" class="cfg-inp" style="width:100%" placeholder="Ej: Alquiler enero 2026, Sueldo Juan Pérez..."></div>'
          +'<div><label style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:5px">Monto</label>'
            +'<input type="number" id="gMonto" class="cfg-inp" style="width:100%" min="0" placeholder="0"></div>'
          +'<div><label style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:5px">Fecha</label>'
            +'<input type="date" id="gFecha" class="cfg-inp" style="width:100%" value="'+hoy+'"></div>'
          +'<div style="grid-column:1/-1"><label style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:5px">Observación (opcional)</label>'
            +'<input type="text" id="gObs" class="cfg-inp" style="width:100%" placeholder="Notas adicionales..."></div>'
          +'<div style="grid-column:1/-1;display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--card2);border-radius:8px">'
            +'<input type="checkbox" id="gTieneFact" style="width:16px;height:16px;cursor:pointer">'
            +'<div><div style="font-size:13px;font-weight:600">Tiene factura (genera crédito fiscal IVA)</div>'
              +'<div style="font-size:11px;color:var(--muted)">Marcá si este gasto tiene factura timbrada del proveedor</div></div>'
          +'</div>'
          +'<div style="grid-column:1/-1;display:flex;gap:10px;justify-content:flex-end">'
            +'<button onclick="renderGastos(&apos;lista&apos;)" class="btn-dn" style="padding:11px 22px">Cancelar</button>'
            +'<button onclick="gastoGuardar()" class="btn-sv" style="padding:11px 28px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Guardar gasto</button>'
          +'</div>'
        +'</div>'
      +'</div>';
    return;
  }

  // LISTA
  var hoy=new Date(), d1=new Date(hoy.getFullYear(),hoy.getMonth(),1);
  var fdDef=d1.getFullYear()+'-'+pad(d1.getMonth()+1)+'-'+pad(d1.getDate());
  var fhDef=hoy.getFullYear()+'-'+pad(hoy.getMonth()+1)+'-'+pad(hoy.getDate());
  var catFiltOpts='<option value="">Todas las categorías</option>'
    +_plan.cats.map(function(cat){return '<option value="'+cat.id+'">'+cat.nombre+'</option>';}).join('');

  c.innerHTML=tabs
    +'<div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-bottom:14px">'
      +'<div><label style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:4px">Desde</label>'
        +'<input type="date" id="gFD" class="d-inp" value="'+fdDef+'"></div>'
      +'<div><label style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:4px">Hasta</label>'
        +'<input type="date" id="gFH" class="d-inp" value="'+fhDef+'"></div>'
      +'<div><label style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:4px">Categoría</label>'
        +'<select id="gFCat" class="d-inp">'+catFiltOpts+'</select></div>'
      +'<button onclick="gastosBuscar()" class="btn-sv" style="padding:9px 18px">Buscar</button>'
    +'</div>'
    +'<div class="kg k3" id="gKpis" style="display:none">'
      +'<div class="kc" style="--c:var(--red)"><div class="kc-l">Total gastos</div><div class="kc-v" id="gKTotal">₲0</div><div class="kc-s" id="gKCant">0 registros</div></div>'
      +'<div class="kc" style="--c:var(--orange)"><div class="kc-l">Mayor categoría</div><div class="kc-v" id="gKCat" style="font-size:14px;font-weight:700">—</div></div>'
      +'<div class="kc" style="--c:var(--blue)"><div class="kc-l">Promedio por gasto</div><div class="kc-v" id="gKProm">₲0</div></div>'
    +'</div>'
    +'<div class="card"><div class="card-h"><span class="card-t" id="gCount">—</span></div>'
      +'<div style="overflow-x:auto"><table><thead><tr>'
        +'<th>Fecha</th><th>Categoría</th><th>Concepto</th><th>Descripción</th>'
        +'<th style="text-align:right">Monto</th><th>Obs.</th>'
        +'<th style="text-align:center">Acción</th>'
      +'</tr></thead><tbody id="gBody"><tr><td colspan="7" class="loading"><span class="sp"></span></td></tr></tbody>'
      +'</table></div></div>';

  await gastosBuscar();
}

async function gastoGuardar(){
  var conId=parseInt((document.getElementById('gConceptoId')||{}).value||'0')||null;
  var desc=(document.getElementById('gConcepto')||{}).value.trim();
  var monto=parseFloat((document.getElementById('gMonto')||{}).value)||0;
  var fecha=(document.getElementById('gFecha')||{}).value;
  var obs=(document.getElementById('gObs')||{}).value.trim();
  if(!conId){ toast('Seleccioná un concepto de gasto'); return; }
  if(!desc){ toast('Ingresá la descripción del gasto'); return; }
  if(!monto||monto<=0){ toast('Ingresá un monto válido'); return; }
  var con=_plan.cons.find(function(c){return c.id===conId;});
  var catId=con?con.categoria_id:null;
  var cat=_plan.cats.find(function(c){return c.id===catId;});
  var btn=document.querySelector('[onclick="gastoGuardar()"]');
  if(btn){ btn.disabled=true; btn.textContent='Guardando...'; }
  try{
    await supaPost('gastos',{
      licencia_id:_gastosLicId, concepto:desc,
      categoria:cat?cat.nombre:'Sin categoría',
      concepto_id:conId, categoria_id:catId,
      monto:monto, fecha:fecha,
      observacion:obs||null, usuario:SE,
      tiene_factura:!!(document.getElementById('gTieneFact')||{}).checked,
      created_at:new Date().toISOString()
    },null);
    toast('Gasto guardado — '+gs(monto));
    renderGastos('lista');
  }catch(e){
    toast('Error: '+e.message);
    if(btn){ btn.disabled=false; btn.textContent='Guardar gasto'; }
  }
}

async function gastosBuscar(){
  var fd=(document.getElementById('gFD')||{}).value||'';
  var fh=(document.getElementById('gFH')||{}).value||'';
  var catId=parseInt((document.getElementById('gFCat')||{}).value||'0')||null;
  var tbody=document.getElementById('gBody');
  if(!tbody) return;
  tbody.innerHTML='<tr><td colspan="7" class="loading"><span class="sp"></span></td></tr>';
  try{
    var q='licencia_id=eq.'+_gastosLicId
      +(catId?'&categoria_id=eq.'+catId:'')
      +(fd?'&fecha=gte.'+fd:'')
      +(fh?'&fecha=lte.'+fh:'')
      +'&order=fecha.desc,id.desc&limit=500';
    var rows=await sg('gastos',q);
    var total=rows.reduce(function(s,r){return s+(r.monto||0);},0);
    var prom=rows.length?Math.round(total/rows.length):0;
    var catMap={};
    rows.forEach(function(r){catMap[r.categoria]=(catMap[r.categoria]||0)+(r.monto||0);});
    var mayorCat=Object.entries(catMap).sort(function(a,b){return b[1]-a[1];})[0];
    if(document.getElementById('gKpis')) document.getElementById('gKpis').style.display='grid';
    if(document.getElementById('gKTotal')) document.getElementById('gKTotal').textContent=gs(total);
    if(document.getElementById('gKCant'))  document.getElementById('gKCant').textContent=rows.length+' registros';
    if(document.getElementById('gKCat'))   document.getElementById('gKCat').textContent=mayorCat?mayorCat[0]:'—';
    if(document.getElementById('gKProm'))  document.getElementById('gKProm').textContent=gs(prom);
    if(document.getElementById('gCount'))  document.getElementById('gCount').textContent=rows.length+' gastos';
    if(!rows.length){
      tbody.innerHTML='<tr><td colspan="7" style="text-align:center;padding:28px;color:var(--muted)">Sin gastos en el período</td></tr>';
      return;
    }
    tbody.innerHTML=rows.map(function(r){
      var con=_plan.cons.find(function(c){return c.id===r.concepto_id;})||{nombre:'—'};
      var cat=_plan.cats.find(function(c){return c.id===r.categoria_id;})||{nombre:r.categoria||'—'};
      return '<tr>'
        +'<td style="font-size:12px;white-space:nowrap;color:var(--muted)">'+fmt(r.fecha)+'</td>'
        +'<td><span style="padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;background:var(--b2);color:var(--blue)">'+cat.nombre+'</span></td>'
        +'<td style="font-size:12px;font-weight:600">'+con.nombre+'</td>'
        +'<td style="font-size:12px">'+r.concepto+'</td>'
        +'<td style="text-align:right;font-weight:800;color:var(--red)">'+gs(r.monto)+'</td>'
        +'<td style="font-size:11px;color:var(--muted)">'+(r.observacion||'')+'</td>'
        +'<td style="text-align:center">'
          +'<button onclick="gastoEliminar('+r.id+')" style="background:var(--r2);border:1px solid var(--red);border-radius:6px;color:var(--red);font-family:Barlow,sans-serif;font-size:11px;font-weight:700;padding:5px 9px;cursor:pointer">Eliminar</button>'
        +'</td>'
      +'</tr>';
    }).join('');
  }catch(e){
    tbody.innerHTML='<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--red)">Error: '+e.message+'</td></tr>';
  }
}

async function gastoEliminar(id){
  if(!confirm('¿Eliminar este gasto?')) return;
  try{
    await supaDelete('gastos','id=eq.'+id);
    toast('Gasto eliminado');
    await gastosBuscar();
  }catch(e){ toast('Error: '+e.message); }
}

async function renderBalance(){
  var c=document.getElementById('content');
  c.innerHTML='<div class="loading"><span class="sp"></span>Cargando...</div>';
  // BUG-04 fix: el `[0].id` crasheaba con uncaught TypeError cuando SLI era
  // undefined y la query devolvía []. Wrappear todo en try/catch y validar.
  var licId;
  try {
    if(SLI){ licId=SLI; }
    else {
      var lr=await sg('licencias','email_cliente=ilike.'+encodeURIComponent(SE)+'&activa=eq.true&select=id&limit=1');
      if(lr && lr[0] && lr[0].id) licId=lr[0].id;
    }
  } catch(e){ console.warn('[Balance] Error obteniendo licencia:', e.message); }
  if(!licId){
    c.innerHTML='<div style="padding:24px;color:var(--muted);text-align:center">'
      +'<div style="font-size:14px;margin-bottom:8px">No pudimos cargar tu licencia.</div>'
      +'<div style="font-size:12px;color:var(--muted);margin-bottom:14px">Esperá unos segundos y reintentá.</div>'
      +'<button onclick="renderBalance()" class="btn-sv" style="padding:8px 18px">Reintentar</button>'
      +'</div>';
    return;
  }
  _plan.licId=licId;
  if(!_plan.cats.length) await planCargar().catch(function(e){ console.warn('[Gastos] Error cargando plan:', e.message); });

  var hoy=new Date(), d1=new Date(hoy.getFullYear(),hoy.getMonth(),1);
  var fdDef=d1.getFullYear()+'-'+pad(d1.getMonth()+1)+'-'+pad(d1.getDate());
  var fhDef=hoy.getFullYear()+'-'+pad(hoy.getMonth()+1)+'-'+pad(hoy.getDate());

  c.innerHTML=
    '<div class="ph"><div><div class="pt">Balance P&amp;G</div>'
      +'<div class="ps">Estado de resultados — Ventas − Costos − Gastos = Utilidad</div></div>'
      +'<button onclick="balanceBuscar()" class="btn-sv" style="padding:9px 20px">Generar</button>'
    +'</div>'
    +'<div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-bottom:16px">'
      +'<div><label style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:4px">Desde</label>'
        +'<input type="date" id="balFD" class="d-inp" value="'+fdDef+'"></div>'
      +'<div><label style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:4px">Hasta</label>'
        +'<input type="date" id="balFH" class="d-inp" value="'+fhDef+'"></div>'
      +'<div style="display:flex;gap:6px;flex-wrap:wrap;align-self:flex-end">'
        +'<button onclick="balSetPeriodo(\'mes\')"  class="dbtn on" id="balBMes">Mes</button>'
        +'<button onclick="balSetPeriodo(\'anio\')" class="dbtn"   id="balBAnio">Año</button>'
      +'</div>'
    +'</div>'
    +'<div id="balBody"></div>';

  await balanceBuscar(licId);
}

function balSetPeriodo(p){
  var hoy=new Date(), d=new Date(hoy);
  if(p==='mes') d=new Date(hoy.getFullYear(),hoy.getMonth(),1);
  else if(p==='anio') d=new Date(hoy.getFullYear(),0,1);
  var fmt2=function(x){return x.getFullYear()+'-'+pad(x.getMonth()+1)+'-'+pad(x.getDate());};
  document.getElementById('balFD').value=fmt2(d);
  document.getElementById('balFH').value=fmt2(hoy);
  ['Mes','Anio'].forEach(function(x){
    var el=document.getElementById('balB'+x); if(el) el.classList.toggle('on',(p==='mes'&&x==='Mes')||(p==='anio'&&x==='Anio'));
  });
}

async function balanceBuscar(licId){
  licId=licId||SLI;
  var fd=document.getElementById('balFD').value;
  var fh=document.getElementById('balFH').value;
  var body=document.getElementById('balBody');
  if(!body) return;
  body.innerHTML='<div class="loading"><span class="sp"></span>Calculando balance...</div>';

  // Paraguay UTC-4: día empieza T04:00:00 UTC, termina al día siguiente T03:59:59 UTC
  var addDayBal=function(ds){var p=ds.split('-');var d=new Date(+p[0],+p[1]-1,+p[2]+1);return d.getFullYear()+'-'+(d.getMonth()+1<10?'0':'')+(d.getMonth()+1)+'-'+(d.getDate()<10?'0':'')+d.getDate();};

  try{
    // ── FASE 1: TODOS LOS FETCHES PRIMERO ──────────────────

    // 1a. Ventas + mapa de costos (en paralelo) — excluye anuladas
    var fetchVentas=sg('pos_ventas',
      'licencia_email=ilike.'+encodeURIComponent(SE)
      +'&anulada=is.false'
      +(fd?'&fecha=gte.'+fd+'T04:00:00':'')
      +(fh?'&fecha=lte.'+addDayBal(fh)+'T03:59:59':'')
      +'&select=items,total&limit=5000'
    );
    var fetchPrds=sg('pos_productos',
      'licencia_email=ilike.'+encodeURIComponent(SE)+'&activo=eq.true&select=id,costo,es_insumo&limit=1000'
    );
    // 1b. Gastos
    var fetchGastos=sg('gastos',
      'licencia_id=eq.'+licId
      +(fd?'&fecha=gte.'+fd:'')
      +(fh?'&fecha=lte.'+fh:'')
      +'&select=monto,categoria,concepto,concepto_id,categoria_id&limit=2000'
    );
    // 1c. IVA (opcional — no lanza error si falla)
    var fetchIva=sg('iva_liquidaciones','licencia_id=eq.'+licId
      +(fd?'&periodo=gte.'+fd.substring(0,7):'')
      +'&select=iva_pagar,iva_favor,debito_total,credito_total,periodo&limit=1'
    ).catch(function(e){ console.warn('[Balance] Error cargando IVA:', e.message); return []; });
    // 1d. Compras del período (para sumar las de insumos como gasto operativo)
    //    NO incluye anuladas: filtramos por observación más abajo
    var fetchCompras=sg('stock_comprobantes',
      'licencia_id=eq.'+licId+'&tipo=eq.compra'
      +(fd?'&fecha=gte.'+fd+'T04:00:00':'')
      +(fh?'&fecha=lte.'+addDayBal(fh)+'T03:59:59':'')
      +'&select=id,observacion&limit=2000'
    ).catch(function(e){ console.warn('[Balance] Error cargando compras:', e.message); return []; });

    var results=await Promise.all([fetchVentas,fetchPrds,fetchGastos,fetchIva,fetchCompras]);
    var ventas=results[0];
    var prds=results[1];
    var gastos=results[2];
    var ivaRows=results[3];
    var compras=results[4];

    // ── FASE 2: COMPUTAR TODOS LOS VALORES ─────────────────

    var costoMap={};
    var insumoSet={}; // producto_id → true si es insumo
    prds.forEach(function(p){
      costoMap[p.id]=parseFloat(p.costo)||0;
      if(p.es_insumo===true) insumoSet[p.id]=true;
    });

    // ── COMPRAS DE INSUMOS DEL PERÍODO ──
    // Excluimos comprobantes anulados (observación contiene [ANULADO])
    // y filtramos items cuyos producto_id correspondan a insumos.
    var totalComprasInsumos = 0;
    var cantComprasInsumos = 0; // # de comprobantes con al menos 1 insumo
    if(compras && compras.length){
      var idsValidos = compras.filter(function(c){
        return !(c.observacion && c.observacion.indexOf('[ANULADO]') >= 0);
      }).map(function(c){ return c.id; });
      if(idsValidos.length){
        try{
          var itemsCompra = await sg('stock_comprobante_items',
            'comprobante_id=in.('+idsValidos.join(',')+')'
            +'&select=comprobante_id,producto_id,cantidad,costo_unitario&limit=20000'
          );
          var compsConInsumo = {};
          itemsCompra.forEach(function(i){
            if(!insumoSet[i.producto_id]) return;
            var subt = (parseFloat(i.cantidad)||0) * (parseFloat(i.costo_unitario)||0);
            totalComprasInsumos += subt;
            compsConInsumo[i.comprobante_id] = true;
          });
          cantComprasInsumos = Object.keys(compsConInsumo).length;
        }catch(e){ console.warn('[Balance] Error sumando compras de insumos:', e.message); }
      }
    }

    var ventaBruta=0, costoVentas=0;
    ventas.forEach(function(v){
      ventaBruta+=(v.total||0);
      var items=[];
      try{ items=typeof v.items==='string'?JSON.parse(v.items):(v.items||[]); }catch(e){ console.warn('[Balance] Error parseando items:', e.message); }
      items.forEach(function(it){
        var costoUnit = it.costo != null ? parseFloat(it.costo) : (costoMap[it.id]||0);
        costoVentas += costoUnit * (parseFloat(it.qty)||1);
      });
    });
    var utilidadBruta=ventaBruta-costoVentas;
    var margenBruto=ventaBruta>0?Math.round(utilidadBruta/ventaBruta*100):0;

    var totalGastos=gastos.reduce(function(s,g){return s+(g.monto||0);},0);

    // Agrupar gastos por categoría > concepto
    var gastosXCat={};
    gastos.forEach(function(g){
      var catId=g.categoria_id||0;
      var catNom=g.categoria||'Sin categoría';
      var conId=g.concepto_id||0;
      var conNom=(_plan.cons.find(function(c){return c.id===conId;})||{nombre:g.concepto||'Sin concepto'}).nombre;
      var key=catId+'|'+catNom;
      if(!gastosXCat[key]) gastosXCat[key]={catNom:catNom,total:0,conceptos:{}};
      gastosXCat[key].total+=(g.monto||0);
      var ckey=conId+'|'+conNom;
      if(!gastosXCat[key].conceptos[ckey]) gastosXCat[key].conceptos[ckey]={nom:conNom,total:0};
      gastosXCat[key].conceptos[ckey].total+=(g.monto||0);
    });

    var utilidadNeta=utilidadBruta-totalGastos-totalComprasInsumos;
    var utilColor=utilidadNeta>=0?'var(--green)':'var(--red)';

    var ivaData=(ivaRows&&ivaRows.length)?ivaRows[0]:null;
    var ivaAPagar=ivaData?Math.round(ivaData.iva_pagar||0):null;
    var utilidadFinal=ivaAPagar!==null?utilidadNeta-ivaAPagar:utilidadNeta;
    var utilFinalColor=utilidadFinal>=0?'var(--green)':'var(--red)';

    // ── FASE 3: CONSTRUIR TODO EL HTML DE UNA VEZ ──────────

    var gastosHTML=Object.values(gastosXCat).sort(function(a,b){return b.total-a.total;}).map(function(cat){
      var consHTML=Object.values(cat.conceptos).sort(function(a,b){return b.total-a.total;}).map(function(con){
        return '<div style="display:flex;justify-content:space-between;padding:5px 16px 5px 32px;font-size:12px;border-bottom:1px solid var(--border)">'
          +'<span style="color:var(--muted)">'+con.nom+'</span>'
          +'<span style="font-weight:600;color:var(--red)">'+gs(con.total)+'</span>'
          +'</div>';
      }).join('');
      return '<div>'
        +'<div style="display:flex;justify-content:space-between;padding:8px 16px;background:var(--card2);cursor:pointer" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display===\'none\'?\'block\':\'none\'">'
          +'<span style="font-weight:700;font-size:13px">▸ '+cat.catNom+'</span>'
          +'<span style="font-weight:800;color:var(--red)">'+gs(cat.total)+'</span>'
        +'</div>'
        +'<div style="display:none">'+consHTML+'</div>'
      +'</div>';
    }).join('');

    body.innerHTML=
      // INGRESOS
      '<div class="card" style="margin-bottom:10px">'
        +'<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 18px;background:var(--g2);border-bottom:1px solid var(--border)">'
          +'<span style="font-size:14px;font-weight:800;color:var(--green)">INGRESOS</span>'
          +'<span style="font-size:18px;font-weight:800;color:var(--green)">'+gs(ventaBruta)+'</span>'
        +'</div>'
        +'<div style="display:flex;justify-content:space-between;padding:8px 18px;border-bottom:1px solid var(--border)">'
          +'<span style="color:var(--muted)">Venta bruta ('+ventas.length+' tickets)</span>'
          +'<span style="font-weight:700">'+gs(ventaBruta)+'</span>'
        +'</div>'
      +'</div>'
      // COSTO DE VENTAS
      +'<div class="card" style="margin-bottom:10px">'
        +'<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 18px;background:var(--r2);border-bottom:1px solid var(--border)">'
          +'<span style="font-size:14px;font-weight:800;color:var(--red)">COSTO DE VENTAS</span>'
          +'<span style="font-size:18px;font-weight:800;color:var(--red)">'+gs(costoVentas)+'</span>'
        +'</div>'
        +'<div style="display:flex;justify-content:space-between;padding:8px 18px">'
          +'<span style="color:var(--muted)">Costo mercadería vendida (costo actual de productos)</span>'
          +'<span style="font-weight:700">'+gs(costoVentas)+'</span>'
        +'</div>'
      +'</div>'
      // UTILIDAD BRUTA
      +'<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 20px;background:var(--card);border:1px solid var(--border);border-radius:10px;margin-bottom:10px">'
        +'<span style="font-size:14px;font-weight:800">UTILIDAD BRUTA</span>'
        +'<div style="text-align:right">'
          +'<div style="font-size:20px;font-weight:800;color:'+(utilidadBruta>=0?'var(--green)':'var(--red)')+'">'+gs(utilidadBruta)+'</div>'
          +'<div style="font-size:12px;color:var(--muted)">Margen: '+margenBruto+'%</div>'
        +'</div>'
      +'</div>'
      // GASTOS
      +'<div class="card" style="margin-bottom:10px">'
        +'<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 18px;background:var(--o2);border-bottom:1px solid var(--border)">'
          +'<span style="font-size:14px;font-weight:800;color:var(--orange)">GASTOS</span>'
          +'<span style="font-size:18px;font-weight:800;color:var(--orange)">'+gs(totalGastos)+'</span>'
        +'</div>'
        +(gastosHTML||'<div style="padding:16px 18px;color:var(--muted);font-size:13px">Sin gastos registrados en el período</div>')
      +'</div>'
      // COMPRAS DE INSUMOS
      +'<div class="card" style="margin-bottom:10px">'
        +'<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 18px;background:var(--o2);border-bottom:1px solid var(--border)">'
          +'<span style="font-size:14px;font-weight:800;color:var(--orange)">COMPRAS DE INSUMOS</span>'
          +'<span style="font-size:18px;font-weight:800;color:var(--orange)">'+gs(totalComprasInsumos)+'</span>'
        +'</div>'
        +'<div style="display:flex;justify-content:space-between;padding:10px 18px">'
          +'<span style="color:var(--muted)">'
            +(cantComprasInsumos
              ?cantComprasInsumos+' compras con insumos en el período'
              :'Sin compras de insumos en el período')
            +' — <button onclick="goTo(&apos;compras&apos;)" style="background:none;border:none;color:var(--blue);cursor:pointer;font-size:12px;text-decoration:underline;font-family:Barlow,sans-serif">Ver detalle</button>'
          +'</span>'
          +'<span style="font-weight:700">'+gs(totalComprasInsumos)+'</span>'
        +'</div>'
      +'</div>'
      // RESULTADO NETO (utilidad antes de IVA)
      +'<div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;background:'+utilColor+';border-radius:12px;margin-top:4px">'
        +'<span style="font-size:16px;font-weight:800;color:#fff">'+(utilidadNeta>=0?'UTILIDAD ANTES DE IVA':'PÉRDIDA ANTES DE IVA')+'</span>'
        +'<span style="font-size:24px;font-weight:800;color:#fff">'+gs(Math.abs(utilidadNeta))+'</span>'
      +'</div>'
      // IVA
      +(ivaAPagar!==null
        ?'<div style="display:flex;justify-content:space-between;align-items:center;padding:13px 20px;background:var(--r2);border:1px solid var(--red);border-radius:10px;margin-top:8px">'
          +'<div><div style="font-size:13px;font-weight:800;color:var(--red)">IVA A PAGAR (estimado)</div>'
          +'<div style="font-size:11px;color:var(--muted);margin-top:2px">Según liquidación '+ivaData.periodo+' — <button onclick="goTo(&apos;iva&apos;)" style="background:none;border:none;color:var(--blue);cursor:pointer;font-size:11px;text-decoration:underline;font-family:Barlow,sans-serif">Ver detalle</button></div></div>'
          +'<span style="font-size:20px;font-weight:800;color:var(--red)">−'+gs(ivaAPagar)+'</span>'
        +'</div>'
        :'<div style="padding:10px 16px;font-size:12px;color:var(--muted);background:var(--card2);border-radius:8px;margin-top:8px">'
          +'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.74V17h8v-2.26A7 7 0 0 0 12 2z"/></svg> <button onclick="goTo(&apos;iva&apos;)" style="background:none;border:none;color:var(--blue);cursor:pointer;font-size:12px;text-decoration:underline;font-family:Barlow,sans-serif">Calculá la liquidación de IVA</button> para ver el resultado neto real.'
        +'</div>'
      )
      // UTILIDAD FINAL (después de IVA)
      +(ivaAPagar!==null
        ?'<div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;background:'+utilFinalColor+';border-radius:12px;margin-top:8px">'
          +'<div><div style="font-size:16px;font-weight:800;color:#fff">'+(utilidadFinal>=0?'UTILIDAD NETA':'PÉRDIDA NETA')+'</div>'
          +'<div style="font-size:12px;color:rgba(255,255,255,.7);margin-top:2px">Después de IVA estimado</div></div>'
          +'<span style="font-size:24px;font-weight:800;color:#fff">'+gs(Math.abs(utilidadFinal))+'</span>'
        +'</div>'
        :'')
      ;

    // ── GRÁFICOS ──────────────────────────────────────────
    // Calcular datos históricos por mes para el gráfico de tendencia
    var grafDiv='<div class="card" style="margin-top:14px;margin-bottom:10px">'
      +'<div class="card-h"><span class="card-t">Ventas vs Ventas − Gastos por mes</span></div>'
      +'<div style="padding:16px 18px"><canvas id="balGraf1" height="90"></canvas></div>'
    +'</div>'
    +'<div class="card" style="margin-bottom:10px">'
      +'<div class="card-h"><span class="card-t">Composición de costos sobre ventas</span></div>'
      +'<div style="padding:16px 18px;display:flex;align-items:center;gap:24px;flex-wrap:wrap">'
        +'<canvas id="balGraf2" width="200" height="200" style="max-width:200px"></canvas>'
        +'<div id="balGraf2Leyenda" style="flex:1;min-width:160px"></div>'
      +'</div>'
    +'</div>';
    body.innerHTML+=grafDiv;

    // Esperar al siguiente frame para que el canvas esté en el DOM
    await new Promise(function(r){setTimeout(r,50);});
    balDibujarTendencia(fd,fh,ventaBruta,utilidadFinal!==null?utilidadFinal:utilidadNeta,licId);
    balDibujarComposicion(ventaBruta,costoVentas,totalGastos,ivaAPagar||0,totalComprasInsumos);

  }catch(e){
    body.innerHTML='<div style="padding:24px;color:var(--red)">Error: '+e.message+'</div>';
  }
}

async function balDibujarTendencia(fd,fh,ventaActual,utilActual,licId){
  var canvas=document.getElementById('balGraf1');
  if(!canvas) return;
  // Paraguay UTC-4: inicio mes T04:00:00, fin mes +1día T03:59:59
  var addDayTrend=function(ds){var p=ds.split('-');var d=new Date(+p[0],+p[1]-1,+p[2]+1);return d.getFullYear()+'-'+(d.getMonth()+1<10?'0':'')+(d.getMonth()+1)+'-'+(d.getDate()<10?'0':'')+d.getDate();};
  // Construir 6 meses hacia atrás desde fd
  var meses=[];
  var dRef=fd?new Date(fd):new Date();
  for(var i=5;i>=0;i--){
    var m=new Date(dRef.getFullYear(),dRef.getMonth()-i,1);
    meses.push({año:m.getFullYear(),mes:m.getMonth()+1});
  }
  // Para cada mes cargar ventas
  var puntos=[];
  await Promise.all(meses.map(async function(m){
    var mStr=m.año+'-'+pad(m.mes);
    var ultimoDia=new Date(m.año,m.mes,0).getDate();
    try{
      var v=await sg('pos_ventas',
        'licencia_email=ilike.'+encodeURIComponent(SE)
        +'&anulada=is.false'
        +'&fecha=gte.'+mStr+'-01T04:00:00'
        +'&fecha=lte.'+addDayTrend(mStr+'-'+ultimoDia)+'T03:59:59'
        +'&select=total&limit=5000'
      );
      var venta=v.reduce(function(s,x){return s+(x.total||0);},0);
      var g=await sg('gastos','licencia_id=eq.'+licId+'&fecha=gte.'+mStr+'-01&fecha=lte.'+mStr+'-'+ultimoDia+'&select=monto&limit=500');
      var gasto=g.reduce(function(s,x){return s+(x.monto||0);},0);
      puntos.push({label:mStr,venta:venta,util:venta-gasto}); // ventas menos gastos (sin costo mercadería histórico)
    }catch(e){ puntos.push({label:mStr,venta:0,util:0}); }
  }));
  puntos.sort(function(a,b){return a.label.localeCompare(b.label);});

  var W=canvas.offsetWidth||canvas.parentElement.offsetWidth||560;
  canvas.width=W; canvas.height=180;
  var ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,W,180);

  var vals=puntos.map(function(p){return Math.max(p.venta,Math.abs(p.util));});
  var maxV=Math.max.apply(null,vals)||1;
  var n=puntos.length;
  var PAD={t:16,b:28,l:12,r:12};
  var gW=W-PAD.l-PAD.r;
  var gH=180-PAD.t-PAD.b;
  var bW=Math.floor(gW/n*0.35);
  var gap=gW/n;

  // Grid
  ctx.strokeStyle='rgba(255,255,255,0.06)'; ctx.lineWidth=1;
  for(var gi=0;gi<=4;gi++){
    var yg=PAD.t+gH-(gH/4*gi);
    ctx.beginPath(); ctx.moveTo(PAD.l,yg); ctx.lineTo(PAD.l+gW,yg); ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.font='9px Barlow,sans-serif'; ctx.textAlign='right';
    var lv=Math.round(maxV/4*gi);
    ctx.fillText(lv>=1000000?Math.round(lv/1000000)+'M':lv>=1000?Math.round(lv/1000)+'K':lv, PAD.l+gW+10, yg+3);
  }

  puntos.forEach(function(p,i){
    var x=PAD.l+i*gap+gap/2;
    var hV=Math.max(2,(p.venta/maxV)*gH);
    var hU=p.util>=0?Math.max(2,(p.util/maxV)*gH):Math.max(2,(Math.abs(p.util)/maxV)*gH);
    // Barra ventas
    ctx.fillStyle='rgba(76,175,80,0.7)';
    ctx.beginPath(); ctx.roundRect(x-bW-2,PAD.t+gH-hV,bW,hV,2); ctx.fill();
    // Barra utilidad
    ctx.fillStyle=p.util>=0?'rgba(66,165,245,0.8)':'rgba(239,83,80,0.8)';
    ctx.beginPath(); ctx.roundRect(x+2,PAD.t+gH-hU,bW,hU,2); ctx.fill();
    // Label mes
    ctx.fillStyle='rgba(255,255,255,0.45)'; ctx.font='9px Barlow,sans-serif'; ctx.textAlign='center';
    var lbl=p.label.substring(5); // MM
    ctx.fillText(lbl,x,180-PAD.b+12);
  });

  // Leyenda
  ctx.fillStyle='rgba(76,175,80,0.8)'; ctx.fillRect(PAD.l,8,12,8);
  ctx.fillStyle='rgba(255,255,255,0.5)'; ctx.font='10px Barlow,sans-serif'; ctx.textAlign='left';
  ctx.fillText('Ventas',PAD.l+16,16);
  ctx.fillStyle='rgba(66,165,245,0.8)'; ctx.fillRect(PAD.l+70,8,12,8);
  ctx.fillStyle='rgba(255,255,255,0.5)';
  ctx.fillText('Ventas − Gastos',PAD.l+86,16);
}

function balDibujarComposicion(venta,costo,gastos,iva,comprasIns){
  var canvas=document.getElementById('balGraf2');
  var leyenda=document.getElementById('balGraf2Leyenda');
  if(!canvas||!venta) return;
  comprasIns = comprasIns || 0;
  var util=Math.max(0,venta-costo-gastos-iva-comprasIns);
  var segmentos=[
    {label:'Costo de ventas',     valor:costo,      color:'#ef5350'},
    {label:'Compras de insumos',  valor:comprasIns, color:'#ffb74d'},
    {label:'Gastos',              valor:gastos,     color:'#ff9800'},
    {label:'IVA estimado',        valor:iva,        color:'#9c27b0'},
    {label:'Utilidad neta',       valor:util,       color:'#4caf50'},
  ].filter(function(s){return s.valor>0;});

  var ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,200,200);
  var total=segmentos.reduce(function(s,x){return s+x.valor;},0)||1;
  var cx=100,cy=100,r=85,ri=52,start=-Math.PI/2;

  segmentos.forEach(function(s){
    var angle=(s.valor/total)*Math.PI*2;
    ctx.beginPath();
    ctx.moveTo(cx,cy);
    ctx.arc(cx,cy,r,start,start+angle);
    ctx.closePath();
    ctx.fillStyle=s.color;
    ctx.fill();
    start+=angle;
  });
  // Hueco central
  ctx.beginPath(); ctx.arc(cx,cy,ri,0,Math.PI*2);
  ctx.fillStyle='var(--card)'; ctx.fill();
  // Texto central
  ctx.fillStyle='rgba(255,255,255,0.6)'; ctx.font='bold 11px Barlow,sans-serif'; ctx.textAlign='center';
  ctx.fillText('sobre',cx,cy-4); ctx.fillText('ventas',cx,cy+10);

  // Leyenda
  if(leyenda){
    leyenda.innerHTML=segmentos.map(function(s){
      var pct=Math.round(s.valor/venta*100);
      return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">'
        +'<div style="width:12px;height:12px;border-radius:3px;background:'+s.color+';flex-shrink:0"></div>'
        +'<div style="flex:1"><div style="font-size:12px;font-weight:600">'+s.label+'</div>'
          +'<div style="font-size:11px;color:var(--muted)">'+pct+'% de ventas</div></div>'
        +'<div style="font-size:13px;font-weight:800">'+pct+'%</div>'
      +'</div>';
    }).join('');
  }
}


// ═══════════════════════════════════════════════════════════
// LIQUIDACIÓN DE IVA — PARAGUAY
// ═══════════════════════════════════════════════════════════
// Reglas IVA Paraguay:
//   IVA 10%: débito = precio_venta / 11     crédito = precio_compra / 11
//   IVA  5%: débito = precio_venta / 21     crédito = precio_compra / 21
//   Exento:  sin IVA
//   IVA a pagar = Débito Total - Crédito Total (si positivo)

var _iva = { licId: null, prodMap: {} };

async function ivaGetLicId(){
  if(_iva.licId) return _iva.licId;
  if(SLI){ _iva.licId=SLI; return SLI; }
  var r=await sg('licencias','email_cliente=ilike.'+encodeURIComponent(SE)+'&activa=eq.true&select=id&limit=1');
  if(r&&r.length){ _iva.licId=r[0].id; return r[0].id; }
  throw new Error('No se encontró licencia');
}

async function renderIVA(){
  var c=document.getElementById('content');
  c.innerHTML='<div class="loading"><span class="sp"></span>Cargando...</div>';
  // BUG-05 fix: ivaGetLicId() lanza throw cuando no encuentra licencia; sin
  // este try/catch el render quedaba con spinner infinito.
  var licId;
  try {
    licId = await ivaGetLicId();
  } catch(e){
    console.warn('[IVA] Error obteniendo licencia:', e.message);
    c.innerHTML='<div style="padding:24px;color:var(--muted);text-align:center">'
      +'<div style="font-size:14px;margin-bottom:8px">No pudimos cargar tu licencia.</div>'
      +'<div style="font-size:12px;color:var(--muted);margin-bottom:14px">Esperá unos segundos y reintentá.</div>'
      +'<button onclick="renderIVA()" class="btn-sv" style="padding:8px 18px">Reintentar</button>'
      +'</div>';
    return;
  }

  // Cargar mapa de IVA por producto
  try{
    var prds=await sg('pos_productos',
      'licencia_email=ilike.'+encodeURIComponent(SE)+'&activo=eq.true&select=id,iva&limit=1000'
    );
    _iva.prodMap={};
    prds.forEach(function(p){ _iva.prodMap[p.id]=p.iva||'10'; });
  }catch(e){ console.warn('[IVA] Error cargando productos:', e.message); _iva.prodMap={}; }

  // Período default: mes actual
  var hoy=new Date();
  var periodoVal=hoy.getFullYear()+'-'+pad(hoy.getMonth()+1);

  // Historial de liquidaciones
  var historial=[];
  try{ historial=await sg('iva_liquidaciones','licencia_id=eq.'+licId+'&order=periodo.desc&limit=24'); }catch(e){ console.warn('[IVA] Error cargando historial:', e.message); }

  c.innerHTML=
    '<div class="ph"><div><div class="pt">Liquidación de IVA</div>'
      +'<div class="ps">Débito fiscal − Crédito fiscal = IVA a pagar (Paraguay)</div></div></div>'
    // Selector de período
    +'<div class="card" style="margin-bottom:12px">'
      +'<div style="padding:16px 18px;display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">'
        +'<div><label style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:5px">Período (mes)</label>'
          +'<input type="month" id="ivaPeriodo" class="cfg-inp" value="'+periodoVal+'"></div>'
        +'<button onclick="ivaCalcular()" class="btn-sv" style="padding:10px 22px;font-size:14px">Calcular IVA</button>'
        +(historial.length?'<div style="margin-left:auto;font-size:12px;color:var(--muted)">Períodos anteriores: '
          +historial.slice(0,6).map(function(h){
            return '<button onclick="ivaCargarPeriodo(\''+h.periodo+'\')" style="background:var(--card2);border:1px solid var(--border);border-radius:5px;color:var(--text2);font-family:Barlow,sans-serif;font-size:11px;font-weight:600;padding:3px 8px;cursor:pointer;margin-left:4px">'
              +h.periodo+(h.estado==='cerrado'?' <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><polyline points="20 6 9 17 4 12"/></svg>':'')+'</button>';
          }).join('')+'</div>':'')
      +'</div>'
    +'</div>'
    +'<div id="ivaBody"></div>';

  // Si hay un período guardado para este mes mostrarlo; si no, calcular automáticamente
  var periodoActual=periodoVal;
  var liquidActual=historial.find(function(h){return h.periodo===periodoActual;});
  if(liquidActual){
    ivaRenderResultado(liquidActual);
  } else {
    await ivaCalcular();
  }
}

async function ivaCalcular(){
  var periodo=document.getElementById('ivaPeriodo').value;
  if(!periodo){ toast('Seleccioná un período'); return; }
  var licId=await ivaGetLicId();
  var body=document.getElementById('ivaBody');
  body.innerHTML='<div class="loading"><span class="sp"></span>Calculando IVA del período '+periodo+'...</div>';

  // Paraguay UTC-4: mes empieza T04:00:00 del día 1, termina T03:59:59 del día 1 del mes siguiente
  var partes=periodo.split('-');
  var ultimoDia=new Date(parseInt(partes[0]),parseInt(partes[1]),0).getDate();
  var addDayIva=function(ds){var p=ds.split('-');var d=new Date(+p[0],+p[1]-1,+p[2]+1);return d.getFullYear()+'-'+(d.getMonth()+1<10?'0':'')+(d.getMonth()+1)+'-'+(d.getDate()<10?'0':'')+d.getDate();};
  var fd=periodo+'-01T04:00:00';
  var fh=addDayIva(periodo+'-'+pad(ultimoDia))+'T03:59:59';

  try{
    // ── DÉBITO FISCAL (desde pos_ventas) — excluye anuladas
    var ventas=await sg('pos_ventas',
      'licencia_email=ilike.'+encodeURIComponent(SE)
      +'&anulada=is.false'
      +'&fecha=gte.'+fd+'&fecha=lte.'+fh
      +'&select=items,total,tiene_factura&limit=5000'
    );

    var venta10=0, venta5=0, ventaExenta=0;
    ventas.forEach(function(v){
      var items=[];
      try{ items=typeof v.items==='string'?JSON.parse(v.items):(v.items||[]); }catch(e){ console.warn('[IVA] Error parseando items:', e.message); }
      items.forEach(function(it){
        var qty=parseFloat(it.qty)||1;
        var precio=parseFloat(it.precio||it.price)||0;
        var total=precio*qty;
        var ivaRate=it.iva||_iva.prodMap[it.id]||'10';
        if(ivaRate==='exento'||ivaRate==='0') ventaExenta+=total;
        else if(ivaRate==='5') venta5+=total;
        else venta10+=total; // default 10%
      });
    });
    // Si no hay items detallados, usar el total de la venta como 10%
    if(venta10===0&&venta5===0&&ventaExenta===0){
      ventas.forEach(function(v){ venta10+=(v.total||0); });
    }

    var debito10=Math.round(venta10/11);
    var debito5 =Math.round(venta5/21);
    var debitoTotal=debito10+debito5;

    // ── CRÉDITO FISCAL COMPRAS ────────────────────────────────
    // Tomar compras con tiene_factura=true O todas las compras
    // (Paraguay: cualquier factura de compra genera crédito)
    var compras=await sg('stock_comprobantes',
      'licencia_id=eq.'+licId
      +'&tipo=eq.compra'
      +'&fecha=gte.'+fd+'&fecha=lte.'+fh
      +'&select=id,total_monto,tiene_factura&limit=1000'
    );
    // Cargar items de compras para determinar IVA por producto
    var compIds=compras.map(function(c){return c.id;});
    var compra10=0, compra5=0;
    if(compIds.length){
      var compItems=await sg('stock_comprobante_items',
        'comprobante_id=in.('+compIds.join(',')+')'
        +'&select=producto_id,cantidad,costo_unitario&limit=5000'
      );
      compItems.forEach(function(i){
        var cant=Math.abs(parseFloat(i.cantidad)||0);
        var costo=parseFloat(i.costo_unitario)||0;
        var total=cant*costo;
        var ivaRate=_iva.prodMap[i.producto_id]||'10';
        if(ivaRate==='5') compra5+=total;
        else if(ivaRate!=='exento'&&ivaRate!=='0') compra10+=total;
      });
    }
    var creditoCompras10=Math.round(compra10/11);
    var creditoCompras5 =Math.round(compra5/21);
    var creditoCompras  =creditoCompras10+creditoCompras5;

    // ── CRÉDITO FISCAL GASTOS ─────────────────────────────────
    var gastosConFact=await sg('gastos',
      'licencia_id=eq.'+licId
      +'&fecha=gte.'+periodo+'-01'
      +'&fecha=lte.'+periodo+'-'+ultimoDia
      +'&tiene_factura=eq.true'
      +'&select=monto,categoria&limit=500'
    );
    // Gastos generales se asume IVA 10% (servicios, alquiler, etc.)
    var gasto10=gastosConFact.reduce(function(s,g){return s+(g.monto||0);},0);
    var creditoGastos10=Math.round(gasto10/11);
    var creditoGastosTotal=creditoGastos10;

    var creditoTotal=creditoCompras+creditoGastosTotal;
    var saldo=debitoTotal-creditoTotal;
    var ivaPagar=Math.max(0,saldo);
    var ivaFavor=Math.max(0,-saldo);

    var data={
      periodo:periodo, licencia_id:licId,
      venta_10:Math.round(venta10), venta_5:Math.round(venta5), venta_exenta:Math.round(ventaExenta),
      debito_10:debito10, debito_5:debito5, debito_total:debitoTotal,
      compra_10:Math.round(compra10), compra_5:Math.round(compra5),
      credito_compras:creditoCompras,
      gasto_10:Math.round(gasto10), gasto_5:0,
      credito_gastos:creditoGastosTotal,
      credito_total:creditoTotal,
      iva_pagar:ivaPagar, iva_favor:ivaFavor,
      estado:'borrador', usuario:SE,
      updated_at:new Date().toISOString()
    };

    // Guardar/actualizar en DB
    try{
      var existe=await sg('iva_liquidaciones','licencia_id=eq.'+licId+'&periodo=eq.'+periodo+'&select=id');
      if(existe&&existe.length){
        await supaPatch('iva_liquidaciones','id=eq.'+existe[0].id,data);
        data.id=existe[0].id;
      } else {
        var r=await supaPost('iva_liquidaciones',data,null);
        data.id=Array.isArray(r)?r[0].id:r.id;
      }
    }catch(e){ toast('Error al guardar liquidación IVA'); console.warn('[IVA] save error:', e.message); }

    ivaRenderResultado(data);

  }catch(e){
    body.innerHTML='<div style="padding:24px;color:var(--red)">Error: '+e.message+'</div>';
  }
}

async function ivaCargarPeriodo(periodo){
  document.getElementById('ivaPeriodo').value=periodo;
  await ivaCalcular();
}

function ivaRenderResultado(d){
  var body=document.getElementById('ivaBody');
  if(!body) return;

  var saldoColor=d.iva_pagar>0?'var(--red)':'var(--green)';
  var saldoLabel=d.iva_pagar>0?'IVA A PAGAR':'SALDO A FAVOR';
  var saldoVal=d.iva_pagar>0?d.iva_pagar:d.iva_favor;

  body.innerHTML=
    // ESTADO y PERÍODO
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px">'
      +'<div style="font-size:15px;font-weight:700">Período: <span style="color:var(--green)">'+d.periodo+'</span>'
        +'&nbsp; <span class="tag '+(d.estado==='cerrado'?'tag-g':'tag-o')+'">'+d.estado.toUpperCase()+'</span></div>'
      +(d.estado!=='cerrado'?'<button onclick="ivaCerrar(\''+d.id+'\')" style="background:var(--g2);border:1px solid var(--green);border-radius:8px;color:var(--green);font-family:Barlow,sans-serif;font-size:12px;font-weight:700;padding:8px 16px;cursor:pointer"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><polyline points="20 6 9 17 4 12"/></svg> Cerrar período</button>':'')
    +'</div>'

    // ── DÉBITO FISCAL ──
    +'<div class="card" style="margin-bottom:10px">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 18px;background:rgba(76,175,80,.1);border-bottom:1px solid var(--border)">'
        +'<span style="font-size:14px;font-weight:800;color:var(--green)">DÉBITO FISCAL (Ventas)</span>'
        +'<span style="font-size:18px;font-weight:800;color:var(--green)">'+gs(d.debito_total)+'</span>'
      +'</div>'
      +'<div style="padding:4px 0">'
        +ivaFila('Ventas gravadas 10% — Base imponible', gs(d.venta_10), '')
        +ivaFila('IVA incluido (÷11)', '', gs(d.debito_10), 'var(--green)')
        +ivaFila('Ventas gravadas 5% — Base imponible', gs(d.venta_5), '')
        +ivaFila('IVA incluido (÷21)', '', gs(d.debito_5), 'var(--green)')
        +ivaFila('Ventas exentas', gs(d.venta_exenta), 'sin IVA', 'var(--muted)')
      +'</div>'
    +'</div>'

    // ── CRÉDITO FISCAL ──
    +'<div class="card" style="margin-bottom:10px">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 18px;background:rgba(66,165,245,.1);border-bottom:1px solid var(--border)">'
        +'<span style="font-size:14px;font-weight:800;color:var(--blue)">CRÉDITO FISCAL (Compras + Gastos)</span>'
        +'<span style="font-size:18px;font-weight:800;color:var(--blue)">'+gs(d.credito_total)+'</span>'
      +'</div>'
      +'<div style="padding:4px 0">'
        +'<div style="padding:6px 18px;font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px;background:var(--card2)">Compras de mercadería</div>'
        +ivaFila('Base imponible compras 10%', gs(d.compra_10), '')
        +ivaFila('Crédito IVA compras 10% (÷11)', '', gs(d.credito_compras - Math.round(d.compra_5/21)), 'var(--blue)')
        +(d.compra_5>0?ivaFila('Base imponible compras 5%', gs(d.compra_5), ''):'')
        +(d.compra_5>0?ivaFila('Crédito IVA compras 5% (÷21)', '', gs(Math.round(d.compra_5/21)), 'var(--blue)'):'')
        +'<div style="padding:6px 18px;font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px;background:var(--card2)">Gastos con factura</div>'
        +ivaFila('Base imponible gastos (10%)', gs(d.gasto_10), '')
        +ivaFila('Crédito IVA gastos (÷11)', '', gs(d.credito_gastos), 'var(--blue)')
        +(d.gasto_10===0?'<div style="padding:8px 18px;font-size:12px;color:var(--muted);font-style:italic">Sin gastos con factura — marcá "Tiene factura" al registrar gastos</div>':'')
      +'</div>'
    +'</div>'

    // ── RESULTADO ──
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">'
      +'<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:16px 18px">'
        +'<div style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">Débito fiscal</div>'
        +'<div style="font-size:22px;font-weight:800;color:var(--green)">'+gs(d.debito_total)+'</div>'
      +'</div>'
      +'<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:16px 18px">'
        +'<div style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">Crédito fiscal</div>'
        +'<div style="font-size:22px;font-weight:800;color:var(--blue)">'+gs(d.credito_total)+'</div>'
      +'</div>'
    +'</div>'
    +'<div style="display:flex;justify-content:space-between;align-items:center;padding:18px 22px;background:'+saldoColor+';border-radius:12px;margin-bottom:14px">'
      +'<div>'
        +'<div style="font-size:16px;font-weight:800;color:#fff">'+saldoLabel+'</div>'
        +'<div style="font-size:12px;color:rgba(255,255,255,.75);margin-top:2px">Débito '+gs(d.debito_total)+' − Crédito '+gs(d.credito_total)+'</div>'
      +'</div>'
      +'<span style="font-size:28px;font-weight:800;color:#fff">'+gs(saldoVal)+'</span>'
    +'</div>'

    // NOTAS
    +'<div style="background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:12px 16px;font-size:12px;color:var(--muted)">'
      +'<strong style="color:var(--text)">Importante:</strong> Este cálculo es una estimación. '
      +'El crédito de gastos solo incluye los gastos marcados como "Tiene factura". '
      +'Verificá con tu contador antes de presentar la declaración.'
    +'</div>';
}

function ivaFila(label, valor1, valor2, color2){
  return '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 18px;border-bottom:1px solid var(--border);font-size:13px">'
    +'<span style="color:var(--muted)">'+label+'</span>'
    +'<div style="display:flex;gap:24px;text-align:right">'
      +(valor1?'<span style="color:var(--text2)">'+valor1+'</span>':'<span></span>')
      +'<span style="font-weight:700;min-width:80px;'+(color2?'color:'+color2:'')+'">'+valor2+'</span>'
    +'</div>'
  +'</div>';
}

async function ivaCerrar(id){
  if(!confirm('¿Cerrar el período? Una vez cerrado no se recalcula automáticamente.')) return;
  try{
    await supaPatch('iva_liquidaciones','id=eq.'+id,{estado:'cerrado',updated_at:new Date().toISOString()});
    toast('Período cerrado');
    await ivaCalcular();
  }catch(e){ toast('Error: '+e.message); }
}

// ════════════════════════════════════════════════════════
// PDF EXPORT — abre ventana de impresión con formato limpio
// ════════════════════════════════════════════════════════
function repExportPDF(opts){
  var win = window.open('','_blank');
  if(!win){ toast('Habilitá popups para exportar PDF'); return; }
  var sc = opts.statCards||[];
  var hds = opts.headers||[];
  var now = new Date().toLocaleDateString('es-PY',{day:'2-digit',month:'long',year:'numeric'});
  var css =
    '*{box-sizing:border-box;margin:0;padding:0}'+
    'body{font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;background:#fff;font-size:13px}'+
    '.page{max-width:800px;margin:0 auto;padding:36px 32px}'+
    '.hd{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:16px;margin-bottom:24px;border-bottom:3px solid #0d47a1}'+
    '.hd-l h1{font-size:20px;font-weight:900;color:#0d47a1;margin-bottom:5px}'+
    '.hd-l p{font-size:11px;color:#666;margin-bottom:2px}'+
    '.hd-r{text-align:right}'+
    '.hd-r p{font-size:11px;color:#777;margin-bottom:8px}'+
    '.pbtn{background:#0d47a1;color:#fff;border:none;padding:7px 16px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:700;letter-spacing:.3px}'+
    '.stats{display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap}'+
    '.stat{flex:1;min-width:130px;background:#edf2ff;border-radius:8px;padding:12px 16px;border-left:4px solid #0d47a1}'+
    '.stat.red{border-left-color:#c62828;background:#fff0f0}'+
    '.stat .lbl{font-size:9px;text-transform:uppercase;letter-spacing:.7px;color:#666;font-weight:700;margin-bottom:5px}'+
    '.stat .val{font-size:20px;font-weight:900;color:#0d47a1}'+
    '.stat.red .val{color:#c62828}'+
    'table{width:100%;border-collapse:collapse;margin-bottom:24px}'+
    'th{background:#0d47a1;color:#fff;padding:8px 11px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px;font-weight:700}'+
    'th.r{text-align:right}'+
    'td{padding:8px 11px;border-bottom:1px solid #e5eaf2;font-size:12px}'+
    'td.r{text-align:right;font-weight:700}'+
    'tr:nth-child(even) td{background:#f7f9fc}'+
    '.ft{margin-top:4px;padding-top:12px;border-top:1px solid #ddd;text-align:center;font-size:10px;color:#aaa}'+
    '@media print{.np{display:none}@page{margin:12mm}}';
  var html =
    '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">'+
    '<title>'+opts.titulo+'</title><style>'+css+'</style></head><body>'+
    '<div class="page">'+
    '<div class="hd">'+
      '<div class="hd-l"><h1>'+opts.titulo+'</h1>'+
        '<p>Período: <strong>'+opts.periodo+'</strong></p>'+
        '<p>'+opts.empresa+'</p>'+
      '</div>'+
      '<div class="hd-r"><p>'+now+'</p>'+
        '<button class="pbtn np" onclick="window.print()">↓ Guardar PDF</button>'+
      '</div>'+
    '</div>'+
    '<div class="stats">'+
      sc.map(function(s){
        return '<div class="stat'+(s.red?' red':'')+'"><div class="lbl">'+s.lbl+'</div><div class="val">'+s.val+'</div></div>';
      }).join('')+
    '</div>'+
    '<table><thead><tr>'+
      hds.map(function(h){ return '<th'+(h.r?' class="r"':'')+'>'+h.t+'</th>'; }).join('')+
    '</tr></thead><tbody>'+opts.rows+'</tbody></table>'+
    '<div class="ft">Sistema POS NODO &middot; '+new Date().getFullYear()+'</div>'+
    '</div></body></html>';
  win.document.write(html);
  win.document.close();
  setTimeout(function(){ win.print(); }, 500);
}

// ════════════════════════════════════════════════════════
// REPORTE: VENTAS POR PRODUCTO
// ════════════════════════════════════════════════════════

async function renderRepProductos(fdKey){
  fdKey = fdKey || 'mes';
  var c = document.getElementById('content');
  var fd = getFD(fdKey);
  var isCustom = fdKey.startsWith('custom_');
  var p2 = function(n){ return String(n).padStart(2,'0'); };
  var addDay = function(ds){ var p=ds.split('-'),d=new Date(+p[0],+p[1]-1,+p[2]+1);return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate()); };
  var fd0 = fd.d.slice(0,10), fh0 = fd.h.slice(0,10);
  var customPts = isCustom ? fdKey.slice(7).split('_') : [];
  var rangoLabel = getFDLabel(fdKey);
  var icoPDF = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>';

  c.innerHTML =
    '<div class="ph" style="margin-bottom:14px;flex-wrap:wrap;gap:10px">'+
      '<div>'+
        '<div class="pt">Ventas por Producto</div>'+
        '<div class="ps" style="color:var(--muted);">'+rangoLabel+'</div>'+
      '</div>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">'+
        '<div style="display:inline-flex;background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:2px;gap:1px;">'+
          '<button class="atab'+(fdKey==='hoy'?' on':'')+'" onclick="renderRepProductos(\'hoy\')">Hoy</button>'+
          '<button class="atab'+(fdKey==='semana'?' on':'')+'" onclick="renderRepProductos(\'semana\')">Semana</button>'+
          '<button class="atab'+(fdKey==='mes'?' on':'')+'" onclick="renderRepProductos(\'mes\')">Mes</button>'+
          '<button class="atab'+(fdKey==='30d'?' on':'')+'" onclick="renderRepProductos(\'30d\')">30 días</button>'+
        '</div>'+
        '<div style="display:flex;gap:4px;align-items:center;background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:3px 8px;">'+
          '<input type="date" id="rpPD" value="'+(customPts[0]||fd0)+'" class="d-inp" style="font-size:12px;padding:3px 5px;min-width:126px;border:none;background:transparent;">'+
          '<span style="color:var(--muted);font-size:11px;padding:0 2px;">–</span>'+
          '<input type="date" id="rpPH" value="'+(customPts[1]||fh0)+'" class="d-inp" style="font-size:12px;padding:3px 5px;min-width:126px;border:none;background:transparent;">'+
          '<button class="atab'+(isCustom?' on':'')+'" style="white-space:nowrap;margin-left:2px;padding:6px 12px;" onclick="(function(){var d=document.getElementById(\'rpPD\').value,h=document.getElementById(\'rpPH\').value;if(!d||!h){toast(\'Seleccioná ambas fechas\');return;}if(d>h){toast(\'La fecha inicial debe ser menor\');return;}renderRepProductos(\'custom_\'+d+\'_\'+h);})()">Aplicar</button>'+
        '</div>'+
        '<button id="repProdPdfBtn" style="display:flex;gap:5px;align-items:center;background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:6px 12px;cursor:pointer;font-size:12px;color:var(--text);font-family:Barlow,sans-serif;font-weight:700;">'+icoPDF+' PDF</button>'+
      '</div>'+
    '</div>'+
    '<div id="repProdWrap"><div class="loading"><span class="sp"></span>Cargando...</div></div>';

  var wrap = document.getElementById('repProdWrap');
  try {
    var ventas = await sg('pos_ventas',
      'licencia_email=ilike.'+encodeURIComponent(SE)+
      '&anulada=is.false'+
      '&fecha=gte.'+fd0+'T04:00:00'+
      '&fecha=lte.'+addDay(fh0)+'T03:59:59'+
      '&select=items,total&limit=5000');

    var prodsMap = {};
    var totalGeneral = 0;
    ventas.forEach(function(x){
      try {
        var items = typeof x.items==='string' ? JSON.parse(x.items) : (x.items||[]);
        if(!Array.isArray(items)) return;
        items.forEach(function(it){
          if(it.esDescuento) return;
          var nom = it.name||it.nombre||'—';
          var cat = it.cat||it.category||it.categoria||'Sin categoría';
          var qty = Number(it.qty)||1;
          var price = Number(it.price||it.precio)||0;
          var sub = price * qty;
          if(!prodsMap[nom]) prodsMap[nom] = {cat:cat, qty:0, tot:0};
          prodsMap[nom].qty += qty;
          prodsMap[nom].tot += sub;
          totalGeneral += sub;
        });
      } catch(e2){}
    });

    var entries = Object.entries(prodsMap).sort(function(a,b){ return b[1].tot-a[1].tot; });

    var pdfBtn = document.getElementById('repProdPdfBtn');
    if(pdfBtn){
      pdfBtn.onclick = function(){
        repExportPDF({
          titulo: 'Ventas por Producto',
          periodo: rangoLabel,
          empresa: SE||'',
          statCards: [
            {lbl:'Productos distintos', val:String(entries.length)},
            {lbl:'Ventas analizadas', val:String(ventas.length)},
            {lbl:'Total del período', val:gs(totalGeneral)}
          ],
          headers: [
            {t:'Producto'},{t:'Categoría'},{t:'Unid.',r:true},{t:'Total',r:true},{t:'%',r:true}
          ],
          rows: entries.map(function(e){
            var pct = totalGeneral>0 ? Math.round(e[1].tot/totalGeneral*100) : 0;
            return '<tr>'+
              '<td>'+e[0]+'</td>'+
              '<td style="color:#666;font-size:11px;">'+e[1].cat+'</td>'+
              '<td class="r">'+e[1].qty+'</td>'+
              '<td class="r">'+gs(e[1].tot)+'</td>'+
              '<td class="r" style="color:#888;font-size:11px;">'+pct+'%</td>'+
            '</tr>';
          }).join('')
        });
      };
    }

    if(!entries.length){
      wrap.innerHTML = '<div style="text-align:center;padding:48px;color:var(--muted);">Sin ventas en el período seleccionado</div>';
      return;
    }

    var maxTot = entries[0][1].tot || 1;
    var html =
      '<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;margin-bottom:14px;padding:16px 20px;display:flex;gap:32px;flex-wrap:wrap;">'+
        '<div><div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.6px;margin-bottom:4px;">Productos distintos</div>'+
          '<div style="font-size:24px;font-weight:800;color:var(--text);">'+entries.length+'</div></div>'+
        '<div><div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.6px;margin-bottom:4px;">Total del período</div>'+
          '<div style="font-size:24px;font-weight:800;color:var(--green);">'+gs(totalGeneral)+'</div></div>'+
        '<div><div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.6px;margin-bottom:4px;">Ventas analizadas</div>'+
          '<div style="font-size:24px;font-weight:800;color:var(--text);">'+ventas.length+'</div></div>'+
      '</div>'+
      '<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;overflow:hidden;">'+
      '<table style="width:100%;border-collapse:collapse;font-size:13px;">'+
      '<thead><tr style="background:var(--card2);">'+
        '<th style="padding:10px 14px;text-align:left;color:var(--muted);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Producto</th>'+
        '<th style="padding:10px 14px;text-align:left;color:var(--muted);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Categoría</th>'+
        '<th style="padding:10px 14px;text-align:right;color:var(--muted);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Unid.</th>'+
        '<th style="padding:10px 14px;text-align:right;color:var(--muted);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Total</th>'+
        '<th style="padding:10px 14px;text-align:right;color:var(--muted);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">%</th>'+
      '</tr></thead><tbody>'+
      entries.map(function(e){
        var pct = totalGeneral > 0 ? Math.round(e[1].tot/totalGeneral*100) : 0;
        var barW = Math.round(e[1].tot/maxTot*100);
        return '<tr style="border-top:1px solid var(--border);">'+
          '<td style="padding:10px 14px;">'+
            '<div style="font-weight:700;color:var(--text);">'+e[0]+'</div>'+
            '<div style="height:3px;background:var(--border);border-radius:2px;margin-top:5px;">'+
              '<div style="width:'+barW+'%;height:3px;background:var(--green);border-radius:2px;"></div>'+
            '</div>'+
          '</td>'+
          '<td style="padding:10px 14px;color:var(--muted);font-size:12px;">'+e[1].cat+'</td>'+
          '<td style="padding:10px 14px;text-align:right;font-weight:600;">'+e[1].qty+'</td>'+
          '<td style="padding:10px 14px;text-align:right;font-weight:800;color:var(--green);">'+gs(e[1].tot)+'</td>'+
          '<td style="padding:10px 14px;text-align:right;color:var(--muted);font-size:12px;">'+pct+'%</td>'+
        '</tr>';
      }).join('')+
      '</tbody></table></div>';

    wrap.innerHTML = html;
  } catch(e) {
    wrap.innerHTML = '<div style="padding:24px;color:var(--red);">Error: '+e.message+'</div>';
  }
}

// ════════════════════════════════════════════════════════
// REPORTE: COMPRAS
// ════════════════════════════════════════════════════════

async function renderRepCompras(fdKey){
  fdKey = fdKey || 'mes';
  var c = document.getElementById('content');
  var fd = getFD(fdKey);
  var isCustom = fdKey.startsWith('custom_');
  var p2 = function(n){ return String(n).padStart(2,'0'); };
  var addDay = function(ds){ var p=ds.split('-'),d=new Date(+p[0],+p[1]-1,+p[2]+1);return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate()); };
  var fd0 = fd.d.slice(0,10), fh0 = fd.h.slice(0,10);
  var customPts = isCustom ? fdKey.slice(7).split('_') : [];
  var rangoLabel = getFDLabel(fdKey);
  var icoPDF = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>';

  c.innerHTML =
    '<div class="ph" style="margin-bottom:14px;flex-wrap:wrap;gap:10px">'+
      '<div>'+
        '<div class="pt">Reporte de Compras</div>'+
        '<div class="ps" style="color:var(--muted);">'+rangoLabel+'</div>'+
      '</div>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">'+
        '<div style="display:inline-flex;background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:2px;gap:1px;">'+
          '<button class="atab'+(fdKey==='hoy'?' on':'')+'" onclick="renderRepCompras(\'hoy\')">Hoy</button>'+
          '<button class="atab'+(fdKey==='semana'?' on':'')+'" onclick="renderRepCompras(\'semana\')">Semana</button>'+
          '<button class="atab'+(fdKey==='mes'?' on':'')+'" onclick="renderRepCompras(\'mes\')">Mes</button>'+
          '<button class="atab'+(fdKey==='30d'?' on':'')+'" onclick="renderRepCompras(\'30d\')">30 días</button>'+
        '</div>'+
        '<div style="display:flex;gap:4px;align-items:center;background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:3px 8px;">'+
          '<input type="date" id="rpCD" value="'+(customPts[0]||fd0)+'" class="d-inp" style="font-size:12px;padding:3px 5px;min-width:126px;border:none;background:transparent;">'+
          '<span style="color:var(--muted);font-size:11px;padding:0 2px;">–</span>'+
          '<input type="date" id="rpCH" value="'+(customPts[1]||fh0)+'" class="d-inp" style="font-size:12px;padding:3px 5px;min-width:126px;border:none;background:transparent;">'+
          '<button class="atab'+(isCustom?' on':'')+'" style="white-space:nowrap;margin-left:2px;padding:6px 12px;" onclick="(function(){var d=document.getElementById(\'rpCD\').value,h=document.getElementById(\'rpCH\').value;if(!d||!h){toast(\'Seleccioná ambas fechas\');return;}if(d>h){toast(\'La fecha inicial debe ser menor\');return;}renderRepCompras(\'custom_\'+d+\'_\'+h);})()">Aplicar</button>'+
        '</div>'+
        '<button class="btn-sv" onclick="renderCompras(\'nuevo\')">+ Nueva compra</button>'+
        '<button id="repCompPdfBtn" style="display:flex;gap:5px;align-items:center;background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:6px 12px;cursor:pointer;font-size:12px;color:var(--text);font-family:Barlow,sans-serif;font-weight:700;">'+icoPDF+' PDF</button>'+
      '</div>'+
    '</div>'+
    '<div id="repCompWrap"><div class="loading"><span class="sp"></span>Cargando...</div></div>';

  var wrap = document.getElementById('repCompWrap');
  try {
    var licId = await planGetLicId();

    var rows = await sg('stock_comprobantes',
      'licencia_id=eq.'+licId+
      '&tipo=in.(compra,entrada)'+
      '&fecha=gte.'+fd0+'T04:00:00'+
      '&fecha=lte.'+addDay(fh0)+'T03:59:59'+
      '&order=fecha.desc&limit=500');

    // El monto de cada compra se guarda en `total_monto` (no `total` ni `monto`).
    // Para compras viejas con total_monto NULL, lo calculamos desde los items.
    var faltantes = rows.filter(function(c){ var v=parseFloat(c.total_monto); return !v||isNaN(v); }).map(function(c){ return c.id; });
    if(faltantes.length){
      try{
        var itemsFb = await sg('stock_comprobante_items',
          'comprobante_id=in.('+faltantes.join(',')+')&select=comprobante_id,cantidad,costo_unitario&limit=5000');
        var totFb={};
        itemsFb.forEach(function(i){ var subt=(parseFloat(i.cantidad)||0)*(parseFloat(i.costo_unitario)||0); totFb[i.comprobante_id]=(totFb[i.comprobante_id]||0)+Math.abs(subt); });
        rows.forEach(function(c){ if((!c.total_monto||isNaN(parseFloat(c.total_monto)))&&totFb[c.id]) c.total_monto=totFb[c.id]; });
      }catch(eFb){ console.warn('[RepCompras] Items fallback error:', eFb.message); }
    }

    var totGeneral = rows.reduce(function(s,x){ return s+(parseFloat(x.total_monto)||x.total||x.monto||0); }, 0);

    var pdfBtn = document.getElementById('repCompPdfBtn');
    if(pdfBtn){
      pdfBtn.onclick = function(){
        repExportPDF({
          titulo: 'Reporte de Compras',
          periodo: rangoLabel,
          empresa: SE||'',
          statCards: [
            {lbl:'Total compras', val:gs(totGeneral), red:true},
            {lbl:'Registros', val:String(rows.length)}
          ],
          headers: [
            {t:'Fecha'},{t:'Proveedor / Concepto'},{t:'Tipo'},{t:'Total',r:true}
          ],
          rows: rows.map(function(r){
            var fch = r.fecha ? (function(){ var d=new Date(r.fecha); return p2(d.getDate())+'/'+p2(d.getMonth()+1)+'/'+d.getFullYear(); })() : '--';
            var desc = r.proveedor||r.concepto||r.descripcion||'—';
            var monto = parseFloat(r.total_monto)||r.total||r.monto||0;
            var tipo = (r.tipo||'compra').replace('_',' ');
            return '<tr>'+
              '<td style="color:#666;font-size:11px;white-space:nowrap;">'+fch+'</td>'+
              '<td style="font-weight:600;">'+desc+'</td>'+
              '<td style="font-size:11px;text-transform:uppercase;color:#666;">'+tipo+'</td>'+
              '<td class="r" style="color:#c62828;">'+gs(monto)+'</td>'+
            '</tr>';
          }).join('')
        });
      };
    }

    if(!rows.length){
      wrap.innerHTML =
        '<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;margin-bottom:14px;padding:20px;text-align:center;">'+
          '<div style="font-size:13px;color:var(--muted);margin-bottom:12px;">Sin compras en el período</div>'+
          '<button class="btn-sv" onclick="renderCompras(\'nuevo\')">+ Registrar compra</button>'+
        '</div>';
      return;
    }

    var html =
      '<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;margin-bottom:14px;padding:16px 20px;display:flex;gap:32px;flex-wrap:wrap;">'+
        '<div><div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.6px;margin-bottom:4px;">Total compras</div>'+
          '<div style="font-size:24px;font-weight:800;color:var(--red);">'+gs(totGeneral)+'</div></div>'+
        '<div><div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.6px;margin-bottom:4px;">Registros</div>'+
          '<div style="font-size:24px;font-weight:800;color:var(--text);">'+rows.length+'</div></div>'+
      '</div>'+
      '<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;overflow:hidden;">'+
      '<table style="width:100%;border-collapse:collapse;font-size:13px;">'+
      '<thead><tr style="background:var(--card2);">'+
        '<th style="padding:10px 14px;text-align:left;color:var(--muted);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Fecha</th>'+
        '<th style="padding:10px 14px;text-align:left;color:var(--muted);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Proveedor / Concepto</th>'+
        '<th style="padding:10px 14px;text-align:left;color:var(--muted);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Tipo</th>'+
        '<th style="padding:10px 14px;text-align:right;color:var(--muted);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Total</th>'+
      '</tr></thead><tbody>'+
      rows.map(function(r){
        var fch = r.fecha ? (function(){ var d=new Date(r.fecha); return p2(d.getDate())+'/'+p2(d.getMonth()+1)+'/'+d.getFullYear(); })() : '--';
        var desc = r.proveedor||r.concepto||r.descripcion||'—';
        var monto = r.total||r.monto||0;
        var tipo = (r.tipo||'compra').replace('_',' ');
        return '<tr style="border-top:1px solid var(--border);">'+
          '<td style="padding:10px 14px;color:var(--muted);font-size:12px;white-space:nowrap;">'+fch+'</td>'+
          '<td style="padding:10px 14px;font-weight:600;color:var(--text);">'+desc+'</td>'+
          '<td style="padding:10px 14px;"><span style="font-size:10px;font-weight:700;text-transform:uppercase;background:var(--card2);border:1px solid var(--border);border-radius:4px;padding:2px 7px;color:var(--muted);">'+tipo+'</span></td>'+
          '<td style="padding:10px 14px;text-align:right;font-weight:800;color:var(--red);">'+gs(monto)+'</td>'+
        '</tr>';
      }).join('')+
      '</tbody></table></div>';

    wrap.innerHTML = html;
  } catch(e) {
    wrap.innerHTML = '<div style="padding:24px;color:var(--red);">Error: '+e.message+'</div>';
  }
}

// ════════════════════════════════════════════════════════
// ADMINISTRACIÓN — TIMBRADOS
// ════════════════════════════════════════════════════════

async function testConexion(){
  try {
    await sg('licencias','limit=1'); _log('[Supabase] Conectividad OK');
    await sg('timbrados','limit=1'); _log('[Supabase] timbrados OK');
    await sg('timbrado_terminales','limit=1'); _log('[Supabase] timbrado_terminales OK');
  }catch(e){console.warn('[Supabase] Error:', e.message);}
}

async function cargarTimbradosDesdeSupabase(){
  if(!SE){try{timbrados=JSON.parse(localStorage.getItem(TIM_KEY)||'[]');}catch(e){timbrados=[];}return;}
  try{
    var rows=await sg('timbrados','licencia_email=ilike.'+encodeURIComponent(SE)+'&activo=eq.true&order=created_at.asc');
    var ters=await sg('timbrado_terminales','licencia_email=ilike.'+encodeURIComponent(SE)+'&activo=eq.true');
    timbrados=rows.map(function(t){
      return {
        _db_id:t.id, nro:t.nro, tipo:t.tipo,
        vig_ini:t.vig_ini, vig_fin:t.vig_fin||'2999-12-31',
        sucursal:t.sucursal, nombre_suc:t.nombre_suc,
        desde:t.desde, hasta:t.hasta,
        cert_venc:t.cert_venc, cert_emis:t.cert_emis,
        seleccionado:ters.some(function(a){return a.timbrado_id===t.id;}),
        asignaciones:ters.filter(function(a){return a.timbrado_id===t.id;}).map(function(a){
          return {_ter_id:a.id,terminal:a.terminal,sucursal:a.sucursal,punto_exp:a.punto_exp,nro_actual:a.nro_actual};
        })
      };
    });
    var mapa={};
    timbrados.forEach(function(t,ti){(t.asignaciones||[]).forEach(function(a,ai){mapa[a.terminal]={timIdx:ti,asigIdx:ai};});});
    localStorage.setItem(TIM_KEY,JSON.stringify(timbrados));
    localStorage.setItem('pos_timbrados_mapa',JSON.stringify(mapa));
    _log('[Carga] OK:',timbrados.length,'timbrados,',timbrados.reduce(function(s,t){return s+(t.asignaciones||[]).length;},0),'terminales');
  }catch(e){
    toast('Error al cargar timbrados'); console.warn('[Carga] Error:',e.message);
    try{timbrados=JSON.parse(localStorage.getItem(TIM_KEY)||'[]');}catch(e2){timbrados=[];}
  }
}

function renderAdmin(){
  document.getElementById('content').innerHTML='<div class="ph"><div><div class="pt">Administración</div><div class="ps">Configuración avanzada del sistema</div></div></div><div class="admin-tabs"><button class="atab on" id="atab-timbrado" onclick="goAdminTab(\'timbrado\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Puntos de Expedición</button><button class="atab" id="atab-sucursales" onclick="goAdminTab(\'sucursales\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/></svg> Sucursales</button></div><div id="adminTabContent"></div>';
  goAdminTab('timbrado');
}

function goAdminTab(t){
  document.querySelectorAll('.atab').forEach(function(b){b.classList.remove('on');});
  var btn=document.getElementById('atab-'+t);
  if(btn) btn.classList.add('on');
  var tc=document.getElementById('adminTabContent');
  if(!tc) return;
  if(t==='timbrado') renderTimbradosTab(tc);
  if(t==='sucursales') renderSucursalesTab(tc);
}

async function renderTimbradosTab(tc){
  tc.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:10px;"><div><div style="font-size:15px;font-weight:700;color:#fff;">Puntos de Expedición</div><div style="font-size:12px;color:var(--muted);margin-top:2px;">Timbrados habilitados por SET/DNIT</div></div><button class="btn-nueva" onclick="abrirMTim()">+ NUEVO</button></div><div id="timLista"><div class="loading"><span class="sp"></span>Cargando...</div></div>';
  await cargarTimbradosDesdeSupabase();
  var lista=document.getElementById('timLista');
  if(lista) lista.innerHTML=buildTimLista();
}

async function refreshTimListaFromServer(){
  await cargarTimbradosDesdeSupabase();
  var lista=document.getElementById('timLista');
  if(lista) lista.innerHTML=buildTimLista();
}

function refreshTimLista(){
  var lista=document.getElementById('timLista');
  if(lista) lista.innerHTML=buildTimLista();
}

function buildTimLista(){
  if(!timbrados.length) return '<div class="empty"><div class="empty-i"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div><div class="empty-t">Sin puntos de expedición</div><div class="empty-s">Agregá el timbrado habilitado por SET/DNIT</div></div>';
  var hoy=new Date();
  return timbrados.map(function(t,i){
    var fin=new Date((t.vig_fin||'2999-12-31')+'T00:00:00');
    var act=fin>=hoy;
    var dias=Math.ceil((fin-hoy)/(1000*60*60*24));
    var vBdg=act?(dias<60&&t.tipo!=='electronico'?'<span class="tag tag-o">'+dias+'d</span>':'<span class="tag tag-g">Vigente</span>'):'<span class="tag tag-r">Vencido</span>';
    var asigs=t.asignaciones||[];
    var terTxt=asigs.length?('<span class="tag tag-g">'+asigs.length+' terminal'+(asigs.length!==1?'es':'')+'</span>'):'';
    var pct=Math.round(((t.nro_actual||t.desde||1)-(t.desde||1))/Math.max((t.hasta||5000)-(t.desde||1),1)*100);
    return '<div class="tim-card"><div class="tim-h" onclick="togTim('+i+')">'+
      '<div class="tim-ico" style="background:'+(act?'var(--g2)':'var(--r2)')+'"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="'+(act?'var(--green)':'var(--red)')+'" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg></div>'+
      '<div class="tim-info"><div class="tim-nro">Timbrado '+t.nro+'</div>'+
      '<div class="tim-meta">'+pad3(t.sucursal)+'-002 · '+(t.tipo==='electronico'?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg> Electrónico':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> Autoimpresor')+(t.nombre_suc?' · '+t.nombre_suc:'')+'</div>'+
      '<div class="tim-tags">'+vBdg+terTxt+(t.seleccionado?'<span class="tag tag-g"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><polyline points="20 6 9 17 4 12"/></svg> CON TERMINALES</span>':'')+'</div></div>'+
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#555" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></div>'+
      '<div class="tim-body" id="tB'+i+'">'+
      '<div class="tim-row"><span style="color:var(--muted)">Timbrado</span><span style="font-family:monospace;font-size:15px;font-weight:700">'+t.nro+'</span></div>'+
      '<div class="tim-row"><span style="color:var(--muted)">Tipo</span><span>'+(t.tipo==='electronico'?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg> Electrónico':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> Autoimpresor')+'</span></div>'+
      '<div class="tim-row"><span style="color:var(--muted)">Inicio vigencia</span><span>'+fmt(t.vig_ini)+'</span></div>'+
      '<div class="tim-row"><span style="color:var(--muted)">Fin vigencia</span><span>'+(t.vig_fin==='2999-12-31'?'<span style="color:var(--muted)">Sin límite</span>':fmt(t.vig_fin))+'</span></div>'+
      '<div class="tim-row"><span style="color:var(--muted)">Sucursal</span><span style="font-family:monospace;font-weight:700">'+pad3(t.sucursal)+'</span></div>'+
      '<div class="tim-row"><span style="color:var(--muted)">Numeración</span><span>'+(t.tipo==='electronico'?'Sin límite':padN(t.desde||1)+' al '+padN(t.hasta||5000))+'</span></div>'+
      '<div class="tim-row"><span style="color:var(--muted)">Siguiente nro</span><span style="color:var(--green);font-weight:700">'+padN(t.nro_actual||t.desde||1)+'</span></div>'+
      '<div class="tim-row"><span style="color:var(--muted)">Terminales asignadas</span><span>'+(asigs.length?asigs.map(function(a){return '<span class="tag tag-g">'+a.terminal+'</span>';}).join(' '):'<span style="color:var(--muted)">Sin asignar</span>')+'</span></div>'+
      '<div style="margin:10px 0 4px"><div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:4px"><span>Uso de numeración</span><span>'+pct+'%</span></div><div style="background:#1e1e1e;border-radius:4px;height:5px;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:'+(pct>80?'var(--red)':pct>60?'var(--orange)':'var(--green)')+';border-radius:4px"></div></div></div>'+
      '<div class="tim-acts"><button class="btn-usar" onclick="abrirModalAsignar('+i+')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg> ASIGNAR TERMINALES</button><button class="btn-editar" onclick="editTim('+i+')">EDITAR</button><button class="btn-elim" onclick="elimTim('+i+')">ELIMINAR</button></div>'+
      '</div></div>';
  }).join('');
}

function togTim(i){var b=document.getElementById('tB'+i);if(b)b.classList.toggle('open');}


// ── ASIGNAR TERMINALES ────────────────────────────────────
async function abrirModalAsignar(timIdx){
  var modal=document.getElementById('mAsignarOv');
  var body=document.getElementById('mAsignarBody');
  if(!modal||!body) return;
  modal.dataset.timIdx=String(timIdx);
  modal.style.display='flex';
  body.innerHTML='<div class="loading"><span class="sp"></span>Cargando terminales...</div>';

  var terminales=[];
  try{
    var rows=await sg('activaciones','email=ilike.'+encodeURIComponent(SE)+'&activa=eq.true&select=id,device_id,nombre_terminal,sucursal,updated_at');
    _log('[Modal] activaciones:', rows.length, rows);
    terminales=rows.filter(function(r){return r.nombre_terminal||r.device_id;})
                   .map(function(r){return {nombre:r.nombre_terminal||r.device_id,sucursal:r.sucursal||''};});
  }catch(e){console.warn('[Modal] Error activaciones:', e.message);}

  var t=timbrados[timIdx];
  var asigs=t.asignaciones||[];
  var yaAsig=asigs.map(function(a){return a.terminal;});

  var html='<div style="font-size:13px;color:var(--muted);margin-bottom:14px;">Timbrado <b style="color:#fff">'+t.nro+'</b> · Suc. <b style="color:#fff">'+pad3(t.sucursal)+'</b></div>';
  html+='<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:8px;">Terminales asignadas ('+asigs.length+')</div>';
  html+='<div id="asigLista" style="margin-bottom:16px;">';
  if(asigs.length){
    asigs.forEach(function(a,j){
      html+='<div style="display:flex;align-items:center;gap:8px;background:#111;border:1px solid var(--green);border-radius:8px;padding:10px 12px;margin-bottom:6px;">';
      html+='<div style="width:8px;height:8px;border-radius:50%;background:var(--green);flex-shrink:0;"></div>';
      html+='<div style="flex:1;"><div style="font-size:13px;font-weight:700;color:#fff;">'+a.terminal+'</div>';
      html+='<div style="font-size:11px;color:var(--muted);">Pto.Exp.: <b style="color:var(--green);font-family:monospace;">'+String(a.punto_exp||'001').padStart(3,'0')+'</b> · Sig.: <b style="color:var(--green);font-family:monospace;">'+String(a.nro_actual||1).padStart(7,'0')+'</b></div></div>';
      html+='<button data-j="'+j+'" class="btn-elim-asig" style="background:var(--r2);border:1px solid var(--red);border-radius:6px;color:var(--red);font-size:11px;font-weight:700;padding:6px 10px;cursor:pointer;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
      html+='</div>';
    });
  } else {
    html+='<div style="text-align:center;padding:12px;color:var(--muted);font-size:12px;background:#111;border-radius:8px;">Sin terminales asignadas</div>';
  }
  html+='</div>';

  html+='<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:8px;">Agregar terminal</div>';
  html+='<div style="background:rgba(76,175,80,.05);border:1px solid rgba(76,175,80,.2);border-radius:8px;padding:12px 14px;">';
  if(terminales.length){
    html+='<div style="font-size:11px;color:var(--muted);margin-bottom:8px;">Seleccioná una terminal registrada:</div>';
    terminales.forEach(function(ter){
      var esYa=yaAsig.indexOf(ter.nombre)>=0;
      html+='<div data-ter="'+ter.nombre.replace(/"/g,'&quot;')+'" class="ter-sel-opt" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;border:1.5px solid '+(esYa?'var(--green)':'#2a2a2a')+';background:'+(esYa?'rgba(76,175,80,.08)':'#111')+';cursor:'+(esYa?'default':'pointer')+';margin-bottom:6px;">';
      html+='<div style="width:10px;height:10px;border-radius:50%;background:'+(esYa?'var(--green)':'#333')+';flex-shrink:0;"></div>';
      html+='<div style="flex:1;"><div style="font-size:13px;font-weight:700;color:'+(esYa?'var(--green)':'#fff')+';">'+ter.nombre+'</div>';
      if(ter.sucursal) html+='<div style="font-size:11px;color:var(--muted);">'+ter.sucursal+'</div>';
      html+='</div>';
      if(esYa) html+='<span style="font-size:10px;background:var(--g2);color:var(--green);padding:2px 7px;border-radius:10px;font-weight:700;">YA ASIGNADA</span>';
      html+='</div>';
    });
  }
  html+='<input id="asigTerminal" type="text" placeholder="'+(terminales.length?'O escribí manualmente...':'Nombre de la terminal')+'" style="width:100%;background:#111;border:1.5px solid #2a2a2a;border-radius:6px;color:#fff;font-family:inherit;font-size:13px;padding:9px 10px;outline:none;box-sizing:border-box;margin-top:'+(terminales.length?'10':'0')+'px;">';
  html+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;">';
  html+='<div><label style="font-size:11px;color:var(--muted);font-weight:700;display:block;margin-bottom:4px;">Pto. Expedición *</label><input id="asigPtoExp" type="text" maxlength="3" value="001" style="width:100%;background:#111;border:1.5px solid #2a2a2a;border-radius:6px;color:#fff;font-family:monospace;font-size:15px;font-weight:700;letter-spacing:2px;padding:8px 10px;outline:none;text-align:center;box-sizing:border-box;"></div>';
  html+='<div><label style="font-size:11px;color:var(--muted);font-weight:700;display:block;margin-bottom:4px;">Nro desde</label><input id="asigDesde" type="number" value="1" min="1" style="width:100%;background:#111;border:1.5px solid #2a2a2a;border-radius:6px;color:#fff;font-family:inherit;font-size:13px;padding:8px 10px;outline:none;box-sizing:border-box;"></div></div>';
  html+='<button id="btnAsigTerminal" style="width:100%;background:var(--green);border:none;border-radius:8px;color:#fff;font-family:inherit;font-size:14px;font-weight:800;padding:12px;cursor:pointer;margin-top:12px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><polyline points="20 6 9 17 4 12"/></svg> ASIGNAR TERMINAL</button>';
  html+='</div>';
  body.innerHTML=html;

  // Event listeners
  body.querySelectorAll('.ter-sel-opt').forEach(function(el){
    if(el.style.cursor==='default') return;
    el.addEventListener('click',function(){
      document.getElementById('asigTerminal').value=el.dataset.ter;
      body.querySelectorAll('.ter-sel-opt').forEach(function(e2){e2.style.borderColor='#2a2a2a';e2.style.background='#111';});
      el.style.borderColor='var(--green)';el.style.background='rgba(76,175,80,.08)';
    });
  });
  body.querySelectorAll('.btn-elim-asig').forEach(function(btn){
    btn.addEventListener('click',function(){elimAsig(parseInt(btn.dataset.j));});
  });
  document.getElementById('btnAsigTerminal').addEventListener('click',function(){agregarAsig();});
}

function cerrarModalAsignar(){
  document.getElementById('mAsignarOv').style.display='none';
  refreshTimLista();
}

async function agregarAsig(){
  var timIdx=parseInt(document.getElementById('mAsignarOv').dataset.timIdx);
  var terminal=document.getElementById('asigTerminal').value.trim();
  var ptoExp=(document.getElementById('asigPtoExp').value||'001').replace(/\D/g,'').padStart(3,'0');
  var desde=parseInt(document.getElementById('asigDesde').value)||1;
  if(!terminal){alert('Ingresá el nombre de la terminal');return;}
  if(!ptoExp||ptoExp==='000'){alert('Ingresá el punto de expedición');return;}

  var btnA=document.getElementById('btnAsigTerminal');
  if(btnA){btnA.disabled=true;btnA.textContent='Guardando...';}

  try{
    var t=timbrados[timIdx];
    _log('[Asignar] Timbrado:',t.nro,'_db_id:',t._db_id);

    // PASO 1: guardar timbrado en BD para obtener ID
    var r1=await supaPost('timbrados',{
      licencia_email:SE,nro:String(t.nro),tipo:t.tipo||'autoimpresor',
      vig_ini:t.vig_ini||null,vig_fin:t.tipo==='electronico'?null:(t.vig_fin||null),
      sucursal:String(t.sucursal||'001'),nombre_suc:t.nombre_suc||null,
      desde:parseInt(t.desde)||1,hasta:parseInt(t.hasta)||5000,activo:true
    },'licencia_email,nro');
    var dbId=Array.isArray(r1)?(r1[0]&&r1[0].id):(r1&&r1.id);
    if(!dbId) throw new Error('Sin ID del timbrado. Respuesta: '+JSON.stringify(r1));
    t._db_id=dbId;
    _log('[Asignar] PASO 1 OK — timbrado_id:',dbId);

    // PASO 2: guardar terminal
    var r2=await supaPost('timbrado_terminales',{
      licencia_email:SE,timbrado_id:dbId,
      terminal:terminal,sucursal:null,
      punto_exp:ptoExp,nro_actual:desde,activo:true
    },'licencia_email,terminal');
    var terId=Array.isArray(r2)?(r2[0]&&r2[0].id):(r2&&r2.id);
    if(!terId) throw new Error('Sin ID de terminal. Respuesta: '+JSON.stringify(r2));
    _log('[Asignar] PASO 2 OK — terminal_id:',terId);

    toast('Terminal "'+terminal+'" asignada correctamente');
    await cargarTimbradosDesdeSupabase();
  }catch(e){
    console.error('[Asignar] Error:',e.message);
    alert('Error al asignar: '+e.message);
  }

  if(btnA){btnA.disabled=false;btnA.textContent='ASIGNAR TERMINAL';}
  await abrirModalAsignar(timIdx);
}

async function elimAsig(j){
  var timIdx=parseInt(document.getElementById('mAsignarOv').dataset.timIdx);
  var a=timbrados[timIdx].asignaciones[j];
  if(!confirm('Desasignar terminal "'+a.terminal+'"?')) return;
  try{
    if(a._ter_id){
      await supaPatch('timbrado_terminales','id=eq.'+a._ter_id,{activo:false});
    } else {
      await supaPatch('timbrado_terminales','licencia_email=ilike.'+encodeURIComponent(SE)+'&terminal=eq.'+encodeURIComponent(a.terminal),{activo:false});
    }
    await cargarTimbradosDesdeSupabase();
    toast('Terminal desasignada');
  }catch(e){alert('Error: '+e.message);}
  await abrirModalAsignar(timIdx);
}


// ── GUARDAR / EDITAR / ELIMINAR TIMBRADO ──────────────────
async function guardarTim(){
  var nro=document.getElementById('mNro').value.trim();
  var vigIni=document.getElementById('mVigIni').value;
  var vigFin=document.getElementById('mVigFin').value;
  var suc=pad3(document.getElementById('mSuc').value||'001');
  var desde=parseInt(document.getElementById('mDesde').value)||1;
  var hasta=parseInt(document.getElementById('mHasta').value)||5000;
  var nomSuc=document.getElementById('mNomSuc').value.trim();
  var tipo=document.getElementById('mTipo').value;
  var certV=document.getElementById('mCertVenc')?document.getElementById('mCertVenc').value:null;
  var certE=document.getElementById('mCertEmis')?document.getElementById('mCertEmis').value.trim():null;

  if(!nro||nro.length!==8){alert('El timbrado debe tener 8 dígitos');return;}
  if(!vigIni){alert('Ingresá inicio de vigencia');return;}
  if(tipo!=='electronico'&&!vigFin){alert('Ingresá fin de vigencia');return;}

  var btnG=document.querySelector('button[onclick="guardarTim()"]');
  if(btnG){btnG.disabled=true;btnG.textContent='Guardando...';}

  try{
    var data={
      licencia_email:SE,nro:nro,tipo:tipo,
      vig_ini:vigIni||null,vig_fin:tipo==='electronico'?null:(vigFin||null),
      sucursal:suc,nombre_suc:nomSuc||null,
      desde:desde,hasta:tipo==='electronico'?9999999:hasta,
      cert_venc:certV||null,cert_emis:certE||null,activo:true
    };
    var result=await supaPost('timbrados',data,'licencia_email,nro');
    var saved=Array.isArray(result)?result[0]:result;
    if(!saved||!saved.id) throw new Error('Sin ID: '+JSON.stringify(result));
    _log('[guardarTim] OK ID:',saved.id);
    closeMTim();
    await refreshTimListaFromServer();
    toast(timEditIdx!==null?'Timbrado actualizado':'Timbrado guardado');
  }catch(e){
    alert('Error al guardar: '+e.message);
    console.error('[guardarTim]',e.message);
  }
  if(btnG){btnG.disabled=false;btnG.textContent='GUARDAR';}
}

async function elimTim(i){
  if(!confirm('Eliminar este timbrado?')) return;
  var t=timbrados[i];
  try{
    if(t._db_id){
      await supaPatch('timbrados','id=eq.'+t._db_id,{activo:false});
    } else {
      await supaPatch('timbrados','licencia_email=ilike.'+encodeURIComponent(SE)+'&nro=eq.'+t.nro,{activo:false});
    }
    await refreshTimListaFromServer();
    toast('Timbrado eliminado');
  }catch(e){alert('Error: '+e.message);}
}

function editTim(i){
  timEditIdx=i;
  var t=timbrados[i];
  document.getElementById('mTimTitle').textContent='Editar Punto de Expedición';
  document.getElementById('mNro').value=t.nro||'';
  document.getElementById('mVigIni').value=t.vig_ini||'';
  document.getElementById('mVigFin').value=t.vig_fin||'';
  document.getElementById('mSuc').value=t.sucursal||'001';
  document.getElementById('mPEx').value='001';
  document.getElementById('mDesde').value=t.desde||'1';
  document.getElementById('mHasta').value=t.hasta||'5000';
  document.getElementById('mNomSuc').value=t.nombre_suc||'';
  document.getElementById('mTipo').value=t.tipo||'autoimpresor';
  selTipo(t.tipo||'autoimpresor');
  if(document.getElementById('mCertVenc')) document.getElementById('mCertVenc').value=t.cert_venc||'';
  if(document.getElementById('mCertEmis')) document.getElementById('mCertEmis').value=t.cert_emis||'';
  updPrev();
  document.getElementById('mTimOv').style.display='flex';
}

// ── MODAL TIMBRADO ────────────────────────────────────────
function abrirMTim(){
  timEditIdx=null;
  document.getElementById('mTimTitle').textContent='Nuevo Punto de Expedición';
  ['mNro','mVigIni','mVigFin','mNomSuc'].forEach(function(id){document.getElementById(id).value='';});
  document.getElementById('mSuc').value='001';
  document.getElementById('mPEx').value='001';
  document.getElementById('mDesde').value='1';
  document.getElementById('mHasta').value='5000';
  selTipo('autoimpresor');
  updPrev();
  document.getElementById('mTimOv').style.display='flex';
}

function closeMTim(){document.getElementById('mTimOv').style.display='none';}

function selTipo(t){
  document.getElementById('mTipo').value=t;
  var bA=document.getElementById('btnAuto'),bE=document.getElementById('btnElec');
  bA.style.background=t==='autoimpresor'?'var(--g2)':'#1e1e1e';
  bA.style.borderColor=t==='autoimpresor'?'var(--green)':'#333';
  bA.style.color=t==='autoimpresor'?'var(--green)':'var(--muted)';
  bE.style.background=t==='electronico'?'var(--b2)':'#1e1e1e';
  bE.style.borderColor=t==='electronico'?'var(--blue)':'#333';
  bE.style.color=t==='electronico'?'var(--blue)':'var(--muted)';
  var vigFin=document.getElementById('mVigFin');
  var hasta=document.getElementById('mHasta');
  var certRow=document.getElementById('certRow');
  var vigFinRow=document.getElementById('vigFinRow');
  var feRow=document.getElementById('feStatusRow');
  if(t==='electronico'){
    if(vigFin){vigFin.value='2999-12-31';vigFin.readOnly=true;vigFin.style.color='var(--muted)';}
    if(hasta){hasta.value='9999999';hasta.readOnly=true;hasta.style.color='var(--muted)';}
    if(certRow) certRow.style.display='block';
    if(vigFinRow) vigFinRow.style.opacity='.5';
    if(feRow){feRow.style.display='block';feTimStatusBox(feRow);}
  } else {
    if(vigFin){vigFin.value='';vigFin.readOnly=false;vigFin.style.color='var(--text)';}
    if(hasta){hasta.value='5000';hasta.readOnly=false;hasta.style.color='var(--text)';}
    if(certRow) certRow.style.display='none';
    if(vigFinRow) vigFinRow.style.opacity='1';
    if(feRow) feRow.style.display='none';
  }
  updPrev();
}

// Muestra en el modal de timbrado si el proveedor de FE (FacturaSend) ya tiene
// credenciales cargadas. Lee la copia local y refresca desde pos_config.
async function feTimStatusBox(el){
  function pintar(cfg){
    if(cfg.tenantId&&cfg.apiKey&&cfg.activa){
      el.innerHTML='<div style="background:var(--g2);border:1px solid var(--green);border-radius:8px;padding:10px 12px;font-size:12px;color:var(--green);font-weight:700;">✓ FacturaSend configurado — los documentos de este timbrado se emiten a SIFEN</div>';
    } else {
      el.innerHTML='<div style="background:rgba(255,152,0,.12);border:1px solid var(--orange);border-radius:8px;padding:10px 12px;font-size:12px;color:var(--orange);">'+
        '<b>Sin credenciales FacturaSend'+(cfg.tenantId&&cfg.apiKey?' activas':'')+'.</b> Este timbrado no va a poder emitir hasta configurarlas. '+
        '<span onclick="closeMTim();goTo(\'factura-electronica\')" style="color:var(--blue);font-weight:700;cursor:pointer;text-decoration:underline;">Configurar ahora</span></div>';
    }
  }
  if(typeof feGetConfig!=='function'){el.innerHTML='';return;}
  pintar(feGetConfig());
  // Refrescar desde la nube por si se configuró en otro dispositivo
  try{
    var rows=await sg('pos_config','licencia_email=ilike.'+encodeURIComponent(SE)+'&clave=eq.facturasend_config&select=valor');
    if(rows.length){
      var val=JSON.parse(rows[0].valor||'{}');
      feSetConfig({tenantId:val.tenant_id||'',apiKey:val.api_key||'',activa:!!val.activa});
      pintar(feGetConfig());
    }
  }catch(e){/* offline: se queda con la copia local */}
}

function updPrev(){
  var nro=document.getElementById('mNro').value||'________';
  var ini=document.getElementById('mVigIni').value||'';
  var fin=document.getElementById('mVigFin').value||'';
  var suc=pad3(document.getElementById('mSuc').value||'001');
  var pex=pad3(document.getElementById('mPEx').value||'001');
  var desde=String(document.getElementById('mDesde').value||'1').padStart(7,'0');
  var hasta=String(document.getElementById('mHasta').value||'5000').padStart(7,'0');
  var nom=document.getElementById('mNomSuc').value||'';
  var tipo=document.getElementById('mTipo').value||'autoimpresor';
  var certV=document.getElementById('mCertVenc')?document.getElementById('mCertVenc').value:'';
  var prev=document.getElementById('mPrev');
  if(!prev) return;
  var certAlert='';
  if(tipo==='electronico'&&certV){
    var dias=Math.ceil((new Date(certV+' 00:00:00')-new Date())/(1000*60*60*24));
    if(dias<0) certAlert='<div style="background:rgba(239,83,80,.15);border:1px solid var(--red);border-radius:6px;padding:6px 10px;margin-top:6px;font-size:11px;color:var(--red);"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>️ CERTIFICADO VENCIDO hace '+Math.abs(dias)+' días</div>';
    else if(dias<=30) certAlert='<div style="background:rgba(255,152,0,.15);border:1px solid var(--orange);border-radius:6px;padding:6px 10px;margin-top:6px;font-size:11px;color:var(--orange);"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>️ Certificado vence en '+dias+' días</div>';
  }
  prev.innerHTML='<div style="color:#555;margin-bottom:4px;font-size:10px;">── VISTA PREVIA ──</div>'+
    '<div><span style="color:#666">TIMBRADO: </span><span style="color:#4caf50;font-weight:700">'+nro+'</span></div>'+
    '<div><span style="color:#666">Tipo: </span><span style="color:#ccc">'+(tipo==='electronico'?'Electrónico':'Autoimpresor')+'</span></div>'+
    '<div><span style="color:#666">Vigencia: </span><span style="color:#ccc">'+fmt(ini)+' al '+(tipo==='electronico'?'<span style="color:#555">Sin límite</span>':fmt(fin))+'</span></div>'+
    '<div><span style="color:#666">Sucursal: </span><span style="color:#ccc">'+suc+(nom?' ('+nom+')':'')+'</span></div>'+
    '<div><span style="color:#666">Pto.Exp.: </span><span style="color:#ccc">'+pex+'</span></div>'+
    '<div><span style="color:#555;font-size:10px;">── EJEMPLO ──</span></div>'+
    '<div style="color:#aaa">Factura N° '+suc+'-'+pex+'-<span style="color:#4caf50">0000001</span></div>'+certAlert;
}