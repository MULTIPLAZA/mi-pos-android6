export async function onRequestGet(context) {
  try {
    // Fetch BRL→PYG y ARS→PYG desde open.er-api.com (gratis, sin key)
    const [resBRL, resARS] = await Promise.all([
      fetch('https://open.er-api.com/v6/latest/BRL'),
      fetch('https://open.er-api.com/v6/latest/ARS'),
    ]);

    if (!resBRL.ok || !resARS.ok) throw new Error('API error');

    const [dataBRL, dataARS] = await Promise.all([resBRL.json(), resARS.json()]);

    const cotBRL = dataBRL.rates && dataBRL.rates.PYG ? Math.round(dataBRL.rates.PYG) : null;
    const cotARS = dataARS.rates && dataARS.rates.PYG ? parseFloat(dataARS.rates.PYG.toFixed(4)) : null;
    const fecha  = dataBRL.time_last_update_utc || new Date().toUTCString();

    return new Response(JSON.stringify({
      ok: true,
      cotBRL,
      cotARS,
      fecha,
      fuente: 'ExchangeRate-API (referencia — ajustar al tipo local)',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
