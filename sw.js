const CACHE = 'ampersand-pos-v1.15.3-20260702';

const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/css/pos.css',
  '/js/config.js',
  // ARCH-001: modulo ESM (sustituye a js/nodo-ico.js y al esc() inline de state.js)
  '/js/lib/index.mjs',
  '/js/lib/icons.mjs',
  '/js/lib/escape.mjs',
  '/js/lib/log.mjs',
  '/js/lib/format.mjs',
  '/js/state.js',
  '/js/sounds.js',
  '/js/asistente.js',
  '/js/ui.js',
  '/js/ventas.js',
  '/js/cobro.js',
  '/js/pedidos.js',
  '/js/impresion.js',
  '/js/turno.js',
  '/js/productos.js',
  '/js/sync.js',
  '/js/licencia.js',
  '/js/mesas.js',
  '/js/rubro.js',
  '/js/credito.js',
  '/js/app.js',
  '/js/init.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.hostname.includes('supabase.co')) return;
  if (url.hostname.includes('jsdelivr.net')) return;
  if (url.hostname.includes('googleapis.com')) return;
  if (url.hostname.includes('cdnjs.cloudflare.com')) return;

  // Network First — {cache:'no-store'} fuerza al SW a ir SIEMPRE al servidor
  // (ignora la caché HTTP del navegador). Así nunca sirve una versión vieja
  // mientras haya red; la Cache Storage queda solo como fallback offline.
  e.respondWith(
    fetch(e.request, { cache: 'no-store' })
      .then(res => {
        if (res.ok && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() =>
        caches.match(e.request)
          .then(cached => cached || caches.match('/'))
      )
  );
});
