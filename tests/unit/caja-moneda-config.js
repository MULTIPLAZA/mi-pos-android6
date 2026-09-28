// Prueba del respaldo en servidor de los ajustes de caja (caja_doble_moneda / caja_moneda_principal),
// js/app.js: cajaMonedaSubirSupabase / cajaMonedaAplicarRemoto + su cableado en sincronizarConfigNegocio.
// Extrae el codigo REAL de app.js y lo corre contra un pos_config simulado -- nunca toca Supabase.
// Uso: node tests/unit/caja-moneda-config.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const CRLF = String.fromCharCode(13, 10), LF = String.fromCharCode(10);
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'app.js'), 'utf8').split(CRLF).join(LF);

function cortar(desde, hasta) {
  const a = src.indexOf(desde), b = src.indexOf(hasta, a + 1);
  if (a < 0 || b < 0) throw new Error('marcadores no encontrados: ' + desde + ' .. ' + hasta);
  return src.slice(a, b);
}
const bloqueSync = cortar('async function sincronizarConfigNegocio(){', 'function renderGeneralInfo(){');
const bloqueCaja = cortar('function hospGuardarCajaMonedaBRL(){', 'function saveGeneralConfig(){');

// pos_config simulado: filas { licencia_email, clave, valor }
function makeEnv(opts = {}) {
  const store = {};
  const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const db = opts.rows ? JSON.parse(JSON.stringify(opts.rows)) : [];
  const posts = [], toasts = [];
  const checks = { cfgCajaDobleMoneda: { checked: false }, cfgCajaMonedaBRL: { checked: false } };
  const ctx = {
    console, JSON, Promise, String, Object, Math,
    localStorage: ls, USAR_DEMO: false, configData: {}, _log() {},
    toast: m => toasts.push(m),
    document: { getElementById: id => checks[id] || null },
    supaGet: async (tabla, q) => {
      if (opts.offline) throw new Error('offline');
      if (tabla !== 'pos_config') return [];
      const m = /clave=eq\.([^&]+)/.exec(q); const inn = /clave=in\.\(([^)]*)\)/.exec(q);
      const claves = m ? [decodeURIComponent(m[1])] : inn ? inn[1].split(',') : [];
      return db.filter(r => claves.includes(r.clave));
    },
    supaPost: async (tabla, payload) => {
      if (opts.offline) throw new Error('offline');
      posts.push(JSON.parse(JSON.stringify(payload)));
      const i = db.findIndex(r => r.clave === payload.clave && r.licencia_email === payload.licencia_email);
      if (i >= 0) db[i] = payload; else db.push(payload);
    },
    cargarTimbradoSesion() {},
  };
  ctx.window = ctx;
  ls.setItem('lic_email', 'hotel@x.com'); ls.setItem('pos_terminal', opts.terminal || 'RECEPCION');
  if (opts.local) Object.entries(opts.local).forEach(([k, v]) => ls.setItem(k, v));
  vm.createContext(ctx);
  vm.runInContext(bloqueCaja + '\n' + bloqueSync + '\n;this.__api={cajaMonedaSubirSupabase,cajaMonedaAplicarRemoto,sincronizarConfigNegocio,hospGuardarCajaDobleMoneda,hospGuardarCajaMonedaBRL,_cajaMonedaLocal};', ctx);
  return { ctx, store, db, posts, toasts, checks, api: ctx.__api };
}
const fila = (mapa) => ({ licencia_email: 'hotel@x.com', clave: 'caja_moneda_config', valor: JSON.stringify(mapa) });
const tick = () => new Promise(r => setTimeout(r, 5));
let fails = 0;
function check(nombre, cond, extra = '') { console.log((cond ? 'OK   ' : 'FALLA') + ' - ' + nombre + (extra ? '  ' + extra : '')); if (!cond) fails++; }

(async () => {
  // 1) Caso Hotel Nico: el navegador perdio el storage -> se restaura desde el servidor
  { const e = makeEnv({ rows: [fila({ RECEPCION: { doble: '1', principal: 'GS' } })] });
    e.api.cajaMonedaAplicarRemoto({ RECEPCION: { doble: '1', principal: 'GS' } });
    check('1. storage vacio + servidor con ajuste: se restaura doble=1', e.store.caja_doble_moneda === '1' && e.store.caja_moneda_principal === 'GS');
    check('1b. avisa con un toast', e.toasts.length === 1);
  }
  // 2) Restauracion via sincronizarConfigNegocio completa (arranque real, junto a negocio_config)
  { const e = makeEnv({ rows: [
      { licencia_email: 'hotel@x.com', clave: 'negocio_config', valor: JSON.stringify({ an: 'NICO PALACE' }) },
      fila({ RECEPCION: { doble: '1', principal: 'GS' }, BAR: { doble: '0', principal: 'GS' } })] });
    await e.api.sincronizarConfigNegocio();
    check('2. arranque completo: restaura los ajustes de RECEPCION (no los de BAR)', e.store.caja_doble_moneda === '1');
  }
  // 3) El dispositivo tiene el ajuste y el servidor no -> se respalda
  { const e = makeEnv({ local: { caja_doble_moneda: '1', caja_moneda_principal: 'GS' } });
    await e.api.sincronizarConfigNegocio(); await tick();
    check('3. dispositivo con ajuste, servidor vacio: se sube', e.posts.length === 1 && JSON.parse(e.posts[0].valor).RECEPCION.doble === '1');
  }
  // 4) Igual en ambos lados -> no escribe nada
  { const e = makeEnv({ local: { caja_doble_moneda: '1', caja_moneda_principal: 'GS' }, rows: [fila({ RECEPCION: { doble: '1', principal: 'GS' } })] });
    await e.api.sincronizarConfigNegocio(); await tick();
    check('4. iguales: no hay escritura', e.posts.length === 0);
  }
  // 5) Manda el dispositivo: si difiere, gana el local (eleccion deliberada) y NO se pisa con el servidor
  { const e = makeEnv({ local: { caja_doble_moneda: '0', caja_moneda_principal: 'GS' }, rows: [fila({ RECEPCION: { doble: '1', principal: 'GS' } })] });
    await e.api.sincronizarConfigNegocio(); await tick();
    check('5. local apagado a proposito: se conserva y se sube', e.store.caja_doble_moneda === '0' && JSON.parse(e.posts[0].valor).RECEPCION.doble === '0');
  }
  // 6) Al subir, no pisa las otras terminales del negocio
  { const e = makeEnv({ local: { caja_doble_moneda: '1', caja_moneda_principal: 'GS' }, rows: [fila({ BAR: { doble: '0', principal: 'BRL' } })] });
    await e.api.cajaMonedaSubirSupabase();
    const mapa = JSON.parse(e.posts[0].valor);
    check('6. conserva la entrada de BAR y agrega RECEPCION', mapa.BAR.principal === 'BRL' && mapa.RECEPCION.doble === '1');
  }
  // 7) Sin ajuste en ningun lado -> no hace nada (no inventa valores)
  { const e = makeEnv({});
    await e.api.sincronizarConfigNegocio(); await tick();
    check('7. nada en ningun lado: no escribe ni restaura', e.posts.length === 0 && e.store.caja_doble_moneda === undefined);
  }
  // 8) Servidor tiene ajustes solo de OTRA terminal -> esta no hereda nada
  { const e = makeEnv({ terminal: 'BAR', rows: [fila({ RECEPCION: { doble: '1', principal: 'GS' } })] });
    e.api.cajaMonedaAplicarRemoto({ RECEPCION: { doble: '1', principal: 'GS' } });
    check('8. terminal BAR no hereda el ajuste de RECEPCION', e.store.caja_doble_moneda === undefined);
  }
  // 9) Sin red al subir: no lanza, queda local
  { const e = makeEnv({ offline: true, local: { caja_doble_moneda: '1' } });
    let lanzo = false; try { await e.api.cajaMonedaSubirSupabase(); } catch (x) { lanzo = true; }
    check('9. sin red: no lanza y el ajuste local sigue', !lanzo && e.store.caja_doble_moneda === '1');
  }
  // 10) Tocar el interruptor sube el cambio
  { const e = makeEnv({});
    e.checks.cfgCajaDobleMoneda.checked = true;
    e.api.hospGuardarCajaDobleMoneda(); await tick();
    check('10. activar el interruptor lo guarda local y en el servidor', e.store.caja_doble_moneda === '1' && e.posts.length === 1 && JSON.parse(e.posts[0].valor).RECEPCION.doble === '1');
  }
  // 11) Activar "Declarar en Reales" apaga dos monedas y sube AMBOS valores
  { const e = makeEnv({ local: { caja_doble_moneda: '1', caja_moneda_principal: 'GS' } });
    e.checks.cfgCajaMonedaBRL.checked = true; e.checks.cfgCajaDobleMoneda.checked = true;
    e.api.hospGuardarCajaMonedaBRL(); await tick();
    const v = JSON.parse(e.posts[0].valor).RECEPCION;
    check('11. exclusion mutua: sube principal=BRL y doble=0', v.principal === 'BRL' && v.doble === '0', JSON.stringify(v));
  }
  console.log(fails ? '\n' + fails + ' FALLAS' : '\nTODO OK'); process.exit(fails ? 1 : 0);
})();
