// ── Rubro / Tipo de negocio — Fase 0 ──────────────────────
// Fuente de verdad única para tipo_negocio y los 4 flags granulares.
//
// REGLA DE DEFAULTS:
//   tipo_negocio setea los defaults de los 4 flags.
//   Si un flag fue seteado explícitamente (pos_flag_*=0|1 en localStorage),
//   gana el valor explícito (permite un retail que SÍ haga delivery, etc.).
//
// COMPATIBILIDAD HACIA ATRÁS:
//   - Sin tipo_negocio configurado → gastronomia → todo como antes.
//   - usa_cocina es ALIAS de comandasHabilitadas existente.
//     Los dos sistemas escriben la misma clave localStorage 'pos_comandas'.
//
// PERSISTENCIA:
//   localStorage keys:
//     'pos_tipo_negocio'  → 'gastronomia' | 'retail'
//     'pos_flag_mesas'    → '0' | '1' | null (null = usar default del tipo)
//     'pos_flag_cocina'   → '0' | '1' | null
//     'pos_flag_delivery' → '0' | '1' | null
//     'pos_flag_mitades'  → '0' | '1' | null
//   Supabase: pos_config clave='rubro_config' valor=JSON con los mismos campos.

// ── Leer tipo de negocio ──────────────────────────────────
function rubroGetTipo(){
  return localStorage.getItem('pos_tipo_negocio') || 'gastronomia';
}

// ── Defaults por tipo ─────────────────────────────────────
function _rubroDefaults(tipo){
  if(tipo === 'retail'){
    return { usa_mesas: false, usa_cocina: false, usa_delivery: false, usa_mitades: false };
  }
  // gastronomia (default) — usa_cocina refleja comandasHabilitadas existente
  return {
    usa_mesas:    true,
    usa_cocina:   !!(configData && configData.comandasHabilitadas !== undefined
                      ? configData.comandasHabilitadas
                      : localStorage.getItem('pos_comandas') === '1'),
    usa_delivery: true,
    usa_mitades:  true,
  };
}

// ── Leer un flag (con override explícito) ─────────────────
function rubroFlag(flag){
  var stored = localStorage.getItem('pos_flag_' + flag);
  if(stored === '1') return true;
  if(stored === '0') return false;
  // Sin override explícito → usar default del tipo
  return _rubroDefaults(rubroGetTipo())[flag];
}

// Atajos semánticos usados en el código de los módulos:
function esRetail()    { return rubroGetTipo() === 'retail'; }
function usaMesas()    { return rubroFlag('mesas');    }
function usaCocina()   { return rubroFlag('cocina');   }
function usaDelivery() { return rubroFlag('delivery'); }
function usaMitades()  { return rubroFlag('mitades');  }

// ── Setear tipo de negocio ────────────────────────────────
// Al cambiar el tipo se limpian los overrides para que los defaults entren.
// Si se quiere conservar overrides explícitos pasar keepOverrides=true.
function rubroSetTipo(tipo, keepOverrides){
  localStorage.setItem('pos_tipo_negocio', tipo);
  if(!keepOverrides){
    localStorage.removeItem('pos_flag_mesas');
    localStorage.removeItem('pos_flag_cocina');
    localStorage.removeItem('pos_flag_delivery');
    localStorage.removeItem('pos_flag_mitades');
  }
  // Sincronizar usa_cocina con el sistema legacy (pos_comandas / configData)
  _rubroSyncCocinaLegacy();
  _rubroGuardarSupabaseDebounced();
}

// ── Setear un flag individual (override explícito) ────────
function rubroSetFlag(flag, valor){
  localStorage.setItem('pos_flag_' + flag, valor ? '1' : '0');
  if(flag === 'cocina'){
    _rubroSyncCocinaLegacy();
  }
  _rubroGuardarSupabaseDebounced();
}

// ── Compatibilidad con sistema legacy de comandas ─────────
// Mantiene pos_comandas y configData.comandasHabilitadas en sync con usa_cocina.
function _rubroSyncCocinaLegacy(){
  var val = usaCocina();
  localStorage.setItem('pos_comandas', val ? '1' : '0');
  if(typeof configData !== 'undefined'){
    configData.comandasHabilitadas = val;
  }
  // Actualizar botón de comanda si la función ya existe en memoria
  if(typeof updBtnComandaCobro === 'function') updBtnComandaCobro();
}

// ── Aplicar los flags a la UI del POS ────────────────────
// Llamar al iniciar la app y cada vez que cambien los flags.
function rubroAplicarUI(){
  var mesas    = usaMesas();
  var delivery = usaDelivery();

  // Ítem de Mesas en el drawer
  var drawerMesas = document.getElementById('drawerItemMesas');
  if(drawerMesas) drawerMesas.style.display = mesas ? '' : 'none';

  // Barra de tipo de pedido (local/llevar/delivery) — desktop y mobile
  var tipoBarsTab = document.querySelectorAll('.tab-tipo-btns');
  var tipoBarMob  = document.querySelector('.mob-tipo-bar');

  tipoBarsTab.forEach(function(el){ el.style.display = (mesas || delivery) ? '' : 'none'; });
  if(tipoBarMob) tipoBarMob.style.display = (mesas || delivery) ? '' : 'none';

  // Botón "Local" — solo disponible si hay mesas
  var btnLocal    = document.getElementById('tipoBtnLocal');
  var btnMobLocal = document.getElementById('mobTipoBtnLocal');
  if(btnLocal)    btnLocal.style.display    = mesas ? '' : 'none';
  if(btnMobLocal) btnMobLocal.style.display = mesas ? '' : 'none';

  // Botón "Delivery" — solo disponible si usa_delivery
  var btnDel    = document.getElementById('tipoBtnDelivery');
  var btnMobDel = document.getElementById('mobTipoBtnDelivery');
  if(btnDel)    btnDel.style.display    = delivery ? '' : 'none';
  if(btnMobDel) btnMobDel.style.display = delivery ? '' : 'none';

  // Si el tipo actual era delivery y ya no se usa, resetear a llevar
  if(!delivery && typeof tipoPedido !== 'undefined' && tipoPedido === 'delivery'){
    if(typeof setTipoPedido === 'function') setTipoPedido('llevar');
  }

  // Barra de monto de delivery — ocultar si no usa delivery
  var tabDelivBar = document.getElementById('tabDeliveryBar');
  var mobDelivBar = document.getElementById('mobDeliveryBar');
  if(!delivery){
    if(tabDelivBar) tabDelivBar.style.display = 'none';
    if(mobDelivBar) mobDelivBar.style.display = 'none';
  }

  // Comanda — sincronizar con sistema legacy
  _rubroSyncCocinaLegacy();
  if(typeof updBtnComandaCobro === 'function') updBtnComandaCobro();

  // Restos de cocina en Configuración (Fase 2): ocultar la card "Impresora de
  // Comandas" y el toggle "Comandas" SOLO en retail sin cocina. En gastronomía
  // (o retail con cocina habilitada vía override) se dejan visibles, para no
  // cambiar el flujo y para no esconder el toggle que justamente activa cocina.
  var ocultarCocinaUI = (rubroGetTipo() === 'retail') && !usaCocina();
  var comandaPrinter = document.getElementById('comandaPrinterSection');
  if(comandaPrinter) comandaPrinter.style.display = ocultarCocinaUI ? 'none' : '';
  var comandaToggleField = document.getElementById('cfgComandasField');
  if(comandaToggleField) comandaToggleField.style.display = ocultarCocinaUI ? 'none' : '';
  // Ficha de producto: checkbox "Comanda (va a cocina)" — sin sentido en retail.
  var artComandaRow = document.getElementById('artComandaRow');
  if(artComandaRow) artComandaRow.style.display = ocultarCocinaUI ? 'none' : '';

  // En retail: buscador siempre visible y con foco para escanear sin tocar pantalla
  if(rubroGetTipo() === 'retail'){
    var sbar = document.getElementById('sbar');
    if(sbar) sbar.classList.add('open');
  }
}

// ── Mapear licencias.rubro → tipo interno ─────────────────
// licencias.rubro es texto libre; normalizamos diacríticos y mapeamos.
// Devuelve 'gastronomia' | 'retail' | null (null = no reconocido).
var _RUBRO_MAPA = {
  // Gastronomia
  gastronomia:'gastronomia', restaurante:'gastronomia', bar:'gastronomia',
  cafeteria:'gastronomia',   parrilla:'gastronomia',    lomiteria:'gastronomia',
  delivery:'gastronomia',    heladeria:'gastronomia',   pizzeria:'gastronomia',
  rotiseria:'gastronomia',   cantina:'gastronomia',     buffet:'gastronomia',
  sandwicheria:'gastronomia',hamburgueseria:'gastronomia',
  // Retail
  retail:'retail',       electronica:'retail',  ferreteria:'retail',
  farmacia:'retail',     ropa:'retail',         indumentaria:'retail',
  supermercado:'retail', minimercado:'retail',  minimarket:'retail',
  libreria:'retail',     jugueteria:'retail',   bazar:'retail',
  perfumeria:'retail',   kiosco:'retail',       calzado:'retail',
  joyeria:'retail',      relojeria:'retail',    optica:'retail',
};
function _rubroLicenciaToTipo(rubro) {
  if(!rubro) return null;
  // Normalizar: minúsculas + quitar diacríticos (gastronomía → gastronomia)
  var r = (rubro + '').toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
  if(!r) return null;
  var tipo = _RUBRO_MAPA[r];
  if(tipo) return tipo;
  _log('[Rubro] Rubro de licencia no reconocido:', rubro);
  return null;
}

// ── Cargar desde Supabase al iniciar ─────────────────────
// Cadena de prioridad (el servidor siempre gana sobre localStorage):
//   1. pos_config.rubro_config → tipo + flags guardados por la app
//   2. licencias.rubro         → derivación automática si no hay pos_config
//   3. 'gastronomia'           → default en rubroGetTipo()
//
// NOTA: tipo_negocio SIEMPRE se sobreescribe desde el servidor para evitar
// datos stale en localStorage cuando cambia la configuración del negocio.
// Los flags son preferencias de usuario y solo se leen del servidor si no hay override local.
async function rubroCargarDesdeSupabase(){
  var email = localStorage.getItem('lic_email');
  if(!email || (typeof USAR_DEMO !== 'undefined' && USAR_DEMO)) return;
  try {
    // 1. pos_config — fuente de verdad principal
    var rows = await supaGet('pos_config',
      'licencia_email=eq.' + encodeURIComponent(email) +
      '&clave=eq.rubro_config&select=valor&limit=1');
    if(rows && rows[0]){
      var cfg = JSON.parse(rows[0].valor || '{}');
      // tipo_negocio: servidor siempre gana (limpia stale de localStorage)
      if(cfg.tipo_negocio) localStorage.setItem('pos_tipo_negocio', cfg.tipo_negocio);
      // flags: solo si el usuario no tiene override local explícito
      ['mesas','cocina','delivery','mitades'].forEach(function(f){
        if(cfg['flag_' + f] !== undefined && localStorage.getItem('pos_flag_' + f) === null){
          localStorage.setItem('pos_flag_' + f, cfg['flag_' + f] ? '1' : '0');
        }
      });
      _log('[Rubro] Config cargada desde pos_config:', cfg.tipo_negocio);
      return; // pos_config encontrada, no necesitamos consultar licencias
    }

    // 2. Sin pos_config → derivar tipo desde licencias.rubro
    var licRows = await supaGet('licencias',
      'email_cliente=eq.' + encodeURIComponent(email) +
      '&activa=eq.true&select=rubro&limit=1');
    var rubroLic = licRows && licRows[0] ? licRows[0].rubro : null;
    var tipoDesdeRubro = _rubroLicenciaToTipo(rubroLic);
    if(tipoDesdeRubro){
      localStorage.setItem('pos_tipo_negocio', tipoDesdeRubro);
      _log('[Rubro] Tipo derivado de licencias.rubro:', rubroLic, '→', tipoDesdeRubro);
    }
  } catch(e){
    console.warn('[Rubro] Error cargando config:', e.message);
  }
}

// ── Guardar en Supabase ───────────────────────────────────
var _rubroSaveTimer = null;
function _rubroGuardarSupabaseDebounced(){
  clearTimeout(_rubroSaveTimer);
  _rubroSaveTimer = setTimeout(_rubroGuardarSupabase, 1000);
}

async function _rubroGuardarSupabase(){
  var email = localStorage.getItem('lic_email');
  if(!email || (typeof USAR_DEMO !== 'undefined' && USAR_DEMO)) return;
  if(typeof supaPost !== 'function') return;
  try {
    var payload = {
      licencia_email: email,
      clave: 'rubro_config',
      valor: JSON.stringify({
        tipo_negocio: rubroGetTipo(),
        flag_mesas:    localStorage.getItem('pos_flag_mesas')    !== null ? usaMesas()    : null,
        flag_cocina:   localStorage.getItem('pos_flag_cocina')   !== null ? usaCocina()   : null,
        flag_delivery: localStorage.getItem('pos_flag_delivery') !== null ? usaDelivery() : null,
        flag_mitades:  localStorage.getItem('pos_flag_mitades')  !== null ? usaMitades()  : null,
      }),
    };
    await supaPost('pos_config', payload, 'licencia_email,clave', true);
    _log('[Rubro] Config guardada en Supabase');
  } catch(e){
    console.warn('[Rubro] Error guardando config:', e.message);
  }
}
