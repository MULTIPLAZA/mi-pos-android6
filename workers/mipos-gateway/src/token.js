// Token de activacion firmado con HMAC-SHA256 (Web Crypto, nativo del runtime Workers).
// Formato: base64url(payload_json) + '.' + base64url(firma). No es JWT estandar (no
// hace falta la complejidad de header/alg negociable) pero el patron es el mismo.
// El payload lleva SIEMPRE licencia_id + email + backend: el Worker inyecta estos
// valores server-side en cada query, nunca confia lo que venga del cliente.

function b64urlEncode(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/').padEnd(str.length + (4 - (str.length % 4)) % 4, '=');
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

// payload: { lid: number, em: string, be: 'cloudflare'|'supabase', did: string, exp: number(epoch seconds) }
export async function signToken(payload, secret) {
  const key = await hmacKey(secret);
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const sigBytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, payloadBytes));
  return `${b64urlEncode(payloadBytes)}.${b64urlEncode(sigBytes)}`;
}

// Devuelve el payload validado, o null si la firma no matchea / esta vencido / esta mal formado.
export async function verifyToken(token, secret) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [p, s] = token.split('.');
  if (!p || !s) return null;
  let payloadBytes;
  try {
    payloadBytes = b64urlDecode(p);
  } catch {
    return null;
  }
  const key = await hmacKey(secret);
  const ok = await crypto.subtle.verify('HMAC', key, b64urlDecode(s), payloadBytes);
  if (!ok) return null;
  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(payloadBytes));
  } catch {
    return null;
  }
  if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}
