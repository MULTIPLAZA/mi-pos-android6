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
