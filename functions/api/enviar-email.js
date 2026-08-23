// Proxy server-side hacia nodo-mailer (Worker centralizado de email de NODO).
// La api_key (env.MAILER_KEY) vive como secret de Cloudflare Pages -- nunca
// en el frontend. Ver Documents/GitHub/nodo-mailer/DOCUMENTACION.md seccion 4.
// Cargar el secret una vez: npx wrangler pages secret put MAILER_KEY --project-name=mi-pos-android6
// Validación de forma: este endpoint no verifica quién llama (no hay un
// modelo de sesión server-verificable en esta app -- ver memoria
// project_nodo_mailer, addendum 2026-08-23), así que cualquiera que
// encuentre esta URL puede mandar un POST directo y usar el MAILER_KEY real
// para enviar como sistema MIPOS. Esto NO cierra ese hueco de fondo (eso
// requiere un modelo de auth que esta app no tiene), pero sí evita que se
// use este endpoint para mandar a destinos/payloads que el flujo legítimo
// (rg90Enviar en admin-finanzas.js, único caller: 1 destinatario, adjuntos
// chicos) nunca produciría -- acota el abuso más grosero (spam masivo,
// payloads gigantes) sin tocar el uso real.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_TEXT_LEN = 200000; // 200KB para subject+html+text combinados
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_B64 = 8000000; // ~8MB en base64 por adjunto

export async function onRequestPost({ request, env }) {
  try {
    const { cliente_id, to, subject, html, text, attachments } = await request.json();

    if (typeof to !== 'string' || !EMAIL_RE.test(to)) {
      return new Response(JSON.stringify({ ok: false, error: 'destinatario invalido' }), {
        status: 400, headers: { 'content-type': 'application/json' },
      });
    }
    const textoTotal = String(subject || '').length + String(html || '').length + String(text || '').length;
    if (textoTotal > MAX_TEXT_LEN) {
      return new Response(JSON.stringify({ ok: false, error: 'contenido demasiado grande' }), {
        status: 400, headers: { 'content-type': 'application/json' },
      });
    }
    if (attachments !== undefined) {
      if (!Array.isArray(attachments) || attachments.length > MAX_ATTACHMENTS) {
        return new Response(JSON.stringify({ ok: false, error: 'adjuntos invalidos' }), {
          status: 400, headers: { 'content-type': 'application/json' },
        });
      }
      for (const a of attachments) {
        if (!a || typeof a.filename !== 'string' || typeof a.content !== 'string' || a.content.length > MAX_ATTACHMENT_B64) {
          return new Response(JSON.stringify({ ok: false, error: 'adjunto invalido' }), {
            status: 400, headers: { 'content-type': 'application/json' },
          });
        }
      }
    }

    const resp = await fetch('https://nodo-mailer.multitechmulti727.workers.dev/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.MAILER_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ sistema: 'MIPOS', cliente_id, to, subject, html, text, attachments }),
    });

    const text2 = await resp.text();
    return new Response(text2, { status: resp.status, headers: { 'content-type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: 'proxy error: ' + err.message }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }
}
