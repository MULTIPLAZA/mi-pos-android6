// ── Productos, Categorías, Descuentos, Modificadores ──
// ── ARTÍCULOS ────────────────────────────────────────────────────────────────
const COLORES_TILE = [
  '#e65100','#c62828','#b71c1c','#ad1457','#6a1b9a',
  '#1565c0','#01579b','#006064','#2e7d32','#1b5e20',
  '#827717','#6d6f1a','#33691e','#4e342e','#37474f',
  '#558b2f','#bf360c','#00695c','#0277bd','#283593',
];
var CATEGORIAS = [];
var nextCatId  = 1;
var CATEGORIAS_DEFAULT = CATEGORIAS.map(c => c.nombre);

// Descuentos (igual que productos pero categoría especial)
var DESCUENTOS = []; // {id, name, tipo:'%'|'monto', valor:null|number, color:'#e53935'}
var nextDescId = 9000;

// ════════════════════════════════════════════════════════
// DESCUENTOS
// ════════════════════════════════════════════════════════

let descEditId = null;
let descTipoSel = '%';

function goToDescuentos(){
  goTo('scDescuentos');
  renderDescList();
  renderCategoriasVenta(); // actualizar categorías en pantalla de ventas
}

function renderDescList(){
  const list = document.getElementById('descList');
  if(!list) return;

  // Combinar DESCUENTOS[] + productos de Supabase con cat='Descuentos'
  const descIds = new Set(DESCUENTOS.map(d=>String(d.id)));
  const prodsDesc = PRODS.filter(p=>
    p.cat==='Descuentos' && p.activo!==false && !descIds.has(String(p.id))
  );
  const descs = [
    ...DESCUENTOS.filter(d=>d.activo!==false),
    ...prodsDesc.map(p=>({
      id:p.id, name:p.name,
      tipo:p.descTipo||'%', valor:p.descValor||null,
      color:'#e53935', activo:true
    }))
  ];

  if(!descs.length){
    list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);font-size:14px;">'+
      '<div style="font-size:32px;margin-bottom:8px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg></div>'+
      'Sin descuentos creados<br>'+
      '<span style="font-size:12px;">Tocá + para crear uno</span></div>';
    return;
  }

  list.innerHTML = descs.map(d => {
    const valorStr = d.valor != null
      ? (d.tipo==='%' ? d.valor+'%' : gs(d.valor))
      : '<span style="color:#555;font-style:italic;">se ingresa al vender</span>';
    return '<div class="art-item" onclick="editarDesc('+d.id+')" style="border-left:3px solid #e53935;">'+
      '<div class="art-item-color" style="background:#e53935;font-size:12px;font-weight:800;">%</div>'+
      '<div class="art-item-info">'+
        '<div class="art-item-name">'+d.name+'</div>'+
        '<div class="art-item-meta">'+
          '<span>'+(d.tipo==='%'?'Porcentaje':'Monto fijo')+'</span>'+
          '<span>·</span><span>'+valorStr+'</span>'+
        '</div>'+
      '</div>'+
      '<button onclick="event.stopPropagation();eliminarDesc('+d.id+')" '+
        'style="background:rgba(239,83,80,.1);border:1px solid var(--red);border-radius:6px;'+
        'color:var(--red);font-size:11px;font-weight:700;padding:6px 10px;cursor:pointer;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>'+
    '</div>';
  }).join('');
}

function abrirNuevoDesc(){
  descEditId = null;
  descTipoSel = '%';
  document.getElementById('mDescTitulo').textContent = 'Nuevo Descuento';
  document.getElementById('mDescNombre').value = '';
  document.getElementById('mDescValor').value = '';
  selDescTipo('%');
  document.getElementById('mDescOv').style.display = 'flex';
  setTimeout(()=>document.getElementById('mDescNombre').focus(), 100);
}

function editarDesc(id){
  const d = DESCUENTOS.find(x=>x.id===id);
  if(!d) return;
  descEditId  = id;
  descTipoSel = d.tipo || '%';
  document.getElementById('mDescTitulo').textContent = 'Editar Descuento';
  document.getElementById('mDescNombre').value = d.name;
  document.getElementById('mDescValor').value  = d.valor != null ? d.valor : '';
  selDescTipo(d.tipo || '%');
  document.getElementById('mDescOv').style.display = 'flex';
}

function selDescTipo(tipo){
  descTipoSel = tipo;
  const bPct   = document.getElementById('mDescTipoPct');
  const bMonto = document.getElementById('mDescTipoMonto');
  if(bPct){
    bPct.style.borderColor   = tipo==='%'     ? 'var(--green)' : '#2a2a2a';
    bPct.style.background    = tipo==='%'     ? 'rgba(76,175,80,.1)' : 'transparent';
    bPct.style.color         = tipo==='%'     ? 'var(--green)' : '#aaa';
  }
  if(bMonto){
    bMonto.style.borderColor = tipo==='monto' ? 'var(--green)' : '#2a2a2a';
    bMonto.style.background  = tipo==='monto' ? 'rgba(76,175,80,.1)' : 'transparent';
    bMonto.style.color       = tipo==='monto' ? 'var(--green)' : '#aaa';
  }
  const inp = document.getElementById('mDescValor');
  if(inp) inp.placeholder = tipo==='%'
    ? 'Ej: 10 (= 10%) — vacío = ingresar al vender'
    : 'Ej: 5000 — vacío = ingresar al vender';
}

function cerrarMDesc(){
  document.getElementById('mDescOv').style.display = 'none';
}

function guardarDesc(){
  const nombre   = document.getElementById('mDescNombre').value.trim();
  const valorStr = document.getElementById('mDescValor').value.trim();
  const valor    = valorStr !== '' ? parseFloat(valorStr) : null;

  if(!nombre){ toast('Ingresá un nombre'); return; }
  if(descTipoSel==='%' && valor!=null && (valor<=0||valor>100)){
    toast('El porcentaje debe ser entre 1 y 100'); return;
  }

  if(descEditId != null){
    const d = DESCUENTOS.find(x=>x.id===descEditId);
    if(d){ d.name=nombre; d.tipo=descTipoSel; d.valor=valor; }
  } else {
    DESCUENTOS.push({
      id:    nextDescId++,
      name:  nombre,
      tipo:  descTipoSel,
      valor: valor,
      color: '#e53935',
      activo:true
    });
  }

  // Persistir en pos_config y localStorage
  guardarDescuentosConfig();
  cerrarMDesc();
  renderDescList();
  filterP();
  toast('Descuento guardado');
}

function guardarDescuentosConfig(){
  // Guardar en localStorage
  localStorage.setItem('pos_descuentos', JSON.stringify(DESCUENTOS));
  // Guardar en Supabase pos_config
  const email = localStorage.getItem('lic_email');
  if(!email || USAR_DEMO) return;
  supaPost('pos_config', {
      licencia_email: email,
      clave: 'descuentos_config',
      valor: JSON.stringify(DESCUENTOS)
    }, 'licencia_email,clave')
  .catch(e=>{ console.warn('[Desc] No se pudo guardar en Supabase:', e.message); toast('Error al guardar descuento en la nube'); });
}

async function cargarDescuentosConfig(){
  // 1. Intentar desde Supabase
  try {
    const email = localStorage.getItem('lic_email');
    if(email && !USAR_DEMO){
      const data = await supaGet('pos_config',
        'licencia_email=eq.'+encodeURIComponent(email)+
        '&clave=eq.descuentos_config&select=valor');
      {
        if(data && data[0] && data[0].valor){
          const parsed = JSON.parse(data[0].valor);
          if(Array.isArray(parsed) && parsed.length){
            DESCUENTOS.length = 0;
            parsed.forEach(d=>DESCUENTOS.push(d));
            localStorage.setItem('pos_descuentos', JSON.stringify(DESCUENTOS));
            _log('[Desc] Cargados desde Supabase:', DESCUENTOS.length);
            return;
          }
        }
      }
    }
  } catch(e){ console.warn('[Desc] Fallback a localStorage'); }

  // 2. Fallback localStorage
  try {
    const stored = localStorage.getItem('pos_descuentos');
    if(stored){
      const parsed = JSON.parse(stored);
      if(Array.isArray(parsed)){
        DESCUENTOS.length = 0;
        parsed.forEach(d=>DESCUENTOS.push(d));
        _log('[Desc] Cargados desde localStorage:', DESCUENTOS.length);
      }
    }
  } catch(e){ console.warn('[Desc] Error cargando descuentos:', e.message); }
}

function eliminarDesc(id){
  if(!confirm('Eliminar este descuento?')) return;
  const idx = DESCUENTOS.findIndex(x=>x.id===id);
  if(idx>=0) DESCUENTOS.splice(idx,1);
  guardarDescuentosConfig();
  renderDescList();
  filterP();
  toast('Descuento eliminado');
}

// Agregar descuento al carrito
function addDescuento(descId){
  const d = DESCUENTOS.find(x=>x.id===descId);
  if(!d) return;

  // Calcular subtotal actual del carrito (sin otros descuentos)
  const subtotal = cart
    .filter(i=>!i.esDescuento)
    .reduce((s,i)=>s+calcItemTotal(i),0);

  if(!subtotal){ toast('Agregá productos primero'); return; }

  let monto = 0;

  const tipo  = d.descTipo  || d.tipo  || '%';
  const valor = d.descValor != null ? d.descValor : (d.valor != null ? d.valor : null);

  if(valor != null){
    // Valor predefinido
    monto = tipo==='%'
      ? Math.round(subtotal * valor / 100)
      : valor;
  } else {
    // Pedir valor en el momento
    const input = prompt(
      tipo==='%'
        ? 'Ingresá el porcentaje de descuento (1-100):'
        : 'Ingresá el monto del descuento:'
    );
    if(input===null) return;
    const val = parseFloat(input);
    if(!val || val<=0){ toast('Valor inválido'); return; }
    monto = d.tipo==='%'
      ? Math.round(subtotal * Math.min(val,100) / 100)
      : val;
  }

  if(monto<=0){ toast('Monto de descuento inválido'); return; }
  if(monto>subtotal){ toast('El descuento no puede superar el subtotal'); return; }

  // Agregar como ítem especial
  cart.push({
    lineId:      Date.now()*1000+Math.floor(Math.random()*1000),
    id:          descId,
    name:        d.name,
    price:       -monto,
    qty:         1,
    obs:         '',
    color:       '#e53935',
    esDescuento: true,
    montoDesc:   monto,
    iva:         'exento',
    enviado:     true, // descuentos no van a comanda
  });

  updUI();
  if(showTkt) renderTkt();
  toast('Descuento aplicado: '+gs(monto));
}


let artEditIdx = -1;
let artColorSel = COLORES_TILE[0];
let artColorManual = false;
// Categoría por defecto cuando todavía no hay categorías cargadas.
// En retail evitamos el sesgo gastronómico ('Comidas') → 'General'.
function _catDefault(){
  try { if(typeof esRetail === 'function' && esRetail()) return 'General'; } catch(e){}
  return 'Comidas';
}
let artCatSel = _catDefault();
let artIvaSel = '10';
let artImagenBase64 = null; // imagen del producto actual en edición
var nextProdId = 100;

function getProductColor(prod){
  if(prod.colorPropio) return prod.color;
  const cat = CATEGORIAS.find(c => c.nombre === prod.cat);
  return cat ? cat.color : (prod.color || '#546e7a');
}

PRODS.forEach((p,i) => {
  if(!p.prodId)          p.prodId        = i + 1;
  if(!p.codigo)          p.codigo        = '';
  if(!p.costo)           p.costo         = 0;
  if(!p.iva)             p.iva           = '10';
  if(p.precioVariable === undefined) p.precioVariable = false;
  if(p.mitad === undefined)          p.mitad          = false;
  if(p.inventario === undefined)     p.inventario     = false;
  if(p.comanda === undefined)        p.comanda        = false;
  if(p.colorPropio === undefined)    p.colorPropio    = false;
});
nextProdId = PRODS.length + 1;

// ── IMAGEN DE PRODUCTO — Cropper + Supabase Storage ────
let _cropFile = null;
let _cropScale = 1;
let _cropOffX = 0, _cropOffY = 0;
let _cropDragging = false;
let _cropLastX = 0, _cropLastY = 0;
let _cropImgW = 0, _cropImgH = 0;
const CROP_SIZE = 280; // px del área de recorte

function onArtImgChange(input){
  const file = input.files[0];
  if(!file) return;
  _cropFile = file;
  const url = URL.createObjectURL(file);
  const img = document.getElementById('cropImg');
  img.onload = function(){
    _cropImgW = img.naturalWidth;
    _cropImgH = img.naturalHeight;
    // Zoom inicial: que la imagen cubra el área de recorte
    const minScale = Math.max(CROP_SIZE/_cropImgW, CROP_SIZE/_cropImgH);
    _cropScale = minScale;
    // Centrar
    _cropOffX = (CROP_SIZE - _cropImgW * _cropScale) / 2;
    _cropOffY = (CROP_SIZE - _cropImgH * _cropScale) / 2;
    const slider = document.getElementById('cropZoomSlider');
    // slider: 100 = minScale, 400 = minScale*4
    slider.min = 100; slider.max = 400; slider.value = 100;
    document.getElementById('cropZoomLbl').textContent = '1×';
    _cropApply();
    document.getElementById('cropOverlay').classList.add('open');
  };
  img.src = url;
  input.value = ''; // reset para poder elegir la misma imagen
}

function _cropApply(){
  const img = document.getElementById('cropImg');
  img.style.width  = (_cropImgW * _cropScale) + 'px';
  img.style.height = (_cropImgH * _cropScale) + 'px';
  img.style.left   = _cropOffX + 'px';
  img.style.top    = _cropOffY + 'px';
}

function _cropClamp(){
  const w = _cropImgW * _cropScale;
  const h = _cropImgH * _cropScale;
  if(w >= CROP_SIZE){ _cropOffX = Math.min(0, Math.max(CROP_SIZE - w, _cropOffX)); }
  else { _cropOffX = (CROP_SIZE - w) / 2; }
  if(h >= CROP_SIZE){ _cropOffY = Math.min(0, Math.max(CROP_SIZE - h, _cropOffY)); }
  else { _cropOffY = (CROP_SIZE - h) / 2; }
}

function cropZoom(val){
  const slider = document.getElementById('cropZoomSlider');
  const minScale = Math.max(CROP_SIZE/_cropImgW, CROP_SIZE/_cropImgH);
  const newScale = minScale * (val / 100);
  // Zoom centrado en el punto medio del área
  const cx = CROP_SIZE / 2;
  const cy = CROP_SIZE / 2;
  _cropOffX = cx - (cx - _cropOffX) * (newScale / _cropScale);
  _cropOffY = cy - (cy - _cropOffY) * (newScale / _cropScale);
  _cropScale = newScale;
  _cropClamp();
  _cropApply();
  document.getElementById('cropZoomLbl').textContent = (val/100).toFixed(1) + '×';
}

// Drag — mouse
(function(){
  const wrap = document.getElementById ? null : null; // se inicializa en DOMContentLoaded
  document.addEventListener('DOMContentLoaded', function(){
    const w = document.getElementById('cropWrapper');
    if(!w) return;
    w.addEventListener('mousedown', function(e){ _cropDragging=true; _cropLastX=e.clientX; _cropLastY=e.clientY; e.preventDefault(); });
    document.addEventListener('mousemove', function(e){
      if(!_cropDragging) return;
      _cropOffX += e.clientX - _cropLastX;
      _cropOffY += e.clientY - _cropLastY;
      _cropLastX=e.clientX; _cropLastY=e.clientY;
      _cropClamp(); _cropApply();
    });
    document.addEventListener('mouseup', function(){ _cropDragging=false; });
    // Touch
    w.addEventListener('touchstart', function(e){ const t=e.touches[0]; _cropDragging=true; _cropLastX=t.clientX; _cropLastY=t.clientY; }, {passive:true});
    w.addEventListener('touchmove', function(e){
      if(!_cropDragging) return;
      const t=e.touches[0];
      _cropOffX += t.clientX - _cropLastX;
      _cropOffY += t.clientY - _cropLastY;
      _cropLastX=t.clientX; _cropLastY=t.clientY;
      _cropClamp(); _cropApply();
      e.preventDefault();
    }, {passive:false});
    w.addEventListener('touchend', function(){ _cropDragging=false; });
  });
})();

function cropCancelar(){
  document.getElementById('cropOverlay').classList.remove('open');
  _cropFile = null;
}

async function cropConfirmar(){
  // Renderizar el recorte en un canvas 400×400
  const OUTPUT = 400;
  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT; canvas.height = OUTPUT;
  const ctx = canvas.getContext('2d');
  const img  = document.getElementById('cropImg');
  const ratio = OUTPUT / CROP_SIZE;
  ctx.drawImage(
    img,
    -_cropOffX * ratio,
    -_cropOffY * ratio,
    _cropImgW * _cropScale * ratio,
    _cropImgH * _cropScale * ratio
  );
  document.getElementById('cropOverlay').classList.remove('open');

  // Mostrar preview mientras sube
  const previewUrl = canvas.toDataURL('image/jpeg', 0.85);
  mostrarPreviewImagen(previewUrl, true);

  try {
    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.85));
    const email    = localStorage.getItem('lic_email') || 'demo';
    const filename = 'prod_'+Date.now()+'_'+Math.random().toString(36).slice(2,7)+'.jpg';
    const path     = email.replace(/[^a-z0-9]/gi,'_')+'/'+filename;

    // Eliminar imagen anterior del Storage si existe y es diferente
    const imgAnterior = window._artImagenAnterior;
    if(imgAnterior && imgAnterior.includes('/storage/v1/object/public/productos/')){
      try {
        const oldPath = imgAnterior.split('/storage/v1/object/public/productos/')[1];
        await fetch(SUPA_URL+'/storage/v1/object/productos/'+oldPath, {
          method: 'DELETE',
          headers: {
            'apikey':        SUPA_ANON,
            'Authorization': 'Bearer '+SUPA_ANON,
          }
        });
        // Limpiar cache local de la imagen anterior
        if(db) try { await db.config.delete('img_cache_'+imgAnterior); } catch(e){/* IndexedDB cache cleanup — no afecta funcionalidad */}
        _log('[Imagen] Anterior eliminada:', oldPath);
      } catch(ed){ console.warn('[Imagen] Error borrando anterior:', ed.message); }
    }
    window._artImagenAnterior = null;

    const r = await fetch(
      SUPA_URL+'/storage/v1/object/productos/'+path,
      {
        method:'POST',
        headers:{
          'apikey':        SUPA_ANON,
          'Authorization': 'Bearer '+SUPA_ANON,
          'Content-Type':  'image/jpeg',
          'x-upsert':      'true',
        },
        body: blob,
      }
    );
    if(!r.ok){ const t=await r.text(); throw new Error(t.substring(0,120)); }

    const publicUrl = SUPA_URL+'/storage/v1/object/public/productos/'+path;
    artImagenBase64 = publicUrl;
    mostrarPreviewImagen(publicUrl, false);

    // Cachear en IndexedDB para offline
    if(db){
      try {
        await db.config.put({ clave:'img_cache_'+publicUrl, valor: previewUrl });
        _log('[Imagen] Cacheada en IndexedDB');
      } catch(e){/* IndexedDB cache write — no afecta funcionalidad */}
    }
    _log('[Imagen] Subida OK:', publicUrl);
    toast('Imagen guardada');
  } catch(e){
    console.warn('[Imagen] Error Storage:', e.message);
    // Fallback: usar el base64 del canvas localmente
    artImagenBase64 = previewUrl;
    mostrarPreviewImagen(previewUrl, false);
    toast('Sin internet — imagen guardada localmente');
  }
}

// Comprimir imagen antes de subir
async function comprimirImagen(file, maxSize, quality){
  return new Promise((resolve)=>{
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = function(){
      URL.revokeObjectURL(url);
      let w = img.width, h = img.height;
      if(w > maxSize || h > maxSize){
        if(w > h){ h = Math.round(h * maxSize/w); w = maxSize; }
        else      { w = Math.round(w * maxSize/h); h = maxSize; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => resolve(blob || file), 'image/jpeg', quality);
    };
    img.onerror = ()=>resolve(file);
    img.src = url;
  });
}

function mostrarPreviewImagen(src, uploading){
  const preview = document.getElementById('artImgPreview');
  const img     = document.getElementById('artImgPreviewImg');
  const upload  = document.getElementById('artImgUpload');
  if(!preview) return;
  if(src){
    img.src = src;
    img.style.opacity = uploading ? '0.5' : '1';
    preview.style.display = 'block';
    upload.style.display  = 'none';
    if(uploading){
      const lbl = upload.querySelector('div');
      if(lbl) lbl.textContent = 'Subiendo...';
    }
  } else {
    preview.style.display = 'none';
    upload.style.display  = 'block';
  }
}

async function quitarImagen(){
  // Eliminar del Storage si hay imagen anterior
  const imgAnterior = window._artImagenAnterior;
  if(imgAnterior && imgAnterior.includes('/storage/v1/object/public/productos/')){
    try {
      const oldPath = imgAnterior.split('/storage/v1/object/public/productos/')[1];
      await fetch(SUPA_URL+'/storage/v1/object/productos/'+oldPath, {
        method: 'DELETE',
        headers: { 'apikey': SUPA_ANON, 'Authorization': 'Bearer '+SUPA_ANON }
      });
      if(db) try { await db.config.delete('img_cache_'+imgAnterior); } catch(e){/* IndexedDB cache cleanup — no afecta funcionalidad */}
      _log('[Imagen] Eliminada del Storage:', oldPath);
      toast('Imagen eliminada');
    } catch(e){ console.warn('[Imagen] Error borrando:', e.message); toast('Error al eliminar imagen'); }
  }
  window._artImagenAnterior = null;
  artImagenBase64 = ''; // string vacío = borrar imagen (distinto de null = no cambiar)
  mostrarPreviewImagen(null, false);
  document.getElementById('artImgInput').value = '';
}

function resetArtImagen(){
  artImagenBase64 = null;
  mostrarPreviewImagen(null, false);
  const inp = document.getElementById('artImgInput');
  if(inp) inp.value = '';
}

function renderArtList(filter){
  filter = filter || '';
  const list = document.getElementById('artList');
  if(!list) return;

  // Todos los productos (excluir ítem libre, descuentos y INSUMOS — se gestionan en el panel admin)
  let items = PRODS.filter(p =>
    !p.itemLibre && !p.esInsumo &&
    (!filter ||
      p.name.toLowerCase().includes(filter.toLowerCase()) ||
      (p.codigo && p.codigo.includes(filter)))
  );

  // Separar activos e inactivos
  const activos   = items.filter(p => p.activo !== false);
  const inactivos = items.filter(p => p.activo === false || p.activo === 0);

  if(!activos.length && !inactivos.length){
    list.innerHTML = '<div class="art-empty"><p>No hay artículos</p></div>';
    return;
  }

  list.innerHTML = '';

  // ── Artículos ACTIVOS ──
  activos.forEach(p => {
    list.appendChild(buildArtItem(p, false));
  });

  // ── Separador + INACTIVOS ──
  if(inactivos.length){
    const sep = document.createElement('div');
    sep.style.cssText = 'padding:10px 14px 4px;font-size:10px;font-weight:700;'+
      'color:var(--muted);letter-spacing:1px;text-transform:uppercase;'+
      'border-top:1px solid #1e1e1e;margin-top:6px;';
    sep.textContent = '── Desactivados ('+inactivos.length+') ──';
    list.appendChild(sep);

    inactivos.forEach(p => {
      list.appendChild(buildArtItem(p, true));
    });
  }
}

function buildArtItem(p, inact){
  const prodIdx  = PRODS.indexOf(p);
  const priceStr = p.precioVariable
    ? '<span style="color:#ff9800;font-size:12px;">Precio variable</span>'
    : gs(p.price);
  const ivaStr   = p.iva==='exento' ? 'Exento' : 'IVA '+p.iva+'%';

  const div = document.createElement('div');
  div.className = 'art-item';
  if(inact){
    div.style.opacity    = '0.55';
    div.style.borderLeft = '3px solid #ef5350';
  }

  div.onclick = () => inact ? mostrarOpcionesInactivo(prodIdx) : editarArticulo(prodIdx);

  div.innerHTML =
    '<div class="art-item-color" style="background:'+(inact?'#2a2a2a':getProductColor(p))+'">'+
      '<span style="font-size:11px;font-weight:700;">'+(inact?'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>':p.name.substring(0,2))+'</span>'+
    '</div>'+
    '<div class="art-item-info">'+
      '<div class="art-item-name">'+p.name+
        (inact?' <span style="font-size:10px;background:rgba(239,83,80,.2);color:#ef5350;'+
          'border-radius:3px;padding:1px 6px;font-weight:700;">INACTIVO</span>':'')+
      '</div>'+
      '<div class="art-item-meta">'+
        '<span>'+p.cat+'</span><span>·</span><span>'+ivaStr+'</span>'+
        (p.codigo?'<span>·</span><span style="color:#555;">'+p.codigo+'</span>':'')+
      '</div>'+
    '</div>'+
    (inact
      ? '<button onclick="event.stopPropagation();reactivarArticulo('+prodIdx+')" '+
          'style="background:rgba(76,175,80,.12);border:1px solid var(--green);'+
          'border-radius:6px;color:var(--green);font-size:11px;font-weight:700;'+
          'padding:6px 12px;cursor:pointer;white-space:nowrap;flex-shrink:0;">↑ ACTIVAR</button>'
      : '<div class="art-item-price">'+priceStr+'</div>'
    );

  return div;
}


// Mostrar opciones para artículo inactivo
function mostrarOpcionesInactivo(prodIdx){
  const p = PRODS[prodIdx];
  if(!p) return;
  const opc = confirm('Reactivar "'+p.name+'"? Volverá a aparecer en ventas.');
  if(opc) reactivarArticulo(prodIdx);
}

// Reactivar artículo
async function reactivarArticulo(prodIdx){
  const p = PRODS[prodIdx];
  if(!p) return;

  // 1. Marcar en memoria
  p.activo = true;
  delete p.deleted_at;

  // 2. Dexie
  if(db) await db.productos.update(p.id, {activo:true, updatedAt:new Date().toISOString()});

  // 3. Supabase
  const email = localStorage.getItem('lic_email');
  if(email && !USAR_DEMO){
    try {
      await supaPatch('pos_productos',
        'id=eq.'+p.id+'&licencia_email=eq.'+encodeURIComponent(email),
        {activo:true}, true);
      _log('[Producto] Reactivado OK:', p.name);
    } catch(e){ console.warn('[Producto] Sin conexión:', e.message); toast('Error al reactivar producto en la nube'); }
  }

  filterP();
  renderArtList();
  toast('"'+p.name+'" reactivado');
}

function filterArts(){
  renderArtList(document.getElementById('artSearch').value);
}

function nuevoArticulo(){
  artEditIdx = -1;
  artImagenBase64 = null;
  setTimeout(()=>resetArtImagen(), 50);
  artEditIdx = -1;
  artCatSel = CATEGORIAS.length > 0 ? CATEGORIAS[0].nombre : _catDefault();
  artIvaSel = '10';
  artColorManual = false;
  const catObj = CATEGORIAS.find(c => c.nombre === artCatSel);
  artColorSel = catObj ? catObj.color : COLORES_TILE[0];
  document.getElementById('artFormTitle').textContent = 'Nuevo artículo';
  document.getElementById('artIdDisplay').textContent = 'ID: (se asigna al guardar)';
  document.getElementById('artNombre').value = '';
  document.getElementById('artCodigo').value = '';
  // codigos es ahora textarea — limpiar
  document.getElementById('artPrecio').value = '';
  document.getElementById('artCosto').value = '';
  document.getElementById('artMitad').checked    = false;
  document.getElementById('artInventario').checked = false;
  document.getElementById('artComanda').checked   = false;
  document.getElementById('artEsKilo').checked    = false;
  document.getElementById('artFavorito').checked  = false;
  document.getElementById('btnEliminarArt').style.display = 'none';
  // Ocultar opciones gastronómicas si el negocio no las usa
  var _rowMitad = document.getElementById('artCheckMitad');
  if(_rowMitad) _rowMitad.style.display = (typeof usaMitades === 'function' && !usaMitades()) ? 'none' : '';
  selIva('10');
  renderColorPicker();
  renderCatSelector();
  goTo('scArticuloNuevo');
  setTimeout(()=>document.getElementById('artNombre').focus(), 300);
}

function editarArticulo(idx){
  const p = PRODS[idx];
  artEditIdx = idx;
  artColorSel = p.colorPropio ? p.color : getProductColor(p);
  artColorManual = !!p.colorPropio;
  artCatSel = p.cat;
  artIvaSel = p.iva || '10';
  document.getElementById('artFormTitle').textContent = 'Editar artículo';
  document.getElementById('artIdDisplay').textContent = 'ID interno: ' + p.prodId;
  document.getElementById('artNombre').value = p.name;
  // Mostrar todos los códigos, uno por línea
  var _allCodigos = (p.codigos && p.codigos.length ? p.codigos : (p.codigo ? [p.codigo] : []));
  document.getElementById('artCodigo').value = _allCodigos.join('\n');
  document.getElementById('artPrecio').value = p.precioVariable ? '' : p.price;
  document.getElementById('artCosto').value = p.costo || '';
  document.getElementById('artMitad').checked = !!p.mitad;
  document.getElementById('artInventario').checked = !!p.inventario;
  document.getElementById('artComanda').checked  = !!p.comanda;
  document.getElementById('artEsKilo').checked   = !!p.esKilo;
  document.getElementById('artFavorito').checked = !!p.esFavorito;
  document.getElementById('btnEliminarArt').style.display = 'flex';
  // Ocultar opciones gastronómicas si el negocio no las usa
  var _rowMitad2 = document.getElementById('artCheckMitad');
  if(_rowMitad2) _rowMitad2.style.display = (typeof usaMitades === 'function' && !usaMitades()) ? 'none' : '';
  selIva(artIvaSel);
  renderColorPicker();
  renderCatSelector();
  // Cargar imagen existente — guardar URL anterior para borrarla si se cambia
  artImagenBase64 = null; // null = no cambiar
  window._artImagenAnterior = p.imagen || null;
  setTimeout(()=>mostrarPreviewImagen(p.imagen||null), 80);
  goTo('scArticuloNuevo');
}

function selIva(val){
  artIvaSel = val;
  ['iva0','iva5','iva10'].forEach(id => { const el=document.getElementById(id); if(el) el.classList.remove('sel'); });
  const map = {'exento':'iva0','5':'iva5','10':'iva10'};
  const el = document.getElementById(map[val]);
  if(el) el.classList.add('sel');
}

function renderColorPicker(){
  const row = document.getElementById('artColorRow');
  if(!row) return;
  row.innerHTML = '';
  COLORES_TILE.forEach(c => {
    const div = document.createElement('div');
    div.className = 'color-opt' + (c===artColorSel?' sel':'');
    div.style.background = c;
    div.dataset.color = c;
    div.onclick = () => selColor(c);
    row.appendChild(div);
  });
}

function selColor(c){
  artColorSel = c;
  artColorManual = true;
  document.querySelectorAll('.color-opt').forEach(el =>
    el.classList.toggle('sel', el.dataset.color === c)
  );
}

function renderCatSelector(){
  const row = document.getElementById('artCatRow');
  if(!row) return;
  row.innerHTML = '';
  CATEGORIAS.forEach(cat => {
    const div = document.createElement('div');
    div.className = 'cat-sel-opt' + (cat.nombre===artCatSel?' sel':'');
    div.textContent = cat.nombre;
    div.onclick = () => selCat(cat.nombre);
    row.appendChild(div);
  });
}

function selCat(cat){
  artCatSel = cat;
  document.querySelectorAll('.cat-sel-opt').forEach(el => el.classList.toggle('sel', el.textContent.trim()===cat));
  if(!artColorManual){
    const catObj = CATEGORIAS.find(c => c.nombre === cat);
    if(catObj){ artColorSel = catObj.color; renderColorPicker(); }
  }
}

function guardarArticulo(){
  const nombre = document.getElementById('artNombre').value.trim();
  const precioStr = document.getElementById('artPrecio').value.trim();
  const precio = parseInt(precioStr) || 0;
  const precioVariable = precioStr === '';
  const costo = parseInt(document.getElementById('artCosto').value) || 0;
  // Leer códigos del textarea: uno por línea, limpiar vacíos y duplicados
  const codigos = document.getElementById('artCodigo').value
    .split('\n').map(function(c){ return c.trim(); }).filter(Boolean)
    .filter(function(c, i, arr){ return arr.indexOf(c) === i; });
  const codigo = codigos[0] || ''; // primer código = primario (compatibilidad)
  const mitad = document.getElementById('artMitad').checked;
  const inventario = document.getElementById('artInventario').checked;
  const comanda    = document.getElementById('artComanda').checked;
  const esKilo     = document.getElementById('artEsKilo').checked;
  const esFavorito = document.getElementById('artFavorito').checked;
  if(!nombre){ toast('Ingresá el nombre del artículo'); return; }

  // Validar que ningún código ya esté en otro producto
  for(var _ci = 0; _ci < codigos.length; _ci++){
    var _cn = codigos[_ci].toLowerCase();
    var _dup = PRODS.find(function(p, idx){
      if(idx === artEditIdx || p.itemLibre) return false;
      if(p.codigo && p.codigo.toLowerCase() === _cn) return true;
      if(p.codigos && p.codigos.some(function(c){ return c.toLowerCase() === _cn; })) return true;
      return false;
    });
    if(_dup){ toast('El código "' + codigos[_ci] + '" ya existe en "' + _dup.name + '"'); return; }
  }

  if(artEditIdx >= 0){
    const imgUpdate = artImagenBase64 !== null ? {imagen: artImagenBase64 || null} : {};
    Object.assign(PRODS[artEditIdx], {
      name: nombre.toUpperCase(), price: precioVariable?0:precio,
      precioVariable, costo, codigo, codigos, color: artColorSel,
      colorPropio: artColorManual,
      cat: artCatSel, iva: artIvaSel, mitad, inventario, comanda, esKilo, esFavorito,
      ...imgUpdate
    });
    const prod = PRODS[artEditIdx];
    dbSaveProducto(prod);
    supaUpsertProducto(prod);
    toast('Artículo actualizado');
  } else {
    const newProd = {
      id: nextProdId, prodId: nextProdId,
      name: nombre.toUpperCase(), price: precioVariable?0:precio,
      precioVariable, costo, codigo, codigos, color: artColorSel,
      colorPropio: artColorManual,
      cat: artCatSel, iva: artIvaSel, mitad, inventario, comanda, esKilo, esFavorito
    };
    PRODS.push(newProd);
    nextProdId++;
    dbSaveProducto(newProd);
    supaUpsertProducto(newProd);
    toast('Artículo agregado');
  }
  filterP(); renderArtList();
  goTo('scArticulosList');
}

async function eliminarArticulo(){
  if(artEditIdx < 0) return;
  const prod = PRODS[artEditIdx];
  if(!confirm('¿Desactivar "'+prod.name+'"? No aparecerá en ventas pero sus datos se conservan.')) return;

  // 1. Marcar en memoria
  PRODS[artEditIdx].activo = false;
  PRODS[artEditIdx].deleted_at = new Date().toISOString();

  // 2. Guardar en Dexie (local)
  if(db) await db.productos.update(prod.id, { activo: false, updatedAt: new Date().toISOString() });

  // 3. Guardar en Supabase
  const email = localStorage.getItem('lic_email');
  if(email && !USAR_DEMO){
    try {
      await supaPatch('pos_productos',
        'id=eq.'+prod.id+'&licencia_email=eq.'+encodeURIComponent(email),
        {activo:false}, true);
      _log('[Producto] Desactivado OK:', prod.name);
    } catch(e){ console.warn('[Producto] Sin conexión:', e.message); toast('Error al desactivar producto en la nube'); }
  }

  filterP();
  renderArtList();
  goTo('scArticulosList');
  toast('Producto desactivado: '+prod.name.substring(0,20));
}

// ── PRECIO VARIABLE ──────────────────────────────────────────────────────────
let precioVarProdId = null;
let pmVal = '';

function addCartConPrecioVariable(id){
  const p=PRODS.find(x=>x.id===id); if(!p) return;
  if(p.precioVariable){
    precioVarProdId = id;
    pmVal = '';
    const esLibre = !!p.itemLibre;
    document.getElementById('precioModalNombre').textContent = esLibre ? 'Ítem libre' : p.name;
    document.getElementById('precioModalSub').textContent = esLibre ? 'Ingresá la descripción y el precio' : 'Ingresá el precio para esta venta';
    const descBlock = document.getElementById('libreDescBlock');
    if(descBlock){ descBlock.style.display = esLibre ? 'block' : 'none'; }
    if(esLibre && document.getElementById('libreDescInput')) document.getElementById('libreDescInput').value='';
    document.getElementById('precioModalDisp').textContent = '₲0';
    document.getElementById('precioModalOv').classList.add('open');
    if(esLibre) setTimeout(()=>{ const li=document.getElementById('libreDescInput'); if(li)li.focus(); },200);
  } else { addCart(id); }
}

function closePrecioModal(e){
  if(e.target===document.getElementById('precioModalOv'))
    document.getElementById('precioModalOv').classList.remove('open');
}

function pmP(d){
  if(pmVal==='0'&&d!=='000') pmVal=d; else pmVal+=d;
  if(pmVal.length>10) pmVal=pmVal.slice(0,10);
  document.getElementById('precioModalDisp').textContent = gs(parseInt(pmVal)||0);
}
function pmD(){
  pmVal=pmVal.slice(0,-1);
  document.getElementById('precioModalDisp').textContent = gs(parseInt(pmVal)||0);
}
function pmOK(){
  const precio = parseInt(pmVal)||0;
  if(!precio){ toast('Ingresá un precio'); return; }
  const p = PRODS.find(x=>x.id===precioVarProdId); if(!p) return;
  const esLibre = !!p.itemLibre;
  let desc = '';
  if(esLibre){
    const li = document.getElementById('libreDescInput');
    desc = li ? li.value.trim() : '';
    if(!desc){ toast('Ingresá una descripción'); if(li)li.focus(); return; }
  }
  const nombre = esLibre ? desc.toUpperCase() : p.name;
  cart.push({ lineId: Date.now()*1000+Math.floor(Math.random()*1000), ...p, name: nombre, price: precio, qty:1, obs:'', enviado:false });
  document.getElementById('precioModalOv').classList.remove('open');
  updUI(); updBtnGuardar();
  toast('+'+nombre.substring(0,16)+' · '+gs(precio));
  if(showTkt) renderTkt();
}

// ── VENTA POR KILO ───────────────────────────────────────────────────────────
var _pesoModo    = 'kg'; // 'kg' o 'gs'
var _pesoVal     = '';
var _pesoProdId  = null;

function addCartConPeso(id){
  var p = PRODS.find(function(x){ return x.id === id; });
  if(!p) return;
  _pesoProdId = id;
  _pesoModo   = 'kg';
  _pesoVal    = '';
  document.getElementById('pesoModalNombre').textContent = p.name;
  document.getElementById('pesoModalSub').textContent    = gs(p.price) + ' / kg';
  _renderPesoNumpad();
  _updPesoDisp();
  document.getElementById('pesoModalOv').classList.add('open');
  if(window.history && window.history.pushState)
    window.history.pushState({ modal: 'peso' }, '');
}

function closePesoModal(e){
  if(!e || e.target === document.getElementById('pesoModalOv'))
    document.getElementById('pesoModalOv').classList.remove('open');
}

function setPesoModo(modo){
  _pesoModo = modo;
  _pesoVal  = '';
  var tabKg = document.getElementById('pesoTabKg');
  var tabGs = document.getElementById('pesoTabGs');
  if(tabKg){
    tabKg.style.background   = modo==='kg' ? 'var(--green)' : 'var(--card2)';
    tabKg.style.borderColor  = modo==='kg' ? 'var(--green)' : 'var(--border)';
    tabKg.style.color        = modo==='kg' ? '#fff'         : 'var(--text2)';
  }
  if(tabGs){
    tabGs.style.background   = modo==='gs' ? 'var(--green)' : 'var(--card2)';
    tabGs.style.borderColor  = modo==='gs' ? 'var(--green)' : 'var(--border)';
    tabGs.style.color        = modo==='gs' ? '#fff'         : 'var(--text2)';
  }
  _renderPesoNumpad();
  _updPesoDisp();
}

function _renderPesoNumpad(){
  var grid = document.getElementById('pesoNumpadGrid');
  if(!grid) return;
  var nb   = 'background:#2a2a2a;border:1px solid #3a3a3a;border-radius:8px;color:#fff;font-family:\'Barlow\',sans-serif;font-weight:600;font-size:20px;padding:15px 0;cursor:pointer;width:100%;';
  var keys = _pesoModo === 'kg'
    ? ['1','2','3','4','5','6','7','8','9','.','0','⌫']
    : ['1','2','3','4','5','6','7','8','9','000','0','⌫'];
  var html = '';
  for(var ki = 0; ki < keys.length; ki++){
    var d   = keys[ki];
    var act = d==='⌫' ? 'pmKD()' : 'pmKP(\''+d+'\')';
    var fsz = (d==='000') ? '16' : '20';
    html += '<button onclick="'+act+'" style="'+nb+'font-size:'+fsz+'px;">'+d+'</button>';
  }
  html += '<button onclick="pmKiloOK()" style="'+nb+'grid-column:span 3;background:var(--green);font-size:16px;border:none;letter-spacing:.5px;">AGREGAR AL TICKET</button>';
  grid.innerHTML = html;
}

function pmKP(d){
  if(_pesoModo === 'kg'){
    if(d==='.' && _pesoVal.indexOf('.') >= 0) return;
    if(_pesoVal === '' && d==='.') _pesoVal = '0';
    _pesoVal += d;
    if(_pesoVal.length > 8) _pesoVal = _pesoVal.slice(0,-1);
  } else {
    if(_pesoVal === '0' && d !== '000') _pesoVal = d;
    else _pesoVal += d;
    if(_pesoVal.length > 10) _pesoVal = _pesoVal.slice(0,-1);
  }
  _updPesoDisp();
}

function pmKD(){
  _pesoVal = _pesoVal.slice(0,-1);
  _updPesoDisp();
}

function _updPesoDisp(){
  var disp = document.getElementById('pesoModalDisp');
  var res  = document.getElementById('pesoModalRes');
  var lbl  = document.getElementById('pesoModalLbl');
  var p    = _pesoProdId ? PRODS.find(function(x){ return x.id === _pesoProdId; }) : null;
  if(!p) return;
  if(_pesoModo === 'kg'){
    var kg    = parseFloat(_pesoVal) || 0;
    var total = Math.round(kg * p.price);
    if(lbl)  lbl.textContent  = 'Kilos';
    if(disp) disp.textContent = (_pesoVal||'0') + ' kg';
    if(res)  res.textContent  = '= ' + gs(total) + ' Gs.';
  } else {
    var monto = parseInt(_pesoVal) || 0;
    var kgs   = p.price > 0 ? monto / p.price : 0;
    if(lbl)  lbl.textContent  = 'Importe (₲)';
    if(disp) disp.textContent = gs(monto) + ' Gs.';
    if(res)  res.textContent  = '= ' + (kgs > 0 ? kgs.toFixed(3) + ' kg' : '0.000 kg');
  }
}

function pmKiloOK(){
  var p = _pesoProdId ? PRODS.find(function(x){ return x.id === _pesoProdId; }) : null;
  if(!p) return;
  var kg = 0;
  if(_pesoModo === 'kg'){
    kg = parseFloat(_pesoVal) || 0;
  } else {
    // Modo IMPORTE: el monto tipeado es la fuente de verdad. El peso se deriva
    // con precisión completa (SIN redondear a 3 decimales) para que
    // round(peso × precio) dé exactamente el importe. Antes se redondeaba el
    // peso y el total arrastraba (ej: se cobraba 4998 en vez de 5000).
    var monto = parseInt(_pesoVal) || 0;
    kg = p.price > 0 ? monto / p.price : 0;
  }
  if(kg <= 0){ toast('Ingresá un peso o importe'); return; }
  var total  = Math.round(kg * p.price);
  var lineId = Date.now()*1000 + Math.floor(Math.random()*1000);
  var item   = {
    lineId: lineId, id: p.id, name: p.name, price: p.price,
    qty: kg, obs: '', enviado: false, iva: p.iva, color: p.color,
    cat: p.cat, esKilo: true
  };
  cart.push(item);
  document.getElementById('pesoModalOv').classList.remove('open');
  updUI(); updBtnGuardar();
  toast('+' + p.name.substring(0,16) + ' \xb7 ' + gs(total));
  if(typeof sndTap === 'function') sndTap();
  if(showTkt) renderTkt();
  if(typeof avisarStockSiCorresponde === 'function') avisarStockSiCorresponde(p);
}

// ── CATEGORÍAS ───────────────────────────────────────────────────────────────
let catEditIdx = -1;
let catColorSel = '#e65100';

const COLORES_CAT = [
  '#607d8b','#c62828','#e91e63','#ff9800',
  '#827717','#2e7d32','#1565c0','#6a1b9a',
  '#e65100','#ad1457','#558b2f','#0277bd',
  '#4e342e','#37474f','#00695c','#283593',
];

function renderCatListScreen(){
  const list = document.getElementById('catListScreen');
  if(!list) return;
  if(!CATEGORIAS.length){ list.innerHTML='<div class="cat-empty-msg"><p>No hay categorías</p></div>'; return; }
  list.innerHTML = '';
  CATEGORIAS.forEach((cat, i) => {
    const count = PRODS.filter(p => p.cat === cat.nombre && p.activo!==false && !p.esInsumo).length;
    const div = document.createElement('div');
    if(cat.activa === false) div.style.opacity = '0.5';
    div.className = 'cat-list-item';
    div.onclick = () => editarCategoria(i);
    div.innerHTML =
      '<div class="cat-list-dot" style="background:'+cat.color+'"></div>'+
      '<div class="cat-list-info"><div class="cat-list-name">'+cat.nombre+'</div>'+
      '<div class="cat-list-count">'+count+' artículo'+(count!==1?'s':'')+'</div></div>'+
      '<div class="cat-list-arrow"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></div>';
    list.appendChild(div);
  });
}

function nuevaCategoria(){
  catEditIdx = -1;
  catColorSel = COLORES_CAT[0];
  document.getElementById('catFormTitle').textContent = 'Nueva categoría';
  document.getElementById('catNombreInput').value = '';
  document.getElementById('btnEliminarCat').style.display = 'none';
  renderCatColorPicker();
  updCatPreview();
  goTo('scCategoriaNueva');
  setTimeout(()=>document.getElementById('catNombreInput').focus(), 300);
}

function editarCategoria(idx){
  const cat = CATEGORIAS[idx];
  catEditIdx = idx;
  catColorSel = cat.color;
  document.getElementById('catFormTitle').textContent = 'Editar categoría';
  document.getElementById('catNombreInput').value = cat.nombre;
  document.getElementById('btnEliminarCat').style.display = 'flex';
  renderCatColorPicker();
  updCatPreview();
  goTo('scCategoriaNueva');
}

function renderCatColorPicker(){
  const row = document.getElementById('catColorRow');
  if(!row) return;
  row.innerHTML = '';
  const checkSVG = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>';
  COLORES_CAT.forEach(c => {
    const div = document.createElement('div');
    div.className = 'cat-color-tile' + (c === catColorSel ? ' sel' : '');
    div.style.background = c;
    div.dataset.color = c;
    div.onclick = () => selCatColor(c);
    if(c === catColorSel) div.innerHTML = checkSVG;
    row.appendChild(div);
  });
}

function selCatColor(c){
  catColorSel = c;
  renderCatColorPicker();
  updCatPreview();
}

function updCatPreview(){
  const prev = document.getElementById('catColorPreview');
  if(!prev) return;
  const nombre = document.getElementById('catNombreInput') ? document.getElementById('catNombreInput').value : '';
  prev.style.background = catColorSel;
  prev.textContent = (nombre || 'Vista previa').toUpperCase();
}

async function supaUpsertProducto(prod){
  if(USAR_DEMO) return;
  const email = localStorage.getItem('lic_email') || localStorage.getItem(SK && SK.email);
  if(!email) return;
  const payload = {
    id:              prod.id,
    nombre:          (prod.name || '').toUpperCase(),
    precio:          prod.price || 0,
    precio_variable: prod.precioVariable || false,
    costo:           prod.costo || 0,
    codigo:          prod.codigo || '',
    codigos:         JSON.stringify(prod.codigos || []),
    categoria:       prod.cat || 'Sin categoría',
    iva:             prod.iva || '10',
    color:           prod.color || '#546e7a',
    color_propio:    prod.colorPropio || false,
    mitad:           prod.mitad || false,
    inventario:      prod.inventario || false,
    comanda:         prod.comanda || false,
    es_kilo:         prod.esKilo || false,
    es_favorito:     prod.esFavorito || false,
    activo:          prod.activo !== false,
    imagen:          prod.imagen || null,
    licencia_email:  email,
    updated_at:      new Date().toISOString()
  };
  try {
    await supaPost('pos_productos', payload, 'id', true);
  } catch(e){
    console.warn('[supaUpsertProducto]', e.message);
    // Sin cola de reintento acá, el producto quedaba SOLO en este
    // dispositivo (PRODS + IndexedDB) si no había internet en el momento de
    // cargarlo — y se perdía para siempre en cuanto se dejaba de usar ese
    // aparato, sin ningún aviso claro (caso real: catálogo completo cargado
    // offline, nunca llegó a Supabase). Mismo patrón que ya resuelve
    // encolarVentaSync() para las ventas.
    encolarProductoSync('pos_productos', payload);
    toast('Sin conexión — se sincronizará solo cuando vuelva el internet');
  }
}

async function supaUpsertCategoria(cat){
  if(USAR_DEMO) return;
  const email = localStorage.getItem('lic_email') || localStorage.getItem(SK && SK.email);
  if(!email) return;
  const payload = {
    id: cat.id,
    nombre: cat.nombre,
    color: cat.color || '#546e7a',
    licencia_email: email,
    updated_at: new Date().toISOString()
  };
  if(cat.activa === false) payload.activa = false;
  try {
    await supaPost('pos_categorias', payload, 'id', true);
  } catch(e){
    console.warn('[supaUpsertCategoria]', e.message);
    encolarProductoSync('pos_categorias', payload);
    toast('Sin conexión — se sincronizará solo cuando vuelva el internet');
  }
}

// ── Cola de respaldo para productos/categorías sin conexión ──────────────
// A diferencia de las ventas (encolarVentaSync/FALLBACK_KEY en turno.js),
// el guardado de productos no tenía NINGÚN reintento — ver comentario en
// supaUpsertProducto. Mismo criterio que la cola de ventas: guardar en
// localStorage y reintentar cuando vuelva la conexión. El POST es upsert
// (on_conflict=id, merge-duplicates), así que reintentar un item ya
// sincronizado no duplica ni pisa datos más nuevos por error.
var FALLBACK_KEY_PRODUCTOS = 'pos_productos_sync_fallback';

function encolarProductoSync(tabla, payload){
  try {
    var arr = JSON.parse(localStorage.getItem(FALLBACK_KEY_PRODUCTOS) || '[]');
    arr.push({ tabla: tabla, payload: payload });
    if(arr.length > 1000) arr = arr.slice(-1000); // tope defensivo
    localStorage.setItem(FALLBACK_KEY_PRODUCTOS, JSON.stringify(arr));
    _log('[Sync] Producto/categoría en cola local (sin conexión):', arr.length);
  } catch(e){ console.warn('[Sync] Fallback productos lleno:', e.message); }
}

async function drenarProductosFallback(){
  if(!navigator.onLine || USAR_DEMO) return;
  var arr;
  try { arr = JSON.parse(localStorage.getItem(FALLBACK_KEY_PRODUCTOS) || '[]'); } catch(e){ return; }
  if(!arr.length) return;
  var quedan = [];
  for(var i=0;i<arr.length;i++){
    try { await supaPost(arr[i].tabla, arr[i].payload, 'id', true); }
    catch(e){ quedan.push(arr[i]); }
  }
  try { localStorage.setItem(FALLBACK_KEY_PRODUCTOS, JSON.stringify(quedan)); } catch(e){}
  if(quedan.length < arr.length){
    _log('[Sync] Fallback productos drenado:', (arr.length - quedan.length));
    toast((arr.length - quedan.length) + ' producto(s) sincronizados que estaban pendientes');
  }
}

// Reintentar apenas vuelve la conexión, sin esperar al próximo arranque
window.addEventListener('online', function(){ drenarProductosFallback(); });

// Sincroniza todas las CATEGORIAS a pos_categorias.
// Necesario porque muchas categorías pueden venir del fallback
// derivarCategoriasDeProductos y no existir aún en Supabase.
// Sin este bulk upsert, al editar una sola se pierden el resto al recargar.
async function supaSyncTodasCategorias(){
  if(USAR_DEMO) return;
  const email = localStorage.getItem('lic_email') || localStorage.getItem(SK && SK.email);
  if(!email) return;
  if(!CATEGORIAS || !CATEGORIAS.length) return;
  try {
    const ahora = new Date().toISOString();
    const payload = CATEGORIAS.map(c => ({
      id: c.id,
      nombre: c.nombre,
      color: c.color || '#546e7a',
      licencia_email: email,
      updated_at: ahora
    }));
    await supaPost('pos_categorias', payload, 'id', true);
  } catch(e){
    console.warn('[supaSyncTodasCategorias]', e.message);
  }
}

async function supaUpdateColorProductosCat(catNombre, nuevoColor, oldColor){
  if(USAR_DEMO) return;
  const email = localStorage.getItem('lic_email') || localStorage.getItem(SK && SK.email);
  if(!email) return;
  try {
    // Solo productos cuyo color coincide con el color viejo de la categoría
    // (respeta los que tienen colorPropio con otro color)
    let filtro = 'licencia_email=eq.'+encodeURIComponent(email)+
                 '&categoria=eq.'+encodeURIComponent(catNombre);
    if(oldColor) filtro += '&color=eq.'+encodeURIComponent(oldColor);
    await supaPatch('pos_productos', filtro, { color: nuevoColor }, true);
  } catch(e){
    console.warn('[supaUpdateColorProductosCat]', e.message);
  }
}

async function guardarCategoria(){
  const nombre = document.getElementById('catNombreInput').value.trim();
  if(!nombre){ toast('Ingresá el nombre de la categoría'); return; }
  let catObj;
  if(catEditIdx >= 0){
    const old = CATEGORIAS[catEditIdx].nombre;
    const oldColor = CATEGORIAS[catEditIdx].color;
    CATEGORIAS[catEditIdx].nombre = nombre;
    CATEGORIAS[catEditIdx].color  = catColorSel;
    PRODS.forEach(p => {
      if(p.cat === old) p.cat = nombre;
      if(!p.colorPropio && p.color === oldColor) p.color = catColorSel;
    });
    catObj = CATEGORIAS[catEditIdx];
    await supaSyncTodasCategorias();
    if(oldColor !== catColorSel){
      await supaUpdateColorProductosCat(nombre, catColorSel, oldColor);
    }
    toast('Categoría actualizada');
  } else {
    if(CATEGORIAS.find(c => c.nombre.toLowerCase() === nombre.toLowerCase())){ toast('Ya existe esa categoría'); return; }
    catObj = { id: nextCatId++, nombre, color: catColorSel };
    CATEGORIAS.push(catObj);
    await supaSyncTodasCategorias();
    toast('Categoría creada');
  }
  CATEGORIAS_DEFAULT.length = 0;
  CATEGORIAS.filter(c=>c.activa!==false).forEach(c => CATEGORIAS_DEFAULT.push(c.nombre));
  if(db) try { await db.categorias.put({ id: catObj.id, nombre: catObj.nombre, color: catObj.color, updatedAt: new Date().toISOString() }); } catch(e){}
  filterP(); renderCatListScreen();
  goTo('scCategorias');
}

function eliminarCategoria(){
  if(catEditIdx < 0) return;
  const cat = CATEGORIAS[catEditIdx];
  // Contar productos activos (no inactivos)
  const activeCount = PRODS.filter(p => p.cat === cat.nombre && p.activo !== false && !p.esInsumo).length;
  const totalCount  = PRODS.filter(p => p.cat === cat.nombre && !p.esInsumo).length;
  if(activeCount > 0){
    toast('No se puede eliminar: tiene '+activeCount+' artículo'+(activeCount!==1?'s':'')+' activo'+(activeCount!==1?'s':''));
    return;
  }
  if(totalCount > 0 && !confirm('Esta categoría tiene '+totalCount+' producto'+(totalCount!==1?'s':'')+' inactivo'+(totalCount!==1?'s':'')+'. ¿Eliminar igual?')) return;
  // Soft delete: marcar inactiva
  CATEGORIAS[catEditIdx].activa = false;
  CATEGORIAS[catEditIdx].deleted_at = new Date().toISOString();
  // Actualizar defaults (excluir inactivas)
  CATEGORIAS_DEFAULT.length = 0;
  CATEGORIAS.filter(c=>c.activa!==false).forEach(c => CATEGORIAS_DEFAULT.push(c.nombre));
  if(db) dbSaveConfig('categorias', JSON.stringify(CATEGORIAS));
  supaUpsertCategoria({ ...CATEGORIAS[catEditIdx], activa: false });
  renderCatListScreen();
  goTo('scCategorias');
  toast('Categoría desactivada');
}

let asignarCatNombre = '';
let asignarSeleccionados = new Set();

function asignarArticulosCategoria(){
  asignarCatNombre = document.getElementById('catNombreInput').value.trim() || 'esta categoría';
  document.getElementById('asignarTitle').textContent = 'Asignar artículos a '+asignarCatNombre;
  asignarSeleccionados = new Set(PRODS.filter(p=>p.cat===asignarCatNombre && !p.esInsumo).map(p=>p.id));
  document.getElementById('asignarSearch').value = '';
  renderAsignarList();
  goTo('scAsignarArticulos');
}

function renderAsignarList(){
  const q = document.getElementById('asignarSearch').value.toLowerCase();
  const list = document.getElementById('asignarList');
  if(!list) return;
  let items = PRODS.filter(p=>!p.itemLibre && !p.esInsumo);
  if(q) items = items.filter(p=>p.name.toLowerCase().includes(q));
  list.innerHTML = '';
  items.forEach(p => {
    const checked = asignarSeleccionados.has(p.id);
    const div = document.createElement('div');
    div.className = 'asignar-item';
    div.onclick = () => toggleAsignar(p.id);
    div.innerHTML =
      '<div class="art-item-color" style="background:'+getProductColor(p)+'">'+p.name.substring(0,2)+'</div>'+
      '<div class="art-item-info"><div class="art-item-name">'+p.name+'</div><div class="art-item-meta"><span>'+p.cat+'</span></div></div>'+
      '<div class="asignar-checkbox '+(checked?'checked':'')+'" id="chk_'+p.id+'">'+
        (checked?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>':'')+
      '</div>';
    list.appendChild(div);
  });
}

function toggleAsignar(id){
  if(asignarSeleccionados.has(id)) asignarSeleccionados.delete(id);
  else asignarSeleccionados.add(id);
  renderAsignarList();
}

function guardarAsignacion(){
  const cat = asignarCatNombre;
  PRODS.forEach(p => {
    if(asignarSeleccionados.has(p.id)){
      p.cat = cat;
      if(!p.colorPropio){
        const catObj = CATEGORIAS.find(c => c.nombre === cat);
        if(catObj) p.color = catObj.color;
      }
    }
  });
  filterP(); toast('Artículos asignados a '+cat);
  goTo('scCategoriaNueva');
}

function crearArticuloDesdeCategoria(){
  const catNombre = document.getElementById('catNombreInput').value.trim();
  if(catNombre && !CATEGORIAS.find(c => c.nombre === catNombre)){ toast('Guardá la categoría primero'); return; }
  nuevoArticulo();
  if(catNombre){
    artCatSel = catNombre; artColorManual = false;
    const catObj = CATEGORIAS.find(c => c.nombre === catNombre);
    if(catObj) artColorSel = catObj.color;
    setTimeout(()=>{ renderCatSelector(); renderColorPicker(); }, 50);
  }
}

// ══════════════════════════════════════════════════════
// MODIFICADORES — Admin, Modal y Lógica
// ══════════════════════════════════════════════════════

var modificadores   = [];  // [{id, nombre, tipo, obligatorio, opciones:[]}]
let modifEditId     = null;
let modifTipoSel    = 'unico';
let modifOpciones   = [];  // [{id?, nombre, precio_adicional}]
let modifProdsSel   = new Set(); // ids de productos asignados

// ── Cargar modificadores desde Supabase ──────────────
async function cargarModificadores(){
  const email = localStorage.getItem('lic_email');
  if(!email || USAR_DEMO) return;
  try {
    const [rMod, rOpc, rProd] = await Promise.all([
      supaGet('pos_modificadores', 'licencia_email=eq.'+encodeURIComponent(email)+'&activo=eq.true&order=orden.asc,id.asc'),
      supaGet('pos_modificador_opciones', 'activo=eq.true&order=orden.asc,id.asc'),
      supaGet('pos_producto_modificadores', 'select=producto_id,modificador_id'),
    ]);
    modificadores = rMod.map(m => ({
      ...m,
      opciones: rOpc.filter(o => o.modificador_id === m.id),
      productos: rProd.filter(p => p.modificador_id === m.id).map(p => p.producto_id),
    }));
    _log('[Modif] Cargados:', modificadores.length);
  } catch(e){ console.warn('[Modif] Error cargando:', e.message); }
}

// ── Admin — Lista ─────────────────────────────────────
function renderModifList(){
  const cont = document.getElementById('modifListContainer');
  if(!cont) return;
  if(!modificadores.length){
    cont.innerHTML = '<div style="text-align:center;color:var(--muted);padding:60px 20px;">'+
      '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:.3;margin-bottom:12px;"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>'+
      '<p style="font-size:15px;font-weight:700;margin:0;">Sin modificadores</p>'+
      '<p style="font-size:13px;margin-top:6px;">Tocá + para crear el primero</p></div>';
    return;
  }
  cont.innerHTML = modificadores.map(m => `
    <div onclick="editarModif(${m.id})" style="background:var(--bg-card);border-radius:10px;padding:14px 16px;margin-bottom:8px;border:1px solid var(--border);cursor:pointer;">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div style="font-size:15px;font-weight:700;color:var(--text);">${m.nombre}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:3px;">
            ${m.tipo==='unico'?'Selección única':'Selección múltiple'} · 
            ${m.obligatorio?'<span style="color:#ff9800;">Obligatorio</span>':'Opcional'} · 
            ${m.opciones.length} opción${m.opciones.length!==1?'es':''}
          </div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px;">
            ${m.productos.length} producto${m.productos.length!==1?'s':''}
          </div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
    </div>
  `).join('');
}

// ── Admin — Nuevo / Editar ────────────────────────────
function abrirNuevoModif(){
  modifEditId   = null;
  modifTipoSel  = 'unico';
  modifOpciones = [];
  modifProdsSel = new Set();
  document.getElementById('modifEditTitle').textContent = 'Nuevo modificador';
  document.getElementById('modifNombre').value = '';
  document.getElementById('modifObligatorio').checked = false;
  document.getElementById('btnEliminarModif').style.display = 'none';
  selModifTipo('unico');
  renderModifOpciones();
  renderModifProductos();
  goTo('scModifEdit');
}

function editarModif(id){
  const m = modificadores.find(x => x.id === id);
  if(!m) return;
  modifEditId   = id;
  modifTipoSel  = m.tipo;
  modifOpciones = m.opciones.map(o => ({...o}));
  modifProdsSel = new Set(m.productos);
  document.getElementById('modifEditTitle').textContent = 'Editar modificador';
  document.getElementById('modifNombre').value = m.nombre;
  document.getElementById('modifObligatorio').checked = !!m.obligatorio;
  document.getElementById('btnEliminarModif').style.display = 'flex';
  selModifTipo(m.tipo);
  renderModifOpciones();
  renderModifProductos();
  goTo('scModifEdit');
}

function selModifTipo(tipo){
  modifTipoSel = tipo;
  const hints = { unico:'Única: el cliente elige una sola opción (ej: Tamaño)', multiple:'Múltiple: puede elegir varias (ej: Extras, Ingredientes)' };
  document.getElementById('modifTipoHint').textContent = hints[tipo]||'';
  ['unico','multiple'].forEach(t => {
    const btn = document.getElementById('modifTipo'+t.charAt(0).toUpperCase()+t.slice(1));
    if(btn) btn.style.borderColor = t===tipo ? 'var(--green)' : 'var(--border2)';
  });
}

function agregarOpcionModif(){
  modifOpciones.push({ nombre:'', precio_adicional:0 });
  renderModifOpciones();
  // Focus en el nuevo input
  setTimeout(()=>{
    const inputs = document.querySelectorAll('.modif-opc-nombre');
    if(inputs.length) inputs[inputs.length-1].focus();
  }, 50);
}

function renderModifOpciones(){
  const cont = document.getElementById('modifOpcionesContainer');
  if(!cont) return;
  if(!modifOpciones.length){
    cont.innerHTML = '<div style="text-align:center;color:var(--muted);font-size:13px;padding:16px;">Sin opciones — tocá + Agregar</div>';
    return;
  }
  cont.innerHTML = modifOpciones.map((o,i) => `
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
      <input class="art-form-input modif-opc-nombre" placeholder="Nombre opción" value="${o.nombre||''}"
        oninput="modifOpciones[${i}].nombre=this.value"
        style="flex:2;margin:0;">
      <input class="art-form-input" placeholder="+precio" type="number" value="${o.precio_adicional||0}"
        oninput="modifOpciones[${i}].precio_adicional=parseInt(this.value)||0"
        style="flex:1;margin:0;">
      <button onclick="modifOpciones.splice(${i},1);renderModifOpciones();"
        style="background:rgba(229,57,53,.12);border:none;border-radius:6px;color:#e53935;padding:8px 10px;cursor:pointer;flex-shrink:0;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>
  `).join('');
}

function renderModifProductos(){
  const cont = document.getElementById('modifProductosContainer');
  if(!cont) return;
  const prods = PRODS.filter(p => !p.itemLibre && !p.esInsumo && p.activo !== false);
  cont.innerHTML = prods.map(p => {
    const sel = modifProdsSel.has(p.id);
    return `<div onclick="toggleModifProd(${p.id})"
      style="padding:10px;border-radius:8px;border:2px solid ${sel?'var(--green)':'var(--border)'};
      background:${sel?'rgba(76,175,80,.08)':'var(--bg-card)'};cursor:pointer;font-size:12px;font-weight:700;
      color:var(--text);text-align:center;">
      ${sel?'':''} ${p.name}
    </div>`;
  }).join('');
}

function toggleModifProd(id){
  if(modifProdsSel.has(id)) modifProdsSel.delete(id);
  else modifProdsSel.add(id);
  renderModifProductos();
}

async function guardarModif(){
  const nombre = document.getElementById('modifNombre').value.trim();
  if(!nombre){ toast('Ingresá el nombre del modificador'); return; }
  const opcValidas = modifOpciones.filter(o => o.nombre.trim());
  if(!opcValidas.length){ toast('Agregá al menos una opción'); return; }

  const email = localStorage.getItem('lic_email');
  const btn = document.querySelector('#scModifEdit .art-save-btn');
  if(btn){ btn.disabled=true; btn.textContent='Guardando...'; }

  try {
    let modifId = modifEditId;
    const modifData = { nombre, tipo:modifTipoSel, obligatorio:document.getElementById('modifObligatorio').checked, licencia_email:email, activo:true };

    if(modifEditId){
      // UPDATE
      await supaFetch('PATCH', 'pos_modificadores', modifData, { id:'eq.'+modifEditId });
    } else {
      // INSERT
      const r = await supaFetch('POST', 'pos_modificadores', modifData, null, 'return=representation');
      const rows = await r.clone().json();
      modifId = rows[0].id;
    }

    // Opciones: borrar las viejas e insertar las nuevas
    await supaFetch('DELETE', 'pos_modificador_opciones', null, { modificador_id:'eq.'+modifId });
    for(let i=0; i<opcValidas.length; i++){
      await supaFetch('POST', 'pos_modificador_opciones', { modificador_id:modifId, nombre:opcValidas[i].nombre, precio_adicional:opcValidas[i].precio_adicional||0, orden:i, activo:true });
    }

    // Productos asignados
    await supaFetch('DELETE', 'pos_producto_modificadores', null, { modificador_id:'eq.'+modifId });
    for(const prodId of modifProdsSel){
      await supaFetch('POST', 'pos_producto_modificadores', { producto_id:prodId, modificador_id:modifId });
    }

    await cargarModificadores();
    toast('Modificador guardado');
    goTo('scModificadores');
    renderModifList();
  } catch(e){
    toast('Error: '+e.message);
    console.error('[Modif] Error guardando:', e.message);
  } finally {
    if(btn){ btn.disabled=false; btn.textContent='GUARDAR MODIFICADOR'; }
  }
}

async function eliminarModif(){
  if(!modifEditId || !confirm('¿Eliminar este modificador?')) return;
  try {
    await supaFetch('PATCH', 'pos_modificadores', { activo:false }, { id:'eq.'+modifEditId });
    await cargarModificadores();
    toast('Modificador eliminado');
    goTo('scModificadores');
    renderModifList();
  } catch(e){ toast('Error: '+e.message); }
}

// ══════════════════════════════════════════════════════
// FLUJO UNIFICADO — Pizzas (mitad + cantidad) y Modificadores
// ══════════════════════════════════════════════════════

let _flujo = {
  prod:        null,   // producto base
  esMitad:     false,  // modo elegido
  qty:         1,
  prod2:       null,   // segundo sabor (si mitad)
  selecciones: {},     // modif selecciones
  tieneModif:  false,
  paso:        1,      // 1=modo+qty, 2=sabor2, 3=modificadores
};

function _flujoSteps(){
  const pasos = [1]; // siempre paso 1 (modo+qty)
  if(_flujo.esMitad) pasos.push(2);
  if(_flujo.tieneModif) pasos.push(3);
  return pasos;
}
function _flujoIdx(){ return _flujoSteps().indexOf(_flujo.paso); }

function abrirFlujoPizza(prod, tieneModif){
  _flujo = { prod, esMitad:false, qty:1, prod2:null, selecciones:{}, tieneModif:!!tieneModif, paso:1 };
  _renderFlujoSheet();
  document.getElementById('modifOverlay').classList.add('open');
}

function modifOverlayClick(e){
  if(e.target === document.getElementById('modifOverlay')) _flujoClose();
}
function modifCancelar(){ _flujoClose(); }
function _flujoClose(){
  document.getElementById('modifOverlay').classList.remove('open');
  _flujo.prod = null;
}

function _renderFlujoSheet(){
  const prod = _flujo.prod;
  const steps = _flujoSteps();
  const idx   = _flujoIdx();
  const isLast = idx === steps.length - 1;

  // Precio en tiempo real
  let precio = prod.price || 0;
  if(_flujo.esMitad && _flujo.prod2){
    const cfg = localStorage.getItem('pos_precio_mitad') || 'mas_caro';
    precio = cfg === 'promedio'
      ? Math.round((prod.price + _flujo.prod2.price) / 2)
      : Math.max(prod.price, _flujo.prod2.price);
  }
  // Sumar extras de modificadores
  let extrasDesc = [];
  const modifs = modificadores.filter(m => m.productos && m.productos.includes(prod.id));
  modifs.forEach(m => {
    const sel = _flujo.selecciones[m.id];
    if(!sel) return;
    if(m.tipo === 'unico'){
      const opc = m.opciones.find(o => o.id === sel);
      if(opc){ extrasDesc.push(opc.nombre); precio += opc.precio_adicional||0; }
    } else {
      sel.forEach(opcId => {
        const opc = m.opciones.find(o => o.id === opcId);
        if(opc){ extrasDesc.push(opc.nombre); precio += opc.precio_adicional||0; }
      });
    }
  });
  const precioTotal = precio * _flujo.qty;

  // Header
  document.getElementById('modifSheetTitle').textContent = prod.name;
  document.getElementById('modifSheetSub').textContent =
    'paso ' + (idx+1) + ' de ' + steps.length;

  // Dots de pasos
  const dotsHTML = steps.map((_,i) =>
    `<div style="width:${i===idx?18:6}px;height:4px;border-radius:2px;background:${i===idx?'var(--green)':'var(--border2)'};transition:width .2s;"></div>`
  ).join('');

  // Body según el paso actual
  let bodyHTML = '';

  if(_flujo.paso === 1){
    // ── Paso 1: modo (si tiene mitad) + cantidad ──
    // El botón MITAD solo aparece si el producto lo admite Y el negocio usa mitades.
    var _puedeVenderMitad = prod.mitad && (typeof usaMitades !== 'function' || usaMitades());
    const modoHTML = _puedeVenderMitad ? `
      <div style="margin-bottom:16px;">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px;font-weight:700;">¿Cómo la querés?</div>
        <div style="display:flex;gap:0;border:1.5px solid var(--border2);">
          <button id="btnModoEntera" onclick="_selModo('entera')"
            style="flex:1;padding:12px;border:none;background:${!_flujo.esMitad?'var(--green)':'var(--bg-dark)'};
            color:${!_flujo.esMitad?'#fff':'var(--muted)'};font-family:'Barlow',sans-serif;font-size:14px;font-weight:800;cursor:pointer;border-radius:0;transition:all .15s;">
            ENTERA
          </button>
          <button id="btnModoMitad" onclick="_selModo('mitad')"
            style="flex:1;padding:12px;border:none;border-left:1.5px solid var(--border2);
            background:${_flujo.esMitad?'var(--green)':'var(--bg-dark)'};
            color:${_flujo.esMitad?'#fff':'var(--muted)'};font-family:'Barlow',sans-serif;font-size:14px;font-weight:800;cursor:pointer;border-radius:0;transition:all .15s;">
            ½ MITAD
          </button>
        </div>
      </div>` : '';

    bodyHTML = modoHTML + `
      <div>
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:10px;font-weight:700;">Cantidad</div>
        <div style="display:flex;align-items:center;gap:16px;">
          <button onclick="_chgQty(-1)"
            style="width:44px;height:44px;border:1.5px solid var(--border2);background:var(--bg-dark);
            color:var(--text);font-size:22px;font-weight:300;cursor:pointer;border-radius:0;display:flex;align-items:center;justify-content:center;">−</button>
          <span style="font-size:26px;font-weight:800;color:var(--text);min-width:32px;text-align:center;" id="flujoQty">${_flujo.qty}</span>
          <button onclick="_chgQty(1)"
            style="width:44px;height:44px;border:1.5px solid var(--border2);background:var(--bg-dark);
            color:var(--text);font-size:22px;font-weight:300;cursor:pointer;border-radius:0;display:flex;align-items:center;justify-content:center;">+</button>
        </div>
      </div>`;

  } else if(_flujo.paso === 2){
    // ── Paso 2: segundo sabor ──
    const pizzas = PRODS.filter(p => p.mitad && p.activo !== false && !p.itemLibre && !p.esInsumo);
    const previewHTML = `
      <div style="display:flex;gap:0;border:1.5px solid var(--border2);margin-bottom:14px;">
        <div style="flex:1;padding:10px;text-align:center;border-right:1.5px solid var(--border2);">
          <div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;">1° mitad</div>
          <div style="font-size:13px;font-weight:800;color:var(--green);">${prod.name}</div>
        </div>
        <div style="flex:1;padding:10px;text-align:center;background:${_flujo.prod2?'rgba(76,175,80,.06)':'var(--bg-dark)'};">
          <div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;">2° mitad</div>
          <div style="font-size:13px;font-weight:800;color:${_flujo.prod2?'var(--green)':'var(--muted)'};">${_flujo.prod2?_flujo.prod2.name:'elegir...'}</div>
        </div>
      </div>
      <input oninput="_filterMitadSearch(this.value)"
        placeholder="Buscar sabor..." value=""
        style="width:100%;background:var(--bg-dark);border:1.5px solid var(--border2);border-radius:0;
        color:var(--text);font-family:'Barlow',sans-serif;font-size:14px;padding:10px 12px;margin-bottom:10px;outline:none;box-sizing:border-box;">`;

    const optsHTML = pizzas.map(p => {
      const sel = _flujo.prod2 && _flujo.prod2.id === p.id;
      return `<div onclick="_selSabor2(${p.id})"
        style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;
        cursor:pointer;border-left:3px solid ${sel?'var(--green)':'transparent'};
        background:${sel?'rgba(76,175,80,.06)':'var(--bg-card)'};
        border-bottom:0.5px solid var(--border);transition:all .12s;">
        <div style="font-size:14px;font-weight:700;color:var(--text);">${p.name}</div>
        <div style="font-size:12px;color:var(--muted);">${gs(p.price)}</div>
      </div>`;
    }).join('');

    bodyHTML = previewHTML + `<div id="mitadOptsList">${optsHTML}</div>`;

  } else if(_flujo.paso === 3){
    // ── Paso 3: modificadores ──
    bodyHTML = modifs.map(m => `
      <div style="margin-bottom:14px;">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px;font-weight:700;display:flex;align-items:center;gap:8px;">
          ${m.nombre}
          ${m.obligatorio?'<span style="background:#e53935;color:#fff;font-size:9px;padding:1px 6px;font-weight:800;">OBLIGATORIO</span>':''}
          <span style="margin-left:auto;font-size:9px;">${m.tipo==='unico'?'elegí 1':'podés elegir varios'}</span>
        </div>
        ${m.opciones.map(o => {
          const sel = m.tipo==='unico'
            ? _flujo.selecciones[m.id] === o.id
            : (_flujo.selecciones[m.id]||new Set()).has(o.id);
          return `<div onclick="_toggleModifOpt(${m.id},${o.id},'${m.tipo}')"
            style="display:flex;align-items:center;justify-content:space-between;padding:11px 14px;
            cursor:pointer;border-left:3px solid ${sel?'var(--green)':'transparent'};
            background:${sel?'rgba(76,175,80,.06)':'var(--bg-card)'};
            border-bottom:0.5px solid var(--border);transition:all .12s;">
            <div>
              <div style="font-size:14px;font-weight:600;color:var(--text);">${o.nombre}</div>
              ${o.precio_adicional>0?`<div style="font-size:12px;color:var(--green);font-weight:700;">+${gs(o.precio_adicional)}</div>`:''}
            </div>
            <div style="width:20px;height:20px;border:1.5px solid ${sel?'var(--green)':'var(--border2)'};
              background:${sel?'var(--green)':'transparent'};display:flex;align-items:center;
              justify-content:center;color:#fff;font-size:11px;border-radius:0;">${sel?'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><polyline points="20 6 9 17 4 12"/></svg>':''}</div>
          </div>`;
        }).join('')}
      </div>
    `).join('') || '<div style="text-align:center;color:var(--muted);padding:20px;">Sin opciones disponibles</div>';
  }

  // Botón footer
  const canNext = _flujo.paso !== 2 || _flujo.prod2 !== null;
  const obligPend = _flujo.paso === 3
    ? modifs.filter(m => m.obligatorio && !_flujo.selecciones[m.id]).map(m=>m.nombre)
    : [];
  const btnLabel = obligPend.length > 0
    ? 'Falta: '+obligPend.join(', ')
    : isLast
      ? `Agregar — ${gs(precioTotal)}`
      : _flujo.paso === 1 && _flujo.esMitad
        ? 'Elegir segundo sabor →'
        : `Continuar — ${gs(precioTotal)}`;

  document.getElementById('modifSheetTitle').textContent = prod.name;
  document.getElementById('modifSheetSub').textContent = 'paso '+(idx+1)+' de '+steps.length;
  document.getElementById('modifSheetBody').innerHTML =
    `<div style="padding:4px 16px 8px;display:flex;gap:4px;">${dotsHTML}</div>` + bodyHTML;
  document.getElementById('modifBtnAgregar').disabled = !canNext || obligPend.length > 0;
  document.getElementById('modifBtnAgregar').textContent = btnLabel;

  // Botón volver
  const backBtn = document.getElementById('modifBackBtn');
  if(backBtn) backBtn.style.display = idx > 0 ? 'block' : 'none';
}

function _selModo(modo){
  _flujo.esMitad = modo === 'mitad';
  if(!_flujo.esMitad) _flujo.prod2 = null;
  _renderFlujoSheet();
}

function _chgQty(d){
  _flujo.qty = Math.max(1, _flujo.qty + d);
  const el = document.getElementById('flujoQty');
  if(el) el.textContent = _flujo.qty;
  _renderFlujoSheet();
}

function _selSabor2(prodId){
  _flujo.prod2 = PRODS.find(p => p.id === prodId);
  _renderFlujoSheet();
}

function _filterMitadSearch(q){
  const cont = document.getElementById('mitadOptsList');
  if(!cont) return;
  const pizzas = PRODS.filter(p => p.mitad && p.activo !== false && !p.itemLibre && !p.esInsumo);
  const filtradas = q ? pizzas.filter(p => p.name.toLowerCase().includes(q.toLowerCase())) : pizzas;
  cont.innerHTML = filtradas.map(p => {
    const sel = _flujo.prod2 && _flujo.prod2.id === p.id;
    return `<div onclick="_selSabor2(${p.id})"
      style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;
      cursor:pointer;border-left:3px solid ${sel?'var(--green)':'transparent'};
      background:${sel?'rgba(76,175,80,.06)':'var(--bg-card)'};
      border-bottom:0.5px solid var(--border);transition:all .12s;">
      <div style="font-size:14px;font-weight:700;color:var(--text);">${p.name}</div>
      <div style="font-size:12px;color:var(--muted);">${gs(p.price)}</div>
    </div>`;
  }).join('');
}

function _toggleModifOpt(modifId, opcId, tipo){
  if(tipo === 'unico'){
    _flujo.selecciones[modifId] = opcId;
  } else {
    if(!_flujo.selecciones[modifId]) _flujo.selecciones[modifId] = new Set();
    const set = _flujo.selecciones[modifId];
    if(set.has(opcId)) set.delete(opcId); else set.add(opcId);
  }
  _renderFlujoSheet();
}

function modifConfirmar(){
  const steps = _flujoSteps();
  const idx   = _flujoIdx();
  const isLast = idx === steps.length - 1;

  if(!isLast){
    // Avanzar al siguiente paso
    _flujo.paso = steps[idx+1];
    _renderFlujoSheet();
    return;
  }

  // Confirmar y agregar al carrito
  const prod = _flujo.prod;
  let precio = prod.price || 0;
  let nombre = prod.name;
  let obs    = '';
  let esMitad = false;

  if(_flujo.esMitad && _flujo.prod2){
    const cfg = localStorage.getItem('pos_precio_mitad') || 'mas_caro';
    precio = cfg === 'promedio'
      ? Math.round((prod.price + _flujo.prod2.price) / 2)
      : Math.max(prod.price, _flujo.prod2.price);
    // Nombre limpio: quitar palabras comunes como "PIZZA" del segundo sabor
    const n1 = prod.name;
    const n2 = _flujo.prod2.name;
    // Extraer solo el sabor (quitar prefijo común entre los dos nombres)
    const words1 = n1.split(' ');
    const words2 = n2.split(' ');
    let prefixLen = 0;
    while(prefixLen < words1.length && prefixLen < words2.length &&
          words1[prefixLen] === words2[prefixLen]) prefixLen++;
    const sabor2 = prefixLen > 0 ? words2.slice(prefixLen).join(' ') || n2 : n2;
    nombre = n1 + ' / ' + sabor2;
    obs    = ''; // las mitades ya están en el nombre, no repetir en obs
    esMitad = true;
  }

  // Extras de modificadores
  let extrasDesc = [];
  let precioExtra = 0;
  const modifs = modificadores.filter(m => m.productos && m.productos.includes(prod.id));
  modifs.forEach(m => {
    const sel = _flujo.selecciones[m.id];
    if(!sel) return;
    if(m.tipo === 'unico'){
      const opc = m.opciones.find(o => o.id === sel);
      if(opc){ extrasDesc.push(opc.nombre); precioExtra += opc.precio_adicional||0; }
    } else {
      sel.forEach(opcId => {
        const opc = m.opciones.find(o => o.id === opcId);
        if(opc){ extrasDesc.push(opc.nombre); precioExtra += opc.precio_adicional||0; }
      });
    }
  });
  if(extrasDesc.length) obs = (obs ? obs+' · ' : '') + extrasDesc.join(' · ');
  precio += precioExtra;

  cart.push({
    lineId:   Date.now()*1000+Math.floor(Math.random()*1000),
    ...prod,
    name:     nombre,
    price:    precio,
    qty:      _flujo.qty,
    obs:      obs,
    enviado:  false,
    _esMitad: esMitad,
    _mitad1:  esMitad ? prod.name : undefined,
    _mitad2:  esMitad && _flujo.prod2 ? _flujo.prod2.name : undefined,
  });

  updUI(); updBtnGuardar();
  if(typeof renderTkt === 'function') renderTkt();
  toast('+'+nombre+(extrasDesc.length?' ('+extrasDesc.join(', ')+')':''));
  document.getElementById('modifOverlay').classList.remove('open');
}

function _flujoBack(){
  const steps = _flujoSteps();
  const idx   = _flujoIdx();
  if(idx > 0){ _flujo.paso = steps[idx-1]; _renderFlujoSheet(); }
}

// Compat — mantener funciones antiguas que puedan llamarse desde otros lugares
function abrirModalMitad(prod){ abrirFlujoPizza(prod, false); }
function mitadCancelar(){ _flujoClose(); }
function mitadConfirmar(){ modifConfirmar(); }
function renderMitadOpts(){}
function selMitad2(id){ _selSabor2(id); }
function updMitadPrecioInfo(){}
function modifOverlayClick(e){ if(e.target===document.getElementById('modifOverlay')) _flujoClose(); }
function mitadOverlayClick(e){ if(e.target===document.getElementById('mitadOverlay')) _flujoClose(); }

// ── Config precio mitad ───────────────────────────────
function selCfgMitad(val){
  localStorage.setItem('pos_precio_mitad', val);
  ['MasCaro','Promedio'].forEach(k => {
    const btn = document.getElementById('cfgMitad'+k);
    if(btn) btn.style.borderColor = (val === k.toLowerCase().replace('mascaro','mas_caro') || (k==='MasCaro' && val==='mas_caro')) ? 'var(--green)' : 'var(--border2)';
  });
  toast(val === 'mas_caro' ? 'Precio: el más caro' : 'Precio: promedio');
}

function loadCfgMitad(){
  const val = localStorage.getItem('pos_precio_mitad') || 'mas_caro';
  selCfgMitad(val);
}

// ── Carga desde Supabase (nube → memoria + IndexedDB) ───────────────────────

async function supaLoadProductos(){
  if(USAR_DEMO) return;
  var email = localStorage.getItem(SK.email);
  if(!email) return;
  try {
    var data = await supaGet('pos_productos',
      'licencia_email=eq.'+encodeURIComponent(email)+'&order=nombre.asc&select=*'
    );
    if(!data || !data.length) return;

    var itemLibre = PRODS.find(function(p){ return p.itemLibre; });
    var newProds  = [];
    if(itemLibre) newProds.push(itemLibre);

    data.forEach(function(p){
      newProds.push({
        id:             p.id,
        prodId:         p.id,
        name:           p.nombre,
        price:          p.precio || 0,
        precioVariable: p.precio_variable || false,
        costo:          p.costo || 0,
        codigo:         p.codigo || '',
        cat:            p.categoria || 'Sin categoría',
        iva:            p.iva || '10',
        color:          p.color || '#546e7a',
        colorPropio:    p.color_propio || false,
        mitad:          p.mitad || false,
        inventario:     p.inventario || false,
        esInsumo:       p.es_insumo === true,
        comanda:        p.comanda || false,
        esKilo:         p.es_kilo || false,
        esFavorito:     p.es_favorito || false,
        itemLibre:      false,
        activo:         p.activo !== false && p.activo !== 0,
        imagen:         p.imagen || null,
      });
    });

    PRODS.length = 0;
    newProds.forEach(function(p){ PRODS.push(p); });

    var maxId = Math.max.apply(null, PRODS.filter(function(p){return !p.itemLibre;}).map(function(p){return p.id;}).concat([0]));
    nextProdId = maxId + 1;
    _log('[Supabase] Productos cargados:', PRODS.length - 1);

    // Merge: agrega al array las categorías derivadas de productos que
    // aún no existen en CATEGORIAS (para cubrir el caso de pos_categorias
    // incompleta en Supabase).
    derivarCategoriasDeProductos();
    curCat = (typeof _catDefaultInicial === 'function') ? _catDefaultInicial() : 'Todos los artículos';
    var catLblEl = document.getElementById('catLbl');
    if(catLblEl) catLblEl.textContent = curCat;
    renderCatPills();
    filterP();
    try { await cargarDescuentosConfig(); } catch(ed){ console.warn('[Desc]', ed.message); }
    // Stock en memoria para aviso de stock estricto (despensa/autoservicio)
    if(typeof cargarStockPOS === 'function') cargarStockPOS();

    // Cachear imágenes en IndexedDB para uso offline
    if(db){
      var prodsConImg = newProds.filter(function(p){ return p.imagen && p.imagen.startsWith('http'); });
      for(var i = 0; i < prodsConImg.length; i++){
        var pi = prodsConImg[i];
        try {
          var cached = await db.config.get('img_cache_' + pi.imagen);
          if(!cached){
            var r = await fetch(pi.imagen);
            if(r.ok){
              var blob = await r.blob();
              var b64  = await new Promise(function(res){
                var fr = new FileReader();
                fr.onload = function(){ res(fr.result); };
                fr.readAsDataURL(blob);
              });
              await db.config.put({ clave:'img_cache_' + pi.imagen, valor: b64 });
            }
          }
        } catch(ei){/* imagen cache — no crítico */}
      }
      if(prodsConImg.length) _log('[Imagen] Cache offline:', prodsConImg.length, 'imágenes');
    }

    // Persistir en IndexedDB para uso offline
    if(db){
      try {
        var rows = data.map(function(p){
          return {
            id:              p.id,
            nombre:          p.nombre,
            precio:          p.precio || 0,
            precio_variable: p.precio_variable || false,
            costo:           p.costo || 0,
            codigo:          p.codigo || '',
            categoria:       p.categoria || 'Sin categoría',
            iva:             p.iva || '10',
            color:           p.color || '#546e7a',
            color_propio:    p.color_propio || false,
            mitad:           p.mitad || false,
            inventario:      p.inventario || false,
            comanda:         p.comanda || false,
            item_libre:      false,
            activo:          p.activo !== false && p.activo !== 0,
            imagen:          p.imagen || null,
            updatedAt:       new Date().toISOString(),
          };
        });
        await db.productos.bulkPut(rows);
        _log('[DB] Productos cacheados offline:', rows.length);
      } catch(ed){ console.warn('[DB] Cache productos:', ed.message); }
    }
  } catch(e){
    if(!(e.message && e.message.includes('Failed to fetch')))
      console.warn('[Supabase] Productos:', e.message);
  }
}

// Deriva CATEGORIAS a partir de los valores únicos de PRODS.cat.
// Fallback para cuando pos_categorias está vacía en Supabase pero los
// productos tienen el campo categoria poblado.
function derivarCategoriasDeProductos(){
  if(!PRODS || !PRODS.length) return;
  var COLORES = ['#e53935','#fb8c00','#fdd835','#43a047','#00acc1','#1e88e5','#5e35b1','#d81b60','#546e7a','#6d4c41'];
  // Nombres ya presentes en CATEGORIAS (case-insensitive)
  var existentes = {};
  CATEGORIAS.forEach(function(c){ existentes[(c.nombre||'').toLowerCase()] = true; });
  // IDs ocupados para evitar colisión al generar ids derivados
  var maxId = CATEGORIAS.reduce(function(m,c){ return Math.max(m, c.id||0); }, 9999);
  var faltantes = {};
  PRODS.forEach(function(p){
    if(p.itemLibre) return;
    var nom = (p.cat || '').toString().trim();
    if(!nom || nom === 'Sin categoría' || nom === 'Descuentos') return;
    if(existentes[nom.toLowerCase()]) return;
    if(!faltantes[nom]) faltantes[nom] = true;
  });
  var nombres = Object.keys(faltantes).sort(function(a,b){ return a.localeCompare(b); });
  nombres.forEach(function(nom, i){
    CATEGORIAS.push({ id: maxId + 1 + i, nombre: nom, color: COLORES[i % COLORES.length] });
  });
  if(nombres.length){
    _log('[Fallback] Categorías derivadas agregadas:', nombres.length, '→', nombres.join(', '));
  }
}

async function supaLoadCategorias(){
  if(USAR_DEMO){ _log('[supaLoadCategorias] Modo demo, skip'); return; }
  var email = localStorage.getItem(SK.email);
  if(!email){ console.warn('[supaLoadCategorias] Sin email en localStorage (SK.email='+SK.email+')'); return; }
  try {
    var data = await supaGet('pos_categorias',
      'licencia_email=eq.'+encodeURIComponent(email)+'&order=nombre.asc&select=*'
    );
    _log('[supaLoadCategorias] Supabase devolvió', (data||[]).length, 'categorías para email:', email);
    if(!data || !data.length){
      console.warn('[supaLoadCategorias] No hay categorías en Supabase para este email');
      return;
    }
    var newCats = data.map(function(c){ return { id:c.id, nombre:c.nombre, color:c.color||'#546e7a' }; });
    CATEGORIAS.length = 0;
    newCats.forEach(function(c){ CATEGORIAS.push(c); });
    var maxId = Math.max.apply(null, CATEGORIAS.map(function(c){return c.id;}).concat([0]));
    nextCatId = maxId + 1;
    _log('[Supabase] Categorías cargadas:', CATEGORIAS.length);

    if(db){
      try {
        var rows = data.map(function(c){
          return {
            id:        c.id,
            nombre:    c.nombre,
            color:     c.color || '#546e7a',
            updatedAt: new Date().toISOString(),
          };
        });
        await db.categorias.bulkPut(rows);
        _log('[DB] Categorías cacheadas offline:', rows.length);
      } catch(ed){ console.warn('[DB] Cache categorías:', ed.message); }
    }
  } catch(e){
    if(!e.message.includes('Failed to fetch'))
      console.warn('[Supabase] Categorías:', e.message);
  }
}
