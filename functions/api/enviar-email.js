// Proxy server-side hacia nodo-mailer (Worker centralizado de email de NODO).
// La api_key (env.MAILER_KEY) vive como secret de Cloudflare Pages -- nunca
// en el frontend. Ver Documents/GitHub/nodo-mailer/DOCUMENTACION.md seccion 4.
// Cargar el secret una vez: npx wrangler pages secret put MAILER_KEY --project-name=mi-pos-android6
export async function onRequestPost({ request, env }) {
  try {
    const { cliente_id, to, subject, html, text, attachments } = await request.json();

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
