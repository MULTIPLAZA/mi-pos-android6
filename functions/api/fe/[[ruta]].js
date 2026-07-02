// ── Proxy FacturaSend ──
// Reenvía /api/fe/<ruta> → https://api.facturasend.com.py/<tenantId>/<ruta>
// El browser NO habla directo con FacturaSend (CORS + no exponer la URL real).
// Credenciales: el cliente manda sus propios tenantId/apiKey en headers
// X-FE-Tenant y X-FE-ApiKey (config del negocio, ver js/factura-electronica.js).
//
// Ejemplos:
//   POST /api/fe/lote/create?qr=true  → POST <api>/<tenant>/lote/create?qr=true
//   POST /api/fe/de/estado            → POST <api>/<tenant>/de/estado
//   POST /api/fe/de/pdf               → POST <api>/<tenant>/de/pdf
//   POST /api/fe/evento/cancelacion   → POST <api>/<tenant>/evento/cancelacion
//   GET  /api/fe/departamentos        → GET  <api>/<tenant>/departamentos

const FE_API_BASE = 'https://api.facturasend.com.py';

async function proxy(context) {
  const { request, params } = context;

  const tenant = request.headers.get('X-FE-Tenant');
  const apiKey = request.headers.get('X-FE-ApiKey');
  if (!tenant || !apiKey) {
    return json({ success: false, error: 'Faltan credenciales FacturaSend (X-FE-Tenant / X-FE-ApiKey)' }, 401);
  }
  // tenant va embebido en la URL destino — solo caracteres seguros
  if (!/^[\w-]+$/.test(tenant)) {
    return json({ success: false, error: 'tenantId inválido' }, 400);
  }

  // params.ruta es el catch-all [[ruta]]: array de segmentos
  const ruta = Array.isArray(params.ruta) ? params.ruta.join('/') : (params.ruta || '');
  const qs = new URL(request.url).search;
  const target = FE_API_BASE + '/' + tenant + '/' + ruta + qs;

  const init = {
    method: request.method,
    headers: {
      'Authorization': 'Bearer api_key_' + apiKey,
      'Content-Type': 'application/json; charset=utf-8',
    },
  };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.text();
  }

  try {
    const res = await fetch(target, init);
    const contentType = res.headers.get('Content-Type') || 'application/json';
    // Passthrough del body tal cual (JSON o binario PDF)
    return new Response(res.body, {
      status: res.status,
      headers: { 'Content-Type': contentType },
    });
  } catch (err) {
    return json({ success: false, error: 'FacturaSend no disponible: ' + err.message }, 502);
  }
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestGet(context)  { return proxy(context); }
export async function onRequestPost(context) { return proxy(context); }
