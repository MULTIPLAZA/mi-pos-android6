// mipos-gateway - unico endpoint que llaman los tenants Cloudflare-nativos, y punto
// de bootstrap para activar_licencia/verificar_licencia de CUALQUIER tenant (ver nota
// mas abajo). Los tenants Supabase ya activados NUNCA pasan por aca para su trafico
// normal (CRUD) - eso sigue yendo directo a Supabase desde js/config.js, sin cambios.
// Ver workers/mipos-gateway/docs/fase0-inventario.md para el alcance exacto del shim.

import { TABLES, isSupportedTable } from './schema.js';
import { runSelect, runInsert, runUpdate, runDelete, ShimError } from './postgrestShim.js';
import { verifyToken } from './token.js';
import { passthroughRest, passthroughRpc } from './supabasePassthrough.js';
import { RPC_HANDLERS, activarLicencia, verificarLicencia } from './rpc.js';

// activar_licencia y verificar_licencia son el UNICO caso donde un tenant 'supabase'
// puede llegar a pasar por este Worker: un dispositivo recien instalado no tiene
// todavia guardado ningun flag de backend localmente, asi que licencia.js siempre le
// pega a este Worker para esas dos llamadas puntuales. El Worker busca la clave/device
// primero en D1 (tenant nuevo); si no esta, hace passthrough al RPC real de Supabase y
// le inyecta backend:'supabase' a la respuesta para que el dispositivo se entere y a
// partir de ahi (para TODO el resto de su trafico, incluidas futuras verificar_licencia)
// vaya directo a Supabase sin pasar mas por aca.
const BOOTSTRAP_RPCS = new Set(['activar_licencia', 'verificar_licencia']);

function log(env, entry) {
  // console.log queda visible via `wrangler tail` durante el piloto (ver docs/RUNBOOK.md).
  console.log(JSON.stringify({ t: new Date().toISOString(), ...entry }));
}

// Sin esto, TODA llamada desde el navegador (super-admin.html, index.html del POS) falla
// con "Failed to fetch" - el browser bloquea la respuesta (y el preflight OPTIONS) por
// falta de headers CORS, aunque el Worker haya contestado bien. curl/Postman no lo
// detectan porque no aplican CORS - por eso pasó desapercibido en los smoke tests previos.
// '*' esta bien acá: no se usan cookies (Authorization es un header explícito, no
// credentials:'include'), así que no hace falta reflejar el Origin.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Key, Prefer',
};

// Los status 101/204/205/304 NO PUEDEN tener body - Response(bodyString, {status:204})
// tira TypeError en el runtime de Workers, aunque el bodyString sea "[]". Esto rompía
// en produccion CUALQUIER guardado con Prefer: return=minimal (POST/PATCH con
// returnMinimal) - confirmado 2026-08-11 con un simple guardado de config del negocio,
// pero afectaba a TODOS los guardados "silenciosos" (pos_config, pos_productos,
// pos_ventas, etc.) para tenants cloudflare, no solo esa pantalla.
const SIN_BODY = new Set([101, 204, 205, 304]);
function jsonResponse(body, status = 200) {
  if (SIN_BODY.has(status)) {
    return new Response(null, { status, headers: CORS_HEADERS });
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...CORS_HEADERS },
  });
}

function preferFlags(request) {
  const prefer = request.headers.get('Prefer') || '';
  return {
    minimal: prefer.includes('return=minimal'),
    merge: prefer.includes('resolution=merge-duplicates'),
  };
}

async function requireTenant(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const payload = token ? await verifyToken(token, env.TOKEN_SECRET) : null;
  if (!payload || payload.be !== 'cloudflare') return null;
  return { lid: payload.lid, em: payload.em, did: payload.did };
}

function tenantValueFor(tableDef, tenant) {
  if (!tableDef.tenant) return null;
  return tableDef.tenant.kind === 'licencia_id' ? tenant.lid : tenant.em;
}

async function handleRest(request, env, url, table) {
  if (!isSupportedTable(table)) {
    return jsonResponse({ error: `tabla no soportada en D1 todavia: ${table}` }, 501);
  }
  const tableDef = TABLES[table];
  let tenantValue = null;
  if (tableDef.tenant === null) {
    // Tabla sin proteccion de admin key a pedido explicito del dueño (2026-08-11,
    // priorizo cero friccion sobre proteccion) - la llama super-admin.html sin
    // autenticarse. RIESGO ACEPTADO: la URL de este Worker es publica (esta en el
    // codigo fuente del repo, que es publico en GitHub) - cualquiera que la encuentre
    // puede crear o modificar licencias sin restriccion. Unica mitigacion que queda:
    // el log() de cada request al final de fetch() (ver wrangler tail).
  } else {
    const tenant = await requireTenant(request, env);
    if (!tenant) return jsonResponse({ error: 'no autorizado' }, 401);
    tenantValue = tenantValueFor(tableDef, tenant);
  }
  const { minimal, merge } = preferFlags(request);

  try {
    if (request.method === 'GET') {
      const rows = await runSelect(env.DB, table, url.searchParams, tenantValue);
      return jsonResponse(rows);
    }
    if (request.method === 'POST') {
      const body = await request.json();
      const onConflictRaw = url.searchParams.get('on_conflict');
      const onConflictCols = merge && onConflictRaw ? onConflictRaw.split(',') : null;
      const rows = await runInsert(env.DB, table, body, { onConflictCols, tenantValue, returnMinimal: minimal });
      return jsonResponse(rows, minimal ? 204 : 201);
    }
    if (request.method === 'PATCH') {
      const body = await request.json();
      const rows = await runUpdate(env.DB, table, url.searchParams, body, tenantValue, { returnMinimal: minimal });
      return jsonResponse(rows, minimal ? 204 : 200);
    }
    if (request.method === 'DELETE') {
      await runDelete(env.DB, table, url.searchParams, tenantValue);
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    return jsonResponse({ error: 'metodo no soportado' }, 405);
  } catch (err) {
    if (err instanceof ShimError) return jsonResponse({ error: err.message }, err.status);
    if (String(err).includes('UNIQUE constraint failed')) {
      return jsonResponse({ error: 'ya existe un registro con ese valor unico (ej. clave duplicada)' }, 409);
    }
    log(env, { level: 'error', where: 'handleRest', table, msg: String(err) });
    return jsonResponse({ error: 'error interno' }, 500);
  }
}

async function handleRpc(request, env, fn) {
  const body = await request.json().catch(() => ({}));

  try {
    if (BOOTSTRAP_RPCS.has(fn)) {
      // Bootstrap: intenta D1 primero (tenant nuevo); si no existe, passthrough a Supabase.
      if (fn === 'activar_licencia') {
        const ip = request.headers.get('CF-Connecting-IP') || null;
        const r = await activarLicencia(env.DB, env.TOKEN_SECRET, body, ip);
        if (r.ok || r.error !== 'clave invalida o licencia inactiva') return jsonResponse(r);
      } else {
        const tenantGuess = await requireTenant(request, env);
        if (tenantGuess) {
          const r = await verificarLicencia(env.DB, env.TOKEN_SECRET, body);
          if (r.ok) return jsonResponse(r);
        }
      }
      const resp = await passthroughRpc(env, fn, { method: 'POST', headers: request.headers, body: JSON.stringify(body) });
      const data = await resp.json().catch(() => null);
      if (data && typeof data === 'object') data.backend = 'supabase';
      return jsonResponse(data, resp.status);
    }

    const tenant = await requireTenant(request, env);
    if (!tenant) return jsonResponse({ error: 'no autorizado' }, 401);
    const handler = RPC_HANDLERS[fn];
    if (!handler) return jsonResponse({ error: `rpc no soportada: ${fn}` }, 501);
    const r = await handler(env.DB, env.TOKEN_SECRET, tenant, body);
    return jsonResponse(r);
  } catch (err) {
    if (err instanceof ShimError) return jsonResponse({ error: err.message }, err.status);
    log(env, { level: 'error', where: 'handleRpc', fn, msg: String(err) });
    return jsonResponse({ error: 'error interno' }, 500);
  }
}

export default {
  async fetch(request, env, ctx) {
    const start = Date.now();
    const url = new URL(request.url);
    // Preflight CORS: el browser lo manda ANTES del POST/PATCH/DELETE real (por el
    // Content-Type/Authorization custom) y espera 2xx + headers CORS, sin body.
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    let response;
    try {
      const restMatch = url.pathname.match(/^\/rest\/v1\/([a-zA-Z_]+)$/);
      const rpcMatch = url.pathname.match(/^\/rest\/v1\/rpc\/([a-zA-Z_]+)$/);
      if (rpcMatch) {
        response = await handleRpc(request, env, rpcMatch[1]);
      } else if (restMatch) {
        response = await handleRest(request, env, url, restMatch[1]);
      } else {
        response = jsonResponse({ error: 'not found' }, 404);
      }
    } catch (err) {
      log(env, { level: 'error', where: 'fetch', msg: String(err) });
      response = jsonResponse({ error: 'error interno' }, 500);
    }
    log(env, { path: url.pathname, method: request.method, status: response.status, ms: Date.now() - start });
    return response;
  },
};
