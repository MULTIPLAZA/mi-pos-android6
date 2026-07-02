const CACHE = 'ampersand-admin-v20260702-facturasend-anulacion';

const ASSETS = [
  '/admin-negocio.html',
  '/manifest-admin.json',
  '/icon.png',
  '/icon-192.png',
  '/css/admin.css',
  '/js/config.js',
  // ARCH-001: modulos ESM (sustituyen a js/nodo-ico.js y esc inline)
  '/js/lib/index.mjs',
  '/js/lib/icons.mjs',
  '/js/lib/escape.mjs',
  '/js/lib/log.mjs',
  '/js/lib/format.mjs',
  '/js/admin-dashboard.js',
  // Lazy-loaded (PERF-001): siguen pre-cacheados para offline pero no se cargan en el initial parse
  '/js/admin-productos.js',
  '/js/admin-inventario.js',
  '/js/admin-finanzas.js',
  '/js/admin-fe.js',
  '/js/admin-tutoriales.js',
  '/js/factura-electronica.js',
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
  if (!url.hostname.includes('workers.dev') &&
      !url.hostname.includes('pages.dev') &&
      !url.hostname.includes('localhost')) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() =>
        caches.match(e.request)
          .then(cached => cached || caches.match('/admin-negocio.html'))
      )
  );
});
