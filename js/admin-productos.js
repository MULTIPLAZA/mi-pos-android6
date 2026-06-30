// ── Admin: Productos, Importación, Catálogo ──

function _esc(s){ const d=document.createElement('div'); d.textContent=String(s==null?'':s); return d.innerHTML; }

// ── PRODUCTOS ─────────────────────────────────────────────

// ── IMPORTACIÓN DE PRODUCTOS ─────────────────────────────
var _imp = { rows:[], categorias:[], errores:[] };

async function renderImportar(){
  var c = document.getElementById('content');
  c.innerHTML =
    '<div class="ph"><div><div class="pt">Importar productos</div><div class="ps">Subí un Excel con tu catálogo y actualizá masivamente</div></div></div>' +
    '<div class="card" style="margin-bottom:14px">' +
      '<div class="card-h"><span class="card-t">Paso 1 — Descargar plantilla</span></div>' +
      '<div style="padding:16px 18px">' +
        '<p style="font-size:13px;color:var(--muted);margin-bottom:12px;">Completá la planilla con tus productos y guardala como .xlsx o .csv</p>' +
        '<div style="display:flex;flex-wrap:wrap;gap:8px">' +
          '<button onclick="descargarPlantilla(\'xlsx\')" style="background:var(--g2);border:1px solid var(--green);border-radius:7px;color:var(--green);font-family:Barlow,sans-serif;font-size:13px;font-weight:700;padding:9px 18px;cursor:pointer;display:flex;align-items:center;gap:7px">' +
            '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
            'Descargar plantilla Excel' +
          '</button>' +
          '<button onclick="descargarPlantilla(\'csv\')" style="background:var(--card2);border:1px solid var(--border);border-radius:7px;color:var(--muted);font-family:Barlow,sans-serif;font-size:13px;font-weight:700;padding:9px 18px;cursor:pointer">Descargar plantilla CSV</button>' +
        '</div>' +
        '<div style="margin-top:14px;background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:12px 14px">' +
          '<div style="font-size:11px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;margin-bottom:8px;">Columnas de la planilla</div>' +
          '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:6px;font-size:12px;">' +
            impColHTML() +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="card" style="margin-bottom:14px">' +
      '<div class="card-h"><span class="card-t">Paso 2 — Subir archivo</span></div>' +
      '<div style="padding:16px 18px">' +
        '<div id="impDropZone" onclick="document.getElementById(\'impFile\').click()" ' +
          'style="border:2px dashed var(--border);border-radius:10px;padding:32px;text-align:center;cursor:pointer;transition:border-color .15s" ' +
          'ondragover="event.preventDefault();this.style.borderColor=\'var(--green)\'" ' +
          'ondragleave="this.style.borderColor=\'var(--border)\'" ' +
          'ondrop="impOnDrop(event)">' +
          '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="1.5" style="margin-bottom:10px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>' +
          '<div style="font-size:14px;font-weight:700;color:var(--text2)">Arrastrá tu archivo acá</div>' +
          '<div style="font-size:12px;color:var(--muted);margin-top:4px">o hacé clic para seleccionar</div>' +
        '</div>' +
        '<input type="file" id="impFile" accept=".xlsx,.xls,.csv" style="display:none" onchange="impLeerArchivo(this)">' +
        '<div style="margin-top:10px;font-size:12px;color:var(--muted);text-align:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.74V17h8v-2.26A7 7 0 0 0 12 2z"/></svg> Si el archivo tiene columna <code style="background:var(--card2);border:1px solid var(--border);border-radius:3px;padding:1px 5px;color:var(--blue)">id</code>, esas filas se actualizarán. Sin id = producto nuevo.</div>' +
      '</div>' +
    '</div>' +
    '<div id="impPreviewSection" style="display:none">' +
      '<div class="card" style="margin-bottom:14px">' +
        '<div class="card-h">' +
          '<span class="card-t" id="impPreviewTitle">Vista previa</span>' +
          '<div style="display:flex;gap:8px">' +
            '<button onclick="impLimpiar()" style="background:var(--r2);border:1px solid var(--red);border-radius:6px;color:var(--red);font-family:Barlow,sans-serif;font-size:12px;font-weight:700;padding:7px 13px;cursor:pointer">Cancelar</button>' +
            '<button onclick="impConfirmar()" id="impBtnConfirmar" style="background:var(--green);border:none;border-radius:6px;color:#fff;font-family:Barlow,sans-serif;font-size:12px;font-weight:700;padding:7px 16px;cursor:pointer">Importar ahora</button>' +
          '</div>' +
        '</div>' +
        '<div id="impErrores" style="display:none;padding:12px 18px;background:rgba(239,83,80,.06);border-bottom:1px solid var(--border)"></div>' +
        '<div style="overflow-x:auto"><table><thead><tr><th>Estado</th><th>ID</th><th>Nombre</th><th>Cat.</th><th>Precio</th><th>Costo</th><th>IVA</th><th>Comanda</th><th>Stock</th></tr></thead><tbody id="impPreviewBody"></tbody></table></div>' +
      '</div>' +
    '</div>' +
    '<div id="impResultSection" style="display:none">' +
      '<div class="card"><div class="card-h"><span class="card-t">Resultado</span></div><div id="impResultBody" style="padding:20px 18px"></div></div>' +
    '</div>';
}

function impColHTML(){
  var cols = [
    {n:'id',              r:false, d:'ID único del producto — usalo para actualizar existentes; vacío = nuevo producto'},
    {n:'nombre',          r:true,  d:'Nombre del producto'},
    {n:'categoria',       r:false, d:'Categoría (ej: Pizzas)'},
    {n:'precio',          r:true,  d:'Precio de venta'},
    {n:'costo',           r:false, d:'Costo de compra'},
    {n:'iva',             r:false, d:'IVA: 10, 5 o exento'},
    {n:'stock',           r:false, d:'Stock inicial'},
    {n:'stock_min',       r:false, d:'Stock mínimo alerta'},
    {n:'comanda',         r:false, d:'Va a cocina: SI o NO'},
    {n:'precio_variable', r:false, d:'Precio variable: SI o NO'},
    {n:'codigo',          r:false, d:'Código de barras'},
    {n:'color',           r:false, d:'Color hex (ej: #e53935)'},
  ];
  return cols.map(function(c){
    return '<div style="display:flex;align-items:flex-start;gap:6px;padding:4px 0">' +
      '<code style="background:var(--card);border:1px solid var(--border);border-radius:3px;padding:1px 5px;font-size:11px;flex-shrink:0;color:'+(c.r?'var(--green)':'var(--blue)')+'">'+c.n+'</code>' +
      '<span style="color:var(--muted)">'+c.d+(c.r?' <span style="color:var(--red)">*</span>':'')+'</span>' +
    '</div>';
  }).join('');
}

function descargarPlantilla(tipo){
  var headers = ['id','nombre','categoria','precio','costo','iva','stock','stock_min','comanda','precio_variable','codigo','color'];
  var ej1 = ['','PIZZA MUZZA','Pizzas','65000','25000','10','50','5','SI','NO','','#e53935'];
  var ej2 = ['','COCA COLA','Bebidas','8000','4000','10','100','10','NO','NO','7891234567890','#1565c0'];

  if(tipo === 'csv'){
    var csv = headers.join(',') + '\n' + ej1.join(',') + '\n' + ej2.join(',');
    var blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    var a    = document.createElement('a');
    a.href   = URL.createObjectURL(blob);
    a.download = 'plantilla_productos.csv'; a.click();
    return;
  }
  // XLSX via SheetJS
  if(typeof XLSX !== 'undefined'){
    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.aoa_to_sheet([headers, ej1, ej2]);
    ws['!cols'] = headers.map(function(){return {wch:18};});
    XLSX.utils.book_append_sheet(wb, ws, 'Productos');
    XLSX.writeFile(wb, 'plantilla_productos.xlsx');
  } else {
    var s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload=function(){ descargarPlantilla('xlsx'); };
    document.head.appendChild(s);
  }
}

function impOnDrop(e){
  e.preventDefault();
  document.getElementById('impDropZone').style.borderColor='var(--border)';
  if(e.dataTransfer.files[0]) impProcesarArchivo(e.dataTransfer.files[0]);
}

function impLeerArchivo(input){
  if(input.files[0]) impProcesarArchivo(input.files[0]);
  input.value='';
}

async function impProcesarArchivo(file){
  var dz=document.getElementById('impDropZone');
  if(dz){ const _dzt=document.createElement('div'); _dzt.style.cssText='color:var(--muted);font-size:13px'; _dzt.textContent='Procesando '+file.name+'...'; dz.innerHTML=''; dz.appendChild(_dzt); }
  try{
    var rows=[];
    var ext=file.name.split('.').pop().toLowerCase();
    if(ext==='csv'){
      var txt=await file.text();
      rows=impParsearCSV(txt);
    } else {
      if(typeof XLSX==='undefined'){
        await new Promise(function(res,rej){
          var s=document.createElement('script');
          s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
          s.onload=res; s.onerror=rej; document.head.appendChild(s);
        });
      }
      var buf=await file.arrayBuffer();
      var wb=XLSX.read(buf,{type:'array'});
      var ws=wb.Sheets[wb.SheetNames[0]];
      rows=XLSX.utils.sheet_to_json(ws,{raw:false,defval:''});
    }
    if(!rows.length){ toast('El archivo está vacío'); impReset(); return; }
    impValidarYMostrar(rows);
  }catch(e){ toast('Error al leer: '+e.message); impReset(); }
}

function impParsearCSV(txt){
  var lines=txt.split(/\r?\n/).filter(function(l){return l.trim();});
  if(lines.length<2) return [];
  var hdr=lines[0].split(',').map(function(h){return h.trim().toLowerCase().replace(/"/g,'');});
  return lines.slice(1).map(function(line){
    var vals=line.split(',').map(function(v){return v.trim().replace(/^"|"$/g,'');});
    var obj={};
    hdr.forEach(function(h,i){obj[h]=vals[i]||'';});
    return obj;
  });
}

function impValidarYMostrar(rows){
  _imp.rows=[]; _imp.errores=[];
  var gv=function(r){
    // obtener valor de una columna tolerando mayúsculas
    for(var k in r){ if(k===arguments[1]||k.toLowerCase()===arguments[1]) return r[k]; }
    return '';
  };
  var validados=rows.map(function(row,idx){
    var fila=idx+2;
    var id=parseInt((row.id||row.Id||row.ID||'').toString().trim())||null;
    var nombre=(row.nombre||row.Nombre||row.NOMBRE||'').toString().trim();
    var precioStr=(row.precio||row.Precio||row.PRECIO||'0').toString().replace(/\s/g,'').replace(',','.');
    var precio=parseFloat(precioStr)||0;
    var errFila=[];
    if(!nombre) errFila.push('Falta nombre');
    // Con ID (UPDATE): precio 0 es válido (no se sobreescribe si no querés)
    // Sin ID (INSERT): precio es obligatorio
    if(!id && precio<=0 && !pv) errFila.push('Precio inválido (requerido para productos nuevos)');
    var iva=(row.iva||row.IVA||row.Iva||'10').toString().trim().toLowerCase();
    if(!['10','5','exento','0'].includes(iva)) iva='10';
    if(iva==='0') iva='exento';
    var comanda=(row.comanda||row.Comanda||'').toString().trim().toUpperCase();
    comanda=comanda==='SI'||comanda==='SÍ'||comanda==='1'||comanda==='TRUE';
    var pv=(row.precio_variable||row.precioVariable||'').toString().trim().toUpperCase();
    pv=pv==='SI'||pv==='SÍ'||pv==='1'||pv==='TRUE';
    var stock=parseInt((row.stock||row.Stock||'0').toString())||0;
    var stockMin=parseInt((row.stock_min||row.stockMin||row.stock_minimo||'0').toString())||0;
    var costo=parseFloat((row.costo||row.Costo||'0').toString().replace(',','.'))||0;
    var cat=(row.categoria||row.Categoria||row.CATEGORIA||'Sin categoría').toString().trim()||'Sin categoría';
    var cod=(row.codigo||row.Codigo||row.CODIGO||'').toString().trim();
    var col=(row.color||row.Color||'').toString().trim()||'';
    if(errFila.length) _imp.errores.push('Fila '+fila+': '+errFila.join(', '));
    return {_fila:fila,_valido:errFila.length===0,_errores:errFila,_esUpdate:!!id,
      id,nombre,categoria:cat,precio:pv?0:precio,costo,iva,comanda,precio_variable:pv,
      stock,stock_min:stockMin,codigo:cod,color:col};
  });
  _imp.rows=validados;
  var total=validados.length, validos=validados.filter(function(r){return r._valido;}).length, inv=total-validos;
  var updates=validados.filter(function(r){return r._valido&&r._esUpdate;}).length;
  var nuevos=validos-updates;
  document.getElementById('impPreviewSection').style.display='block';
  document.getElementById('impPreviewTitle').textContent=
    total+' productos · '+
    (updates?updates+' UPDATE · ':'')+
    (nuevos?nuevos+' NUEVO · ':'')+
    (inv?inv+' con error':'').replace(/ · $/,'');
  if(_imp.errores.length){
    var ed=document.getElementById('impErrores');
    ed.style.display='block';
    ed.innerHTML='<div style="font-size:12px;font-weight:700;color:var(--red);margin-bottom:6px;">'+_imp.errores.length+' filas con errores (no se importarán):</div>'+
      _imp.errores.slice(0,5).map(function(e){return '<div style="font-size:12px;color:var(--red)">• '+_esc(e)+'</div>';}).join('')+
      (_imp.errores.length>5?'<div style="font-size:12px;color:var(--muted)">... y '+(_imp.errores.length-5)+' más</div>':'');
  }
  document.getElementById('impPreviewBody').innerHTML=validados.map(function(r){
    var est=r._valido
      ?(r._esUpdate
        ?'<span style="color:var(--blue);font-size:11px;font-weight:700">UPDATE</span>'
        :'<span style="color:var(--green);font-size:11px;font-weight:700">NUEVO</span>')
      :'<span style="color:var(--red);font-size:11px;font-weight:700" title="'+r._errores.join(', ')+'">Error</span>';
    return '<tr style="opacity:'+(r._valido?'1':'.5')+'">'+
      '<td>'+est+'</td>'+
      '<td style="font-size:11px;color:'+(r._esUpdate?'var(--blue)':'var(--muted)')+'">'+
        (r._esUpdate?'#'+_esc(r.id):'—')+'</td>'+
      '<td style="font-weight:600">'+_esc(r.nombre)+'</td>'+
      '<td>'+_esc(r.categoria)+'</td>'+
      '<td style="text-align:right;font-weight:700">'+(r.precio_variable?'<span style="color:var(--orange)">Variable</span>':gs(r.precio))+'</td>'+
      '<td style="text-align:right">'+(r.costo?gs(r.costo):'—')+'</td>'+
      '<td><span class="tag tag-gr">IVA '+(r.iva==='exento'?'Exento':r.iva+'%')+'</span></td>'+
      '<td style="text-align:center">'+(r.comanda?'<span style="color:var(--green)">SI</span>':'NO')+'</td>'+
      '<td style="text-align:center">'+(r.stock||'—')+'</td>'+
    '</tr>';
  }).join('');
  var btn=document.getElementById('impBtnConfirmar');
  if(btn){btn.disabled=validos===0;btn.style.opacity=validos===0?'.4':'1';}
  impReset();
  document.getElementById('impResultSection').style.display='none';
}

function impReset(){
  var dz=document.getElementById('impDropZone');
  if(!dz) return;
  dz.innerHTML='<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="1.5" style="margin-bottom:10px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>'+
    '<div style="font-size:14px;font-weight:700;color:var(--text2)">Arrastrá tu archivo acá</div>'+
    '<div style="font-size:12px;color:var(--muted);margin-top:4px">o hacé clic para seleccionar</div>';
}

function impLimpiar(){
  _imp.rows=[];_imp.errores=[];
  document.getElementById('impPreviewSection').style.display='none';
  document.getElementById('impResultSection').style.display='none';
  document.getElementById('impErrores').style.display='none';
  impReset();
}

async function sincronizarCategorias(nombresCateg){
  // Traer categorías existentes
  try{
    var existentes=await sg('pos_categorias','licencia_email=ilike.'+encodeURIComponent(SE)+'&select=id,nombre&order=id.desc&limit=500');
    var nombresExistentes=existentes.map(function(c){return (c.nombre||'').toUpperCase();});
    var maxCatId=existentes.length?Math.max.apply(null,existentes.map(function(c){return c.id||0;})):0;

    // Filtrar solo las categorías nuevas
    var nuevas=nombresCateg.filter(function(n){
      return n && n!=='SIN CATEGORÍA' && !nombresExistentes.includes(n.toUpperCase());
    });
    // Deduplicar
    nuevas=nuevas.filter(function(n,i,arr){return arr.indexOf(n)===i;});
    if(!nuevas.length){_log('[Import] Sin categorías nuevas');return;}

    var colores=['#e53935','#8e24aa','#1e88e5','#00897b','#f57c00','#6d4c41','#546e7a','#43a047','#c0ca33','#fdd835'];
    var ahora=new Date().toISOString();
    var payload=nuevas.map(function(nombre,i){
      return {
        id: maxCatId + 1 + i,
        nombre: nombre,
        color: colores[i % colores.length],
        licencia_email: SE,
        updated_at: ahora
      };
    });
    await supaPost('pos_categorias', payload, 'id');
    _log('[Import] Categorías creadas:', nuevas);
    toast('Categorías creadas: '+nuevas.join(', '));
  }catch(e){
    console.warn('[Import] Error sincronizando categorías:', e.message);
  }
}

async function impConfirmar(){
  var validos=_imp.rows.filter(function(r){return r._valido;});
  if(!validos.length){toast('Sin productos válidos');return;}
  var btn=document.getElementById('impBtnConfirmar');
  if(btn){btn.disabled=true;btn.textContent='Importando...';}
  var ok=0,err=0,errs=[];
  var lote=20;
  for(var i=0;i<validos.length;i+=lote){
    var batch=validos.slice(i,i+lote);
    // Separar updates de inserts
    var updates=batch.filter(function(r){return r._esUpdate;});
    var inserts=batch.filter(function(r){return !r._esUpdate;});
    try{
      // UPDATE uno a uno por id
      for(var j=0;j<updates.length;j++){
        var r=updates[j];
        // Construir objeto de update — si precio es 0, no sobreescribir el precio actual
        var upd={nombre:r.nombre.toUpperCase(),categoria:r.categoria,
          precio_variable:r.precio_variable,iva:r.iva,comanda:r.comanda,
          updated_at:new Date().toISOString()};
        if(r.precio>0) upd.precio=r.precio;
        if(r.costo>0) upd.costo=r.costo;
        if(r.codigo) upd.codigo=r.codigo;
        if(r.color) upd.color=r.color;
        await supaPatch('pos_productos','id=eq.'+r.id+'&licencia_email=ilike.'+encodeURIComponent(SE),upd);
        ok++;
      }
      // INSERT: dejar que Postgres auto-genere el ID (serial/identity)
      if(inserts.length){
        var ahora=new Date().toISOString();
        var payload=inserts.map(function(r){
          return {
            nombre:r.nombre.toUpperCase(),
            categoria:r.categoria||'Sin categoría',
            precio:r.precio||0,
            precio_variable:r.precio_variable||false,
            costo:r.costo||0,
            iva:r.iva||'10',
            comanda:r.comanda||false,
            codigo:r.codigo||'',
            color:r.color||'#546e7a',
            activo:true,
            licencia_email:SE,
            updated_at:ahora
          };
        });
        _log('[Import] payload[0]:', JSON.stringify(payload[0]));
        await supaPost('pos_productos',payload,'id');
        ok+=inserts.length;
      }
    }catch(e){err+=batch.length;errs.push(e.message.substring(0,200));console.error('[Import error]',e.message);}
    if(btn) btn.textContent='Importando '+ok+'/'+validos.length+'...';
  }
  document.getElementById('impPreviewSection').style.display='none';
  document.getElementById('impResultSection').style.display='block';
  document.getElementById('impResultBody').innerHTML=
    '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">'+
      '<div style="width:52px;height:52px;border-radius:50%;background:'+(err?'var(--o2)':'var(--g2)')+';display:flex;align-items:center;justify-content:center;font-size:24px">'+(err?'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>':'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><polyline points="20 6 9 17 4 12"/></svg>')+'</div>'+
      '<div><div style="font-size:18px;font-weight:800;color:var(--text)">'+(err===0?'Importación completa':'Importación con errores')+'</div>'+
      '<div style="font-size:13px;color:var(--muted)">'+ok+' importados'+(err?' · '+err+' fallaron':'')+'</div></div>'+
    '</div>'+
    (err?'<div style="background:var(--r2);border:1px solid var(--red);border-radius:8px;padding:12px;font-size:12px;color:var(--red);margin-bottom:14px">'+errs.join('<br>')+'</div>':'')+
    '<div style="display:flex;gap:8px">'+
      '<button onclick="impLimpiar()" style="background:var(--card2);border:1px solid var(--border);border-radius:7px;color:var(--text2);font-family:Barlow,sans-serif;font-size:13px;font-weight:700;padding:9px 18px;cursor:pointer">Nueva importación</button>'+
      '<button onclick="goTo(\'productos\')" style="background:var(--green);border:none;border-radius:7px;color:#fff;font-family:Barlow,sans-serif;font-size:13px;font-weight:700;padding:9px 18px;cursor:pointer">Ver productos</button>'+
    '</div>';
  // Sincronizar categorías nuevas en pos_categorias
  var categsImportadas=validos.map(function(r){return (r.categoria||'').toUpperCase();})
    .filter(function(c,i,arr){return c&&c!=='SIN CATEGORÍA'&&arr.indexOf(c)===i;});
  if(categsImportadas.length) await sincronizarCategorias(categsImportadas);

  _imp.rows=[];
  if(btn){btn.disabled=false;btn.textContent='Importar ahora';}
  try{allPrds=await sg('pos_productos','licencia_email=ilike.'+encodeURIComponent(SE)+'&activo=eq.true&es_insumo=is.false&order=nombre.asc&limit=500');}catch(e){ console.warn('[Import] Error recargando productos:', e.message); }
}

async function renderProductos(){
  cerrarProdPanel();
  var INP='width:100%;background:var(--card2);border:1.5px solid var(--border);border-radius:8px;color:var(--text);font-family:Barlow,sans-serif;font-size:13px;padding:10px 12px;outline:none;box-sizing:border-box';
  document.getElementById('content').innerHTML=
    '<div class="ph"><div><div class="pt">Productos</div><div class="ps">Catálogo sincronizado</div></div>'
    +'<div class="dbar">'
      +'<button onclick="abrirProdPanel(null)" style="background:var(--green);border:none;border-radius:7px;color:#fff;font-family:Barlow,sans-serif;font-size:12px;font-weight:700;padding:8px 14px;cursor:pointer;display:flex;align-items:center;gap:6px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Nuevo</button>'
      +'<button onclick="exportarCatalogo()" style="background:var(--b2);border:1px solid var(--blue);border-radius:7px;color:var(--blue);font-family:Barlow,sans-serif;font-size:12px;font-weight:700;padding:8px 14px;cursor:pointer;display:flex;align-items:center;gap:6px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Exportar</button>'
      +'<button onclick="goTo(\'importar\')" style="background:var(--card2);border:1px solid var(--border);border-radius:7px;color:var(--text2);font-family:Barlow,sans-serif;font-size:12px;font-weight:700;padding:8px 14px;cursor:pointer;display:flex;align-items:center;gap:6px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>Importar</button>'
    +'</div></div>'
    +'<div class="card"><div class="card-h"><span class="card-t" id="pCount">—</span><input class="c-srch" placeholder="Buscar..." oninput="filtrP(this.value)"></div>'
    +'<table><thead><tr><th>Producto</th><th>Categoría</th><th>IVA</th><th style="text-align:right">Precio</th><th></th></tr></thead><tbody id="pBody"><tr><td colspan="5" class="loading"><span class="sp"></span></td></tr></tbody></table></div>';
  try{
    // Excluir insumos (es_insumo=true). is.false captura false y NULL legacy.
    allPrds=await sg('pos_productos','licencia_email=ilike.'+encodeURIComponent(SE)+'&activo=eq.true&es_insumo=is.false&order=nombre.asc&limit=500');
    renderPT(allPrds);
  }catch(e){document.getElementById('pBody').innerHTML='<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--muted)">Sin productos sincronizados</td></tr>';}
}

function renderPT(p){
  if(!document.getElementById('pCount')) return;
  document.getElementById('pCount').textContent=p.length+' productos';
  document.getElementById('pBody').innerHTML=p.length
    ?p.map(function(x){
      return '<tr style="cursor:pointer" onclick="_clickProd('+x.id+')">'
        +'<td><div style="display:flex;align-items:center;gap:8px">'
          +(x.foto_url
            ?'<img src="'+_esc(x.foto_url)+'" style="width:36px;height:36px;border-radius:6px;object-fit:cover;flex-shrink:0" loading="lazy" alt="">'
            :'<div style="width:36px;height:36px;border-radius:6px;background:'+(x.color||'#546e7a')+';flex-shrink:0"></div>')
          +'<span style="font-weight:600">'+_esc(x.nombre)+'</span>'
        +'</div></td>'
        +'<td>'+_esc(x.categoria||'—')+'</td>'
        +'<td><span class="tag tag-gr">IVA '+(x.iva==='exento'?'Exento':(x.iva||'10')+'%')+'</span></td>'
        +'<td style="text-align:right;font-weight:700">'+(x.precio_variable?'<span style="color:var(--orange)">Variable</span>':gs(x.precio))+'</td>'
        +'<td style="text-align:right"><button onclick="event.stopPropagation();_clickProd('+x.id+')" style="background:var(--card2);border:1px solid var(--border);border-radius:6px;color:var(--text2);font-family:Barlow,sans-serif;font-size:11px;font-weight:700;padding:4px 10px;cursor:pointer">Editar</button></td>'
      +'</tr>';
    }).join('')
    :'<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--muted)">Sin productos</td></tr>';
}

function _clickProd(id){
  var p=allPrds.find(function(x){return x.id===id;});
  if(p) abrirProdPanel(p);
}

// ── PANEL CREAR / EDITAR PRODUCTO ─────────────────────────────────────────

var _prodPanel={prod:null};
var _ppFoto={blob:null,url:null,stream:null,facingMode:'environment'};

function abrirProdPanel(prod){
  _prodPanel.prod=prod||null;
  var esEd=!!prod;

  // Categorías únicas para datalist
  var cats=[];
  (allPrds||[]).forEach(function(p){ var c=(p.categoria||'').trim().toUpperCase(); if(c&&cats.indexOf(c)<0) cats.push(c); });
  cats.sort();

  var nom  = prod ? _esc(prod.nombre||'')        : '';
  var cat  = prod ? _esc(prod.categoria||'')      : '';
  var pre  = prod ? (prod.precio||0)              : '';
  var cos  = prod ? (prod.costo||0)               : '';
  var iva  = prod ? (prod.iva||'10')              : '10';
  var preV   = prod ? !!prod.precio_variable        : false;
  var com    = prod ? !!prod.comanda                : false;
  var esKilo = prod ? !!prod.es_kilo                : false;
  var col  = prod ? (prod.color||'#546e7a')       : '#546e7a';
  var cod  = prod ? _esc(prod.codigo||'')         : '';
  var fotoUrl = prod ? (prod.foto_url||'') : '';
  _ppFoto = { blob:null, url:fotoUrl||null, stream:null, facingMode:'environment' };

  var INP='width:100%;background:var(--card2);border:1.5px solid var(--border);border-radius:8px;color:var(--text);font-family:Barlow,sans-serif;font-size:14px;padding:10px 12px;outline:none;box-sizing:border-box';
  var LBL='font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:6px';
  var ivaOpts=['10','5','exento'].map(function(v){
    var sel=v===iva;
    return '<button type="button" onclick="_selIva(\''+v+'\')" id="ppIvaBtn'+v+'" style="flex:1;background:'+(sel?'var(--green)':'var(--card2)')+';border:1.5px solid '+(sel?'var(--green)':'var(--border)')+';border-radius:7px;color:'+(sel?'#fff':'var(--text2)')+';font-family:Barlow,sans-serif;font-size:13px;font-weight:700;padding:8px;cursor:pointer">'+(v==='exento'?'Exento':v+'%')+'</button>';
  }).join('');

  var overlay=document.getElementById('prodPanelOverlay');
  if(!overlay){ overlay=document.createElement('div'); overlay.id='prodPanelOverlay'; document.body.appendChild(overlay); }
  overlay.style.cssText='position:fixed;inset:0;z-index:200;display:flex;justify-content:flex-end';

  overlay.innerHTML=
    '<div onclick="cerrarProdPanel()" style="position:absolute;inset:0;background:rgba(0,0,0,.45)"></div>'
    +'<div style="position:relative;width:100%;max-width:460px;background:var(--card);height:100%;overflow-y:auto;display:flex;flex-direction:column;border-left:1px solid var(--border)">'
      // Header
      +'<div style="padding:14px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;position:sticky;top:0;background:var(--card);z-index:1">'
        +'<button type="button" onclick="cerrarProdPanel()" style="background:none;border:none;color:var(--muted);cursor:pointer;padding:2px;display:flex"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>'
        +'<span style="font-size:16px;font-weight:800">'+(esEd?'Editar producto':'Nuevo producto')+'</span>'
        +(esEd?'<button type="button" onclick="_desactivarProd()" style="margin-left:auto;background:var(--r2);border:1px solid var(--red);border-radius:6px;color:var(--red);font-family:Barlow,sans-serif;font-size:11px;font-weight:700;padding:5px 11px;cursor:pointer">Desactivar</button>':'')
      +'</div>'
      // Formulario
      +'<div style="padding:20px;flex:1;display:flex;flex-direction:column;gap:16px">'
        // Foto
        +'<div style="display:flex;flex-direction:column;align-items:center;gap:10px">'
          +'<div id="ppFotoWrap" onclick="_abrirCamaraModal()" style="width:104px;height:104px;border-radius:12px;border:2px dashed var(--border);overflow:hidden;display:flex;align-items:center;justify-content:center;cursor:pointer;background:var(--card2)" title="Tocar para sacar foto">'
            +'<img id="ppFotoImg" src="'+(fotoUrl||'')+'" style="display:'+(fotoUrl?'block':'none')+';width:100%;height:100%;object-fit:cover" alt="">'
            +'<div id="ppFotoPlaceholder" style="display:'+(fotoUrl?'none':'flex')+';flex-direction:column;align-items:center;gap:5px;pointer-events:none;color:var(--muted)">'
              +'<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>'
              +'<span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px">Sin foto</span>'
            +'</div>'
          +'</div>'
          +'<div style="display:flex;gap:6px">'
            +'<button type="button" onclick="_abrirCamaraModal()" style="background:var(--b2);border:1px solid var(--blue);border-radius:6px;color:var(--blue);font-family:Barlow,sans-serif;font-size:11px;font-weight:700;padding:6px 11px;cursor:pointer;display:flex;align-items:center;gap:5px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>Cámara</button>'
            +'<button type="button" onclick="document.getElementById(\'ppFotoFile\').click()" style="background:var(--card2);border:1px solid var(--border);border-radius:6px;color:var(--text2);font-family:Barlow,sans-serif;font-size:11px;font-weight:700;padding:6px 11px;cursor:pointer;display:flex;align-items:center;gap:5px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>Archivo</button>'
            +'<button type="button" id="ppFotoDel" onclick="_eliminarFoto()" style="display:'+(fotoUrl?'flex':'none')+';background:var(--r2);border:1px solid var(--red);border-radius:6px;color:var(--red);font-family:Barlow,sans-serif;font-size:11px;font-weight:700;padding:6px 10px;cursor:pointer;align-items:center;gap:4px"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>Quitar</button>'
            +'<input type="file" id="ppFotoFile" accept="image/*" style="display:none" onchange="_onFotoFile(this)">'
          +'</div>'
        +'</div>'
        // Nombre
        +'<div><label style="'+LBL+'">Nombre *</label>'
          +'<input id="ppNom" type="text" value="'+nom+'" oninput="this.value=this.value.toUpperCase()" placeholder="NOMBRE DEL PRODUCTO" style="'+INP+';font-weight:600" onfocus="this.style.borderColor=\'var(--green)\'" onblur="this.style.borderColor=\'var(--border)\'"></div>'
        // Categoría
        +'<div><label style="'+LBL+'">Categoría</label>'
          +'<input id="ppCat" type="text" value="'+cat+'" list="ppCatList" oninput="this.value=this.value.toUpperCase()" placeholder="SIN CATEGORÍA" style="'+INP+'" onfocus="this.style.borderColor=\'var(--green)\'" onblur="this.style.borderColor=\'var(--border)\'">'
          +'<datalist id="ppCatList">'+cats.map(function(c){return '<option value="'+c+'">';}).join('')+'</datalist></div>'
        // Precio + Costo
        +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'
          +'<div><label style="'+LBL+'">Precio (₲)</label><input id="ppPre" type="number" min="0" value="'+pre+'" placeholder="0" style="'+INP+';font-weight:700" onfocus="this.style.borderColor=\'var(--green)\'" onblur="this.style.borderColor=\'var(--border)\'"></div>'
          +'<div><label style="'+LBL+'">Costo (₲)</label><input id="ppCos" type="number" min="0" value="'+cos+'" placeholder="0" style="'+INP+';font-weight:700" onfocus="this.style.borderColor=\'var(--green)\'" onblur="this.style.borderColor=\'var(--border)\'"></div>'
        +'</div>'
        // IVA
        +'<div><label style="'+LBL+'">IVA</label>'
          +'<input type="hidden" id="ppIva" value="'+iva+'">'
          +'<div style="display:flex;gap:8px">'+ivaOpts+'</div>'
        +'</div>'
        // Toggles
        +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
          +'<label style="display:flex;align-items:center;gap:8px;background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;cursor:pointer">'
            +'<input type="checkbox" id="ppPreV"'+(preV?' checked':'')+' style="width:16px;height:16px;accent-color:var(--green);cursor:pointer">'
            +'<span style="font-size:12px;font-weight:600">Precio variable</span></label>'
          +'<label style="display:flex;align-items:center;gap:8px;background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;cursor:pointer">'
            +'<input type="checkbox" id="ppCom"'+(com?' checked':'')+' style="width:16px;height:16px;accent-color:var(--green);cursor:pointer">'
            +'<span style="font-size:12px;font-weight:600">Va a comanda</span></label>'
          +'<label style="display:flex;align-items:center;gap:8px;background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;cursor:pointer;grid-column:1/-1">'
            +'<input type="checkbox" id="ppEsKilo"'+(esKilo?' checked':'')+' style="width:16px;height:16px;accent-color:var(--green);cursor:pointer">'
            +'<span style="font-size:12px;font-weight:600">&#9878; Vender por kg (precio es por kilo)</span></label>'
        +'</div>'
        // Color + Código
        +'<div style="display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:end">'
          +'<div><label style="'+LBL+'">Color</label>'
            +'<input id="ppCol" type="color" value="'+col+'" style="width:52px;height:40px;border:1.5px solid var(--border);border-radius:8px;cursor:pointer;background:none;padding:2px"></div>'
          +'<div><label style="'+LBL+'">Código / SKU</label>'
            +'<input id="ppCod" type="text" value="'+cod+'" placeholder="Opcional" style="'+INP+'" onfocus="this.style.borderColor=\'var(--green)\'" onblur="this.style.borderColor=\'var(--border)\'"></div>'
        +'</div>'
        // Botón guardar
        +'<button id="ppBtnSv" type="button" onclick="_guardarProd()" style="width:100%;background:var(--green);border:none;border-radius:9px;color:#fff;font-family:Barlow,sans-serif;font-size:14px;font-weight:800;padding:13px;cursor:pointer;margin-top:4px">Guardar producto</button>'
      +'</div>'
    +'</div>';

  setTimeout(function(){ var el=document.getElementById('ppNom'); if(el) el.focus(); },80);
}

function _selIva(val){
  document.getElementById('ppIva').value=val;
  ['10','5','exento'].forEach(function(v){
    var b=document.getElementById('ppIvaBtn'+v);
    if(!b) return;
    var sel=v===val;
    b.style.background=sel?'var(--green)':'var(--card2)';
    b.style.borderColor=sel?'var(--green)':'var(--border)';
    b.style.color=sel?'#fff':'var(--text2)';
  });
}

function cerrarProdPanel(){
  var o=document.getElementById('prodPanelOverlay');
  if(o) o.style.display='none';
}

async function _guardarProd(){
  var nom=(document.getElementById('ppNom').value||'').trim().toUpperCase();
  if(!nom){ toast('Ingresá un nombre'); document.getElementById('ppNom').focus(); return; }
  var cat=(document.getElementById('ppCat').value||'').trim().toUpperCase()||'Sin categoría';
  var pre=parseFloat(document.getElementById('ppPre').value)||0;
  var cos=parseFloat(document.getElementById('ppCos').value)||0;
  var iva=document.getElementById('ppIva').value||'10';
  var preV=document.getElementById('ppPreV').checked;
  var com=document.getElementById('ppCom').checked;
  var col=document.getElementById('ppCol').value||'#546e7a';
  var cod=(document.getElementById('ppCod').value||'').trim();

  var btn=document.getElementById('ppBtnSv');
  if(btn){btn.disabled=true;btn.textContent='Guardando...';}

  var payload={
    nombre:nom, categoria:cat,
    precio:preV?0:pre, costo:cos, iva:iva,
    precio_variable:preV, comanda:com,
    color:col, codigo:cod,
    es_kilo:document.getElementById('ppEsKilo').checked,
    activo:true, es_insumo:false, licencia_email:SE,
    updated_at:new Date().toISOString()
  };

  try{
    if(_ppFoto.blob){
      if(btn) btn.textContent='Subiendo foto...';
      payload.foto_url = await _uploadFotoProducto(_ppFoto.blob);
    } else if(_ppFoto.url && _ppFoto.url.startsWith('https://')){
      payload.foto_url = _ppFoto.url;
    } else {
      payload.foto_url = null;
    }
    if(_prodPanel.prod){
      await supaPatch('pos_productos','id=eq.'+_prodPanel.prod.id+'&licencia_email=ilike.'+encodeURIComponent(SE),payload);
      toast('Producto actualizado');
    } else {
      // pos_productos.id no tiene autoincrement → calcular max+1 desde la DB
      payload.id = await _nextProductoId();
      await supaPost('pos_productos',payload,null,true);
      toast('Producto creado');
    }
    cerrarProdPanel();
    allPrds=await sg('pos_productos','licencia_email=ilike.'+encodeURIComponent(SE)+'&activo=eq.true&es_insumo=is.false&order=nombre.asc&limit=500');
    renderPT(allPrds);
  }catch(e){
    toast('Error: '+e.message);
    if(btn){btn.disabled=false;btn.textContent='Guardar producto';}
  }
}

async function _desactivarProd(){
  if(!_prodPanel.prod) return;
  if(!confirm('¿Desactivar "'+_prodPanel.prod.nombre+'"? Dejará de aparecer en ventas.')) return;
  try{
    await supaPatch('pos_productos','id=eq.'+_prodPanel.prod.id+'&licencia_email=ilike.'+encodeURIComponent(SE),{activo:false,updated_at:new Date().toISOString()});
    toast('Producto desactivado');
    cerrarProdPanel();
    allPrds=await sg('pos_productos','licencia_email=ilike.'+encodeURIComponent(SE)+'&activo=eq.true&es_insumo=is.false&order=nombre.asc&limit=500');
    renderPT(allPrds);
  }catch(e){ toast('Error: '+e.message); }
}

async function exportarCatalogo(){
  toast('Preparando exportación...');
  var prods = allPrds.length ? allPrds : await sg('pos_productos','licencia_email=ilike.'+encodeURIComponent(SE)+'&activo=eq.true&es_insumo=is.false&order=nombre.asc&limit=2000');
  if(!prods.length){ toast('Sin productos para exportar'); return; }
  var headers = ['id','nombre','categoria','precio','costo','iva','stock','stock_min','comanda','precio_variable','codigo','color'];
  var rows = prods.map(function(p){
    return [
      p.id||'',
      p.nombre||'',
      p.categoria||'',
      p.precio||0,
      p.costo||0,
      p.iva||'10',
      p.stock||0,
      p.stock_min||0,
      p.comanda?'SI':'NO',
      p.precio_variable?'SI':'NO',
      p.codigo||'',
      p.color||''
    ];
  });
  if(typeof XLSX !== 'undefined'){
    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.aoa_to_sheet([headers].concat(rows));
    ws['!cols'] = headers.map(function(h){return {wch:h==='nombre'?30:h==='id'?8:16};});
    XLSX.utils.book_append_sheet(wb, ws, 'Productos');
    XLSX.writeFile(wb, 'catalogo_productos.xlsx');
    toast('Catálogo exportado con '+prods.length+' productos');
  } else {
    var s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload=function(){ exportarCatalogo(); };
    document.head.appendChild(s);
  }
}

// ── HELPER: próximo id libre para pos_productos ───────────
// La tabla pos_productos no tiene autoincrement en `id` —
// hay que pasarlo explícito. Usamos max(id)+1 leído de la DB
// para minimizar el riesgo de colisión (no es a prueba de
// race conditions concurrentes, pero alcanza para alta humana).
async function _nextProductoId(){
  try{
    var r = await sg('pos_productos','select=id&order=id.desc&limit=1');
    return (r && r.length && r[0].id ? r[0].id : 0) + 1;
  }catch(e){
    return Date.now() % 1000000; // fallback: id grande basado en timestamp
  }
}

// ── INSUMOS ───────────────────────────────────────────────
// Mercaderías que se compran y se controlan en stock,
// pero NO se venden (harina, queso, servilletas, gas, etc.)
// Conviven en pos_productos con flag es_insumo=true.
// Se fuerzan: inventario=true, precio=0, comanda=false, precio_variable=false.

var allInsumos = [];

async function renderInsumos(){
  cerrarInsumoPanel();
  document.getElementById('content').innerHTML=
    '<div class="ph"><div><div class="pt">Insumos</div><div class="ps">Mercaderías para control de stock y compras — no se venden</div></div>'
    +'<div class="dbar">'
      +'<button onclick="abrirInsumoPanel(null)" style="background:var(--green);border:none;border-radius:7px;color:#fff;font-family:Barlow,sans-serif;font-size:12px;font-weight:700;padding:8px 14px;cursor:pointer;display:flex;align-items:center;gap:6px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Nuevo insumo</button>'
      +'<button onclick="exportarInsumos()" style="background:var(--b2);border:1px solid var(--blue);border-radius:7px;color:var(--blue);font-family:Barlow,sans-serif;font-size:12px;font-weight:700;padding:8px 14px;cursor:pointer;display:flex;align-items:center;gap:6px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Exportar</button>'
    +'</div></div>'
    +'<div class="card" style="margin-bottom:14px;background:rgba(255,152,0,.08);border-left:4px solid var(--orange)">'
      +'<div style="padding:14px 18px;font-size:13px;color:var(--text);line-height:1.55">'
        +'<div style="font-size:14px;font-weight:800;color:var(--orange);margin-bottom:6px;display:flex;align-items:center;gap:8px">'
          +'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
          +'Atención — esto NO es para productos de venta'
        +'</div>'
        +'<div style="color:var(--muted)">Lo que cargues acá <strong style="color:var(--text)">nunca aparece en la pantalla de ventas del POS</strong>. Sirve para llevar el stock y las compras de mercaderías que se consumen pero no se venden directo (harina, queso, vasos, gas, etc.). '
        +'<br><br>Si querés vender algo, cargalo en <a onclick="goTo(\'productos\')" style="color:var(--green);font-weight:700;cursor:pointer;text-decoration:underline">Productos</a>.'
        +'</div>'
      +'</div>'
    +'</div>'
    +'<div class="card"><div class="card-h"><span class="card-t" id="insCount">—</span><input class="c-srch" placeholder="Buscar..." oninput="filtrIns(this.value)"></div>'
    +'<table><thead><tr><th>Insumo</th><th>Categoría</th><th>Código</th><th style="text-align:right">Costo</th><th></th></tr></thead><tbody id="insBody"><tr><td colspan="5" class="loading"><span class="sp"></span></td></tr></tbody></table></div>';
  try{
    allInsumos=await sg('pos_productos','licencia_email=ilike.'+encodeURIComponent(SE)+'&activo=eq.true&es_insumo=is.true&order=nombre.asc&limit=500');
    renderInsT(allInsumos);
  }catch(e){
    document.getElementById('insBody').innerHTML='<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--muted)">Sin insumos cargados todavía. Tocá "Nuevo insumo" para empezar.</td></tr>';
  }
}

function renderInsT(p){
  if(!document.getElementById('insCount')) return;
  document.getElementById('insCount').textContent=p.length+' insumos';
  document.getElementById('insBody').innerHTML=p.length
    ?p.map(function(x){
      return '<tr style="cursor:pointer" onclick="_clickInsumo('+x.id+')">'
        +'<td><div style="display:flex;align-items:center;gap:8px">'
          +'<div style="width:24px;height:24px;border-radius:5px;background:'+(x.color||'#546e7a')+';flex-shrink:0"></div>'
          +'<span style="font-weight:600">'+_esc(x.nombre)+'</span>'
        +'</div></td>'
        +'<td>'+_esc(x.categoria||'—')+'</td>'
        +'<td style="font-size:12px;color:var(--muted)">'+_esc(x.codigo||'—')+'</td>'
        +'<td style="text-align:right;font-weight:700">'+(x.costo?gs(x.costo):'—')+'</td>'
        +'<td style="text-align:right"><button onclick="event.stopPropagation();_clickInsumo('+x.id+')" style="background:var(--card2);border:1px solid var(--border);border-radius:6px;color:var(--text2);font-family:Barlow,sans-serif;font-size:11px;font-weight:700;padding:4px 10px;cursor:pointer">Editar</button></td>'
      +'</tr>';
    }).join('')
    :'<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--muted)">Sin insumos</td></tr>';
}

function filtrIns(q){
  if(!allInsumos) return;
  var f=(q||'').toLowerCase();
  var fil=!f?allInsumos:allInsumos.filter(function(r){
    return (r.nombre||'').toLowerCase().includes(f)
      || (r.codigo||'').toLowerCase().includes(f)
      || (r.categoria||'').toLowerCase().includes(f);
  });
  renderInsT(fil);
}

function _clickInsumo(id){
  var p=allInsumos.find(function(x){return x.id===id;});
  if(p) abrirInsumoPanel(p);
}

// ── PANEL CREAR / EDITAR INSUMO ───────────────────────────────────────────

var _insPanel={ins:null};

function abrirInsumoPanel(ins){
  _insPanel.ins=ins||null;
  var esEd=!!ins;

  // Categorías únicas de insumos para datalist
  var cats=[];
  (allInsumos||[]).forEach(function(p){ var c=(p.categoria||'').trim().toUpperCase(); if(c&&cats.indexOf(c)<0) cats.push(c); });
  cats.sort();

  var nom = ins ? _esc(ins.nombre||'')   : '';
  var cat = ins ? _esc(ins.categoria||'') : '';
  var cos = ins ? (ins.costo||0)          : '';
  var col = ins ? (ins.color||'#546e7a')  : '#546e7a';
  var cod = ins ? _esc(ins.codigo||'')    : '';

  var INP='width:100%;background:var(--card2);border:1.5px solid var(--border);border-radius:8px;color:var(--text);font-family:Barlow,sans-serif;font-size:14px;padding:10px 12px;outline:none;box-sizing:border-box';
  var LBL='font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:6px';

  var overlay=document.getElementById('insPanelOverlay');
  if(!overlay){ overlay=document.createElement('div'); overlay.id='insPanelOverlay'; document.body.appendChild(overlay); }
  overlay.style.cssText='position:fixed;inset:0;z-index:200;display:flex;justify-content:flex-end';

  overlay.innerHTML=
    '<div onclick="cerrarInsumoPanel()" style="position:absolute;inset:0;background:rgba(0,0,0,.45)"></div>'
    +'<div style="position:relative;width:100%;max-width:460px;background:var(--card);height:100%;overflow-y:auto;display:flex;flex-direction:column;border-left:1px solid var(--border)">'
      +'<div style="padding:14px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;position:sticky;top:0;background:var(--card);z-index:1">'
        +'<button type="button" onclick="cerrarInsumoPanel()" style="background:none;border:none;color:var(--muted);cursor:pointer;padding:2px;display:flex"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>'
        +'<span style="font-size:16px;font-weight:800">'+(esEd?'Editar insumo':'Nuevo insumo')+'</span>'
        +(esEd?'<button type="button" onclick="_convertirInsumoAProducto()" style="margin-left:auto;background:var(--g2);border:1px solid var(--green);border-radius:6px;color:var(--green);font-family:Barlow,sans-serif;font-size:11px;font-weight:700;padding:5px 11px;cursor:pointer" title="Pasar este registro a Productos (aparecerá en ventas)">→ Mover a Productos</button>':'')
        +(esEd?'<button type="button" onclick="_desactivarInsumo()" style="background:var(--r2);border:1px solid var(--red);border-radius:6px;color:var(--red);font-family:Barlow,sans-serif;font-size:11px;font-weight:700;padding:5px 11px;cursor:pointer">Desactivar</button>':'')
      +'</div>'
      +'<div style="padding:20px;flex:1;display:flex;flex-direction:column;gap:16px">'
        // Aviso
        +'<div style="background:rgba(255,152,0,.08);border:1px solid var(--orange);border-radius:8px;padding:10px 12px;font-size:12px;color:var(--text);line-height:1.5">'
          +'<strong style="color:var(--orange)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Este registro NO sale en la pantalla de ventas.</strong> '
          +'Sí aparece en Compras, Inventarios, Movimientos y Conteo. '
          +(esEd?'Si era un producto de venta, tocá <strong>"→ Mover a Productos"</strong> arriba.':'Si esto era un producto que querés vender, cancelá y cargalo en <a onclick="cerrarInsumoPanel();goTo(\'productos\')" style="color:var(--green);font-weight:700;cursor:pointer;text-decoration:underline">Productos</a>.')
        +'</div>'
        // Nombre
        +'<div><label style="'+LBL+'">Nombre *</label>'
          +'<input id="ipNom" type="text" value="'+nom+'" oninput="this.value=this.value.toUpperCase()" placeholder="EJ: HARINA TIPO 000" style="'+INP+';font-weight:600" onfocus="this.style.borderColor=\'var(--green)\'" onblur="this.style.borderColor=\'var(--border)\'"></div>'
        // Categoría
        +'<div><label style="'+LBL+'">Categoría</label>'
          +'<input id="ipCat" type="text" value="'+cat+'" list="ipCatList" oninput="this.value=this.value.toUpperCase()" placeholder="EJ: SECOS, LACTEOS, DESCARTABLES..." style="'+INP+'" onfocus="this.style.borderColor=\'var(--green)\'" onblur="this.style.borderColor=\'var(--border)\'">'
          +'<datalist id="ipCatList">'+cats.map(function(c){return '<option value="'+c+'">';}).join('')+'</datalist></div>'
        // Costo
        +'<div><label style="'+LBL+'">Costo unitario (₲)</label>'
          +'<input id="ipCos" type="number" min="0" value="'+cos+'" placeholder="0" style="'+INP+';font-weight:700" onfocus="this.style.borderColor=\'var(--green)\'" onblur="this.style.borderColor=\'var(--border)\'"></div>'
        // Color + Código
        +'<div style="display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:end">'
          +'<div><label style="'+LBL+'">Color</label>'
            +'<input id="ipCol" type="color" value="'+col+'" style="width:52px;height:40px;border:1.5px solid var(--border);border-radius:8px;cursor:pointer;background:none;padding:2px"></div>'
          +'<div><label style="'+LBL+'">Código / SKU</label>'
            +'<input id="ipCod" type="text" value="'+cod+'" placeholder="Opcional" style="'+INP+'" onfocus="this.style.borderColor=\'var(--green)\'" onblur="this.style.borderColor=\'var(--border)\'"></div>'
        +'</div>'
        // Botón guardar
        +'<button id="ipBtnSv" type="button" onclick="_guardarInsumo()" style="width:100%;background:var(--green);border:none;border-radius:9px;color:#fff;font-family:Barlow,sans-serif;font-size:14px;font-weight:800;padding:13px;cursor:pointer;margin-top:4px">Guardar insumo</button>'
      +'</div>'
    +'</div>';

  setTimeout(function(){ var el=document.getElementById('ipNom'); if(el) el.focus(); },80);
}

function cerrarInsumoPanel(){
  var o=document.getElementById('insPanelOverlay');
  if(o) o.style.display='none';
}

async function _guardarInsumo(){
  var nom=(document.getElementById('ipNom').value||'').trim().toUpperCase();
  if(!nom){ toast('Ingresá un nombre'); document.getElementById('ipNom').focus(); return; }
  var cat=(document.getElementById('ipCat').value||'').trim().toUpperCase()||'Sin categoría';
  var cos=parseFloat(document.getElementById('ipCos').value)||0;
  var col=document.getElementById('ipCol').value||'#546e7a';
  var cod=(document.getElementById('ipCod').value||'').trim();

  var btn=document.getElementById('ipBtnSv');
  if(btn){btn.disabled=true;btn.textContent='Guardando...';}

  // Insumos: no se venden → precio 0, sin comanda, sin precio variable,
  // siempre con inventario para que entren al sistema de stock/compras.
  var payload={
    nombre:nom, categoria:cat,
    precio:0, costo:cos, iva:'10',
    precio_variable:false, comanda:false,
    inventario:true, es_insumo:true,
    color:col, codigo:cod,
    activo:true, licencia_email:SE,
    updated_at:new Date().toISOString()
  };

  try{
    if(_insPanel.ins){
      await supaPatch('pos_productos','id=eq.'+_insPanel.ins.id+'&licencia_email=ilike.'+encodeURIComponent(SE),payload);
      toast('Insumo actualizado');
    } else {
      // pos_productos.id no tiene autoincrement → calcular max+1 desde la DB
      payload.id = await _nextProductoId();
      await supaPost('pos_productos',payload,null,true);
      toast('Insumo creado');
    }
    cerrarInsumoPanel();
    allInsumos=await sg('pos_productos','licencia_email=ilike.'+encodeURIComponent(SE)+'&activo=eq.true&es_insumo=is.true&order=nombre.asc&limit=500');
    renderInsT(allInsumos);
  }catch(e){
    toast('Error: '+e.message);
    if(btn){btn.disabled=false;btn.textContent='Guardar insumo';}
  }
}

async function _desactivarInsumo(){
  if(!_insPanel.ins) return;
  if(!confirm('¿Desactivar "'+_insPanel.ins.nombre+'"? Dejará de aparecer en compras e inventario.')) return;
  try{
    await supaPatch('pos_productos','id=eq.'+_insPanel.ins.id+'&licencia_email=ilike.'+encodeURIComponent(SE),{activo:false,updated_at:new Date().toISOString()});
    toast('Insumo desactivado');
    cerrarInsumoPanel();
    allInsumos=await sg('pos_productos','licencia_email=ilike.'+encodeURIComponent(SE)+'&activo=eq.true&es_insumo=is.true&order=nombre.asc&limit=500');
    renderInsT(allInsumos);
  }catch(e){ toast('Error: '+e.message); }
}

// Convierte un insumo en producto de venta — útil cuando el usuario
// cargó algo por error en la pantalla de Insumos.
// Solo cambia es_insumo:false. NO toca precio/inventario para
// que el usuario los corrija después en el panel de Productos.
async function _convertirInsumoAProducto(){
  if(!_insPanel.ins) return;
  if(!confirm('¿Pasar "'+_insPanel.ins.nombre+'" a Productos?\n\nVa a empezar a aparecer en la pantalla de ventas del POS. Después podés editarle el precio desde la pantalla de Productos.')) return;
  try{
    await supaPatch('pos_productos','id=eq.'+_insPanel.ins.id+'&licencia_email=ilike.'+encodeURIComponent(SE),{es_insumo:false,updated_at:new Date().toISOString()});
    toast('Movido a Productos');
    cerrarInsumoPanel();
    allInsumos=await sg('pos_productos','licencia_email=ilike.'+encodeURIComponent(SE)+'&activo=eq.true&es_insumo=is.true&order=nombre.asc&limit=500');
    renderInsT(allInsumos);
  }catch(e){ toast('Error: '+e.message); }
}

async function exportarInsumos(){
  toast('Preparando exportación...');
  var ins = allInsumos.length ? allInsumos : await sg('pos_productos','licencia_email=ilike.'+encodeURIComponent(SE)+'&activo=eq.true&es_insumo=is.true&order=nombre.asc&limit=2000');
  if(!ins.length){ toast('Sin insumos para exportar'); return; }
  var headers = ['id','nombre','categoria','costo','codigo','color'];
  var rows = ins.map(function(p){
    return [p.id||'', p.nombre||'', p.categoria||'', p.costo||0, p.codigo||'', p.color||''];
  });
  if(typeof XLSX !== 'undefined'){
    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.aoa_to_sheet([headers].concat(rows));
    ws['!cols'] = headers.map(function(h){return {wch:h==='nombre'?30:h==='id'?8:16};});
    XLSX.utils.book_append_sheet(wb, ws, 'Insumos');
    XLSX.writeFile(wb, 'catalogo_insumos.xlsx');
    toast('Insumos exportados ('+ins.length+')');
  } else {
    var s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload=function(){ exportarInsumos(); };
    document.head.appendChild(s);
  }
}

function filtrP(q){if(!allPrds.length) return;var f=q.toLowerCase();renderPT(!q?allPrds:allPrds.filter(function(p){return (p.nombre||'').toLowerCase().includes(f)||(p.categoria||'').toLowerCase().includes(f);}));}

// ── FOTO DE PRODUCTO ─────────────────────────────────────

async function _getSupabaseSDK() {
  if (window._sbClient) return window._sbClient;
  await new Promise(function(res, rej) {
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
  window._sbClient = window.supabase.createClient(SUPA_URL, SUPA_ANON);
  return window._sbClient;
}

async function _uploadFotoProducto(blob) {
  var client = await _getSupabaseSDK();
  var fname = encodeURIComponent(SE) + '/' + Date.now() + '.jpg';
  var result = await client.storage.from('productos').upload(fname, blob, {
    contentType: 'image/jpeg', upsert: true
  });
  if (result.error) throw new Error('Storage: ' + result.error.message);
  return SUPA_URL + '/storage/v1/object/public/productos/' + fname;
}

async function _comprimirImagen(src) {
  var bmp = await createImageBitmap(src);
  var MAX = 480, w = bmp.width, h = bmp.height;
  if (w > MAX || h > MAX) { var ratio = Math.min(MAX/w, MAX/h); w = Math.round(w*ratio); h = Math.round(h*ratio); }
  var cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  cv.getContext('2d').drawImage(bmp, 0, 0, w, h);
  return new Promise(function(res){ cv.toBlob(res, 'image/jpeg', 0.82); });
}

function _setFotoPreview(url) {
  var img = document.getElementById('ppFotoImg');
  var ph  = document.getElementById('ppFotoPlaceholder');
  var del = document.getElementById('ppFotoDel');
  if (!img) return;
  if (url) {
    img.src = url; img.style.display = 'block';
    if (ph)  ph.style.display = 'none';
    if (del) del.style.display = 'flex';
  } else {
    img.style.display = 'none';
    if (ph)  ph.style.display = 'flex';
    if (del) del.style.display = 'none';
  }
}

function _eliminarFoto() {
  _ppFoto.blob = null; _ppFoto.url = null;
  _setFotoPreview(null);
}

async function _onFotoFile(input) {
  var file = input.files[0]; input.value = '';
  if (!file) return;
  try {
    var blob = await _comprimirImagen(file);
    _ppFoto.blob = blob; _ppFoto.url = URL.createObjectURL(blob);
    _setFotoPreview(_ppFoto.url);
  } catch(e) { toast('Error al leer imagen'); }
}

function _abrirCamaraModal() {
  var m = document.createElement('div');
  m.id = 'camaraModal';
  m.style.cssText = 'position:fixed;inset:0;z-index:300;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box';
  m.addEventListener('click', function(e){ if (e.target === m) _cerrarCamaraModal(); });
  m.innerHTML =
    '<div style="background:var(--card);border-radius:14px;overflow:hidden;width:min(88vw,400px);display:flex;flex-direction:column">'
    +'<div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">'
      +'<span style="font-size:15px;font-weight:800">Sacar foto</span>'
      +'<button type="button" onclick="_cerrarCamaraModal()" style="background:none;border:none;color:var(--muted);cursor:pointer;padding:2px;display:flex"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>'
    +'</div>'
    +'<div style="background:#111;position:relative;aspect-ratio:4/3;max-height:300px;overflow:hidden;display:flex;align-items:center;justify-content:center">'
      +'<video id="camaraVideo" autoplay playsinline muted style="width:100%;height:100%;object-fit:cover"></video>'
      +'<div id="camaraErr" style="display:none;position:absolute;inset:0;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:#ccc;padding:20px;text-align:center">'
        +'<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>'
        +'<span id="camaraErrMsg" style="font-size:13px">Sin acceso a la cámara</span>'
        +'<button type="button" onclick="document.getElementById(\'ppFotoFile\').click();_cerrarCamaraModal()" style="background:var(--b2);border:1px solid var(--blue);border-radius:7px;color:var(--blue);font-family:Barlow,sans-serif;font-size:13px;font-weight:700;padding:8px 16px;cursor:pointer">Seleccionar archivo</button>'
      +'</div>'
    +'</div>'
    +'<div style="padding:14px 16px;display:flex;gap:8px;justify-content:center;align-items:center">'
      +'<button type="button" onclick="_togCamara()" style="background:var(--card2);border:1px solid var(--border);border-radius:8px;color:var(--text2);font-family:Barlow,sans-serif;font-size:12px;font-weight:700;padding:9px 14px;cursor:pointer;display:flex;align-items:center;gap:6px"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>Girar</button>'
      +'<button type="button" onclick="_capturarFoto()" style="background:var(--green);border:none;border-radius:8px;color:#fff;font-family:Barlow,sans-serif;font-size:14px;font-weight:800;padding:10px 28px;cursor:pointer;display:flex;align-items:center;gap:7px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>Capturar</button>'
    +'</div>'
    +'</div>';
  document.body.appendChild(m);
  _iniciarCamara();
}

async function _iniciarCamara() {
  var video = document.getElementById('camaraVideo');
  var errDiv = document.getElementById('camaraErr');
  if (!video) return;
  try {
    if (_ppFoto.stream) { _ppFoto.stream.getTracks().forEach(function(t){ t.stop(); }); }
    var stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: _ppFoto.facingMode, width: { ideal: 1280 }, height: { ideal: 960 } },
      audio: false
    });
    _ppFoto.stream = stream;
    video.srcObject = stream;
    if (errDiv) errDiv.style.display = 'none';
    video.style.display = 'block';
  } catch(e) {
    if (errDiv) {
      errDiv.style.display = 'flex';
      var msg = document.getElementById('camaraErrMsg');
      if (msg) msg.textContent = (e.name === 'NotAllowedError'
        ? 'Permiso denegado — revisá la configuración del navegador'
        : 'Cámara no disponible en este dispositivo');
    }
    if (video) video.style.display = 'none';
  }
}

async function _togCamara() {
  _ppFoto.facingMode = (_ppFoto.facingMode === 'environment' ? 'user' : 'environment');
  await _iniciarCamara();
}

async function _capturarFoto() {
  var video = document.getElementById('camaraVideo');
  if (!video || !video.srcObject) return;
  try {
    var blob = await _comprimirImagen(video);
    _ppFoto.blob = blob; _ppFoto.url = URL.createObjectURL(blob);
    _cerrarCamaraModal();
    _setFotoPreview(_ppFoto.url);
  } catch(e) { toast('Error al capturar: ' + e.message); }
}

function _cerrarCamaraModal() {
  if (_ppFoto.stream) {
    _ppFoto.stream.getTracks().forEach(function(t){ t.stop(); });
    _ppFoto.stream = null;
  }
  var m = document.getElementById('camaraModal');
  if (m) m.remove();
}
