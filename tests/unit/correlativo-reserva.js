// Prueba de la reserva atomica del correlativo de factura (js/turno.js reservarNroFactura + js/cobro.js cargarTimbradoSesion).
// Extrae el codigo REAL de esos archivos y lo corre contra un servidor de correlativos simulado -- nunca toca Supabase.
// Uso: node tests/unit/correlativo-reserva.js
const fs = require('fs'), vm = require('vm');
const root = require('path').join(__dirname, '..', '..', 'js') + '/';
const CRLF = String.fromCharCode(13, 10), LF = String.fromCharCode(10);
const turno = fs.readFileSync(root+'turno.js','utf8').split(CRLF).join(LF);
const cobro = fs.readFileSync(root+'cobro.js','utf8').split(CRLF).join(LF);
const a = turno.indexOf('async function avanzarNroFactura(timbrado){');
const b = turno.indexOf('// PERSISTENCIA DE TURNO EN localStorage');
if(a<0||b<0) throw new Error('marcadores turno.js no encontrados');
const turnoBlock = turno.slice(a, b).replace(/\/\/ ═+\s*$/,'');
const c = cobro.indexOf('async function cargarTimbradoSesion() {');
const d = cobro.indexOf('/**\n * ¿Este timbrado (no electrónico) está dentro');
if(c<0||d<0) throw new Error('marcadores cobro.js no encontrados');
const cobroBlock = cobro.slice(c, d);

// Servidor simulado: contador atómico por (email,terminal). RPC devuelve el PRÓXIMO.
function makeServer(start){ return { n: start, rpcCalls: 0, get next(){return this.n;} }; }

function makeClient(server, opts={}){
  const store = {};
  const ls = { getItem:k=>k in store?store[k]:null, setItem:(k,v)=>{store[k]=String(v)}, removeItem:k=>{delete store[k]} };
  const ctx = {
    console, setTimeout, clearTimeout, Promise, JSON, Math, parseInt, String, Number, Date,
    localStorage: ls,
    navigator: { onLine: true },
    USAR_DEMO: false,
    window: {},
    _log(){},
    usaGateway: ()=> !!opts.gateway,
    getNroFactura: t=>t.nro_actual,
    timbradoSession: null,
    supaRPC: async (fn, p)=>{
      if(opts.offline) throw new Error('offline');
      if(opts.hang) return new Promise(()=>{});
      if(fn==='avanzar_correlativo'){ await new Promise(r=>setTimeout(r, opts.latency||1)); server.rpcCalls++; server.n += 1; return { ok:true, nro_actual: server.n }; }
      if(fn==='get_timbrado_terminal'){ return { nro:'18987861', tipo:'autoimpresor', sucursal:1, punto_exp:2, nro_actual: server.n }; }
    },
  };
  ctx.window = ctx;
  ls.setItem('lic_email','hotel@x.com'); ls.setItem('pos_terminal', opts.terminal||'RECEPCION');
  vm.createContext(ctx);
  vm.runInContext(turnoBlock + '\n' + cobroBlock + '\n;this.__api={reservarNroFactura,avanzarNroFactura,cargarTimbradoSesion,_corrPendLeer,_setNroActualLocal,getTimbradoActivo:()=>window._timbradoCache};', ctx);
  ctx.__setTimeout = ms => vm.runInContext('_CORR_RESERVA_TIMEOUT_MS='+ms, ctx);
  return ctx;
}
let fails = 0;
function check(name, cond, extra=''){ console.log((cond?'OK   ':'FALLA')+' - '+name+(extra?'  '+extra:'')); if(!cond) fails++; }

(async()=>{
  // 1) Dos terminales/sesiones reservando a la vez -> números distintos y consecutivos
  { const S = makeServer(63); // próximo a usar: 63
    const A = makeClient(S,{terminal:'RECEPCION'}), B = makeClient(S,{terminal:'RECEPCION'});
    const tim = {nro:'18987861', punto_exp:2, sucursal:1};
    const r = await Promise.all([A.__api.reservarNroFactura(tim), B.__api.reservarNroFactura(tim), A.__api.reservarNroFactura(tim), B.__api.reservarNroFactura(tim)]);
    const s = [...r].sort((x,y)=>x-y);
    check('1. 4 reservas simultáneas de 2 sesiones: sin repetidos', new Set(r).size===4, JSON.stringify(s));
    check('1b. arrancan en el 63 y son consecutivas', s[0]===63 && s[3]===66, JSON.stringify(s));
    check('1c. servidor queda en 67', S.n===67, 'n='+S.n);
  }
  // 2) Caso Hotel Nico: la reserva usa el del servidor aunque el caché local esté viejo
  { const S = makeServer(64);
    const A = makeClient(S); A.window._timbradoCache = {nro:'18987861',punto_exp:2,nro_actual:56};
    const n = await A.__api.reservarNroFactura(A.window._timbradoCache);
    check('2. caché viejo (56) ignorado: reserva 64 del servidor', n===64, 'n='+n);
  }
  // 3) Offline: la venta sale con el caché, queda pendiente; al volver la red no se repite
  { const S = makeServer(100);
    const off = {offline:true}; const A = makeClient(S, off);
    A.window._timbradoCache = {nro:'18987861',punto_exp:2,sucursal:1,nro_actual:100};
    const tim = A.window._timbradoCache;
    const r1 = await A.__api.reservarNroFactura(tim);        // offline -> null
    check('3a. sin red: reserva devuelve null (cae al caché)', r1===null);
    const impreso1 = tim.nro_actual;                          // 100 (número impreso offline)
    await A.__api.avanzarNroFactura(tim);                     // RPC falla -> pendiente
    check('3b. avance offline queda pendiente (1)', A.__api._corrPendLeer('RECEPCION')===1);
    // vuelve la red
    off.offline=false; A.navigator.onLine = true;
    await A.__api.cargarTimbradoSesion();                     // servidor dice 100 (no recibió nada)
    check('3c. refresco NO baja el caché: 100 + 1 pendiente = 101', A.window._timbradoCache.nro_actual===101, 'cache='+A.window._timbradoCache.nro_actual);
    const r2 = await A.__api.reservarNroFactura(A.window._timbradoCache);
    check('3d. próxima factura reservada = 101 (distinta de la impresa offline: 100)', r2===101 && r2!==impreso1, 'r2='+r2);
    check('3e. pendiente repuesto y servidor en 102', A.__api._corrPendLeer('RECEPCION')===0 && S.n===102, 'n='+S.n);
  }
  // 4) Servidor colgado -> vence el timeout y cae al caché (no bloquea el cobro)
  { const S = makeServer(10); const A = makeClient(S,{hang:true}); A.__setTimeout(50);
    const t0=Date.now(); const n = await A.__api.reservarNroFactura({nro:'1',punto_exp:1});
    check('4. servidor colgado: null en < 1s (no bloquea el cobro)', n===null && Date.now()-t0<1000, (Date.now()-t0)+'ms');
  }
  // 5) Tenant Cloudflare/D1: no reserva (comportamiento anterior intacto)
  { const S = makeServer(10); const A = makeClient(S,{gateway:true});
    const n = await A.__api.reservarNroFactura({nro:'1',punto_exp:1});
    check('5. gateway D1: null y sin llamadas al servidor', n===null && S.rpcCalls===0);
    A.window._timbradoCache={nro:'1',punto_exp:1,nro_actual:5}; A.navigator.onLine=false;
  }
  // 6) Secuencia normal de 5 facturas seguidas en una sola terminal
  { const S = makeServer(200); const A = makeClient(S); const tim={nro:'1',punto_exp:2}; const out=[];
    for(let i=0;i<5;i++) out.push(await A.__api.reservarNroFactura(tim));
    check('6. 5 facturas seguidas: 200..204 sin saltos', JSON.stringify(out)==='[200,201,202,203,204]', JSON.stringify(out));
  }
  console.log(fails? '\n'+fails+' FALLAS':'\nTODO OK'); process.exit(fails?1:0);
})();
