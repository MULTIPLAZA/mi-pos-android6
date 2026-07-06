// ── Estado global centralizado ──
// Todas las variables compartidas entre archivos viven aquí.
// Usar getters/setters para mutaciones controladas.

// ── HELPERS MIGRADOS A js/lib/ (ARCH-001) ──
// _log/_warn/_err viven en lib/log.mjs    → expuestos como window._log/_warn/_err
// escapeHtml / esc  viven en lib/escape.mjs → expuestos como window.escapeHtml/esc
// El modulo ESM lib/index.mjs los carga y los re-expone antes de DOMContentLoaded,
// asi que TODA llamada dentro de handlers (que es donde se usan) los encuentra.

// ── CART / TICKET ──
var cart = [];
var ticketDescuento = 0;
var currentTicketNro = null;
var ticketCounter = parseInt(localStorage.getItem('pos_ticket_counter')) || 0;
var tipoPedido = 'llevar';
var pendientes = [];
var showTkt = false;

// ── NUMPAD ──
var npCtx = '';
var npVal = '';

// ── SPLIT PAYMENT ──
var divPagos = [];
var divNpIdx = -1;
var divMethodIdx = -1;
var PAY_METHODS = ['Efectivo','POS','Transferencia'];

// ── MESA ──
var mesaActual = null;

// ── CLIENTE de la venta actual (nombre rapido sin RUC ni facturacion) ──
// Sirve para identificar pedidos por nombre cuando no hay mesa (delivery,
// llevar, mostrador). Se imprime debajo del nro de ticket y se guarda en
// pos_ventas.cliente_nombre.
var clienteNombre = '';

// ── MODO LECTURA ──
// Cuando se navega a una venta YA COBRADA con las flechas del header, se carga
// al cart en modo solo-lectura: items visibles pero NO se puede agregar, quitar
// o modificar. Boton COBRAR se transforma en REIMPRIMIR. Para volver a operar
// hay que apretar 'NUEVA VENTA' o navegar a otro ticket editable.
var _modoLectura = false;
var _viewingCobradaVenta = null; // referencia a la venta cobrada en visualizacion
// Snapshot del cart vivo ANTES de entrar a modo lectura. Permite que al
// navegar de vuelta con ▶ se restaure exactamente lo que la cajera tenia
// cargado (cart en curso o pendiente activo).
var _cartEnCursoSnap = null; // { cart, currentTicketNro, mesaActual, tipoPedido, clienteNombre, ticketDescuento }

// ── PRODUCTOS ──
var PRODS = [
  {id:99,name:'ÍTEM LIBRE',price:0,color:'#546e7a',cat:'Otros',
   precioVariable:true,itemLibre:true,iva:'10',colorPropio:false},
];
var curCat = 'Todos los artículos';

// ── Setters con control ──
// Cada setter permite poner logs, validaciones o eventos a futuro.

function setCart(newCart) { cart = newCart; }
function clearCart() {
  cart = [];
  // Limpiar autosave al confirmar venta o descartar carrito explicitamente
  try { localStorage.removeItem('pos_cart_autosave'); } catch(e){}
  // El nombre del cliente acompana a la venta, se borra junto con el cart
  if(typeof clienteNombre !== 'undefined') clienteNombre = '';
  // Limpiar modo lectura si estaba activo (salir de la venta cobrada visualizada)
  if(typeof _modoLectura !== 'undefined') _modoLectura = false;
  if(typeof _viewingCobradaVenta !== 'undefined') _viewingCobradaVenta = null;
}

function setTicketDescuento(val) { ticketDescuento = val; }
function resetTicketDescuento() { ticketDescuento = 0; }

function setCurrentTicketNro(val) { currentTicketNro = val; }

function setTicketCounter(val) {
  ticketCounter = val;
  localStorage.setItem('pos_ticket_counter', val);
}
function incrementTicketCounter() {
  ticketCounter++;
  localStorage.setItem('pos_ticket_counter', ticketCounter);
  return ticketCounter;
}

// setTipoPedido vive en ventas.js (tiene lógica de UI adicional)

function setPendientes(arr) { pendientes = arr; }
function addPendiente(p) { pendientes.push(p); }
function removePendiente(idx) { pendientes.splice(idx, 1); }

function setShowTkt(val) { showTkt = val; }

function setNpCtx(val) { npCtx = val; }
function setNpVal(val) { npVal = val; }

function setDivPagos(arr) { divPagos = arr; }
function clearDivPagos() { divPagos = []; divNpIdx = -1; divMethodIdx = -1; }
function setDivNpIdx(val) { divNpIdx = val; }
function setDivMethodIdx(val) { divMethodIdx = val; }

function setMesaActual(val) { mesaActual = val; }
function clearMesaActual() { mesaActual = null; }

function setClienteNombre(val) { clienteNombre = (val || '').trim(); }
function clearClienteNombre() { clienteNombre = ''; }

// ── CONFIGURACIÓN NEGOCIO ──
var configData = {
  negocio:      localStorage.getItem('an')       || 'MI NEGOCIO',
  direccion:    localStorage.getItem('ad')       || 'ASUNCION',
  ciudad:       localStorage.getItem('ciudad')   || '',
  telefono:     localStorage.getItem('at')       || '',
  ruc:          localStorage.getItem('ar')       || '',
  email:        localStorage.getItem('email_negocio') || '',
  pie_recibo:   localStorage.getItem('pie_recibo')|| '¡Gracias por su compra!',
  mostrar_ruc:  localStorage.getItem('mostrar_ruc')||'1',
  moneda:       localStorage.getItem('moneda')   || 'GS',
  terminal:     localStorage.getItem('pos_terminal')  || 'Terminal 1',
  sucursal:     localStorage.getItem('pos_sucursal')  || 'Principal',
  deposito:     localStorage.getItem('pos_deposito')  || 'Depósito Principal',
  sucursal_id:  localStorage.getItem('pos_sucursal_id') || null,
  deposito_id:  localStorage.getItem('pos_deposito_id') || null,
};

// ── IMPRESORAS ──
var printers = {
  ticket:  { type: null, name: null, device: null, size: '58' },
  comanda: { type: null, name: null, device: null, size: '58' },
};

// ── ÚLTIMO RECIBO ──
var ultimoReciboData = null;

// ── Banderitas SVG (reemplazan emoji de bandera — Windows no las
// renderiza como ícono, muestra el código de país en texto plano) ──
function _flagSvg(code, size){
  size = size || 20;
  var h = Math.round(size * 0.7);
  var common = 'width="'+size+'" height="'+h+'" viewBox="0 0 20 14" style="display:inline-block;vertical-align:middle;border-radius:2px;overflow:hidden;flex-shrink:0;"';
  var svgs = {
    PY: '<svg '+common+'><rect width="20" height="14" fill="#fff"/><rect width="20" height="4.67" fill="#d52b1e"/><rect y="9.33" width="20" height="4.67" fill="#0038a8"/></svg>',
    BR: '<svg '+common+'><rect width="20" height="14" fill="#009c3b"/><polygon points="10,1.5 18.5,7 10,12.5 1.5,7" fill="#ffdf00"/><circle cx="10" cy="7" r="3.2" fill="#002776"/></svg>',
    AR: '<svg '+common+'><rect width="20" height="14" fill="#fff"/><rect width="20" height="4.67" fill="#74acdf"/><rect y="9.33" width="20" height="4.67" fill="#74acdf"/><circle cx="10" cy="7" r="1.7" fill="#f6b40e"/></svg>',
    US: '<svg '+common+'><rect width="20" height="14" fill="#fff"/><rect width="20" height="1.08" fill="#B22234"/><rect y="2.15" width="20" height="1.08" fill="#B22234"/><rect y="4.31" width="20" height="1.08" fill="#B22234"/><rect y="6.46" width="20" height="1.08" fill="#B22234"/><rect y="8.62" width="20" height="1.08" fill="#B22234"/><rect y="10.77" width="20" height="1.08" fill="#B22234"/><rect y="12.92" width="20" height="1.08" fill="#B22234"/><rect width="8" height="7.5" fill="#3C3B6E"/></svg>',
  };
  return svgs[code] || '';
}
