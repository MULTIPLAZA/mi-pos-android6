// ── App: utilidades, config negocio, carrito, drawer, configuración, print UI ──
// PRODS y curCat → js/state.js

// ── UTILIDADES ───────────────────────────────────────────────

// ── CONFIG ───────────────────────────────────────────────────

async function sincronizarConfigNegocio(){
  const email = localStorage.getItem('lic_email');
  if(!email || USAR_DEMO) return;
  // Cargar config de rubro en paralelo (no bloquea el resto de la sync)
  if(typeof rubroCargarDesdeSupabase === 'function'){
    rubroCargarDesdeSupabase().then(function(){
      if(typeof rubroAplicarUI === 'function') rubroAplicarUI();
    }).catch(function(e){ console.warn('[Rubro] Error en sync inicial:', e.message); });
  }
  try {
    const rows = await supaGet('pos_config',
      'licencia_email=eq.'+encodeURIComponent(email)+
      '&clave=in.(negocio_config,timbrados_config,timbrados_mapa)');

    rows.forEach(row => {
      try {
        const val = JSON.parse(row.valor||'{}');
        if(row.clave === 'negocio_config'){
          // IMPORTANTE: si el usuario ya tiene datos guardados localmente
          // (localStorage), NO pisarlos con lo que venga de Supabase. Solo
          // usar los datos de Supabase como fallback cuando no hay local.
          // Esto evita que datos viejos/de otra cuenta sobreescriban lo
          // que el usuario acaba de guardar.
          if(val.an && !localStorage.getItem('an'))  configData.negocio   = val.an;
          if(val.ar && !localStorage.getItem('ar'))  configData.ruc        = val.ar;
          if(val.ad && !localStorage.getItem('ad'))  configData.direccion  = val.ad;
          if(val.ciudad && !localStorage.getItem('ciudad')) configData.ciudad = val.ciudad;
          if(val.at && !localStorage.getItem('at'))  configData.telefono   = val.at;
          if(val.email_negocio) configData.email = val.email_negocio;
          if(val.pie_recibo && !localStorage.getItem('pie_recibo'))    configData.pie_recibo  = val.pie_recibo;
          if(val.mostrar_ruc !== undefined && !localStorage.getItem('mostrar_ruc')) configData.mostrar_ruc = val.mostrar_ruc;
          if(val.moneda && !localStorage.getItem('moneda')) configData.moneda = val.moneda;
          // Solo persistir a localStorage las claves que NO existen aún
          Object.entries(val).forEach(([k,v])=>{
            if(v && !localStorage.getItem(k)) localStorage.setItem(k,v);
          });
          _log('[Config] Negocio (sync Supabase):', configData.negocio, '| RUC:', configData.ruc);
        }
      } catch(e){ console.warn('[Config] Error parsing', row.clave, e.message); }
    });
    cargarTimbradoSesion();
  } catch(e){ console.warn('[Config] Error sync:', e.message); }
}

function renderGeneralInfo(){
  const el = document.getElementById('generalInfoPanel');
  if(!el) return;
  const terminal   = localStorage.getItem('pos_terminal') || 'Terminal 1';
  const sucursal   = localStorage.getItem('pos_sucursal') || '—';
  const depId      = localStorage.getItem('pos_deposito_id') || null;
  const tim = getTimbradoActivo();
  const pad3 = n => String(n||0).padStart(3,'0');
  const padN = n => String(n||0).padStart(7,'0');
  el.innerHTML = `
    <div style="background:#111;border:1.5px solid #2a2a2a;border-radius:10px;overflow:hidden;margin-bottom:14px;">
      <div style="padding:10px 14px;border-bottom:1px solid #1e1e1e;display:flex;align-items:center;gap:8px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
        <span style="font-size:10px;font-weight:800;color:var(--green);letter-spacing:1px;text-transform:uppercase;">Esta Terminal</span>
      </div>
      <div style="padding:10px 14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="font-size:12px;color:#777;">Nombre</span>
          <span style="font-size:16px;font-weight:800;color:#fff;">${terminal}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="font-size:12px;color:#777;">Sucursal</span>
          <span style="font-size:13px;font-weight:600;color:#ccc;">${sucursal}</span>
        </div>
      </div>
    </div>
    ${tim ? `
    <div style="background:#111;border:1.5px solid rgba(76,175,80,.3);border-radius:10px;overflow:hidden;margin-bottom:14px;">
      <div style="padding:10px 14px;border-bottom:1px solid #1e1e1e;">
        <span style="font-size:10px;font-weight:800;color:var(--green);">TIMBRADO ACTIVO</span>
      </div>
      <div style="padding:10px 14px;display:flex;flex-direction:column;gap:6px;">
        <div style="display:flex;justify-content:space-between;">
          <span style="font-size:12px;color:#777;">Timbrado</span>
          <span style="font-size:13px;font-weight:800;color:#fff;font-family:monospace;">${tim.nro}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding-top:4px;border-top:1px solid #1e1e1e;">
          <span style="font-size:12px;color:#777;">Próxima factura</span>
          <span style="font-size:14px;font-weight:800;color:var(--green);font-family:monospace;">${pad3(tim.sucursal)}-${pad3(tim.punto_exp)}-${padN(tim.nro_actual||tim.desde||1)}</span>
        </div>
      </div>
    </div>` : `
    <div style="background:rgba(239,83,80,.08);border:1.5px solid rgba(239,83,80,.3);border-radius:10px;padding:12px 14px;margin-bottom:14px;">
      <span style="font-size:13px;font-weight:700;color:#ef5350;">Sin timbrado configurado</span>
    </div>`}
  `;
  // Panel de diagnóstico
  const licId     = localStorage.getItem('ali') || '—';
  const sucId     = localStorage.getItem('pos_sucursal_id') || '—';
  const depId2    = localStorage.getItem('pos_deposito_id') || '—';
  const termId    = localStorage.getItem('pos_terminal_id') || '—';
  const dbVer     = localStorage.getItem('pos_db_version') || '—';
  const online    = navigator.onLine ? 'Online' : 'Offline';
  const ua        = navigator.userAgent.match(/Chrome\/([\d.]+)/);
  const chrome    = ua ? 'Chrome '+ua[1] : navigator.userAgent.substring(0,40);
  const pwaMode   = window.matchMedia('(display-mode: standalone)').matches ? 'PWA (standalone)' : 'Navegador';

  el.innerHTML += `
    <div style="background:#111;border:1.5px solid #2a2a2a;border-radius:10px;overflow:hidden;margin-bottom:14px;">
      <div style="padding:10px 14px;border-bottom:1px solid #1e1e1e;display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:8px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff9800" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span style="font-size:10px;font-weight:800;color:#ff9800;letter-spacing:1px;text-transform:uppercase;">Diagnóstico</span>
        </div>
        <button onclick="navigator.clipboard&&navigator.clipboard.writeText(document.getElementById('diagPanel').innerText).then(()=>toast('Copiado'))" style="background:none;border:1px solid #333;border-radius:6px;color:#777;font-size:10px;font-weight:700;padding:4px 8px;cursor:pointer;font-family:Barlow,sans-serif;">COPIAR</button>
      </div>
      <div id="diagPanel" style="padding:10px 14px;display:flex;flex-direction:column;gap:5px;font-family:monospace;font-size:12px;">
        <div style="display:flex;justify-content:space-between;"><span style="color:#777;">Licencia ID</span><span style="color:#fff;font-weight:700;">${licId}</span></div>
        <div style="display:flex;justify-content:space-between;"><span style="color:#777;">Sucursal ID</span><span style="color:#fff;">${sucId}</span></div>
        <div style="display:flex;justify-content:space-between;"><span style="color:#777;">Depósito ID</span><span style="color:#fff;">${depId2}</span></div>
        <div style="display:flex;justify-content:space-between;"><span style="color:#777;">Terminal ID</span><span style="color:#fff;">${termId}</span></div>
        <div style="display:flex;justify-content:space-between;border-top:1px solid #1e1e1e;margin-top:4px;padding-top:5px;"><span style="color:#777;">Conexión</span><span style="color:${navigator.onLine?'#4caf50':'#ef5350'};">${online}</span></div>
        <div style="display:flex;justify-content:space-between;"><span style="color:#777;">Modo</span><span style="color:#ccc;">${pwaMode}</span></div>
        <div style="display:flex;justify-content:space-between;"><span style="color:#777;">Navegador</span><span style="color:#ccc;">${chrome}</span></div>
        <div style="display:flex;justify-content:space-between;border-top:1px solid #1e1e1e;margin-top:4px;padding-top:5px;">
          <span style="color:#777;">URL base</span>
          <span style="color:#ccc;font-size:10px;max-width:180px;text-align:right;word-break:break-all;">${SUPA_URL.replace('https://','').substring(0,30)}...</span>
        </div>
      </div>
    </div>
  `;

  loadGeneralConfigInputs();
}

function loadGeneralConfigInputs(){
  const set = (id, val) => { const el = document.getElementById(id); if(el!=null) el.value = val || ''; };
  set('cfgNegocio',   configData.negocio   || localStorage.getItem('an') || '');
  set('cfgDireccion', configData.direccion  || localStorage.getItem('ad') || '');
  set('cfgTelefono',  configData.telefono   || localStorage.getItem('at') || '');
  set('cfgRuc',       configData.ruc        || localStorage.getItem('ar') || '');
  // Mostrar última sincronización con la nube
  if(typeof mostrarUltimaSincroNegocio === 'function') mostrarUltimaSincroNegocio();
  const chk = document.getElementById('cfgPresupuestos');
  if(chk){
    const habilitado = configData.presupuestosHabilitados !== undefined
      ? configData.presupuestosHabilitados
      : localStorage.getItem('pos_presupuestos') === '1';
    chk.checked = !!habilitado;
    configData.presupuestosHabilitados = !!habilitado;
  }
  const chkCom = document.getElementById('cfgComandas');
  if(chkCom){
    // Fuente de verdad: rubro (pos_flag_cocina) si está disponible, sino legacy (pos_comandas)
    const hab = typeof usaCocina === 'function'
      ? usaCocina()
      : (configData.comandasHabilitadas !== undefined
          ? configData.comandasHabilitadas
          : localStorage.getItem('pos_comandas') === '1');
    chkCom.checked = !!hab;
    configData.comandasHabilitadas = !!hab;
  }
  // Checkbox de sonidos — activo por defecto (mute === '0' o null)
  const chkSnd = document.getElementById('cfgSonidos');
  if(chkSnd){
    chkSnd.checked = typeof sonidoMuteGet === 'function' ? !sonidoMuteGet() : true;
  }
  // Checkbox del asistente de voz
  const chkAsist = document.getElementById('cfgAsistente');
  if(chkAsist){
    chkAsist.checked = typeof asistenteHabilitadoGet === 'function' ? asistenteHabilitadoGet() : true;
  }
  // Checkbox de voz — activo por defecto
  const chkVoz = document.getElementById('cfgVoz');
  if(chkVoz){
    chkVoz.checked = typeof vozMuteGet === 'function' ? !vozMuteGet() : true;
    // Mostrar/ocultar selector de voz según estado del toggle
    var selVoz = document.getElementById('cfgVozSelector');
    if(selVoz) selVoz.style.display = chkVoz.checked ? 'block' : 'none';
    // Poblar selector si está activo. Las voces pueden tardar en cargar,
    // hacer un retry después de un momento si viene vacío
    if(chkVoz.checked && typeof poblarSelectorVoces === 'function'){
      poblarSelectorVoces('all');
      setTimeout(function(){ poblarSelectorVoces(_vozFiltroActual || 'all'); }, 500);
    }
  }
  // Cargar config precio mitad
  if(typeof loadCfgMitad === 'function') loadCfgMitad();

  // Multi-moneda
  var chkMM = document.getElementById('cfgMultiMoneda');
  if(chkMM){
    var mmAct = localStorage.getItem('mm_activo') === '1';
    chkMM.checked = mmAct;
    var mmPanel = document.getElementById('cfgMMPanel');
    if(mmPanel) mmPanel.style.display = mmAct ? 'block' : 'none';
    var inpBRL = document.getElementById('cfgCotBRL');
    var inpARS = document.getElementById('cfgCotARS');
    if(inpBRL) inpBRL.value = localStorage.getItem('mm_cotBRL') || '';
    if(inpARS) inpARS.value = localStorage.getItem('mm_cotARS') || '';
    var ultAct = document.getElementById('cfgMMUltAct');
    if(ultAct){
      var ts = localStorage.getItem('mm_updAt');
      ultAct.textContent = ts ? 'Tipo de cambio actualizado: ' + ts : 'Tipo de cambio: no configurado';
    }
  }
}

// Toggle de sonidos con feedback auditivo instantáneo
function toggleSonidosConfig(){
  var chk = document.getElementById('cfgSonidos');
  if(!chk || typeof sonidoMuteSet !== 'function') return;
  sonidoMuteSet(!chk.checked);
  // Reproducir un tap al activar para confirmar que funciona
  if(chk.checked && typeof sndTap === 'function') sndTap();
}

// Toggle del asistente de voz — activa/desactiva el FAB flotante
function toggleAsistenteConfig(){
  var chk = document.getElementById('cfgAsistente');
  if(!chk || typeof asistenteHabilitadoSet !== 'function') return;
  asistenteHabilitadoSet(chk.checked);
  if(chk.checked){
    if(typeof toast === 'function') toast('Asistente activado — tocá el botón verde abajo');
  } else {
    if(typeof toast === 'function') toast('Asistente desactivado');
  }
}

// Toggle de voz con prueba instantánea
function toggleVozConfig(){
  var chk = document.getElementById('cfgVoz');
  if(!chk || typeof vozMuteSet !== 'function') return;
  vozMuteSet(!chk.checked);
  // Mostrar/ocultar selector de voz
  var sel = document.getElementById('cfgVozSelector');
  if(sel) sel.style.display = chk.checked ? 'block' : 'none';
  if(chk.checked){
    poblarSelectorVoces('all');
    if(typeof hablarCobro === 'function') hablarCobro(50000);
  }
}

// Estado del filtro actual (todas/masc/fem)
var _vozFiltroActual = 'all';

// Pobla el <select> con las voces disponibles, filtradas por género
function poblarSelectorVoces(filtro){
  _vozFiltroActual = filtro || 'all';
  var sel = document.getElementById('cfgVozSelect');
  if(!sel || typeof listarVocesEs !== 'function') return;
  var voces = listarVocesEs();
  if(!voces.length){
    sel.innerHTML = '<option value="">Cargando voces... (esperá 1-2 segundos)</option>';
    return;
  }
  var filtradas = voces;
  if(filtro === 'male' || filtro === 'female'){
    filtradas = voces.filter(function(v){ return generoVoz(v) === filtro; });
    if(!filtradas.length) filtradas = voces; // fallback
  }
  // La selección guardada ahora es un objeto {voiceURI, name, lang}
  var actual = typeof vozSeleccionadaGet === 'function' ? vozSeleccionadaGet() : null;
  var actualURI = actual && actual.voiceURI ? actual.voiceURI : '';
  var actualName = actual && actual.name ? actual.name : '';
  var html = '';
  filtradas.forEach(function(v, idx){
    var g = generoVoz(v);
    var icon = g === 'female' ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><circle cx="12" cy="9" r="6"/><line x1="12" y1="15" x2="12" y2="22"/><line x1="9" y1="19" x2="15" y2="19"/></svg> ' : (g === 'male' ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><circle cx="10" cy="14" r="5"/><line x1="14" y1="10" x2="20" y2="4"/><polyline points="14 4 20 4 20 10"/></svg> ' : '• ');
    // Usar el índice como value para poder mapear luego al objeto voz completo
    var isSel = (actualURI && v.voiceURI === actualURI) ||
                (!actualURI && actualName && v.name === actualName);
    var selAttr = isSel ? ' selected' : '';
    // Guardamos voiceURI como atributo data para recuperarlo después
    html += '<option value="'+_escapeAttr(v.name)+'" data-uri="'+_escapeAttr(v.voiceURI||'')+'" data-lang="'+_escapeAttr(v.lang||'')+'"'+selAttr+'>'+icon+v.name+' ('+v.lang+')</option>';
  });
  sel.innerHTML = html;

  // Resaltar botón de filtro activo
  ['btnVozAll','btnVozM','btnVozF'].forEach(function(id){
    var b = document.getElementById(id);
    if(b){ b.style.background = 'var(--bg-dark)'; b.style.borderColor = 'var(--border)'; b.style.color = 'var(--text)'; }
  });
  var btnMap = { all:'btnVozAll', male:'btnVozM', female:'btnVozF' };
  var btnActivo = document.getElementById(btnMap[_vozFiltroActual]);
  if(btnActivo){ btnActivo.style.background = 'rgba(76,175,80,.15)'; btnActivo.style.borderColor = 'var(--green)'; btnActivo.style.color = 'var(--green)'; }
}

function _escapeAttr(s){
  return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;');
}

function filtrarVocesPorGenero(genero){
  poblarSelectorVoces(genero);
}

function seleccionarVozDesdeConfig(){
  var sel = document.getElementById('cfgVozSelect');
  if(!sel || typeof vozSeleccionadaSet !== 'function') return;
  // Buscar el objeto voz completo usando name + voiceURI del option seleccionado
  var opt = sel.options[sel.selectedIndex];
  if(!opt) return;
  var voces = typeof listarVocesEs === 'function' ? listarVocesEs() : [];
  var match = voces.find(function(v){
    return v.name === opt.value && v.voiceURI === opt.getAttribute('data-uri');
  });
  if(!match){
    match = voces.find(function(v){ return v.name === opt.value; });
  }
  if(match){
    vozSeleccionadaSet(match); // pasa el objeto completo con voiceURI
    if(typeof probarVoz === 'function') probarVoz(match.name);
  } else {
    // Fallback al comportamiento anterior
    vozSeleccionadaSet(sel.value);
    if(typeof probarVoz === 'function') probarVoz(sel.value);
  }
}

function probarVozSeleccionada(){
  var sel = document.getElementById('cfgVozSelect');
  if(!sel || typeof probarVoz !== 'function') return;
  probarVoz(sel.value);
}

function presupuestosHabilitados(){
  return !!(configData.presupuestosHabilitados || localStorage.getItem('pos_presupuestos') === '1');
}

function comandasHabilitadas(){
  // Si el sistema de rubro está cargado, delegamos en él (que ya sincroniza con pos_comandas)
  if(typeof usaCocina === 'function') return usaCocina();
  return !!(configData.comandasHabilitadas || localStorage.getItem('pos_comandas') === '1');
}

function updBtnComandaCobro(){
  // Actualizar badge de ítems pendientes de enviar a cocina
  const pendientes = cart.filter(i => !i.enviado).length;
  // Badge en pantalla de cobro
  const badgeEl = document.getElementById('comandaBadge');
  if(badgeEl){
    badgeEl.textContent = pendientes;
    badgeEl.style.display = pendientes > 0 ? 'inline-flex' : 'none';
  }
  // Badge en botón <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M12 22c-4.97 0-9-4.03-9-9 0-6 5-13 9-13s9 7 9 13c0 4.97-4.03 9-9 9z"/></svg> de pantalla de venta
  const badge2 = document.getElementById('comandaBadge2');
  if(badge2){
    badge2.textContent = pendientes;
    badge2.style.display = pendientes > 0 ? 'inline-flex' : 'none';
  }
  const btn = document.getElementById('btnComandaCobro');
  if(btn) btn.style.display = comandasHabilitadas() ? 'flex' : 'none';
}

function renderConfigInfo(){
  const el = document.getElementById('configInfoPanel');
  if(!el) return;
  const terminal  = localStorage.getItem('pos_terminal') || 'Terminal 1';
  const sucursal  = localStorage.getItem('pos_sucursal') || '—';
  const deposito  = localStorage.getItem('pos_deposito') || '—';
  const negocio   = configData.negocio   || localStorage.getItem('an') || '—';
  const ruc       = configData.ruc       || localStorage.getItem('ar') || '—';
  const direccion = configData.direccion || localStorage.getItem('ad') || '—';
  const ciudad    = configData.ciudad    || localStorage.getItem('ciudad') || '';
  const telefono  = configData.telefono  || localStorage.getItem('at') || '—';
  const email     = localStorage.getItem('lic_email') || '—';
  const plan      = localStorage.getItem('lic_plan')  || '—';
  const vence     = localStorage.getItem('lic_vence') || '—';
  const tim = getTimbradoActivo();
  const pad3 = n => String(n||0).padStart(3,'0');
  const padN = n => String(n||0).padStart(7,'0');
  const timInfo = tim ? pad3(tim.sucursal)+'-'+pad3(tim.punto_exp)+' · Timb. '+tim.nro : null;
  el.innerHTML = `
    <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;overflow:hidden;margin-bottom:12px;">
      <div style="background:#222;padding:10px 14px;display:flex;align-items:center;gap:8px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
        <span style="font-size:12px;font-weight:800;color:var(--green);text-transform:uppercase;">Esta Terminal</span>
      </div>
      <div style="padding:12px 14px;display:flex;flex-direction:column;gap:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:12px;color:#777;">Nombre</span>
          <span style="font-size:15px;font-weight:800;color:#fff;">${terminal}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:12px;color:#777;">Sucursal</span>
          <span style="font-size:13px;font-weight:600;color:#ccc;">${sucursal}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:12px;color:#777;">Depósito</span>
          <span style="font-size:13px;color:#aaa;">${deposito}</span>
        </div>
        ${timInfo ? `
        <div style="border-top:1px solid #2a2a2a;padding-top:8px;display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:12px;color:#777;">Timbrado</span>
          <span style="font-size:12px;font-weight:700;color:var(--green);font-family:monospace;">${timInfo}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:12px;color:#777;">Próx. factura</span>
          <span style="font-size:13px;font-weight:700;color:#fff;font-family:monospace;">${pad3(tim.sucursal)}-${pad3(tim.punto_exp)}-${padN(tim.nro_actual||tim.desde||1)}</span>
        </div>` : `
        <div style="border-top:1px solid #2a2a2a;padding-top:8px;">
          <span style="font-size:12px;color:#ef5350;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>️ Sin timbrado asignado</span>
        </div>`}
      </div>
    </div>
    <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;overflow:hidden;margin-bottom:12px;">
      <div style="background:#222;padding:10px 14px;">
        <span style="font-size:12px;font-weight:800;color:#42a5f5;text-transform:uppercase;">Datos del Negocio</span>
      </div>
      <div style="padding:12px 14px;display:flex;flex-direction:column;gap:8px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <span style="font-size:12px;color:#777;flex-shrink:0;">Razón social</span>
          <span style="font-size:13px;font-weight:700;color:#fff;text-align:right;">${negocio}</span>
        </div>
        ${ruc !== '—' ? `<div style="display:flex;justify-content:space-between;"><span style="font-size:12px;color:#777;">RUC</span><span style="font-size:13px;font-weight:600;color:#ccc;font-family:monospace;">${ruc}</span></div>` : ''}
        ${direccion !== '—' ? `<div style="display:flex;justify-content:space-between;gap:8px;"><span style="font-size:12px;color:#777;flex-shrink:0;">Dirección</span><span style="font-size:12px;color:#aaa;text-align:right;">${direccion}${ciudad?', '+ciudad:''}</span></div>` : ''}
        ${telefono !== '—' ? `<div style="display:flex;justify-content:space-between;"><span style="font-size:12px;color:#777;">Teléfono</span><span style="font-size:13px;color:#aaa;">${telefono}</span></div>` : ''}
      </div>
    </div>
    <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;overflow:hidden;margin-bottom:12px;">
      <div style="background:#222;padding:10px 14px;">
        <span style="font-size:12px;font-weight:800;color:#ff9800;text-transform:uppercase;">Licencia</span>
      </div>
      <div style="padding:12px 14px;display:flex;flex-direction:column;gap:8px;">
        <div style="display:flex;justify-content:space-between;"><span style="font-size:12px;color:#777;">Email</span><span style="font-size:12px;color:#aaa;">${email}</span></div>
        <div style="display:flex;justify-content:space-between;"><span style="font-size:12px;color:#777;">Plan</span><span style="font-size:13px;font-weight:700;color:var(--green);">${plan}</span></div>
        <div style="display:flex;justify-content:space-between;"><span style="font-size:12px;color:#777;">Vence</span><span style="font-size:13px;color:#aaa;">${vence}</span></div>
      </div>
    </div>`;
  const emailEl = document.getElementById('configEmail');
  if(emailEl) emailEl.textContent = email;
}

function cargarConfigLocal(){
  const keys = {
    an:'negocio', ar:'ruc', ad:'direccion',
    ciudad:'ciudad', at:'telefono', pie_recibo:'pie_recibo',
    mostrar_ruc:'mostrar_ruc', moneda:'moneda'
  };
  Object.entries(keys).forEach(([lk, ck])=>{
    const v = localStorage.getItem(lk);
    if(v) configData[ck] = v;
  });
}

// ── CARRITO ──────────────────────────────────────────────────
function updUI(){
  const t=calcTotal(), c=cart.length;
  document.getElementById('sAmt').textContent=gs(t);
  document.getElementById('sBadge').textContent=c;
  document.getElementById('ttotal').textContent=gs(t);
  const tabAmt = document.getElementById('tabCobrarAmt');
  const tabTotal = document.getElementById('tabTotal');
  if(tabAmt) tabAmt.textContent=gs(t);
  if(tabTotal) tabTotal.textContent=gs(t);
  if(typeof renderTabletTicket==='function') renderTabletTicket();
  updTabTicketHeader();
  updBtnComandaCobro(); // actualizar badge de comanda pendiente
}
function toggleTicket(){
  setShowTkt(!showTkt);
  document.getElementById('tpanel').classList.toggle('open',showTkt);
  document.getElementById('prodView').style.display=showTkt?'none':'flex';
  if(showTkt)renderTkt();
}
function renderTkt(){
  const tl=document.getElementById('tlist');
  if(!tl) return;
  // Banner cuando estamos en modo LECTURA (venta cobrada) — al tope del cart
  const _enLectura = (typeof _modoLectura !== 'undefined' && _modoLectura && _viewingCobradaVenta);
  const _esAnul = _enLectura && _viewingCobradaVenta.anulada;
  const bannerLectura = _enLectura
    ? `<div style="background:${_esAnul?'rgba(239,83,80,.12)':'rgba(66,165,245,.12)'};border:1.5px solid ${_esAnul?'rgba(239,83,80,.35)':'rgba(66,165,245,.35)'};border-radius:6px;padding:8px 10px;margin-bottom:8px;display:flex;align-items:center;gap:8px;">
         <span style="font-size:10px;font-weight:800;padding:2px 7px;border-radius:4px;letter-spacing:.4px;background:${_esAnul?'rgba(239,83,80,.25)':'rgba(66,165,245,.28)'};color:${_esAnul?'#ef5350':'#42a5f5'};">${_esAnul?'ANULADA':'COBRADO'}</span>
         <span style="font-size:11px;color:var(--muted);">Solo lectura · apretá NUEVA VENTA para otra</span>
       </div>`
    : '';
  // Cabecera del cart con el nombre del cliente (si hay) — pequeno y al tono
  const _nomCli = (typeof clienteNombre !== 'undefined' && clienteNombre) ? clienteNombre : '';
  const headerCliente = _nomCli
    ? `<div style="display:flex;align-items:center;gap:6px;padding:6px 4px 8px;margin-bottom:4px;border-bottom:1px dashed var(--border);font-size:12px;color:var(--text);font-weight:700;">
         <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="opacity:.7"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
         <span style="opacity:.6;font-size:10px;text-transform:uppercase;letter-spacing:.5px;font-weight:700;">Cliente:</span>
         <span>${_nomCli}</span>
       </div>`
    : '';
  if(!cart.length){
    // Cart vacio — mostrar SIEMPRE banner de lectura y header del cliente si hay
    tl.innerHTML = bannerLectura + headerCliente +
      '<div class="tempty"><svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:.3"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/></svg><p>Ticket vacío</p></div>';
    return;
  }
  // Pie de venta cobrada: efectivo y vuelto
  const _pieVenta = (_enLectura && _viewingCobradaVenta && !_esAnul && (_viewingCobradaVenta.efectivo || _viewingCobradaVenta.vuelto))
    ? `<div style="margin-top:10px;padding:10px 12px;background:var(--surface2,#1e1e1e);border-radius:8px;font-size:12px;font-family:var(--font-mono,monospace);">` +
      (_viewingCobradaVenta.efectivo ? `<div style="display:flex;justify-content:space-between;color:var(--muted);margin-bottom:4px;"><span>Recibido</span><span style="color:var(--text);">${_viewingCobradaVenta.efectivo}</span></div>` : '') +
      (_viewingCobradaVenta.vuelto   ? `<div style="display:flex;justify-content:space-between;"><span style="color:#4caf50;font-weight:700;">Vuelto</span><span style="color:#4caf50;font-weight:800;">${_viewingCobradaVenta.vuelto}</span></div>` : '') +
      `</div>`
    : '';
  tl.innerHTML = bannerLectura + headerCliente + cart.map(i=>i.esDescuento
    ? `<div class="titem" style="border-left:2px solid #ef5350;"><div class="tiname" style="color:#ef9a9a;">${i.name}</div><div class="tictrl"><button class="qbtn" onclick="chgQty(${i.lineId},-1)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div><div class="tiprice" style="color:#ef5350;">-${gs(i.montoDesc)}</div></div>`
    : `<div class="titem" style="${i.enviado?'opacity:.6;':''}">`+
        `<div class="tiname">`+
          (i.enviado ? '<span style="font-size:9px;color:#4caf50;font-weight:700;letter-spacing:.3px;text-transform:uppercase;display:block;line-height:1.2;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><polyline points="20 6 9 17 4 12"/></svg> enviado</span>' : '')+
          i.name+
          (i.obs?'<div style="font-size:11px;color:#888;font-weight:400;text-transform:none;margin-top:2px;">'+i.obs+'</div>':'')+
        `</div>`+
        `<div class="tictrl">`+
          `<button class="qbtn" onclick="abrirObsRapida(${i.lineId})" title="${i.obs?'Editar observación':'Agregar observación'}" style="color:${i.obs?'var(--orange)':'var(--muted)'};">`+
            `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:auto;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`+
          `</button>`+
          `<button class="qbtn" onclick="chgQty(${i.lineId},-1)">−</button><span class="qnum">${i.esKilo ? (parseFloat(i.qty)||0).toFixed(3)+' kg' : i.qty}</span><button class="qbtn" onclick="chgQty(${i.lineId},1)">+</button>`+
        `</div>`+
        `<div class="tiprice">${gs(i.price*i.qty)}</div>`+
      `</div>`
  ).join('') + _pieVenta;
}


  const v = parseInt(document.getElementById('shiftDisp').textContent.replace(/[₲.,]/g,''))||0;

  // Verificar licencia antes de abrir turno (si hay internet)
function updBtnGuardar(){
  const n=pendientes.length, tieneProductos=calcTotal()>0;
  const badge=document.getElementById('pendingBadge'), txt=document.getElementById('btnGuardarTxt'), icon=document.getElementById('btnGuardarIcon');
  const tabBadge=document.getElementById('tabPendingBadge'), tabTxt=document.getElementById('tabBtnTxt');
  if(tieneProductos){
    txt.textContent='GUARDAR'; if(tabTxt)tabTxt.textContent='GUARDAR';
    icon.innerHTML='<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>';
    if(n>0){ badge.textContent=n>9?'9+':n; badge.classList.add('show'); if(tabBadge){tabBadge.textContent=badge.textContent;tabBadge.style.display='flex';} }
    else { badge.classList.remove('show'); if(tabBadge)tabBadge.style.display='none'; }
  } else if(n>0){
    badge.textContent=n>9?'9+':n; badge.classList.add('show');
    txt.textContent='PENDIENTES'; icon.innerHTML='<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>';
    if(tabBadge){tabBadge.textContent=badge.textContent;tabBadge.style.display='flex';} if(tabTxt)tabTxt.textContent='PENDIENTES';
  } else {
    badge.classList.remove('show'); txt.textContent='GUARDAR';
    icon.innerHTML='<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>';
    if(tabBadge)tabBadge.style.display='none'; if(tabTxt)tabTxt.textContent='GUARDAR';
  }
}

async function doOpenShift(){
  const v   = parseInt(document.getElementById('shiftDisp').textContent.replace(/[₲.,]/g,''))||0;
  const btn = document.querySelector('#scClosed .btn-abrir-outline') || document.querySelector('[onclick*="doOpenShift"]');

  if(navigator.onLine){
    if(btn){ btn.textContent='Verificando...'; btn.disabled=true; }
    const ok = await licVerificarAhora();
    if(btn){ btn.textContent='ABRIR EL TURNO'; btn.disabled=false; }
    if(!ok) return; // licMostrarBloqueo ya fue llamado
  }

  turnoData.fechaApertura  = await obtenerFechaServidor(); // hora del servidor, no del dispositivo
  turnoData.efectivoInicial = v;
  turnoData.ventas          = [];
  turnoData.egresos         = [];
  turnoData.ingresos        = [];
  turnoData.supaId          = null;
  turnoData.dbId            = null;
  // Guardar apertura en Supabase (background, no bloquea)
  supaInsertTurno('abierto', v);
  // Esperar a que IndexedDB asigne el dbId ANTES de guardar en localStorage
  // para que turnoData.dbId quede persistido correctamente
  if(db){
    try { await dbAbrirTurno(v); } catch(e){ console.warn('[Turno] Error al abrir turno en IndexedDB:', e.message); }
  }
  // Persistir en localStorage DESPUÉS de tener el dbId
  turnoGuardar();
  goTo('scSale'); renderCatPills(); filterP(); toast('Turno abierto ');
}

// ══════════════════════════════════════════════════════════════════════════════
// obtenerFechaServidor — retorna la hora del servidor Supabase (PostgreSQL).
//
// POR QUÉ:
//   new Date() usa el reloj del dispositivo. En Android, si el usuario tiene
//   la fecha/hora manual o el zona horaria mal configurada, los timestamps
//   de ventas y turnos quedan incorrectos.
//   Supabase/PostgreSQL tiene el reloj del servidor (UTC) siempre correcto.
//
// USO:
//   const ahora = await obtenerFechaServidor();
//   // ahora es un Date() con la hora real del servidor
//
// FALLBACK:
//   Si no hay internet o Supabase falla, retorna new Date() del dispositivo.
//   La app nunca se bloquea por esto.
//
// CACHE:
//   Guarda el offset entre servidor y dispositivo en memoria (_serverOffset).
//   Las llamadas subsiguientes usan el offset sin consultar Supabase de nuevo.
//   El offset se recalcula cada vez que hay internet disponible.
// ══════════════════════════════════════════════════════════════════════════════
var _serverOffset = 0; // diferencia en ms entre servidor y dispositivo
var _serverOffsetOk = false; // si el offset fue calculado exitosamente

async function obtenerFechaServidor(){
  // Intentar calcular el offset si no lo tenemos aún
  if(!_serverOffsetOk && navigator.onLine && !USAR_DEMO){
    try{
      const t0 = Date.now();
      // Consulta mínima a Supabase — solo para obtener la hora del servidor
      // Usamos /rest/v1/ con una tabla que siempre existe y traemos 0 rows
      const res = await fetch(
        SUPA_URL + '/rest/v1/pos_config?limit=0&select=id',
        { headers: supaHeaders({ 'Accept': 'application/json' }) }
      );
      const t1 = Date.now();
      // El header Date de la respuesta HTTP es la hora del servidor
      const serverDateStr = res.headers.get('date');
      if(serverDateStr){
        const serverMs = new Date(serverDateStr).getTime();
        // Compensar la latencia de red (mitad del round-trip)
        const latencia = Math.round((t1 - t0) / 2);
        _serverOffset = (serverMs + latencia) - t1;
        _serverOffsetOk = true;
        _log('[FechaServidor] Offset calculado:',
          (_serverOffset >= 0 ? '+' : '') + _serverOffset + 'ms respecto al dispositivo',
          '| Latencia:', latencia + 'ms'
        );
      }
    } catch(e){
      console.warn('[FechaServidor] No se pudo calcular offset:', e.message);
    }
  }
  // Retornar fecha ajustada con el offset
  return new Date(Date.now() + _serverOffset);
}

// Sincronizar el offset al arrancar (background, sin bloquear)
function sincronizarFechaServidor(){
  _serverOffsetOk = false; // forzar recálculo
  obtenerFechaServidor().catch(function(e){ console.warn('[FechaServidor] Error en sincronización background:', e.message); });
}

function supaInsertTurno(estado, efectivoInicial){
  const email = localStorage.getItem('lic_email');
  if(!email) return;
  const data = {
    fecha_apertura:   new Date().toISOString(),
    efectivo_inicial: efectivoInicial || 0,
    estado:           estado,
    terminal:         localStorage.getItem('pos_terminal') || 'Terminal 1',
    licencia_email:   email,
  };
  supaPost('pos_turno', data).then(rows=>{
    if(rows&&rows[0]) turnoData.supaId = rows[0].id;
    _log('[Turno] Guardado en Supabase id:', rows&&rows[0]&&rows[0].id);
  }).catch(e=>console.warn('[Turno] Error Supabase:', e.message));
}
function diag(msg){ /* diag disabled */ }

function renderCatPills(){
  const bar = document.getElementById('catPillBar');
  if(!bar) return;
  const todos = 'Todos los artículos';
  const cats = [todos, ...CATEGORIAS.map(c=>c.nombre)];
  const hasDescs = (typeof DESCUENTOS!=='undefined' && DESCUENTOS.filter(d=>d.activo!==false).length) ||
    PRODS.filter(p=>p.cat==='Descuentos'&&p.activo!==false).length;
  if(hasDescs) cats.push('<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> Descuentos');
  bar.innerHTML = cats.map(function(c){
    const sel = curCat===c ? ' sel' : '';
    return '<button class="cat-pill'+sel+'" onclick="pickCat(this)">'+c+'</button>';
  }).join('');
}
function renderCategoriasVenta(){
  var _catOv=document.getElementById('catOv'); if(_catOv && _catOv.classList.contains('open')) openCat();
}
function closeCat(e){ if(e.target===document.getElementById('catOv'))document.getElementById('catOv').classList.remove('open'); }
function pickCat(el){
  const cat = typeof el === 'string' ? el : el.textContent.trim();
  curCat = cat;
  const lbl = document.getElementById('catLbl');
  if(lbl) lbl.textContent = cat;
  document.getElementById('catOv').classList.remove('open');
  renderCatPills();
  filterP();
}
function openCat(){
  const sheet = document.getElementById('catSheetContent');
  if(!sheet){ toast('ERROR: catSheetContent no existe'); return; }
  const todos = 'Todos los artículos';
  function catItem(nombre, color){
    const sel = curCat===nombre;
    const colorStyle = color ? 'color:'+color+';border-left-color:'+color+';' : '';
    const ic = color ? 'background:'+color+';' : '';
    return '<div class="cat-item'+(sel?' sel':'')+'" onclick="pickCat(this)" style="'+colorStyle+'">'
      +'<div class="cat-item-ic" style="'+ic+'"></div>'
      +nombre
      +(sel?'<svg style="margin-left:auto" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>':'')
      +'</div>';
  }
  // Si no hay categorías pero hay productos, derivarlas automáticamente
  if(typeof CATEGORIAS !== 'undefined' && CATEGORIAS.length === 0 && typeof PRODS !== 'undefined' && PRODS.length > 1){
    if(typeof derivarCategoriasDeProductos === 'function') derivarCategoriasDeProductos();
  }
  let html = catItem(todos);
  var _numCats = (typeof CATEGORIAS !== 'undefined' && Array.isArray(CATEGORIAS)) ? CATEGORIAS.length : -1;
  var _email   = localStorage.getItem('lic_email') || '(no guardado)';
  var _online  = navigator.onLine;
  _log('[openCat] CATEGORIAS.length =', _numCats, 'PRODS.length =', (typeof PRODS !== 'undefined' ? PRODS.length : -1), 'email =', _email, 'online =', _online);

  if(_numCats > 0){
    CATEGORIAS.forEach(c => { html += catItem(c.nombre, c.color||null); });
  } else {
    // Estado vacío con diagnóstico y botón para recargar
    html += '<div style="padding:24px 20px;text-align:center;">'
      + '<div style="color:#999;font-size:13px;margin-bottom:8px;">No hay categorías cargadas.</div>'
      + '<div style="color:#666;font-size:11px;margin-bottom:16px;line-height:1.6;">'
      + 'Email: '+_email+'<br>'
      + 'Conexión: '+(_online?'online':'offline')
      + '</div>'
      + '<button onclick="recargarCategoriasAhora()" style="background:var(--green);border:none;border-radius:6px;color:#fff;padding:12px 24px;font-family:\'Barlow\',sans-serif;font-size:13px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;cursor:pointer;">Recargar desde Supabase</button>'
      + '</div>';
  }
  sheet.innerHTML = html;
  var ov = document.getElementById('catOv');
  if(!ov){ toast('ERROR: catOv no existe'); return; }
  ov.classList.add('open');
}

// Recarga manual de categorías — para diagnóstico y recovery
async function recargarCategoriasAhora(){
  var email = localStorage.getItem('lic_email');
  var sheet = document.getElementById('catSheetContent');
  if(sheet){
    sheet.innerHTML = '<div style="padding:20px;color:#fff;font-family:monospace;font-size:11px;line-height:1.6;">'
      + '<div style="color:#4caf50;font-weight:bold;margin-bottom:8px;">DIAGNÓSTICO SUPABASE</div>'
      + 'Email: '+email+'<br>'
      + 'URL: '+SUPA_URL+'<br>'
      + 'Probando...<br>'
      + '</div>';
  }
  try {
    // 1. Query DIRECTA sin helpers — ver qué responde Supabase crudo
    var url = SUPA_URL + '/rest/v1/pos_categorias?licencia_email=eq.'
      + encodeURIComponent(email) + '&select=*';
    var r = await fetch(url, { headers: SUPA_HEADERS });
    var txt = await r.text();
    var data = null;
    try { data = JSON.parse(txt); } catch(e) {}

    // 2. Actualizar panel de diagnóstico con el resultado
    if(sheet){
      var resultHtml = '<div style="padding:20px;color:#fff;font-family:monospace;font-size:11px;line-height:1.6;">'
        + '<div style="color:#4caf50;font-weight:bold;margin-bottom:8px;">DIAGNÓSTICO SUPABASE</div>'
        + 'Email: '+email+'<br>'
        + 'HTTP: '+r.status+' '+r.statusText+'<br>'
        + 'Respuesta: '+txt.substring(0,300).replace(/</g,'&lt;')+'<br>'
        + 'Array length: '+(Array.isArray(data) ? data.length : 'NO ES ARRAY')+'<br><br>';

      if(Array.isArray(data) && data.length){
        // Aplicar manualmente
        CATEGORIAS.length = 0;
        data.forEach(function(c){
          CATEGORIAS.push({ id:c.id, nombre:c.nombre, color:c.color||'#546e7a' });
        });
        resultHtml += '<div style="color:#4caf50;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><polyline points="20 6 9 17 4 12"/></svg> '+CATEGORIAS.length+' categorías cargadas manualmente</div>'
          + '<div style="margin-top:8px;">'+CATEGORIAS.map(function(c){return c.nombre;}).join(', ')+'</div>'
          + '<button onclick="document.getElementById(\'catOv\').classList.remove(\'open\');filterP();" style="margin-top:16px;background:var(--green);border:none;border-radius:6px;color:#fff;padding:12px 24px;font-weight:800;cursor:pointer;">CERRAR Y APLICAR</button>';
      } else {
        resultHtml += '<div style="color:#ef5350;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Supabase devolvió ' + (Array.isArray(data) ? '0' : 'algo raro') + '</div>'
          + '<div style="margin-top:8px;color:#999;">Posibles causas:<br>'
          + '• Email no coincide con el de Supabase<br>'
          + '• RLS policy bloquea SELECT en pos_categorias<br>'
          + '• Tabla no tiene columna licencia_email<br>'
          + '• No hay categorías para este email</div>';
      }
      resultHtml += '</div>';
      sheet.innerHTML = resultHtml;
    }
  } catch(e){
    if(sheet){
      sheet.innerHTML = '<div style="padding:20px;color:#ef5350;font-family:monospace;font-size:11px;">ERROR: '+e.message+'</div>';
    }
    console.error('[recargarCategorias] Error:', e);
  }
}

function _getImgSrcSync(p){
  if(!p.imagen) return null;
  return p.imagen; // URL de Supabase Storage o base64
}

function _tileProd(p){
  const imgSrc = _getImgSrcSync(p);
  if(imgSrc){
    return '<div class="ptile ptile-img" style="background:'+getProductColor(p)+';" onclick="addCart('+p.id+',this)">'+
      '<img src="'+imgSrc+'" class="ptile-img-bg" onerror="this.style.display=\'none\'" loading="lazy">'+
      '<div class="ptile-img-overlay"></div>'+
      '<span class="pname ptile-img-name">'+p.name+'</span>'+
    '</div>';
  }
  if(p.itemLibre){
    return '<div class="ptile" style="background:#37474f;border:2px dashed #78909c;box-sizing:border-box;" onclick="addCart('+p.id+',this)"><span class="pname">'+p.name+'</span></div>';
  }
  return '<div class="ptile" style="background:'+getProductColor(p)+'" onclick="addCart('+p.id+',this)"><span class="pname">'+p.name+'</span></div>';
}

function renderP(list){
  const g=document.getElementById('pgrid');
  if(!g) return;
  if(!list.length){
    g.innerHTML='<div style="grid-column:1/-1;padding:40px;text-align:center;color:#999;font-size:14px;">Sin resultados</div>';
    return;
  }
  g.innerHTML = list.map(p => _tileProd(p)).join('');
}
var _filterPTimer = null;
function filterP(){
  // Debounce — evita renders simultáneos cuando supaLoad y renderCatPills se llaman juntos
  clearTimeout(_filterPTimer);
  _filterPTimer = setTimeout(_filterPInternal, 16);
}
function _filterPInternal(){
  const q = document.getElementById('sinput').value.toLowerCase();

  // Categoría especial: Descuentos
  if(curCat==='Descuentos' || curCat==='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> Descuentos'){
    renderDescuentosTiles();
    return;
  }

  // Si la categoría seleccionada ya no existe, resetear a Todos
  if(curCat !== 'Todos los artículos'){
    const catExiste = CATEGORIAS.some(c=>c.nombre===curCat);
    if(!catExiste){
      curCat = 'Todos los artículos';
      const lbl = document.getElementById('catLbl');
      if(lbl) lbl.textContent = 'Todos los artículos';
    }
  }

  // Productos normales — excluir inactivos, ítem libre e INSUMOS (no se venden)
  // NO filtrar por cat=Descuentos ya que eso rompe productos mal categorizados
  let l = (curCat==='Todos los artículos' ? PRODS : PRODS.filter(p=>p.cat===curCat))
           .filter(p=>!p.itemLibre && !p.esInsumo && p.activo!==false && p.activo!==0);
  if(q) l = l.filter(p=>p.name.toLowerCase().includes(q) || (p.codigo && p.codigo.toLowerCase().includes(q)));

  // Favoritos al tope, ítem libre siempre al final
  if(!q){
    const favs  = l.filter(p=> p.esFavorito && !p.itemLibre);
    const resto = l.filter(p=>!p.esFavorito && !p.itemLibre);
    const libre = PRODS.find(p=>p.itemLibre);
    l = libre ? [...favs, ...resto, libre] : [...favs, ...resto];
  }
  renderP(l);
}


function renderDescuentosTiles(){
  const g = document.getElementById('pgrid');
  const descIds2 = new Set(DESCUENTOS.map(d=>String(d.id)));
  const prodsDesc2 = PRODS.filter(p=>
    p.cat==='Descuentos' && p.activo!==false && !descIds2.has(String(p.id))
  );
  const descs = [
    ...DESCUENTOS.filter(d=>d.activo!==false),
    ...prodsDesc2.map(p=>({id:p.id,name:p.name,tipo:p.descTipo||'%',valor:p.descValor||null}))
  ];
  if(!descs.length){
    g.innerHTML = '<div style="grid-column:span 3;padding:40px;text-align:center;color:#555;font-size:14px;">Sin descuentos — creá uno en Artículos → Descuentos</div>';
    return;
  }
  g.innerHTML = descs.map(d => {
    const valStr = d.valor!=null
      ? (d.tipo==='%' ? d.valor+'%' : gs(d.valor))
      : 'valor al vender';
    return '<div class="ptile" style="background:#b71c1c;" onclick="addDescuento('+d.id+')">'+
      '<span class="pname" style="font-size:11px;">'+d.name+'<br>'+
      '<span style="font-size:13px;font-weight:800;">'+valStr+'</span></span>'+
    '</div>';
  }).join('');
}
function toggleSearch(){
  const sb=document.getElementById('sbar');
  // En retail el buscador siempre queda abierto
  if(typeof esRetail === 'function' && esRetail()){
    sb.classList.add('open');
    document.getElementById('sinput').focus();
    return;
  }
  sb.classList.toggle('open');
  if(sb.classList.contains('open'))document.getElementById('sinput').focus();
  else{document.getElementById('sinput').value='';filterP();}
}


// -- Retail: captura de scanner a nivel documento --
// Los lectores de código de barras funcionan como teclados HID: envían chars
// muy rápido (~5-50ms entre chars) y terminan con Enter. Cuando ningún input
// tiene el foco, los keystrokes se pierden. Este handler los intercepta,
// acumula el código y en Enter lo procesa igual que sinputKeydown.
// Solo actúa cuando el tipo de negocio es 'retail'.

var _scanBuf = '', _scanTimer = null, _scannerInited = false;

function _initRetailScanner(){
  if(_scannerInited) return;
  _scannerInited = true;
  document.addEventListener('keydown', function(e){
    if(typeof esRetail !== 'function' || !esRetail()) return;
    var active = document.activeElement;
    var tag = active ? active.tagName : '';
    if(active && active.id === 'sinput') return; // sinputKeydown lo maneja
    if(tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if(e.ctrlKey || e.altKey || e.metaKey) return;

    if(e.key === 'Enter'){
      if(_scanBuf.trim()){
        var code = _scanBuf.trim();
        _scanBuf = '';
        clearTimeout(_scanTimer);
        _procesarCodigoScanner(code);
      }
      e.preventDefault();
      return;
    }
    if(e.key.length === 1){
      _scanBuf += e.key;
      clearTimeout(_scanTimer);
      // >300ms sin nuevo char = tipeo humano (no scanner) → descartar
      _scanTimer = setTimeout(function(){ _scanBuf = ''; }, 300);
      e.preventDefault();
    }
  });
}

// Busca un producto por código exacto en codigo O en el array codigos[]
function _findProdByCodigo(q, candidatos){
  return candidatos.find(function(p){
    if(p.codigo && p.codigo.toLowerCase() === q) return true;
    if(p.codigos && p.codigos.some(function(c){ return c.toLowerCase() === q; })) return true;
    return false;
  });
}

function _procesarCodigoScanner(raw){
  var q = raw.toLowerCase();
  var candidatos = (typeof PRODS !== 'undefined' ? PRODS : []).filter(function(p){
    return !p.itemLibre && !p.esInsumo && p.activo !== false && p.activo !== 0;
  });
  // 1. Match exacto por código (incluye codigos[])
  var exacto = _findProdByCodigo(q, candidatos);
  if(exacto){ addCart(exacto.id); _mostrarTicketMobile(); return; }
  // 2. Único match por nombre o código parcial
  var filtrados = candidatos.filter(function(p){
    var enCodigos = p.codigos && p.codigos.some(function(c){ return c.toLowerCase().includes(q); });
    return p.name.toLowerCase().includes(q) || (p.codigo && p.codigo.toLowerCase().includes(q)) || enCodigos;
  });
  if(filtrados.length === 1){ addCart(filtrados[0].id); _mostrarTicketMobile(); return; }
  // 3. Sin coincidencia o ambiguo: abrir barra de búsqueda con el código
  var sbar = document.getElementById('sbar');
  var sinput = document.getElementById('sinput');
  if(sbar && sinput){
    sbar.classList.add('open');
    sinput.value = raw;
    if(typeof filterP === 'function') filterP();
    // Quitar teclado: el scanner no lo necesita; el usuario lo abre tocando el input
    sinput.blur();
  }
  if(filtrados.length === 0){
    if(sinput){ sinput.value = ''; if(typeof filterP === 'function') filterP(); }
    _buscarCodigoEnAPI(raw);
  }
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', _initRetailScanner);
} else {
  _initRetailScanner();
}

// -- Scan-to-cart: Enter en #sinput --
function sinputKeydown(e){
  if(e.key !== 'Enter') return;
  e.preventDefault();
  var raw = document.getElementById('sinput').value.trim();
  if(!raw) return;
  var q = raw.toLowerCase();

  // Candidatos: excluir itemLibre, insumos, inactivos (igual que _filterPInternal)
  var candidatos = PRODS.filter(function(p){
    return !p.itemLibre && !p.esInsumo && p.activo !== false && p.activo !== 0;
  });

  // 1. Buscar match exacto por código (incluye codigos[])
  var exacto = _findProdByCodigo(q, candidatos);
  if(exacto){
    addCart(exacto.id);
    document.getElementById('sinput').value = '';
    filterP();
    _mostrarTicketMobile();
    document.getElementById('sinput').blur();
    return;
  }

  // 2. Si la lista filtrada por nombre/código tiene exactamente 1 resultado, agregar ese
  var filtrados = candidatos.filter(function(p){
    var enCodigos = p.codigos && p.codigos.some(function(c){ return c.toLowerCase().includes(q); });
    return p.name.toLowerCase().includes(q) || (p.codigo && p.codigo.toLowerCase().includes(q)) || enCodigos;
  });
  if(filtrados.length === 1){
    addCart(filtrados[0].id);
    document.getElementById('sinput').value = '';
    filterP();
    _mostrarTicketMobile();
    document.getElementById('sinput').blur();
    return;
  }

  // 3. Sin coincidencia única: consultar API o mostrar sugerencias
  if(filtrados.length === 0){
    document.getElementById('sinput').value = '';
    filterP();
    _buscarCodigoEnAPI(raw);
  } else {
    // Múltiples sugerencias: quitar teclado para que el usuario vea la lista
    document.getElementById('sinput').blur();
  }
}

// En retail mobile: después de escanear, mostrar ticket directo en lugar de la grilla
function _mostrarTicketMobile(){
  if(window.innerWidth >= 768) return;
  if(typeof esRetail === 'function' && !esRetail()) return;
  if(typeof showTkt !== 'undefined' && showTkt) return;
  if(typeof setShowTkt === 'function') setShowTkt(true);
  var tp = document.getElementById('tpanel');
  var pv = document.getElementById('prodView');
  if(tp) tp.classList.add('open');
  if(pv) pv.style.display = 'none';
  if(typeof renderTkt === 'function') renderTkt();
}

// -- Pedidos: ver js/pedidos.js --

function goDetalle(){
  if(calcTotal() === 0){ toast('El ticket está vacío'); return; }
  renderDetalle();
  goTo('scDetalle');
}
function renderDetalle(){
  const items = cart;
  const total = calcTotal();
  const count = items.length;
  document.getElementById('detTitle').textContent = currentTicketNro !== null ? 'Ticket #' + String(currentTicketNro).padStart(4,'0') : 'Ticket actual';
  document.getElementById('detSubtitle').textContent = count + ' artículo' + (count!==1?'s':'') + ' · ' + gs(total);
  document.getElementById('detItems').textContent = count + ' artículo' + (count!==1?'s':'');
  document.getElementById('detTotal').textContent = gs(total);
  const list = document.getElementById('detList');
  list.innerHTML = '';
  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'det-item';
    div.id = 'detItem_' + item.lineId;
    const delIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>';
    if(item.esDescuento){
      div.style.borderLeft = '3px solid #ef5350';
      div.innerHTML = '<div class="det-item-main"><div class="det-item-color" style="background:#e53935;font-size:9px;font-weight:800;">%</div><div class="det-item-name" style="color:#ef9a9a;">'+item.name+'</div><div class="det-item-subtotal" style="color:#ef5350;">-'+gs(item.montoDesc)+'</div></div><div class="det-item-controls"><button class="det-qbtn del" onclick="detChgQty('+item.lineId+',-1)">'+delIcon+'</button></div>';
      list.appendChild(div); return;
    }
    div.innerHTML =
      '<div class="det-item-main"><div class="det-item-color" style="background:'+item.color+'"></div><div class="det-item-name">'+item.name+'</div><div class="det-item-subtotal">'+gs(item.price*item.qty)+'</div></div>' +
      '<div class="det-item-controls"><div class="det-qty-row"><button class="det-qbtn del" onclick="detChgQty('+item.lineId+',-1)">'+(item.qty===1?delIcon:'−')+'</button><span class="det-qnum">'+item.qty+'</span><button class="det-qbtn" onclick="detChgQty('+item.lineId+',1)">+</button></div>' +
      '<span class="det-unit-price">'+gs(item.price)+' c/u</span>' +
      '<button class="det-obs-toggle" onclick="toggleDetObs('+item.lineId+')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'+(item.obs?'Obs: '+item.obs.substring(0,20):'Observación')+'</button>' +
      '<button class="det-obs-toggle" style="color:'+(item.desc>0?'var(--orange)':'var(--muted)')+'" onclick="toggleDetDesc('+item.lineId+')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>'+(item.desc>0?'Desc: '+item.desc+'%':'Descuento')+'</button></div>' +
      '<div class="det-obs-box'+(item.obs?' open':'')+'\" id="detObs_'+item.lineId+'"><input class="det-obs-input" type="text" placeholder="Ej: Sin cebolla, bien cocido..." maxlength="60" value="'+(item.obs||'')+'" oninput="saveDetObs('+item.lineId+', this.value)"></div>' +
      '<div class="det-obs-box'+(item.desc>0?' open':'')+'\" id="detDesc_'+item.lineId+'" style="display:'+(item.desc>0?'block':'none')+';"><div style="display:flex;align-items:center;gap:8px;padding:6px 0;"><span style="font-size:12px;color:var(--muted);flex-shrink:0;">Descuento %</span><input class="det-obs-input" type="number" min="0" max="100" placeholder="0" value="'+(item.desc||'')+'" style="width:70px;text-align:center;" oninput="saveDetDesc('+item.lineId+', this.value)"><span style="font-size:12px;color:var(--orange);flex-shrink:0;">= '+gs(calcItemTotal(item))+'</span></div></div>';
    list.appendChild(div);
  });
}
function detChgQty(lineId, delta){
  const idx = cart.findIndex(l=>l.lineId===lineId); if(idx<0) return;
  if(cart[idx].esKilo){
    if(delta > 0){ addCartConPeso(cart[idx].id); return; }
    cart.splice(idx,1);
    updUI(); updBtnGuardar();
    if(calcTotal()===0){ goTo('scSale'); return; }
    renderDetalle(); return;
  }
  cart[idx].qty += delta;
  if(cart[idx].qty <= 0) cart.splice(idx,1);
  updUI(); updBtnGuardar();
  if(calcTotal() === 0){ goTo('scSale'); return; }
  renderDetalle();
}
function toggleDetObs(lineId){ const box=document.getElementById('detObs_'+lineId); if(!box)return; box.classList.toggle('open'); if(box.classList.contains('open'))box.querySelector('input').focus(); }
function saveDetObs(lineId, val){ const item=cart.find(l=>l.lineId===lineId); if(item)item.obs=val; const btn=document.querySelector('#detItem_'+lineId+' .det-obs-toggle'); if(btn)btn.lastChild.textContent=val?' Obs: '+val.substring(0,20):' Observación'; }

// ── OBS RÁPIDA: modal mínimo para escribir/editar la obs de un item del cart
// sin tener que abrir la pantalla scDetalle. Lo dispara el botón lápiz que
// aparece al lado de los +/- en cada item del cart (tablet + mobile).
function abrirObsRapida(lineId){
  const item = cart.find(l => l.lineId === lineId);
  if(!item){ if(typeof toast==='function') toast('Producto no encontrado'); return; }

  // Crear overlay (lo borramos al cerrar — no contamina el DOM)
  let ov = document.getElementById('obsRapidaOv');
  if(ov) ov.remove();
  ov = document.createElement('div');
  ov.id = 'obsRapidaOv';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';

  ov.innerHTML =
    '<div style="background:var(--bg-card,#1f1f1f);color:var(--text,#fff);border:1px solid var(--border,#333);border-radius:10px;width:100%;max-width:420px;padding:18px 18px 14px;box-shadow:0 12px 40px rgba(0,0,0,.5);">'+
      '<div style="font-size:11px;color:var(--muted,#999);text-transform:uppercase;letter-spacing:.5px;font-weight:700;margin-bottom:4px;">Observación</div>'+
      '<div style="font-size:15px;font-weight:800;margin-bottom:14px;line-height:1.25;">'+esc(item.name)+'</div>'+
      '<input id="obsRapidaInput" type="text" maxlength="60" placeholder="Ej: sin cebolla, bien cocido…" '+
        'value="'+esc(item.obs||'')+'" '+
        'style="width:100%;box-sizing:border-box;padding:11px 12px;font-size:15px;border-radius:6px;border:1.5px solid var(--border2,#555);background:var(--bg,#111);color:var(--text,#fff);outline:none;font-family:inherit;">'+
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;">'+
        '<button id="obsRapidaCancel" style="padding:9px 18px;font-size:13px;font-weight:700;border:1.5px solid var(--border2,#555);background:transparent;color:var(--text,#fff);border-radius:6px;cursor:pointer;font-family:inherit;">CANCELAR</button>'+
        '<button id="obsRapidaOk" style="padding:9px 22px;font-size:13px;font-weight:800;border:none;background:var(--green,#4caf50);color:#fff;border-radius:6px;cursor:pointer;font-family:inherit;letter-spacing:.3px;">GUARDAR</button>'+
      '</div>'+
    '</div>';

  document.body.appendChild(ov);
  const input  = document.getElementById('obsRapidaInput');
  const close  = () => { ov.remove(); document.removeEventListener('keydown', onKey); };
  const guardar = () => {
    item.obs = input.value.trim();
    close();
    if(typeof renderTkt === 'function') renderTkt();
    if(typeof renderTabletTicket === 'function') renderTabletTicket();
    if(typeof updUI === 'function') updUI();
    if(item.obs && typeof toast === 'function') toast('Obs guardada: ' + item.obs.substring(0,30));
  };
  const onKey = e => {
    if(e.key === 'Escape') close();
    if(e.key === 'Enter')  guardar();
  };
  document.getElementById('obsRapidaOk').onclick     = guardar;
  document.getElementById('obsRapidaCancel').onclick = close;
  ov.onclick = e => { if(e.target === ov) close(); };
  document.addEventListener('keydown', onKey);
  setTimeout(() => { input.focus(); input.select(); }, 50);
}
function toggleDetDesc(lineId){ const el=document.getElementById('detDesc_'+lineId); if(!el)return; const open=el.style.display==='block'; el.style.display=open?'none':'block'; if(!open)setTimeout(function(){var _i=el.querySelector('input');if(_i)_i.focus();},50); }
function saveDetDesc(lineId, val){
  const item=cart.find(i=>i.lineId===lineId); if(!item)return;
  item.desc=Math.min(100,Math.max(0,parseFloat(val)||0)); updUI();
  const sub=document.querySelector('#detItem_'+lineId+' .det-item-subtotal'); if(sub)sub.textContent=gs(calcItemTotal(item));
  const btns=document.querySelectorAll('#detItem_'+lineId+' .det-obs-toggle'); if(btns[1])btns[1].style.color=item.desc>0?'var(--orange)':'var(--muted)';
  const span=document.querySelector('#detDesc_'+lineId+' span:last-child'); if(span)span.textContent='= '+gs(calcItemTotal(item));
}
// -- imprimirComandaPreCobro: ver js/pedidos.js --

function generarRecibo(data){
  ultimoReciboData = data;

  const esFactura = data.factura && data.factura.timbrado;
  const size      = getPaperSize('ticket');

  // Generar HTML y dejar el preview listo para cuando el usuario decida
  const htmlImpresion = esFactura
    ? generarHTMLFactura(data, size)
    : generarHTMLTicket(data, size);
  mostrarPreviewRecibo(htmlImpresion, size);

  // NO imprimir automáticamente aquí — el usuario elige en scRecibo
  // (tocando IMPRIMIR TICKET, TICKET+COMANDA, SOLO COMANDA u Omitir)

  // Rellenar el resumen de la pantalla de recibo
  renderReciboResumen(data);

  // Mostrar pantalla de opciones
  goTo('scRecibo');
}

// ── RENDER DEL RESUMEN DE RECIBO ─────────────────────────
// Rellena la pantalla scRecibo con: total, método, vuelto, ítems, hora
// y muestra/oculta los botones de comanda según la config del negocio.
function renderReciboResumen(data){
  if(!data) return;
  // Total grande
  var elTotal = document.getElementById('reciboTotal');
  if(elTotal) elTotal.textContent = gs(data.total || 0);

  // Título con nro ticket
  var nro = data.nroTicket != null ? String(data.nroTicket).padStart(4,'0') : '';
  var elTitulo = document.getElementById('reciboTitulo');
  if(elTitulo) elTitulo.textContent = nro ? 'Ticket #' + nro : 'Comprobante';

  // Hora del cobro
  var elHora = document.getElementById('reciboHora');
  if(elHora){
    var f = data.fecha instanceof Date ? data.fecha : new Date();
    var hh = String(f.getHours()).padStart(2,'0');
    var mm = String(f.getMinutes()).padStart(2,'0');
    elHora.textContent = hh + ':' + mm;
  }

  // Chip de método de pago
  var elMetodo = document.getElementById('reciboMetodoChip');
  if(elMetodo){
    var met = data.metodo || '—';
    // Si es pago dividido, mostrar cantidad de métodos
    if(data.divPagos && data.divPagos.length > 1){
      met = 'MIXTO (' + data.divPagos.length + ')';
    }
    elMetodo.textContent = met;
  }

  // Chip de vuelto (solo si hay)
  var elVuelto = document.getElementById('reciboVueltoChip');
  if(elVuelto){
    var vuelto = 0;
    if(typeof data.vuelto === 'string'){
      // Puede venir como string "Gs. 5.000" — extraer el número
      var m = data.vuelto.replace(/[^0-9]/g,'');
      vuelto = parseInt(m) || 0;
    } else {
      vuelto = parseInt(data.vuelto) || 0;
    }
    if(vuelto > 0){
      elVuelto.textContent = 'Vuelto ' + gs(vuelto);
      elVuelto.style.display = '';
    } else {
      elVuelto.style.display = 'none';
    }
  }

  // Chip de cantidad de ítems
  var elItems = document.getElementById('reciboItemsChip');
  if(elItems){
    var items = data.items || [];
    var totalQty = items.reduce(function(s,i){ return s + (i.qty || 0); }, 0);
    elItems.textContent = totalQty + ' ítem' + (totalQty !== 1 ? 's' : '');
  }

  // Mostrar/ocultar botones de comanda según config.
  // Si NO hay comandas → marcar .recibo-acciones con clase "no-resto"
  // para que CSS haga al SOLO TICKET el botón primario grande.
  var hayComandas = typeof comandasHabilitadas === 'function' && comandasHabilitadas();
  var btnSolo = document.getElementById('btnComandaRecibo');
  var btnCombo = document.getElementById('btnTicketComanda');
  var acciones = document.querySelector('#scRecibo .recibo-acciones');
  if(btnSolo)  btnSolo.style.display  = hayComandas ? '' : 'none';
  if(btnCombo) btnCombo.style.display = hayComandas ? '' : 'none';
  if(acciones) acciones.classList.toggle('no-resto', !hayComandas);

  // Iniciar countdown de auto-imprimir
  iniciarCountdownAutoImprimir(3);
}

// ── COUNTDOWN AUTO-IMPRIMIR ─────────────────────────────
// Después de 3s sin interacción IMPRIME el ticket automáticamente
// (comportamiento por defecto = caso más común).
// Cualquier tap/click en la pantalla cancela el countdown para que
// el usuario pueda elegir otra opción (combo, solo cocina, omitir).
var _countdownTimer = null;
var _countdownRemaining = 0;
var _countdownAborted = false;

function iniciarCountdownAutoImprimir(segundos){
  cancelarCountdown();
  _countdownRemaining = segundos || 3;
  _countdownAborted = false;
  var cont = document.getElementById('reciboCountdown');
  if(cont) cont.textContent = 'Imprimiendo en ' + _countdownRemaining + 's...';
  _countdownTimer = setInterval(function(){
    if(_countdownAborted){ cancelarCountdown(); return; }
    _countdownRemaining--;
    if(cont) cont.textContent = 'Imprimiendo en ' + _countdownRemaining + 's...';
    if(_countdownRemaining <= 0){
      cancelarCountdown();
      // Comportamiento por defecto: imprimir ticket + volver a ventas
      if(typeof imprimirRecibo === 'function') imprimirRecibo();
      setTimeout(function(){
        if(typeof finalizarRecibo === 'function') finalizarRecibo();
      }, 600);
    }
  }, 1000);

  // Cancelar countdown al tocar cualquier cosa en scRecibo
  setTimeout(function(){
    var sc = document.getElementById('scRecibo');
    if(sc && !sc._countdownListener){
      sc._countdownListener = function(){
        _countdownAborted = true;
        var c = document.getElementById('reciboCountdown');
        if(c) c.textContent = '';
      };
      sc.addEventListener('touchstart', sc._countdownListener, { passive: true });
      sc.addEventListener('click',      sc._countdownListener);
    }
  }, 50);
}

// Alias retrocompatible
function iniciarCountdownNuevaVenta(segundos){ iniciarCountdownAutoImprimir(segundos); }

function cancelarCountdown(){
  if(_countdownTimer){ clearInterval(_countdownTimer); _countdownTimer = null; }
  _countdownRemaining = 0;
  var cont = document.getElementById('reciboCountdown');
  if(cont) cont.textContent = '';
}

function mostrarPreviewRecibo(html, size){
  const papel = document.getElementById('reciboPapel');
  if(!papel) return;

  // Usar iframe para renderizar el HTML térmico fielmente
  const pxW = size==='58' ? 220 : 300;
  papel.style.width  = pxW+'px';
  papel.style.padding = '0';
  papel.style.background = 'transparent';
  papel.style.boxShadow = 'none';

  // Remover iframe anterior si existe
  let iframe = document.getElementById('previewIframe');
  if(iframe) iframe.remove();

  iframe = document.createElement('iframe');
  iframe.id = 'previewIframe';
  iframe.style.cssText = [
    'width:'+pxW+'px',
    'border:none',
    'background:#fff',
    'border-radius:4px',
    'box-shadow:0 2px 20px rgba(0,0,0,.6)',
    'display:block',
    'min-height:200px'
  ].join(';');
  iframe.scrolling = 'no';
  papel.appendChild(iframe);

  // Escribir el HTML térmico en el iframe
  iframe.contentDocument.open();
  iframe.contentDocument.write(html.replace(/<div id="printInfo"[\s\S]*?<\/div>/, ''));
  iframe.contentDocument.close();

  // Auto-altura
  setTimeout(()=>{
    try {
      const h = iframe.contentDocument.body.scrollHeight;
      iframe.style.height = (h+10)+'px';
    } catch(e){ /* safe to ignore: optional iframe auto-height */ }
  }, 200);
}

// Convertir HTML térmico a texto plano para preview
function htmlToPreview(html, size){
  const cols = size==='58' ? 32 : 42;
  // Remover tags y convertir <p> a líneas
  return html
    .replace(/<hr[^>]*>/gi, '-'.repeat(cols))
    .replace(/<br\s*\/?>/gi, '')
    .replace(/<p[^>]*class="row"[^>]*>([\s\S]*?)<\/p>/gi, (m, inner) => {
      // Extraer los dos spans de .row
      const spans = inner.match(/<span[^>]*>([\s\S]*?)<\/span>/gi) || [];
      const texts = spans.map(s => s.replace(/<[^>]+>/g,'').trim());
      if(texts.length >= 2){
        const left  = texts[0];
        const right = texts.slice(1).join(' ');
        const pad   = Math.max(1, cols - left.length - right.length);
        return left + ' '.repeat(pad) + right;
      }
      return texts.join(' ');
    })
    .replace(/<[^>]+>/g, '')  // remover tags restantes
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ')
    .split('\n')
    .map(l => l.trimEnd())
    .join('\n');
}

// -- imprimirComandaActual: ver js/pedidos.js --


// -- Impresion: ver js/impresion.js --

// -- Turno: ver js/turno.js --


// ── DRAWER ───────────────────────────────────────────────────────────────────
function openDrawer(){
  document.getElementById('drawer').classList.add('open');
  document.getElementById('drawerOverlay').classList.add('open');
}
function closeDrawer(){
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('drawerOverlay').classList.remove('open');
}

function drawerGo(section){
  document.querySelectorAll('.drawer-item').forEach(el => el.classList.remove('active'));
  if(event && event.currentTarget) event.currentTarget.classList.add('active');
  closeDrawer();
  if(section === 'ventas'){
    goTo('scSale');
  } else if(section === 'recibos'){
    goToVentas();
  } else if(section === 'articulos'){
    goTo('scArticulos');
    renderArtList();
  } else if(section === 'turno'){
    goTo('scTurno');
    renderTurno();
  } else if(section === 'mesas'){
    abrirPantallaMesas();
  } else {
    if(section === 'configuracion'){
      goToConfig();
    } else {
      toast(section.charAt(0).toUpperCase()+section.slice(1)+' — próximamente');
    }
  }
}

// -- Productos/Categorias/Descuentos: ver js/productos.js --


// Variable global para guardar el HTML del ticket de cierre
var cierreTicketHTML = '';
var cierreTextoPlano = '';

function buildCierreTicket(size){
  size = size || getPaperSize('ticket') || '58';
  var cols = size==='80' ? 48 : 32;
  var saldoEsperado = calcSaldoEsperado();
  // Si MM activo, usar cierreTotal (GS + BRL equiv + ARS equiv); si no, suma del desglose por método
  var _mmActCierre = localStorage.getItem('mm_activo') === '1';
  var totalContado = _mmActCierre ? cierreTotal : Object.values(cierreMetodos).reduce(function(s,d){return s+d.contado;},0);
  // Acumular moneda extranjera del turno
  var _shiftBRL = 0, _shiftBRLGs = 0, _shiftARS = 0, _shiftARSGs = 0;
  turnoData.ventas.forEach(function(v){
    if(v.mmPagos){ _shiftBRL += v.mmPagos.pagoBRL||0; _shiftBRLGs += v.mmPagos.pagoBRLGs||0; _shiftARS += v.mmPagos.pagoARS||0; _shiftARSGs += v.mmPagos.pagoARSGs||0; }
  });
  var diff = totalContado > 0 ? totalContado - saldoEsperado : null;
  var ahora = new Date();
  var pad2 = function(n){ return String(n).padStart(2,'0'); };
  var fmtDT = function(d){ return d ? pad2(d.getDate())+'/'+pad2(d.getMonth()+1)+'/'+d.getFullYear()+' '+pad2(d.getHours())+':'+pad2(d.getMinutes())+':'+pad2(d.getSeconds()) : '-'; };
  var gn2 = function(n){ return Math.round(n||0).toLocaleString('es-PY'); };

  var negocio  = configData.negocio   || localStorage.getItem('an') || 'MI NEGOCIO';
  var ruc      = configData.ruc       || localStorage.getItem('ar') || '';
  var dir      = configData.direccion || localStorage.getItem('ad') || '';
  var terminal = configData.terminal  || localStorage.getItem('pos_terminal') || 'CAJA1';
  var usuario  = 'admin';
  var compNro  = turnoData.comprobante || '001-001-001';

  var totalVentas  = turnoData.ventas.reduce(function(s,v){return s+v.total;},0);
  var totalEgresos = turnoData.egresos.filter(function(e){return !e.anulada;}).reduce(function(s,e){return s+e.monto;},0);
  var totalIngresos = (turnoData.ingresos||[]).reduce(function(s,i){return s+i.monto;},0);
  var cantVentas   = turnoData.ventas.length;
  var saldoCaja    = turnoData.efectivoInicial + totalVentas + totalIngresos - totalEgresos;
  var rendicion    = 0; // monto rendido/retirado
  var diferencia   = rendicion - saldoCaja;

  // Formas de pago — desglosar divPagos si existe
  var metodos = {};
  var acumMetodoCierre = function(m, monto){
    m = (m||'EFECTIVO').toUpperCase().trim();
    if(!metodos[m]) metodos[m]={total:0,ops:0};
    metodos[m].total += monto;
    metodos[m].ops++;
  };
  turnoData.ventas.forEach(function(v){
    if(v.divPagos && v.divPagos.length >= 2){
      v.divPagos.forEach(function(p){ acumMetodoCierre(p.metodo, p.monto||0); });
    } else if(v.metodo && v.metodo.includes(' + ')){
      var partes = v.metodo.split(' + ');
      var montoParte = Math.round(v.total / partes.length);
      partes.forEach(function(p, i){
        var monto = i===partes.length-1 ? v.total-montoParte*(partes.length-1) : montoParte;
        acumMetodoCierre(p, monto);
      });
    } else {
      acumMetodoCierre(v.metodo, v.total);
    }
  });

  // Helper: línea separadora
  var SEP_CHAR = '-'.repeat(cols);
  var sep = function(){ return '<p style="margin:0;letter-spacing:0;">'+SEP_CHAR+'</p>'; };

  // Helper: fila izq/der alineada
  var row = function(l, r, bold){
    l=String(l); r=String(r);
    var sp=Math.max(1,cols-l.length-r.length);
    var line=l+' '.repeat(sp)+r;
    return bold
      ? '<p style="margin:0;font-weight:bold;">'+line+'</p>'
      : '<p style="margin:0;">'+line+'</p>';
  };
  var rowLabel = function(label){
    return '<p style="margin:4px 0 2px;font-weight:bold;letter-spacing:1px;">'+label+'</p>';
  };
  var center = function(text, bold){
    var s=String(text); var sp=Math.max(0,Math.floor((cols-s.length)/2));
    var line=' '.repeat(sp)+s;
    return bold
      ? '<p style="margin:0;font-weight:bold;text-align:center;">'+line+'</p>'
      : '<p style="margin:0;text-align:center;">'+line+'</p>';
  };

  var css = 'body{font-family:Arial,"Helvetica Neue",sans-serif;font-size:'+(size==='80'?'11':'9')+'pt;'
    +'width:'+(size==='80'?'80':'58')+'mm;margin:0;padding:2mm 0;background:#fff;color:#000;}'
    +'p{margin:0;padding:0;line-height:1.3;white-space:pre;}';

  var lines = '';
  // Cabecera
  lines += center(negocio, true);
  if(ruc)  lines += center('RUC: '+ruc);
  if(dir)  lines += center(dir);
  lines += sep();
  lines += center('CIERRE DE CAJA', true);
  lines += sep();
  lines += row('Comprobante:', compNro);
  lines += row('Apertura:', fmtDT(turnoData.fechaApertura));
  lines += row('Usuario:', usuario);
  lines += row('Local:', terminal);
  lines += row('Cierre:', fmtDT(ahora));
  lines += sep();
  // RESUMEN
  lines += rowLabel('RESUMEN');
  lines += sep();
  lines += row('Importe Inicial', gn2(turnoData.efectivoInicial));
  lines += row('Total Entrada', gn2(totalVentas));
  lines += row('', gn2(totalVentas));
  lines += row('Total Salida', gn2(totalEgresos));
  lines += row('Saldo En Caja', gn2(saldoCaja), true);
  lines += row('Rendicion', gn2(rendicion));
  lines += row('Diferencia', (diferencia>0?'+':'')+gn2(diferencia));
  lines += sep();
  // FORMAS DE PAGO
  lines += rowLabel('FORMAS DE PAGO');
  lines += sep();
  Object.entries(metodos).sort(function(a,b){return b[1].total-a[1].total;}).forEach(function(e){
    var label = e[0];
    var ops   = e[1].ops;
    var monto = gn2(e[1].total);
    // label + ops (alineado) + monto
    var mid   = String(ops);
    var sp    = Math.max(1, cols - label.length - mid.length - monto.length - 2);
    lines += '<p style="margin:0;white-space:pre;">'+label+' '.repeat(sp)+mid+'  '+monto+'</p>';
  });
  lines += row('TOTAL:', gn2(totalVentas), true);
  lines += sep();
  // MOVIMIENTOS DE CAJA
  lines += rowLabel('MOVIMIENTOS DE CAJA');
  lines += sep();
  var totalEntMovs = (turnoData.ingresos||[]).reduce(function(s,i){return s+i.monto;},0);
  lines += row('Total Entrada:', gn2(totalEntMovs));
  lines += row('Total Salida :', gn2(totalEgresos));
  if(turnoData.egresos && turnoData.egresos.length){
    turnoData.egresos.filter(function(e){return !e.anulada;}).forEach(function(e){
      lines += row('  '+e.desc.substring(0,cols-14), gn2(e.monto));
    });
  }
  lines += sep();
  // Moneda extranjera del turno
  if(_shiftBRL > 0 || _shiftARS > 0){
    lines += rowLabel('MONEDA EXTRANJERA EN TURNO');
    lines += sep();
    if(_shiftBRL > 0){ lines += row('Reales recibidos:', gn2(_shiftBRL)+' R$'); lines += row('  Equiv. Gs:', gn2(_shiftBRLGs)); }
    if(_shiftARS > 0){ lines += row('Pesos Arg. recibidos:', gn2(_shiftARS)+' $'); lines += row('  Equiv. Gs:', gn2(_shiftARSGs)); }
    lines += sep();
  }
  // Conteo si existe
  if(totalContado > 0){
    lines += rowLabel('CONTEO DEL CAJERO');
    lines += sep();
    // Arqueo multi-moneda
    if(_mmActCierre && (cierreArqueoGS > 0 || cierreArqueoBRL > 0 || cierreArqueoARS > 0)){
      var _cotBRLc = parseFloat(localStorage.getItem('mm_cotBRL')) || 0;
      var _cotARSc = parseFloat(localStorage.getItem('mm_cotARS')) || 0;
      if(cierreArqueoGS  > 0) lines += row('Guaranies:', gn2(cierreArqueoGS));
      if(cierreArqueoBRL > 0){ lines += row('Reales:', cierreArqueoBRL+' R$'); if(_cotBRLc>0) lines += row('  Equiv. Gs:', gn2(Math.round(cierreArqueoBRL*_cotBRLc))); }
      if(cierreArqueoARS > 0){ lines += row('Pesos Arg.:', cierreArqueoARS+' $'); if(_cotARSc>0) lines += row('  Equiv. Gs:', gn2(Math.round(cierreArqueoARS*_cotARSc))); }
      lines += row('Total equiv. Gs:', gn2(totalContado), true);
    } else {
      Object.entries(cierreMetodos).forEach(function(e){
        var m=e[0], d=e[1];
        if(d.contado>0){
          var dif=d.contado-d.esperado;
          var difStr=dif===0?' OK':dif>0?' +'+gn2(dif):' -'+gn2(Math.abs(dif));
          lines += row(m.substring(0,cols-gn2(d.contado).length-1), gn2(d.contado));
          lines += '<p style="margin:0;padding-left:8px;font-size:9pt;">Esp: '+gn2(d.esperado)+'  '+difStr+'</p>';
        }
      });
    }
    if(diff!==null){
      var dLabel = diff===0 ? 'CUADRE EXACTO' : diff>0 ? 'SOBRANTE: +'+gn2(diff) : 'FALTANTE: -'+gn2(Math.abs(diff));
      lines += '<p style="margin:4px 0;font-weight:bold;text-align:center;">'+dLabel+'</p>';
    }
    lines += sep();
  }
  // Firma
  lines += '<p style="margin:0;white-space:pre;">OBS:</p>';
  lines += sep();
  lines += '<p style="margin:20px 0 0;">&nbsp;</p>';
  lines += '<p style="margin:0;border-top:1px solid #000;">&nbsp;</p>';
  lines += center('Firma - Aclaracion - CI');
  lines += '<p style="margin:8px 0 0;">&nbsp;</p>';
  lines += center(usuario+' '+fmtDT(ahora));
  lines += sep();
  lines += '<p style="margin:0 0 16px;">&nbsp;</p>';

  cierreTicketHTML = '<html><head><style>'+css+'</style></head><body>'+lines+'</body></html>';

  // Texto plano para WhatsApp
  var wa = '*CIERRE DE CAJA - '+negocio+'*\n';
  wa += 'Apertura: '+fmtDT(turnoData.fechaApertura)+'\nCierre: '+fmtDT(ahora)+'\n';
  wa += '\n*RESUMEN*\n';
  wa += 'Ef. Inicial: '+gn2(turnoData.efectivoInicial)+'\n';
  wa += 'Total Entrada: '+gn2(totalVentas)+'\n';
  wa += 'Total Salida: '+gn2(totalEgresos)+'\n';
  wa += 'Saldo en Caja: '+gn2(saldoCaja)+'\n';
  wa += 'Diferencia: '+gn2(diferencia)+'\n';
  wa += '\n*FORMAS DE PAGO*\n';
  Object.entries(metodos).forEach(function(e){ wa += e[0]+' ('+e[1].ops+'): '+gn2(e[1].total)+'\n'; });
  wa += 'TOTAL: '+gn2(totalVentas)+'\n';
  if(totalContado>0){ wa += '\n*CONTEO*\nTotal contado: '+gn2(totalContado)+'\nSaldo esperado: '+gn2(saldoEsperado)+'\n'; }
  if(diff!==null){
    if(diff===0) wa += '\nCUADRE EXACTO';
    else if(diff>0) wa += '\nSOBRANTE: +'+gn2(diff);
    else wa += '\nFALTANTE: -'+gn2(Math.abs(diff));
  }
  cierreTextoPlano = wa;
}

async function confirmarCierre(){
  var size = getPaperSize('ticket') || '58';
  buildCierreTicket(size);

  // ── Calcular totales para persistir el cierre ────────────
  var _mmActConfirmar = localStorage.getItem('mm_activo') === '1';
  var totalContado = _mmActConfirmar ? cierreTotal : Object.values(cierreMetodos).reduce(function(s,d){return s+d.contado;},0);
  var saldoEsperado = calcSaldoEsperado();
  var diferencia = totalContado > 0 ? totalContado - saldoEsperado : 0;
  // Acumular moneda extranjera del turno para pasar al cierre impreso
  var _mmShiftBRL = 0, _mmShiftBRLGs = 0, _mmShiftARS = 0, _mmShiftARSGs = 0;
  turnoData.ventas.forEach(function(v){
    if(v.mmPagos){ _mmShiftBRL+=v.mmPagos.pagoBRL||0; _mmShiftBRLGs+=v.mmPagos.pagoBRLGs||0; _mmShiftARS+=v.mmPagos.pagoARS||0; _mmShiftARSGs+=v.mmPagos.pagoARSGs||0; }
  });
  var _totalVentas   = turnoData.ventas.reduce(function(s,v){return s+v.total;},0);
  var _totalEgresos  = turnoData.egresos.filter(function(e){return !e.anulada;}).reduce(function(s,e){return s+e.monto;},0);
  var _cantVentas    = turnoData.ventas.length;
  var _metodosTotales = {};
  (function(){
    var acum=function(met,mn){met=(met||'EFECTIVO').toUpperCase().trim();_metodosTotales[met]=(_metodosTotales[met]||0)+mn;};
    turnoData.ventas.forEach(function(v){
      if(v.divPagos&&v.divPagos.length>=2){v.divPagos.forEach(function(p){acum(p.metodo,p.monto||0);});}
      else if(v.metodo&&v.metodo.includes(' + ')){var pts=v.metodo.split(' + '),mp=Math.round(v.total/pts.length);pts.forEach(function(p,i){acum(p,i===pts.length-1?v.total-mp*(pts.length-1):mp);});}
      else{acum(v.metodo,v.total);}
    });
  })();

  // Voz: alertar si hay diferencia (solo si el cajero declaro algo)
  if(totalContado > 0 && typeof hablarDiferenciaCierre === 'function'){
    hablarDiferenciaCierre(diferencia);
  }
  var turnoDbIdCierre = turnoData.dbId;
  var turnoSupaIdCierre = turnoData.supaId;

  // ── Persistir cierre en IndexedDB + encolar sync ─────────
  if(db && turnoDbIdCierre){
    try { await dbCerrarTurno(turnoDbIdCierre, totalContado, diferencia); }
    catch(e){ console.warn('[Cierre] Error IndexedDB:', e.message); }
  }

  // ── Persistir cierre en Supabase directo si hay internet ─
  const supaId = turnoSupaIdCierre || turnoDbIdCierre;
  if(navigator.onLine && supaId){
    try {
      await supaPatch('pos_turno', 'id=eq.'+supaId, {
          estado:          'cerrado',
          fecha_cierre:    (await obtenerFechaServidor()).toISOString(),
          total_contado:   totalContado,
          diferencia:      diferencia,
          total_vendido:   _totalVentas,
          total_egresos:   _totalEgresos,
          cantidad_ventas: _cantVentas,
          resumen_pagos:   JSON.stringify(_metodosTotales),
        }, true);
      _log('[Cierre] Turno cerrado en Supabase OK');
    } catch(e){ console.warn('[Cierre] Error Supabase:', e.message); }

    // ── Cancelar pedidos satelite abiertos al cerrar turno ─
    // Los pedidos que quedaron sin cobrar se marcan como cancelados para que
    // no aparezcan en el proximo turno ni en los satelites
    try {
      var _emailCierre = localStorage.getItem('lic_email');
      var _sucCierre = localStorage.getItem('pos_sucursal') || 'Principal';
      if(_emailCierre){
        await supaPatch('pos_pedidos',
          'licencia_email=eq.' + encodeURIComponent(_emailCierre)
          + '&estado=in.(abierto,en_cobro)',
          { estado: 'cancelado', updated_at: new Date().toISOString() },
          true
        );
        _log('[Cierre] Pedidos satelite abiertos cancelados');
      }
    } catch(e){ console.warn('[Cierre] Error cancelando pedidos satelite:', e.message); }
  }

  // Preview en iframe para fidelidad
  var papel = document.getElementById('previewPapel');
  var pxW = size==='80' ? 320 : 220;
  papel.style.width = pxW+'px';
  papel.style.padding = '0';
  papel.style.background = 'transparent';
  papel.style.boxShadow = 'none';
  var iframeCierre = document.getElementById('cierreIframe');
  if(iframeCierre) iframeCierre.remove();
  iframeCierre = document.createElement('iframe');
  iframeCierre.id = 'cierreIframe';
  iframeCierre.style.cssText = 'width:'+pxW+'px;border:none;background:#fff;display:block;';
  papel.innerHTML = '';
  papel.appendChild(iframeCierre);
  var doc = iframeCierre.contentWindow.document;
  doc.open(); doc.write(cierreTicketHTML); doc.close();
  setTimeout(function(){
    try{ iframeCierre.style.height = (iframeCierre.contentWindow.document.body.scrollHeight+20)+'px'; }catch(e){ /* safe to ignore: optional iframe auto-height */ }
  }, 200);
  // Guardar datos para buildCierreBTPS ANTES de limpiar turnoData
  cierreData = {
    fechaApertura: turnoData.fechaApertura,
    totalVentas:   turnoData.ventas.reduce(function(s,v){return s+v.total;},0),
    totalEgresos:  turnoData.egresos.filter(function(e){return !e.anulada;}).reduce(function(s,e){return s+e.monto;},0),
    totalIngresos: (turnoData.ingresos||[]).reduce(function(s,i){return s+i.monto;},0),
    efInicial:     turnoData.efectivoInicial,
    cantVentas:    turnoData.ventas.length,
    egresos:       turnoData.egresos.filter(function(e){return !e.anulada;}),
    metodos:       (function(){
      var m={};
      var acum=function(met,monto){met=(met||'EFECTIVO').toUpperCase().trim();if(!m[met])m[met]={total:0,ops:0};m[met].total+=monto;m[met].ops++;};
      turnoData.ventas.forEach(function(v){
        if(v.divPagos&&v.divPagos.length>=2){ v.divPagos.forEach(function(p){acum(p.metodo,p.monto||0);}); }
        else if(v.metodo&&v.metodo.includes(' + ')){ var pts=v.metodo.split(' + '),mp=Math.round(v.total/pts.length);pts.forEach(function(p,i){acum(p,i===pts.length-1?v.total-mp*(pts.length-1):mp);}); }
        else{ acum(v.metodo,v.total); }
      });
      return m;
    })(),
    totalContado:  totalContado,
    saldoEsperado: saldoEsperado,
    diff:          totalContado > 0 ? totalContado - saldoEsperado : null,
    cierreMetodos: JSON.parse(JSON.stringify(cierreMetodos)),
    arqueoGS:      cierreArqueoGS,
    arqueoBRL:     cierreArqueoBRL,
    arqueoARS:     cierreArqueoARS,
    cotBRL:        parseFloat(localStorage.getItem('mm_cotBRL')) || 0,
    cotARS:        parseFloat(localStorage.getItem('mm_cotARS')) || 0,
    mmShiftBRL:    _mmShiftBRL,
    mmShiftBRLGs:  _mmShiftBRLGs,
    mmShiftARS:    _mmShiftARS,
    mmShiftARSGs:  _mmShiftARSGs,
  };
  turnoBorrar();
  turnoData = { fechaApertura: null, efectivoInicial: 0, ventas: [], egresos: [], ingresos: [] };
  cierreMetodos = {};
  goTo('scPreviewCierre');
}

function buildCierreBTPS(){
  // Construir texto BTPS del cierre con los datos guardados en cierreTextoPlano
  // pero con formato de impresora térmica
  if(!cierreTextoPlano){ return null; }
  var size = getPaperSize('ticket') || '58';
  var cols = size==='80' ? 48 : 32;
  var sep  = '='.repeat(cols);
  var sep2 = '-'.repeat(cols);
  var n    = '\n';
  var gn2  = function(v){ return Math.round(v||0).toLocaleString('es-PY'); };
  var pad  = function(l,r){ var sp=Math.max(1,cols-String(l).length-String(r).length); return String(l)+' '.repeat(sp)+String(r); };

  var negocio  = configData.negocio  || 'MI NEGOCIO';
  var ruc      = configData.ruc      || '';
  var dir      = configData.direccion|| '';
  var terminal = configData.terminal || 'CAJA1';
  var pad2     = function(n){ return String(n).padStart(2,'0'); };
  var fmtDT    = function(d){ return d ? pad2(new Date(d).getDate())+'/'+pad2(new Date(d).getMonth()+1)+'/'+new Date(d).getFullYear()+' '+pad2(new Date(d).getHours())+':'+pad2(new Date(d).getMinutes()) : '-'; };
  var ahora    = new Date();

  var totalVentas   = cierreData ? cierreData.totalVentas   : 0;
  var totalEgresos  = cierreData ? cierreData.totalEgresos  : 0;
  var totalIngresos = cierreData ? cierreData.totalIngresos : 0;
  var efInicial     = cierreData ? cierreData.efInicial     : 0;
  var saldoCaja     = efInicial + totalVentas + totalIngresos - totalEgresos;
  var totalContado  = Object.values(cierreMetodos).reduce(function(s,d){return s+d.contado;},0);
  var saldoEsp      = calcSaldoEsperado ? calcSaldoEsperado() : saldoCaja;
  var diff          = totalContado > 0 ? totalContado - saldoEsp : null;

  var txt = '';
  txt += '[CENTER][BOLD]' + negocio.toUpperCase() + '[/BOLD][/CENTER]' + n;
  if(ruc) txt += '[CENTER]RUC: ' + ruc + '[/CENTER]' + n;
  if(dir) txt += '[CENTER]' + dir + '[/CENTER]' + n;
  txt += sep + n;
  txt += '[CENTER][BOLD]CIERRE DE CAJA[/BOLD][/CENTER]' + n;
  txt += sep + n;
  txt += pad('Terminal:', terminal) + n;
  txt += pad('Apertura:', fmtDT(cierreData && cierreData.fechaApertura)) + n;
  txt += pad('Cierre:', fmtDT(ahora)) + n;
  txt += sep2 + n;
  txt += '[BOLD]RESUMEN[/BOLD]' + n;
  txt += sep2 + n;
  txt += pad('Ef. Inicial:', gn2(efInicial)) + n;
  txt += pad('Total ventas:', gn2(totalVentas)) + n;
  if(totalEgresos > 0) txt += pad('Total egresos:', gn2(totalEgresos)) + n;
  if(totalIngresos > 0) txt += pad('Total ingresos:', gn2(totalIngresos)) + n;
  txt += '[BOLD]' + pad('SALDO EN CAJA:', gn2(saldoCaja)) + '[/BOLD]' + n;
  txt += sep2 + n;
  txt += '[BOLD]FORMAS DE PAGO[/BOLD]' + n;
  txt += sep2 + n;

  // Usar los metodos ya calculados (ya desglosan divPagos)
  if(cierreData && cierreData.metodos){
    Object.entries(cierreData.metodos).sort(function(a,b){return b[1].total-a[1].total;}).forEach(function(e){
      txt += pad(e[0] + ' ('+e[1].ops+'op):', gn2(e[1].total)) + n;
    });
  }
  txt += '[BOLD]' + pad('TOTAL:', gn2(totalVentas)) + '[/BOLD]' + n;
  txt += sep2 + n;

  if(cierreData && cierreData.egresos && cierreData.egresos.length){
    txt += '[BOLD]EGRESOS[/BOLD]' + n;
    txt += sep2 + n;
    cierreData.egresos.forEach(function(e){
      txt += pad('  '+String(e.desc||'').substring(0, cols-14), gn2(e.monto)) + n;
    });
    txt += sep2 + n;
  }

  if(totalContado > 0){
    txt += '[BOLD]CONTEO[/BOLD]' + n;
    txt += sep2 + n;
    Object.entries(cierreMetodos).forEach(function(e){
      var m=e[0], d=e[1];
      if(d.contado>0){
        var dif=d.contado-d.esperado;
        var difStr=dif===0?' OK':dif>0?' +'+gn2(dif):' -'+gn2(Math.abs(dif));
        txt += pad(m+':', gn2(d.contado)) + n;
        txt += '  Esperado: '+gn2(d.esperado)+'  '+difStr + n;
      }
    });
    if(diff !== null){
      var dLabel = diff===0 ? 'CUADRE EXACTO' : diff>0 ? 'SOBRANTE: +'+gn2(diff) : 'FALTANTE: -'+gn2(Math.abs(diff));
      txt += '[CENTER][BOLD]' + dLabel + '[/BOLD][/CENTER]' + n;
    }
    txt += sep2 + n;
  }

  txt += pad('Cant. ventas:', String(cierreData ? cierreData.cantVentas : 0)) + n;
  txt += sep2 + n;

  // Rendicion del cajero y diferencia
  txt += '[BOLD]RENDICION DEL CAJERO[/BOLD]' + n;
  txt += sep2 + n;
  txt += pad('Saldo esperado:', gn2(saldoCaja)) + n;
  if(totalContado > 0){
    txt += pad('Total contado:', gn2(totalContado)) + n;
    var diferencia = totalContado - saldoCaja;
    if(diferencia === 0){
      txt += '[CENTER][BOLD]*** CUADRE EXACTO ***[/BOLD][/CENTER]' + n;
    } else if(diferencia > 0){
      txt += '[BOLD]' + pad('SOBRANTE:', '+' + gn2(diferencia)) + '[/BOLD]' + n;
    } else {
      txt += '[BOLD]' + pad('FALTANTE:', '-' + gn2(Math.abs(diferencia))) + '[/BOLD]' + n;
    }
  } else {
    txt += pad('Total contado:', '(sin conteo)') + n;
    txt += pad('Diferencia:', '(sin conteo)') + n;
  }
  txt += sep2 + n;

  // Firma del cajero
  txt += 'OBS: ' + n;
  txt += sep2 + n;
  txt += n;
  txt += n;
  txt += '[CENTER]______________________________[/CENTER]' + n;
  txt += '[CENTER]Firma / Aclaracion / CI[/CENTER]' + n;
  txt += sep + n;
  txt += '[CENTER]*** FIN CIERRE ***[/CENTER]' + n;
  txt += '[FEED:4]' + n;
  txt += '[CUT]';
  return txt;
}

// Variable para guardar datos del cierre para BTPS
var cierreData = null;

function imprimirCierre(){
  // NO regenerar — turnoData ya fue borrado en confirmarCierre
  if(!cierreTicketHTML && !cierreData){ toast('Sin datos de cierre'); return; }

  // Usar imprimirCierreTurno() de impresion.js que maneja todos los canales
  // (BTPS, Bluetooth, Android APK, navegador/USB)
  imprimirCierreTurno(cierreData, cierreTicketHTML);
}

function compartirWhatsApp(){
  window.open('https://wa.me/?text='+encodeURIComponent(cierreTextoPlano), '_blank');
}

function cerrarPreviewCierre(){
  goTo('scClosed');
  toast('Turno cerrado');
}


// ── configData, printers → js/state.js ──

// Restaurar configuración de impresoras al iniciar
function isAndroidAPK() {
  return typeof window.AndroidPrint !== 'undefined';
}

function restaurarConfigImpresoras(){
  ['ticket','comanda'].forEach(tipo => {
    const savedType        = localStorage.getItem('printerType_' + tipo);
    const savedName        = localStorage.getItem('printerName_' + tipo);
    const savedSize        = localStorage.getItem('printerSize_' + tipo);
    const savedAndroidName = localStorage.getItem('printerAndroidName_' + tipo);

    if(savedSize) printers[tipo].size = savedSize;
    if(savedType && savedName){
      printers[tipo].type = savedType;
      printers[tipo].name = savedName;

      if(savedType === 'bt'){
        if(isAndroidAPK()){
          // En el APK: restaurar el nombre y re-registrar en el puente nativo
          printers[tipo].androidName    = savedAndroidName || savedName;
          printers[tipo].needsReconnect = false; // el APK maneja la conexión
          if(savedAndroidName || savedName){
            window.AndroidPrint.setBluetoothDevice(savedAndroidName || savedName);
          }
        } else {
          // En web: marcar que necesita reconectar (Web Bluetooth no persiste)
          printers[tipo].needsReconnect = true;
        }
      }
      updPrinterUI(tipo);
    }
  });
}

function goToConfig(){
  document.getElementById('cfgNegocio').value   = configData.negocio;
  document.getElementById('cfgDireccion').value = configData.direccion;
  document.getElementById('cfgTelefono').value  = configData.telefono;
  document.getElementById('cfgRuc').value       = configData.ruc;
  document.getElementById('configEmail').textContent = configData.email;
  goTo('scConfig');
}

function saveGeneralConfig(){
  var _cfgNeg=document.getElementById('cfgNegocio'),   _cfgDir=document.getElementById('cfgDireccion');
  var _cfgTel=document.getElementById('cfgTelefono'),   _cfgRuc=document.getElementById('cfgRuc');
  var _cfgPre=document.getElementById('cfgPresupuestos'),_cfgCom=document.getElementById('cfgComandas');
  configData.negocio   = (_cfgNeg  ? _cfgNeg.value   : null) || configData.negocio;
  configData.direccion = (_cfgDir  ? _cfgDir.value   : null) || configData.direccion;
  configData.telefono  = (_cfgTel  ? _cfgTel.value   : null) || configData.telefono;
  configData.ruc       = (_cfgRuc  ? _cfgRuc.value   : null) || configData.ruc;
  configData.presupuestosHabilitados = !!(_cfgPre ? _cfgPre.checked : false);
  var nuevoValorCocina = !!(_cfgCom ? _cfgCom.checked : false);
  // Persistir en localStorage
  localStorage.setItem('an', configData.negocio);
  localStorage.setItem('ad', configData.direccion);
  localStorage.setItem('at', configData.telefono);
  localStorage.setItem('ar', configData.ruc);
  localStorage.setItem('pos_presupuestos', configData.presupuestosHabilitados ? '1' : '0');
  // Pasar por el sistema rubro para mantener pos_flag_cocina y legacy en sync
  if(typeof rubroSetFlag === 'function'){
    rubroSetFlag('cocina', nuevoValorCocina);
  } else {
    configData.comandasHabilitadas = nuevoValorCocina;
    localStorage.setItem('pos_comandas', nuevoValorCocina ? '1' : '0');
  }
  // Mostrar u ocultar botón comanda en cobro
  updBtnComandaCobro();

  // Multi-moneda: guardar toggle + cotizaciones en localStorage
  var _cfgMM = document.getElementById('cfgMultiMoneda');
  if(_cfgMM){
    var _mmActNuevo = _cfgMM.checked;
    localStorage.setItem('mm_activo', _mmActNuevo ? '1' : '0');
    var _mmPanelEl = document.getElementById('cfgMMPanel');
    if(_mmPanelEl) _mmPanelEl.style.display = _mmActNuevo ? 'block' : 'none';
    var _cfgBRL = document.getElementById('cfgCotBRL');
    var _cfgARS = document.getElementById('cfgCotARS');
    var _mmHuboActualizacion = false;
    if(_cfgBRL && _cfgBRL.value !== '') {
      localStorage.setItem('mm_cotBRL', _cfgBRL.value);
      _mmHuboActualizacion = true;
    }
    if(_cfgARS && _cfgARS.value !== '') {
      localStorage.setItem('mm_cotARS', _cfgARS.value);
      _mmHuboActualizacion = true;
    }
    if(_mmHuboActualizacion){
      var _padMM = function(n){ return String(n).padStart(2,'0'); };
      var _nowMM = new Date();
      var _tsMM = _padMM(_nowMM.getDate())+'/'+_padMM(_nowMM.getMonth()+1)+'/'+_nowMM.getFullYear()
                +' '+_padMM(_nowMM.getHours())+':'+_padMM(_nowMM.getMinutes());
      localStorage.setItem('mm_updAt', _tsMM);
      var _ultEl = document.getElementById('cfgMMUltAct');
      if(_ultEl) _ultEl.textContent = 'Tipo de cambio actualizado: ' + _tsMM;
    }
  }

  // Persistir también en Supabase (debounced para no spammear en cada tecla)
  _guardarConfigSupabaseDebounced();
}

// Debounce de 1s para no mandar un POST a Supabase por cada tecla
var _saveConfigTimer = null;
function _guardarConfigSupabaseDebounced(){
  clearTimeout(_saveConfigTimer);
  _saveConfigTimer = setTimeout(_guardarConfigSupabase, 1000);
}

async function _guardarConfigSupabase(){
  var email = localStorage.getItem('lic_email');
  if(!email || typeof USAR_DEMO !== 'undefined' && USAR_DEMO) return;
  if(typeof supaPost !== 'function') return;
  try {
    var payload = {
      licencia_email: email,
      clave: 'negocio_config',
      valor: JSON.stringify({
        an: configData.negocio || '',
        ar: configData.ruc || '',
        ad: configData.direccion || '',
        at: configData.telefono || '',
        ciudad: configData.ciudad || '',
        pie_recibo: configData.pie_recibo || '',
        mostrar_ruc: configData.mostrar_ruc || '',
        moneda: configData.moneda || '',
      }),
    };
    await supaPost('pos_config', payload, 'licencia_email,clave', true);
    _log('[Config] Guardado en Supabase <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><polyline points="20 6 9 17 4 12"/></svg>');
    return true;
  } catch(e){
    console.warn('[Config] Error guardando en Supabase:', e.message);
    throw e;
  }
}

// Marca que hay cambios sin guardar (al tipear en los inputs)
function _marcarNegocioDirty(){
  var btn = document.getElementById('btnGuardarNegocio');
  var txt = document.getElementById('txtGuardarNegocio');
  var status = document.getElementById('syncStatusNegocio');
  if(btn){
    btn.style.background = 'var(--orange, #ff9800)';
    btn.style.boxShadow  = '0 3px 10px rgba(255,152,0,.3)';
  }
  if(txt) txt.textContent = 'GUARDAR CAMBIOS';
  if(status){
    status.textContent = '● Hay cambios sin guardar';
    status.style.color = '#ff9800';
  }
}

// ── GUARDAR EXPLÍCITO DE DATOS DEL NEGOCIO ──
// El usuario toca el botón "Guardar datos" y ve feedback claro:
// - Spinner mientras guarda
// - <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><polyline points="20 6 9 17 4 12"/></svg> verde + "Guardado en la nube" al terminar
// - <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> rojo + mensaje de error si falla
// - Horario del último guardado exitoso
async function guardarNegocioAhora(){
  // 1. Leer valores actuales de los inputs
  var _cfgNeg = document.getElementById('cfgNegocio');
  var _cfgDir = document.getElementById('cfgDireccion');
  var _cfgTel = document.getElementById('cfgTelefono');
  var _cfgRuc = document.getElementById('cfgRuc');
  if(_cfgNeg) configData.negocio   = _cfgNeg.value || '';
  if(_cfgDir) configData.direccion = _cfgDir.value || '';
  if(_cfgTel) configData.telefono  = _cfgTel.value || '';
  if(_cfgRuc) configData.ruc       = _cfgRuc.value || '';

  // 2. Persistir en localStorage
  localStorage.setItem('an', configData.negocio);
  localStorage.setItem('ad', configData.direccion);
  localStorage.setItem('at', configData.telefono);
  localStorage.setItem('ar', configData.ruc);

  // 3. Cancelar cualquier debounce pendiente (evitar doble POST)
  clearTimeout(_saveConfigTimer);

  // 4. Feedback visual: spinner
  var btn = document.getElementById('btnGuardarNegocio');
  var txt = document.getElementById('txtGuardarNegocio');
  var status = document.getElementById('syncStatusNegocio');
  if(btn) btn.disabled = true;
  if(btn) btn.style.opacity = '.75';
  if(txt) txt.textContent = 'GUARDANDO...';
  if(status) { status.textContent = ''; status.style.color = 'var(--muted)'; }

  try {
    await _guardarConfigSupabase();
    // 5. Éxito — restaurar botón verde, mostrar check
    if(btn){
      btn.style.background = 'var(--green)';
      btn.style.boxShadow  = '0 3px 10px rgba(76,175,80,.3)';
    }
    if(txt) txt.textContent = 'GUARDADO';
    if(status){
      var ahora = new Date();
      var hh = String(ahora.getHours()).padStart(2,'0');
      var mm = String(ahora.getMinutes()).padStart(2,'0');
      status.textContent = 'Guardado en la nube · ' + hh + ':' + mm;
      status.style.color = 'var(--green)';
      localStorage.setItem('pos_negocio_last_sync', ahora.toISOString());
    }
    if(typeof toast === 'function') toast('Datos del negocio guardados');
    // Restablecer el texto del botón después de 2 segundos
    setTimeout(function(){
      if(btn) { btn.disabled = false; btn.style.opacity = '1'; }
      if(txt) txt.textContent = 'GUARDAR DATOS';
    }, 2000);
  } catch(e){
    // 6. Error
    if(txt) txt.textContent = 'ERROR';
    if(status){
      status.textContent = 'No se pudo sincronizar: ' + (e.message || 'sin detalle') + ' — se guardó localmente';
      status.style.color = '#e53935';
    }
    if(typeof toast === 'function') toast('Error al sincronizar — guardado solo local');
    setTimeout(function(){
      if(btn) { btn.disabled = false; btn.style.opacity = '1'; }
      if(txt) txt.textContent = 'REINTENTAR';
    }, 1500);
  }

  // Refrescar UI dependiente
  updBtnComandaCobro();
}

// Mostrar el estado de la última sincronización al abrir la pantalla
function mostrarUltimaSincroNegocio(){
  var status = document.getElementById('syncStatusNegocio');
  if(!status) return;
  var iso = localStorage.getItem('pos_negocio_last_sync');
  if(!iso){
    status.textContent = 'Nunca sincronizado con la nube';
    status.style.color = 'var(--muted)';
    return;
  }
  try {
    var f = new Date(iso);
    var hoy = new Date();
    var mismoDia = f.toDateString() === hoy.toDateString();
    var hh = String(f.getHours()).padStart(2,'0');
    var mm = String(f.getMinutes()).padStart(2,'0');
    if(mismoDia){
      status.textContent = 'Última sincronización hoy a las ' + hh + ':' + mm;
    } else {
      var dd = String(f.getDate()).padStart(2,'0');
      var MM = String(f.getMonth()+1).padStart(2,'0');
      status.textContent = 'Última sincronización: ' + dd + '/' + MM + ' ' + hh + ':' + mm;
    }
    status.style.color = 'var(--muted)';
  } catch(e){}
}

// -- Modificadores: ver js/productos.js --

// ══════════════════════════════════════════════════════════════════════════════
// cerrarSesion — cierre de sesión real con limpieza de estado
//
// QUÉ BORRA:
//   - Credenciales de sesión (lic_activated, lic_token, lic_plan, lic_vence, etc.)
//   - Turno activo (pos_turno_activo) — la caja empieza limpia
//   - Tickets pendientes (pos_pendientes) — sin cola anterior
//   - Contador de tickets (pos_ticket_counter) — vuelve a 1
//   - Modo terminal (pos_modo_terminal) — se re-lee desde Supabase al volver
//
// QUÉ CONSERVA:
//   - device_id (lic_device_id + cookie) — para auto-recuperar sin re-registro
//   - Configuración de terminal (pos_terminal, pos_sucursal, pos_deposito)
//   - Config de impresoras (btps_mac, etc.)
//   - Cookie pos_email_bk — fallback offline
//
// Al volver a abrir la app, licInit() consulta Supabase con el device_id,
// recupera la sesión automáticamente y lee el modo (caja/satélite) fresco.
// ══════════════════════════════════════════════════════════════════════════════
function cerrarSesion(){
  var msg = '¿Cerrar sesión?\n\n' +
    'La terminal se reconectará automáticamente la próxima vez que abras la app.\n' +
    'El modo (Caja/Satélite) se actualizará desde el servidor.';

  if(!confirm(msg)) return;

  // ── Limpiar credenciales de sesión ───────────────────────────────────────
  // Las SK keys son las de autenticación — sin ellas licInit() va a Supabase
  Object.values(SK).forEach(function(k){
    // Conservar solo device_id — es el identificador del dispositivo físico
    if(k !== SK.deviceId) localStorage.removeItem(k);
  });

  // ── Limpiar estado operativo ──────────────────────────────────────────────
  localStorage.removeItem('pos_turno_activo');   // turno activo
  localStorage.removeItem('pos_pendientes');     // tickets pendientes
  localStorage.removeItem('pos_ticket_counter'); // contador de tickets
  localStorage.removeItem('pos_modo_terminal');  // modo — se re-lee desde Supabase

  // ── Limpiar cookies de sesión (NO device_id ni email_bk) ─────────────────
  // pos_email_bk y pos_device_id se conservan para auto-recuperación offline
  cookieSet('ali', '', -1);         // licencia_id — se recupera al reconectar

  // ── Limpiar IndexedDB — turno y ventas en memoria ─────────────────────────
  if(db){
    try{
      db.turno.clear();
      _log('[Sesion] IndexedDB turno limpiado');
    } catch(e){ console.warn('[Sesion] Error limpiando IndexedDB:', e.message); }
  }

  // ── Reset de variables en memoria ─────────────────────────────────────────
  // Sin esto, la sesión anterior quedaría en RAM aunque el localStorage esté limpio
  if(typeof pendientes !== 'undefined') setPendientes([]);
  if(typeof cart !== 'undefined') clearCart();
  if(typeof currentTicketNro !== 'undefined') setCurrentTicketNro(null);
  if(typeof turnoData !== 'undefined'){
    turnoData.fechaApertura   = null;
    turnoData.efectivoInicial = 0;
    turnoData.ventas          = [];
    turnoData.egresos         = [];
    turnoData.ingresos        = [];
    turnoData.supaId          = null;
    turnoData.dbId            = null;
  }
  if(typeof mesaActual !== 'undefined') clearMesaActual();
  if(typeof MODO_TERMINAL !== 'undefined') MODO_TERMINAL = 'caja';

  toast('Sesión cerrada — reconectando...');

  // ── Recargar la app para aplicar limpieza completa ───────────────────────
  // location.reload() es la forma más limpia — cualquier estado residual
  // en memoria desaparece y licInit() corre desde cero con el device_id
  setTimeout(function(){ location.reload(); }, 800);
}

function selPrinterSize(tipo, size){
  printers[tipo].size = size;
  localStorage.setItem('printerSize_'+tipo, size);
  document.getElementById(tipo+'Size58').classList.toggle('sel', size==='58');
  document.getElementById(tipo+'Size80').classList.toggle('sel', size==='80');
  toast('Papel '+size+'mm configurado para '+tipo);
}

// ── Printer UI/BT/USB functions: ver js/impresion.js ──
// ── updPrinterUI, conectarBluetooth, usarImpresoraUSBLocal, usarImpresoraPC,
//    btps*, desconectarImpresora, imprimirTicketConf, imprimirPCUSB,
//    limpiarParaImpresora, abrirDialogoImpresion, imprimirUSBLocal
//    → todos en impresion.js
// ══════════════════════════════════════════════════════════
// SISTEMA DE LICENCIAS
// ══════════════════════════════════════════════════════════

// ── Búsqueda de código de barras en API externa (SpCodigoBarra) ──────────────

async function _buscarCodigoEnAPI(codigo){
  if(!navigator.onLine){ toast('Sin internet — código no encontrado'); return; }
  toast('Buscando código...');
  try {
    var url = '/api/sql';
    var r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sp: "Exec SpCodigoBarra @CodigoBarra='" + codigo.replace(/'/g,"''") + "'" }),
    });
    if(!r.ok){
      var txt = '';
      try { txt = await r.text(); } catch(_){}
      throw new Error('HTTP ' + r.status + (txt ? ': ' + txt.substring(0,80) : ''));
    }
    var datos = await r.json();
    var fila = Array.isArray(datos) && datos.length > 0 ? datos[0] : null;
    if(!fila){
      _crearProductoNuevo(codigo);
      return;
    }
    _crearYVenderExterno(fila, codigo);
  } catch(e){
    console.error('[API] buscarCodigo error:', e.name, e.message, 'url:', APISQL_WORKER);
    toast('Error al buscar [' + e.name + ']: ' + e.message);
  }
}

function _crearProductoNuevo(codigo, nombrePrefill, precioPrefill){
  var prev = document.getElementById('_modalNuevoProd');
  if(prev) prev.remove();
  var valNombre = nombrePrefill ? nombrePrefill.replace(/"/g,'&quot;') : '';
  var valPrecio = precioPrefill ? String(precioPrefill) : '';
  // En landscape el bottom-sheet queda detrás del teclado — usar modal centrado
  var isLandscape = window.innerWidth > window.innerHeight;
  var wrapStyle = isLandscape
    ? 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.82);display:flex;align-items:center;justify-content:center;padding:12px;'
    : 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.75);display:flex;align-items:flex-end;justify-content:center;';
  var cardStyle = isLandscape
    ? 'background:#1a1a1a;border-radius:16px;width:100%;max-width:480px;padding:18px 20px 20px;font-family:Barlow,sans-serif;overflow-y:auto;max-height:96vh;'
    : 'background:#1a1a1a;border-radius:20px 20px 0 0;width:100%;max-width:480px;padding:24px 20px 32px;font-family:Barlow,sans-serif;';

  // Numpad para precio — mismo estilo que precioModalOv
  var nb = 'background:#2a2a2a;border:1px solid #3a3a3a;border-radius:8px;color:#fff;font-family:\'Barlow\',sans-serif;font-weight:600;padding:15px 0;cursor:pointer;width:100%;';
  var numpadHtml = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:14px;">';
  var numKeys = ['1','2','3','4','5','6','7','8','9','000','0','⌫'];
  for (var ki = 0; ki < numKeys.length; ki++) {
    var d = numKeys[ki];
    var act = d === '⌫' ? '_mnpNumDel()' : '_mnpNum(\'' + d + '\')';
    var fsz = d === '000' ? '16' : '20';
    numpadHtml += '<button onclick="' + act + '" style="' + nb + 'font-size:' + fsz + 'px;">' + d + '</button>';
  }
  numpadHtml += '</div>';

  var dispVal = valPrecio ? gs(parseInt(valPrecio)) : '₲ 0';

  var m = document.createElement('div');
  m.id = '_modalNuevoProd';
  m.style.cssText = wrapStyle;
  m.innerHTML =
    '<div style="' + cardStyle + '">' +
      (isLandscape ? '' : '<div style="width:40px;height:4px;background:#333;border-radius:2px;margin:0 auto 16px;"></div>') +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">' +
        '<div style="width:36px;height:36px;border-radius:10px;background:#4caf50;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
        '</div>' +
        '<div>' +
          '<div style="font-size:13px;font-weight:800;color:#fff;letter-spacing:.3px;">Nuevo producto</div>' +
          '<div style="font-size:11px;color:#666;margin-top:1px;">Código: ' + codigo + '</div>' +
        '</div>' +
      '</div>' +
      // Botón "toca para escribir" — solo cuando no hay prefill
      (nombrePrefill ? '' :
        '<button id="_mnpTeclado" onclick="_mnpFocusNombre()" ' +
        'style="width:100%;background:#1e3a1e;border:2px dashed #4caf50;border-radius:12px;color:#4caf50;font-family:Barlow,sans-serif;' +
        'font-size:13px;font-weight:800;padding:11px 16px;margin-bottom:12px;cursor:pointer;letter-spacing:.5px;text-align:left;">⌨  TOCA AQUÍ PARA ESCRIBIR EL NOMBRE</button>'
      ) +
      '<div style="font-size:11px;font-weight:700;color:#888;letter-spacing:.8px;text-transform:uppercase;margin-bottom:6px;">Nombre</div>' +
      '<input id="_mnpNombre" autocomplete="off" autocapitalize="characters" placeholder="Ej: COCA COLA 500ML" value="' + valNombre + '" ' +
        'style="width:100%;box-sizing:border-box;background:#2a2a2a;border:1.5px solid #3a3a3a;border-radius:12px;' +
        'color:#fff;font-family:Barlow,sans-serif;font-size:16px;font-weight:600;padding:14px 16px;margin-bottom:12px;outline:none;letter-spacing:.3px;">' +
      '<div style="font-size:11px;font-weight:700;color:#888;letter-spacing:.8px;text-transform:uppercase;margin-bottom:6px;">Precio (Gs)</div>' +
      '<div id="_mnpPrecioDisp" style="font-size:26px;font-weight:800;color:#fff;text-align:right;padding:12px 16px;background:#2a2a2a;border:1.5px solid #3a3a3a;border-radius:12px;margin-bottom:8px;">' + dispVal + '</div>' +
      '<input type="hidden" id="_mnpPrecio" value="' + valPrecio + '">' +
      numpadHtml +
      '<div style="display:flex;gap:10px;">' +
        '<button onclick="document.getElementById(\'_modalNuevoProd\').remove()" ' +
          'style="flex:1;background:#2a2a2a;border:1.5px solid #3a3a3a;border-radius:12px;color:#888;font-family:Barlow,sans-serif;font-size:14px;font-weight:700;padding:14px;cursor:pointer;">Cancelar</button>' +
        '<button onclick="_confirmarNuevoProducto(\'' + codigo + '\')" ' +
          'style="flex:2;background:#4caf50;border:none;border-radius:12px;color:#fff;font-family:Barlow,sans-serif;font-size:15px;font-weight:800;padding:14px;cursor:pointer;letter-spacing:.3px;">AGREGAR AL CARRITO</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(m);

  // Estado del numpad (raw dígitos)
  window._mnpNumVal = valPrecio || '';
  window._mnpNum = function(d) {
    var v = window._mnpNumVal + d;
    if (v.length > 10) return;
    window._mnpNumVal = v;
    var n = parseInt(v) || 0;
    var disp = document.getElementById('_mnpPrecioDisp');
    var inp  = document.getElementById('_mnpPrecio');
    if (disp) disp.textContent = gs(n);
    if (inp)  inp.value = n ? String(n) : '';
  };
  window._mnpNumDel = function() {
    window._mnpNumVal = window._mnpNumVal.slice(0, -1);
    var n = parseInt(window._mnpNumVal) || 0;
    var disp = document.getElementById('_mnpPrecioDisp');
    var inp  = document.getElementById('_mnpPrecio');
    if (disp) disp.textContent = window._mnpNumVal ? gs(n) : '₲ 0';
    if (inp)  inp.value = window._mnpNumVal ? String(n) : '';
  };
  // Exponer helper para el botón de teclado nombre
  window._mnpFocusNombre = function() {
    var el  = document.getElementById('_mnpNombre');
    var btn = document.getElementById('_mnpTeclado');
    if (btn) btn.style.display = 'none';
    if (el) { el.focus(); el.click(); }
  };
  // Auto-focus solo cuando no hay prefill (producto manual sin datos)
  if (!nombrePrefill) {
    setTimeout(function(){
      var el = document.getElementById('_mnpNombre');
      if (el) {
        el.focus();
        if (document.activeElement === el) {
          var btn = document.getElementById('_mnpTeclado');
          if (btn) btn.style.display = 'none';
        }
      }
    }, 120);
  }
}

function _confirmarNuevoProducto(codigo){
  var nombre = (document.getElementById('_mnpNombre').value || '').trim().toUpperCase();
  var precio  = parseFloat(document.getElementById('_mnpPrecio').value) || 0;
  if(!nombre){ document.getElementById('_mnpNombre').style.border='1.5px solid #f44336'; return; }
  if(!precio){ document.getElementById('_mnpPrecioDisp').style.border='1.5px solid #f44336'; return; }
  document.getElementById('_modalNuevoProd').remove();
  var newProd = {
    id: nextProdId, prodId: nextProdId,
    name: nombre, price: precio,
    precioVariable: false, costo: 0,
    codigo: codigo, codigos: [codigo], color: '#455a64',
    colorPropio: false, cat: 'General',
    iva: '10', mitad: false, inventario: false, comanda: false,
    activo: true,
  };
  PRODS.push(newProd);
  nextProdId++;
  if(typeof dbSaveProducto === 'function') dbSaveProducto(newProd);
  if(typeof supaUpsertProducto === 'function') supaUpsertProducto(newProd);
  if(typeof filterP === 'function') filterP();
  addCart(newProd.id);
  _mostrarTicketMobile();
  toast(nombre + ' — creado y agregado');
}

function _extraerCampo(fila, candidatos){
  for(var i = 0; i < candidatos.length; i++){
    if(fila[candidatos[i]] !== undefined && fila[candidatos[i]] !== null && fila[candidatos[i]] !== '')
      return fila[candidatos[i]];
  }
  return null;
}

function _crearYVenderExterno(fila, codigo){
  // Si ya existe en catálogo por código (en cualquiera de sus códigos), sumar al carrito directo
  var _allProds = (typeof PRODS !== 'undefined' ? PRODS : []).filter(function(p){ return !p.itemLibre; });
  var existente = _findProdByCodigo(codigo.toLowerCase(), _allProds);
  if(existente){ addCart(existente.id); _mostrarTicketMobile(); toast('+' + existente.name); return; }

  var nombre = (_extraerCampo(fila, ['Descripcion','descripcion','DESCRIPCION','Nombre','nombre','NOMBRE','Producto','producto','PRODUCTO','Description','name']) || '').trim().toUpperCase();
  var precio  = parseFloat(_extraerCampo(fila, ['Precio','precio','PRECIO','PrecioVenta','PrecioUnitario','PRECIO_VENTA','Price','price','Importe']) || 0) || 0;
  // Mostrar sheet para confirmar/ajustar antes de crear
  _crearProductoNuevo(codigo, nombre, precio);
}


// ── CONSULTA TIPO DE CAMBIO (referencia BCP/ExchangeRate-API) ─────────────────
async function consultarTipoBCP(){
  var btn = document.getElementById('btnBCP');
  var res = document.getElementById('bcpResult');
  if(btn) btn.textContent = 'Consultando...';
  try {
    var r = await fetch('/api/cotizacion');
    if(!r.ok) throw new Error('HTTP ' + r.status);
    var data = await r.json();
    if(!data.ok) throw new Error(data.error || 'Sin datos');

    var cotBRL = data.cotBRL;
    var cotARS = data.cotARS;
    var fecha  = data.fecha || '';

    document.getElementById('bcpFecha').textContent = 'Fuente: ' + data.fuente + (fecha ? ' — ' + fecha : '');
    document.getElementById('bcpRates').innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);">'
        +'<span style="font-size:13px;font-weight:600;">🇧🇷 1 Real (BRL)</span>'
        +'<span style="font-size:14px;font-weight:800;color:var(--green);">₲ '+gn(cotBRL)+'</span>'
        +'<button onclick="usarTipoBCP(\'brl\','+cotBRL+')" style="background:var(--green);border:none;border-radius:6px;color:#fff;font-family:Barlow,sans-serif;font-size:11px;font-weight:700;padding:5px 10px;cursor:pointer;">Usar</button>'
      +'</div>'
      +'<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;">'
        +'<span style="font-size:13px;font-weight:600;">🇦🇷 1 Peso (ARS)</span>'
        +'<span style="font-size:14px;font-weight:800;color:var(--green);">₲ '+cotARS+'</span>'
        +'<button onclick="usarTipoBCP(\'ars\','+cotARS+')" style="background:var(--green);border:none;border-radius:6px;color:#fff;font-family:Barlow,sans-serif;font-size:11px;font-weight:700;padding:5px 10px;cursor:pointer;">Usar</button>'
      +'</div>';

    if(res) res.style.display = 'block';
  } catch(e){
    toast('Error al consultar: ' + e.message);
  }
  if(btn){
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Consultar tipo de cambio (referencia BCP)';
  }
}

function usarTipoBCP(moneda, valor){
  if(moneda === 'brl'){
    var el = document.getElementById('cfgCotBRL');
    if(el){ el.value = valor; saveGeneralConfig(); }
  } else {
    var el2 = document.getElementById('cfgCotARS');
    if(el2){ el2.value = valor; saveGeneralConfig(); }
  }
  toast('Cotización actualizada');
}
