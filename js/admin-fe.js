// ── Admin: Factura Electrónica (FacturaSend) ──
// Página 'factura-electronica' del panel admin. Dos pestañas:
//   - Configuración: credenciales tenantId/apiKey por negocio + test de conexión.
//     Fuente de verdad: Supabase pos_config (clave 'facturasend_config') para
//     que la terminal POS las descargue en sincronizarConfigNegocio().
//   - Documentos: listado de DEs emitidos (pos_ventas con fe_cdc) con estado
//     SIFEN, respuesta y botón de actualización vía feConsultarEstados().
// Usa helpers globales de admin-negocio.html: SE, sg, gs, fmtDT, toast, pad3.
// Usa la capa adaptadora js/factura-electronica.js: feGetConfig/feSetConfig/
// feTestConexion/feConsultarEstados.

var FE_CFG_CLAVE = 'facturasend_config';
var feDocs = [];
var feDocsFiltro = 'todos';

// ── Helpers ───────────────────────────────────────────────

/** Lee la config FE desde Supabase y sincroniza la copia local del admin */
async function feCargarConfigSupabase(){
  try{
    var rows = await sg('pos_config','licencia_email=ilike.'+encodeURIComponent(SE)+'&clave=eq.'+FE_CFG_CLAVE+'&select=valor');
    if(rows.length){
      var val = JSON.parse(rows[0].valor||'{}');
      feSetConfig({ tenantId: val.tenant_id||'', apiKey: val.api_key||'', apiUrl: val.api_url||'', activa: !!val.activa });
      return val;
    }
  }catch(e){ console.warn('[FE] Error cargando config:', e.message); }
  var c = feGetConfig();
  return { tenant_id:c.tenantId, api_key:c.apiKey, api_url:c.apiUrl, activa:c.activa };
}

/** Badge de estado FE. Acepta código numérico ('0','2','4'...) o null */
function feEstadoBadge(estado){
  var e = String(estado===null||estado===undefined?'':estado);
  if(e==='2')  return '<span class="tag tag-g">Aprobado</span>';
  if(e==='3')  return '<span class="tag tag-g">Aprobado c/obs</span>';
  if(e==='4')  return '<span class="tag tag-r">Rechazado</span>';
  if(e==='99') return '<span class="tag tag-r">Cancelado</span>';
  if(e==='-1') return '<span class="tag tag-o">Borrador</span>';
  return '<span class="tag tag-o">Pendiente</span>';
}

// ── PÁGINA ────────────────────────────────────────────────

function renderFacturaElectronica(){
  document.getElementById('content').innerHTML =
    '<div class="ph"><div><div class="pt">Factura Electrónica</div><div class="ps">Emisión SIFEN vía FacturaSend</div></div></div>'+
    '<div class="admin-tabs">'+
    '<button class="atab on" id="fetab-docs" onclick="goFETab(\'docs\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Documentos</button>'+
    '<button class="atab" id="fetab-config" onclick="goFETab(\'config\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> Configuración</button>'+
    '</div><div id="feTabContent"></div>';
  // Si no hay credenciales todavía, abrir directo en Configuración
  var c = feGetConfig();
  goFETab((c.tenantId && c.apiKey) ? 'docs' : 'config');
}

function goFETab(t){
  document.querySelectorAll('.atab').forEach(function(b){ b.classList.remove('on'); });
  var btn = document.getElementById('fetab-'+t);
  if(btn) btn.classList.add('on');
  var tc = document.getElementById('feTabContent');
  if(!tc) return;
  if(t==='config') renderFEConfigTab(tc);
  if(t==='docs')   renderFEDocsTab(tc);
}

// ── TAB CONFIGURACIÓN ─────────────────────────────────────

async function renderFEConfigTab(tc){
  tc.innerHTML = '<div class="loading"><span class="sp"></span>Cargando...</div>';
  var val = await feCargarConfigSupabase();

  var inp = 'width:100%;background:var(--input-bg);border:1.5px solid var(--input-border);border-radius:8px;color:var(--text);font-family:\'Barlow\',sans-serif;font-size:14px;padding:11px 12px;outline:none;box-sizing:border-box;';
  var lbl = 'font-size:11px;color:var(--muted);text-transform:uppercase;font-weight:700;display:block;margin-bottom:5px;';

  tc.innerHTML =
    '<div style="max-width:560px;">'+

    // Card credenciales
    '<div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px;margin-bottom:14px;">'+
    '<div style="font-size:14px;font-weight:800;color:var(--text);margin-bottom:14px;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Credenciales FacturaSend</div>'+
    '<div style="margin-bottom:12px;"><label style="'+lbl+'">Servidor (URL de la API)</label>'+
    '<input id="feApiUrl" type="text" placeholder="Vacío = nube FacturaSend (api.facturasend.com.py)" autocomplete="off" value="'+escapeHtml(val.api_url||'')+'" style="'+inp+'font-family:monospace;">'+
    '<div style="font-size:10px;color:var(--muted);margin-top:3px;">Servidor propio (self-hosted): ej. http://207.244.255.146:85/api</div></div>'+
    '<div style="margin-bottom:12px;"><label style="'+lbl+'">Tenant ID *</label>'+
    '<input id="feTenant" type="text" placeholder="Ej: empresa123" autocomplete="off" value="'+escapeHtml(val.tenant_id||'')+'" style="'+inp+'font-family:monospace;"></div>'+
    '<div style="margin-bottom:12px;"><label style="'+lbl+'">API Key *</label>'+
    '<div style="position:relative;"><input id="feApiKey" type="password" placeholder="api_key_..." autocomplete="off" value="'+escapeHtml(val.api_key||'')+'" style="'+inp+'font-family:monospace;padding-right:44px;">'+
    '<button onclick="feToggleKey()" style="position:absolute;right:6px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--muted);cursor:pointer;padding:6px;" title="Mostrar/ocultar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button></div>'+
    '<div style="font-size:10px;color:var(--muted);margin-top:3px;">Se ingresa sin el prefijo "api_key_" — se agrega solo.</div></div>'+
    '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;background:var(--card2);border-radius:8px;padding:10px 12px;">'+
    '<input id="feActiva" type="checkbox" '+(val.activa?'checked':'')+' style="width:18px;height:18px;accent-color:var(--green);cursor:pointer;">'+
    '<label for="feActiva" style="font-size:13px;color:var(--text);font-weight:600;cursor:pointer;flex:1;">Factura electrónica activa</label></div>'+
    '<div style="display:flex;gap:10px;">'+
    '<button onclick="feProbarConexion()" id="feBtnTest" style="flex:1;background:var(--card2);border:1.5px solid var(--blue);border-radius:8px;color:var(--blue);font-family:\'Barlow\',sans-serif;font-size:13px;font-weight:700;padding:12px;cursor:pointer;">PROBAR CONEXIÓN</button>'+
    '<button onclick="feGuardarConfig()" id="feBtnSave" style="flex:1;background:var(--green);border:none;border-radius:8px;color:#fff;font-family:\'Barlow\',sans-serif;font-size:13px;font-weight:800;padding:12px;cursor:pointer;">GUARDAR</button>'+
    '</div>'+
    '<div id="feTestResult" style="margin-top:10px;"></div>'+
    '</div>'+

    // Card requisitos
    '<div style="background:rgba(66,165,245,.06);border:1px solid rgba(66,165,245,.2);border-radius:12px;padding:16px 18px;">'+
    '<div style="font-size:13px;font-weight:700;color:var(--blue);margin-bottom:8px;">Requisitos previos</div>'+
    '<div style="font-size:12px;color:var(--muted);line-height:1.8;">'+
    '1. Cuenta en <b style="color:var(--text)">console.facturasend.com.py</b> o en tu servidor FacturaSend propio (el Tenant ID y la API Key salen de ahí).<br>'+
    '2. Certificado digital del negocio cargado en la consola de FacturaSend.<br>'+
    '3. Timbrado electrónico habilitado por DNIT, cargado acá en <b style="color:var(--text)">Administración → Puntos de Expedición</b> con tipo Electrónico.<br>'+
    '4. Las credenciales se guardan en la nube: las terminales las reciben solas al sincronizar.'+
    '</div></div>'+

    '</div>';
}

function feToggleKey(){
  var i = document.getElementById('feApiKey');
  if(i) i.type = (i.type==='password') ? 'text' : 'password';
}

async function feGuardarConfig(){
  var tenant = (document.getElementById('feTenant').value||'').trim();
  var apiKey = (document.getElementById('feApiKey').value||'').trim().replace(/^api_key_/,'');
  var apiUrl = (document.getElementById('feApiUrl').value||'').trim().replace(/\/+$/,'');
  var activa = document.getElementById('feActiva').checked;
  if(activa && (!tenant || !apiKey)){ alert('Para activar, completá Tenant ID y API Key'); return; }
  if(apiUrl && !/^https?:\/\//.test(apiUrl)){ alert('La URL del servidor debe empezar con http:// o https://'); return; }

  var btn = document.getElementById('feBtnSave');
  if(btn){ btn.disabled=true; btn.textContent='Guardando...'; }
  try{
    await supaPost('pos_config', {
      licencia_email: SE,
      clave: FE_CFG_CLAVE,
      valor: JSON.stringify({ tenant_id:tenant, api_key:apiKey, api_url:apiUrl, activa:activa }),
    }, 'licencia_email,clave', true);
    feSetConfig({ tenantId:tenant, apiKey:apiKey, apiUrl:apiUrl, activa:activa });
    toast('Configuración guardada');
  }catch(e){
    alert('Error al guardar: '+e.message);
  }
  if(btn){ btn.disabled=false; btn.textContent='GUARDAR'; }
}

async function feProbarConexion(){
  var tenant = (document.getElementById('feTenant').value||'').trim();
  var apiKey = (document.getElementById('feApiKey').value||'').trim().replace(/^api_key_/,'');
  var apiUrl = (document.getElementById('feApiUrl').value||'').trim().replace(/\/+$/,'');
  var res = document.getElementById('feTestResult');
  if(!tenant || !apiKey){ if(res) res.innerHTML='<div style="font-size:12px;color:var(--orange);">Completá Tenant ID y API Key primero</div>'; return; }

  // Probar con lo tipeado (sin obligar a guardar antes)
  var prev = feGetConfig();
  feSetConfig({ tenantId:tenant, apiKey:apiKey, apiUrl:apiUrl });

  var btn = document.getElementById('feBtnTest');
  if(btn){ btn.disabled=true; btn.textContent='Probando...'; }
  if(res) res.innerHTML='<div style="font-size:12px;color:var(--muted);">Conectando con FacturaSend...</div>';
  try{
    var r = await feTestConexion();
    if(res) res.innerHTML='<div style="background:var(--g2);border:1px solid var(--green);border-radius:8px;padding:10px 12px;font-size:12px;color:var(--green);font-weight:700;">✓ Conexión OK — credenciales válidas ('+r.departamentos+' departamentos recibidos)</div>';
  }catch(e){
    feSetConfig(prev); // restaurar lo que había si falló
    if(res) res.innerHTML='<div style="background:var(--r2);border:1px solid var(--red);border-radius:8px;padding:10px 12px;font-size:12px;color:var(--red);font-weight:700;">✗ '+escapeHtml(e.message)+'</div>';
  }
  if(btn){ btn.disabled=false; btn.textContent='PROBAR CONEXIÓN'; }
}

// ── TAB DOCUMENTOS ────────────────────────────────────────

async function renderFEDocsTab(tc){
  tc.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:10px;">'+
    '<div><div style="font-size:15px;font-weight:700;color:var(--text);">Documentos Electrónicos</div><div style="font-size:12px;color:var(--muted);margin-top:2px;">Estados de SIFEN vía FacturaSend</div></div>'+
    '<button class="btn-nueva" id="feBtnRefresh" onclick="feActualizarEstados()">↻ ACTUALIZAR ESTADOS</button></div>'+
    '<div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;" id="feChips">'+
    ['todos','pendientes','aprobados','rechazados'].map(function(f){
      var lbls = {todos:'Todos', pendientes:'Pendientes', aprobados:'Aprobados', rechazados:'Rechazados'};
      return '<button onclick="feFiltrarDocs(\''+f+'\')" id="feChip-'+f+'" style="background:'+(feDocsFiltro===f?'var(--g2)':'var(--card2)')+';border:1.5px solid '+(feDocsFiltro===f?'var(--green)':'var(--border)')+';border-radius:16px;color:'+(feDocsFiltro===f?'var(--green)':'var(--muted)')+';font-family:\'Barlow\',sans-serif;font-size:12px;font-weight:700;padding:6px 14px;cursor:pointer;">'+lbls[f]+'</button>';
    }).join('')+'</div>'+
    '<div id="feDocsLista"><div class="loading"><span class="sp"></span>Cargando...</div></div>';
  await feCargarDocs();
}

async function feCargarDocs(){
  var lista = document.getElementById('feDocsLista');
  try{
    feDocs = await sg('pos_ventas',
      'licencia_email=ilike.'+encodeURIComponent(SE)+
      '&fe_cdc=not.is.null&order=fecha.desc&limit=200'+
      '&select=id,fecha,total,factura_ruc,factura_nombre,cliente_nombre,fe_cdc,fe_estado,fe_numero,fe_respuesta,fe_nc_cdc,fe_nc_numero,fe_nc_estado,anulada');
  }catch(e){
    // Columnas fe_* aún no migradas en Supabase
    if(lista) lista.innerHTML='<div class="empty"><div class="empty-t">Falta la migración de base de datos</div><div class="empty-s">Ejecutá supabase-migrations/add_factura_electronica.sql en el SQL Editor de Supabase</div></div>';
    return;
  }
  if(lista) lista.innerHTML = feBuildDocsLista();
}

function feFiltrarDocs(f){
  feDocsFiltro = f;
  ['todos','pendientes','aprobados','rechazados'].forEach(function(x){
    var b = document.getElementById('feChip-'+x);
    if(!b) return;
    var on = (x===f);
    b.style.background = on?'var(--g2)':'var(--card2)';
    b.style.borderColor = on?'var(--green)':'var(--border)';
    b.style.color = on?'var(--green)':'var(--muted)';
  });
  var lista = document.getElementById('feDocsLista');
  if(lista) lista.innerHTML = feBuildDocsLista();
}

function feBuildDocsLista(){
  var docs = feDocs.filter(function(d){
    var e = String(d.fe_estado===null||d.fe_estado===undefined?'':d.fe_estado);
    if(feDocsFiltro==='pendientes') return e===''||e==='0'||e==='1'||e==='-1';
    if(feDocsFiltro==='aprobados')  return e==='2'||e==='3';
    if(feDocsFiltro==='rechazados') return e==='4'||e==='99';
    return true;
  });
  if(!docs.length) return '<div class="empty"><div class="empty-i"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div><div class="empty-t">Sin documentos electrónicos</div><div class="empty-s">'+(feDocsFiltro==='todos'?'Los documentos emitidos con timbrado electrónico van a aparecer acá':'No hay documentos con este filtro')+'</div></div>';

  return docs.map(function(d,i){
    var cliente = d.factura_nombre || d.cliente_nombre || 'Consumidor final';
    var resp = d.fe_respuesta ? '<div style="font-size:11px;color:'+(String(d.fe_estado)==='4'?'var(--red)':'var(--muted)')+';margin-top:6px;padding:8px 10px;background:var(--card2);border-radius:6px;line-height:1.5;">'+escapeHtml(d.fe_respuesta)+'</div>' : '';
    if(d.fe_nc_cdc){
      resp += '<div style="font-size:11px;color:var(--orange);margin-top:6px;padding:8px 10px;background:var(--card2);border-radius:6px;line-height:1.5;">Nota de Crédito '+escapeHtml(d.fe_nc_numero||'')+' '+feEstadoBadge(d.fe_nc_estado)+'<br><span style="font-family:monospace;font-size:10px;color:var(--muted);word-break:break-all;">'+d.fe_nc_cdc+'</span></div>';
    }
    return '<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:8px;">'+
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">'+
      '<div style="flex:1;min-width:180px;">'+
      '<div style="font-size:13px;font-weight:800;color:var(--text);font-family:monospace;">'+escapeHtml(d.fe_numero||('#'+d.id))+' '+feEstadoBadge(d.fe_estado)+'</div>'+
      '<div style="font-size:11px;color:var(--muted);margin-top:2px;">'+fmtDT(d.fecha)+' · '+escapeHtml(cliente)+(d.factura_ruc?' · RUC '+escapeHtml(d.factura_ruc):'')+'</div>'+
      '</div>'+
      '<div style="font-size:14px;font-weight:800;color:var(--green);">'+gs(d.total)+'</div>'+
      '</div>'+
      '<div onclick="feCopiarCDC(\''+d.fe_cdc+'\')" title="Copiar CDC" style="font-size:10px;font-family:monospace;color:var(--muted);margin-top:6px;cursor:pointer;word-break:break-all;">CDC: '+d.fe_cdc+'</div>'+
      resp+
      '</div>';
  }).join('');
}

function feCopiarCDC(cdc){
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(cdc);
    } else {
      var ta=document.createElement('textarea'); ta.value=cdc; document.body.appendChild(ta);
      ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    }
    toast('CDC copiado');
  }catch(e){ /* clipboard no disponible */ }
}

/** Consulta a FacturaSend los estados de los docs pendientes y los persiste */
async function feActualizarEstados(){
  var pend = feDocs.filter(function(d){
    var e = String(d.fe_estado===null||d.fe_estado===undefined?'':d.fe_estado);
    return d.fe_cdc && (e===''||e==='0'||e==='1');
  });
  if(!pend.length){ toast('No hay documentos pendientes de estado'); return; }

  // Asegurar credenciales cargadas desde la nube
  var c = feGetConfig();
  if(!c.tenantId || !c.apiKey){
    await feCargarConfigSupabase();
    c = feGetConfig();
    if(!c.tenantId || !c.apiKey){ toast('Configurá las credenciales primero'); goFETab('config'); return; }
  }

  var btn = document.getElementById('feBtnRefresh');
  if(btn){ btn.disabled=true; btn.textContent='Consultando...'; }
  try{
    var res = await feConsultarEstados(pend.map(function(d){ return d.fe_cdc; }));
    var porCdc = {};
    (res||[]).forEach(function(r){ if(r && r.cdc) porCdc[r.cdc]=r; });

    var actualizados = 0;
    for(var i=0; i<pend.length; i++){
      var d = pend[i];
      var r = porCdc[d.fe_cdc];
      if(!r) continue;
      // situacion numérica (2/3/4...); fallback al texto de estado
      var est = (r.situacion!==undefined && r.situacion!==null) ? String(r.situacion) : String(d.fe_estado||'0');
      var resp = ((r.respuesta_codigo||'')+' '+(r.respuesta_mensaje||r.estado||'')).trim();
      if(est===String(d.fe_estado||'') && !resp) continue;
      await supaPatch('pos_ventas','id=eq.'+d.id, { fe_estado:est, fe_respuesta:resp||null }, true);
      d.fe_estado = est; d.fe_respuesta = resp;
      actualizados++;
    }
    toast(actualizados ? (actualizados+' documento'+(actualizados!==1?'s':'')+' actualizado'+(actualizados!==1?'s':'')) : 'Sin cambios de estado');
    var lista = document.getElementById('feDocsLista');
    if(lista) lista.innerHTML = feBuildDocsLista();
  }catch(e){
    alert('Error al consultar estados: '+e.message);
  }
  if(btn){ btn.disabled=false; btn.textContent='↻ ACTUALIZAR ESTADOS'; }
}
