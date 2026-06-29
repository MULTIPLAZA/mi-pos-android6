export async function onRequestPost(context) {
  try {
    const body = await context.request.text();
    const response = await fetch('https://apisql-proxy.multitechmulti727.workers.dev/sql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://mi-pos-android6.pages.dev',
      },
      body: body,
    });
    const text = await response.text();
    return new Response(text, {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'proxy error', detail: err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
