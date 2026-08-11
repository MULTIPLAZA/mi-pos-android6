// Proxy transparente hacia el Supabase real, para tenants backend='supabase'.
// La anon key queda retenida server-side (env.SUPA_ANON) - nunca se manda al cliente,
// a diferencia de hoy que esta hardcodeada en js/config.js. Esto es una mejora de
// seguridad de regalo, pero el comportamiento de datos es 100% identico al actual.

export async function passthroughRest(env, table, url, init) {
  const target = new URL(`/rest/v1/${table}${url.search}`, env.SUPA_URL);
  return forward(env, target, init);
}

export async function passthroughRpc(env, fn, init) {
  const target = new URL(`/rest/v1/rpc/${fn}`, env.SUPA_URL);
  return forward(env, target, init);
}

async function forward(env, target, init) {
  const headers = new Headers(init.headers);
  headers.set('apikey', env.SUPA_ANON);
  headers.set('Authorization', `Bearer ${env.SUPA_ANON}`);
  headers.delete('host');
  const resp = await fetch(target.toString(), {
    method: init.method,
    headers,
    body: init.body,
    signal: AbortSignal.timeout(30000),
  });
  return resp;
}
