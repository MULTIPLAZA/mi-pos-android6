const CACHE = 'ampersand-superadmin-v20260705-redesign';

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
  // mipos-gateway (backend D1, workers.dev): mismo motivo documentado en
  // sw.js/sw-admin.js -- si el Worker esta caido y este SW intercepta, el
  // .catch() de mas abajo devolvia el HTML de la app (status 200) en vez de
  // un error de red real, y el SDK que espera JSON explota con un
  // SyntaxError no reconocido como reintentable.
  //
  // ANTES esta condicion era una ALLOWLIST invertida (solo interceptaba si
  // el host CONTENIA workers.dev/pages.dev/localhost) -- interceptaba
  // workers.dev (el bug de arriba) y ademas dejaba de aplicar el fetch
  // no-store por completo si el sitio se sirve desde un dominio propio (no
  // *.pages.dev). Ahora es una denylist (igual que sw.js/sw-admin.js):
  // excluye lo conocido externo, intercepta todo lo demas.
  if (url.hostname.includes('workers.dev')) return;

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
