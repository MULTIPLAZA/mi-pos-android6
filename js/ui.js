// ============================================================
// ui.js — Utilidades de interfaz de usuario
// Ampersand POS
// ============================================================
//
// Funciones pequeñas usadas por todos los módulos.
// No depende de ningún otro archivo JS del proyecto.
//
// FUNCIONES:
//   gs(n)            → formatea número como precio en guaraníes
//   toast(m)         → notificación temporal en pantalla
//   goTo(id)         → navega entre pantallas
//   animAddToCart()  → animación al agregar producto al carrito
//   toggleTheme()    → alterna tema claro/oscuro
//   applyTheme()     → aplica el tema guardado al iniciar
// ============================================================

// ── FORMATO DE MONEDA ────────────────────────────────────────

// gs() vive en js/lib/format.mjs (ARCH-001d). Expuesto como window.gs.

// ── TOAST ────────────────────────────────────────────────────

var _tt;

/**
 * Muestra una notificación temporal en pantalla por 1.8 segundos.
 * Si llega otra antes, reemplaza a la anterior.
 * @param {string} m — Mensaje a mostrar
 */
function toast(m) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = m;
  t.classList.add('show');
  clearTimeout(_tt);
  _tt = setTimeout(() => t.classList.remove('show'), 1800);
}

// ── NAVEGACIÓN ───────────────────────────────────────────────

/**
 * Navega a la pantalla con el ID dado.
 * Oculta todas las demás y muestra solo la pedida.
 * Algunas pantallas tienen callbacks que se ejecutan al mostrarse.
 *
 * @param {string} id — ID del elemento <div class="screen">
 */
function goTo(id) {
  // Regresión de BUG-06 fix: el ocultamiento defensivo de scActivado seteaba
  // style.display='none' inline en todas las .screen; ese inline style queda
  // persistente porque goTo() solo togglea classList. Limpiar el inline acá
  // garantiza que .screen.active{display:flex} del CSS vuelva a aplicarse.
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.style.removeProperty('display');
  });
  const el = document.getElementById(id);
  if (el) el.classList.add('active');

  // Pushear al historial para que el botón atrás de Android navegue
  // en vez de cerrar la app
  if (window.history && window.history.pushState) {
    window.history.pushState({ screen: id }, '', '#' + id);
  }

  // Callbacks post-navegación
  if (id === 'scConfig')        setTimeout(() => window.renderConfigInfo?.(),   50);
  if (id === 'scConfigGeneral') setTimeout(() => window.renderGeneralInfo?.(),  50);
  if (id === 'scDescuentos')    setTimeout(() => window.renderDescList?.(),     50);
  if (id === 'scArticulosList') setTimeout(() => window.renderArtList?.(),      50);
  if (id === 'scSale')          setTimeout(() => window._hospAplicarCatDefaultSiCorresponde?.(), 50);
}

// Manejar botón atrás del navegador/Android
window.addEventListener('popstate', function(e) {
  // Cerrar modales flotantes primero
  const pesoOv = document.getElementById('pesoModalOv');
  if(pesoOv && pesoOv.classList.contains('open')){
    pesoOv.classList.remove('open');
    return;
  }
  const precioOv = document.getElementById('precioModalOv');
  if(precioOv && precioOv.classList.contains('open')){
    precioOv.classList.remove('open');
    return;
  }
  // Modal "Nuevo producto" (escaneo de código no encontrado) — se crea con
  // appendChild/remove() en vez del patrón classList 'open' de los de
  // arriba, así que sin este chequeo el botón Atrás lo dejaba abierto para
  // siempre (la pantalla de fondo quedaba "atrapada" y el modal ni se enteraba).
  const nuevoProdOv = document.getElementById('_modalNuevoProd');
  if(nuevoProdOv){
    nuevoProdOv.remove();
    return;
  }
  const screen = e.state && e.state.screen;
  if (screen) {
    // Navegar a la pantalla anterior sin pushear al historial
    document.querySelectorAll('.screen').forEach(s => {
      s.classList.remove('active');
      s.style.removeProperty('display');
    });
    const el = document.getElementById(screen);
    if (el) el.classList.add('active');
  } else {
    // Si no hay estado, ir a la pantalla principal
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const main = document.getElementById('scSale') || document.getElementById('scClosed');
    if (main) main.classList.add('active');
  }
});

// ── ANIMACIÓN AL AGREGAR AL CARRITO ─────────────────────────

/**
 * Anima el botón del producto cuando se agrega al carrito:
 * - Efecto ripple sobre el tile
 * - Tarjeta que vuela hasta el badge del carrito
 *
 * @param {HTMLElement} tileEl — El botón del producto presionado
 * @param {string}      color  — Color de fondo del producto
 */
function animAddToCart(tileEl, color) {
  if (!tileEl || !tileEl.isConnected) return;
  const rect   = tileEl.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  // Ripple — usa tamaño relativo al tile, no sobredimensionado
  const ripple = document.createElement('div');
  const sz     = Math.max(rect.width, rect.height);

  ripple.style.cssText =
    'position:absolute;border-radius:50%;background:rgba(255,255,255,0.3);pointer-events:none;' +
    'transform:scale(0);animation:_ripple 0.45s ease-out forwards;' +
    'width:' + sz + 'px;height:' + sz + 'px;' +
    'left:' + ((rect.width - sz) / 2) + 'px;' +
    'top:'  + ((rect.height - sz) / 2) + 'px;';

  // El .ptile ya tiene position:relative + overflow:hidden en CSS
  tileEl.appendChild(ripple);
  setTimeout(() => { if (ripple.parentNode) ripple.remove(); }, 500);

  const badge = document.querySelector('.tbadge');
  if (!badge) return;

  const bRect = badge.getBoundingClientRect();
  const card  = document.createElement('div');
  const pname = tileEl.querySelector('.pname');

  card.style.cssText =
    'position:fixed;z-index:9999;pointer-events:none;border-radius:10px;' +
    'display:flex;align-items:flex-end;padding:6px 8px;overflow:hidden;' +
    'font-size:11px;font-weight:800;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.7);' +
    'background:' + color + ';' +
    'left:' + rect.left + 'px;top:' + rect.top + 'px;' +
    'width:' + rect.width + 'px;height:' + rect.height + 'px;' +
    'transition:left .38s cubic-bezier(.4,0,.2,1),top .35s cubic-bezier(.4,0,.2,1),' +
    'width .38s cubic-bezier(.4,0,.2,1),height .38s cubic-bezier(.4,0,.2,1),' +
    'opacity .38s ease,border-radius .38s ease;';

  card.textContent = pname ? pname.textContent.substring(0, 18) : '';
  document.body.appendChild(card);

  requestAnimationFrame(() => requestAnimationFrame(() => {
    const s = 28;
    card.style.left         = (bRect.left + bRect.width / 2 - s / 2) + 'px';
    card.style.top          = (bRect.top  + bRect.height / 2 - s / 2) + 'px';
    card.style.width        = s + 'px';
    card.style.height       = s + 'px';
    card.style.opacity      = '0';
    card.style.borderRadius = '50%';
    card.style.fontSize     = '0';
  }));

  setTimeout(() => {
    card.remove();
    badge.style.transform  = 'scale(1.6)';
    badge.style.transition = 'transform .15s ease';
    setTimeout(() => { badge.style.transform = 'scale(1)'; }, 150);
  }, 400);
}

// ── TEMA CLARO / OSCURO ──────────────────────────────────────

/**
 * Alterna entre tema claro y oscuro y guarda la preferencia.
 */
var _ICO_MOON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
var _ICO_SUN  = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next    = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('pos_theme', next);
  const btn = document.getElementById('themeToggleBtn');
  if (btn) btn.innerHTML = next === 'dark' ? _ICO_MOON : _ICO_SUN;
}

/**
 * Aplica el tema guardado en localStorage al iniciar la app.
 * Llamar lo antes posible para evitar el flash de tema incorrecto.
 */
function applyTheme() {
  const saved = localStorage.getItem('pos_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  const btn = document.getElementById('themeToggleBtn');
  if (btn) btn.innerHTML = saved === 'dark' ? _ICO_MOON : _ICO_SUN;
}
