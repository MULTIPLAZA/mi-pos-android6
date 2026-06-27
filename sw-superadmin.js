const CACHE = 'ampersand-superadmin-v20260602-retail';

const ASSETS = [
  '/super-admin.html',
  '/manifest-superadmin.json',
  '/icon.png',
  '/icon-192.png',
  '/js/config.js',
  // ARCH-001: modulos ESM (sustituyen a js/nodo-ico.js y esc inline)
  '/js/lib/index.mjs',
  '/js/lib/icons.mjs',
  '/js/lib/escape.mjs',
  '/js/lib/log.mjs',
  '/js/lib/format.mjs',
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

  // {cache:'no-store'}: el SW va siempre al servidor, nunca a la caché HTTP
  // del navegador. La Cache Storage queda solo como fallback offline.
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
          .then(cached => cached || caches.match('/super-admin.html'))
      )
  );
});
