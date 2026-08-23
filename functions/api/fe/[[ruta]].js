// ── Proxy FacturaSend ──
// Reenvía /api/fe/<ruta> → <baseUrl>/<tenantId>/<ruta>
// El browser NO habla directo con FacturaSend (CORS + mixed content si el
// server FE es http:// + no exponer la URL real).
// Credenciales: el cliente manda sus propios tenantId/apiKey en headers
// X-FE-Tenant y X-FE-ApiKey (config del negocio, ver js/factura-electronica.js).
// Servidor: por defecto la nube (api.facturasend.com.py); para un FacturaSend
// self-hosted el cliente manda X-FE-BaseUrl (ej: http://207.244.255.146:85/api).
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

  // Base URL: nube por defecto, o servidor FacturaSend propio (self-hosted).
  // Este endpoint no tiene modelo de sesión server-verificable (mismo motivo
  // que enviar-email.js, ver memoria project_nodo_mailer) -- cualquiera que
  // encuentre esta URL puede mandar X-FE-BaseUrl con CUALQUIER host y usar
  // esta Function como proxy/relay hacia donde sea (SSRF / open proxy), no
  // solo hacia el FacturaSend real del negocio. No hay forma de cerrar esto
  // del todo sin un modelo de auth que esta app no tiene, pero se bloquean
  // los destinos obviamente internos/de loopback (rangos privados, localhost,
  // metadata de nube) -- el mismo criterio "acotar el abuso más grosero sin
  // tocar el uso real" ya aplicado en enviar-email.js. Un FacturaSend
  // self-hosted real siempre es una IP/dominio público (ver ejemplo en el
  // comentario de arriba: 207.244.255.146), nunca localhost ni un rango
  // privado, así que esto no rompe ningún caso legítimo.
  let base = FE_API_BASE;
  const baseHdr = (request.headers.get('X-FE-BaseUrl') || '').trim().replace(/\/+$/, '');
  if (baseHdr) {
    if (!/^https?:\/\/[\w.-]+(:\d+)?(\/[\w./-]*)?$/.test(baseHdr)) {
      return json({ success: false, error: 'X-FE-BaseUrl inválida' }, 400);
    }
    let baseUrl;
    try { baseUrl = new URL(baseHdr); } catch { return json({ success: false, error: 'X-FE-BaseUrl inválida' }, 400); }
    const host = baseUrl.hostname.toLowerCase();
    const esPrivado =
      host === 'localhost' || host === '0.0.0.0' ||
      host === '169.254.169.254' || // metadata de nube (AWS/GCP/Azure/etc.)
      /^127\./.test(host) || /^10\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      /^192\.168\./.test(host) || /^169\.254\./.test(host) ||
      host === '::1' || host.startsWith('fc') || host.startsWith('fd') ||
      host.startsWith('fe80');
    if (esPrivado) {
      return json({ success: false, error: 'X-FE-BaseUrl no puede apuntar a una red privada/local' }, 400);
    }
    base = baseHdr;
  }

  // params.ruta es el catch-all [[ruta]]: array de segmentos
  const ruta = Array.isArray(params.ruta) ? params.ruta.join('/') : (params.ruta || '');
  const qs = new URL(request.url).search;
  const target = base + '/' + tenant + '/' + ruta + qs;

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
