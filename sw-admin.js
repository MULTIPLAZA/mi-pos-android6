const CACHE = 'ampersand-admin-v20260823-cache-no-store';

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
  // mipos-gateway (backend D1 para tenants Cloudflare, js/config.js
  // GATEWAY_URL, usado por admin-negocio.html vía rubro.js/backendBaseUrl()
  // para tenants Cloudflare-nativos): mismo motivo que ya documenta sw.js --
  // si el Worker esta caido/inalcanzable y este SW intercepta, el .catch() de
  // mas abajo caia a caches.match('/admin-negocio.html') y devolvia el HTML
  // de la app (status 200) en vez de un error de red real. supaGet()/
  // supaPost() esperan JSON y hacen r.json() sobre eso -- explota con un
  // SyntaxError que ningun _esErrorReintentar() del codigo sabe reconocer
  // como reintentable, asi que el item queda marcado como error permanente
  // en vez de encolado.
  //
  // ANTES esta condicion era una ALLOWLIST invertida (solo interceptaba si
  // el host CONTENIA workers.dev/pages.dev/localhost) -- eso interceptaba
  // workers.dev (el bug de arriba) y ADEMAS dejaba de aplicar el fetch
  // no-store por completo si el sitio alguna vez se sirve desde un dominio
  // propio (no *.pages.dev): admin-negocio.html volveria a depender de la
  // cache HTTP normal del navegador, exactamente lo que este SW existe para
  // evitar. Ahora es una denylist (igual que sw.js): excluye lo conocido
  // externo, intercepta TODO lo demas -- mismo origen sin importar el dominio,
  // y sin capturar el Worker.
  if (url.hostname.includes('workers.dev')) return;

  // {cache:'no-store'}: el SW va siempre al servidor, nunca a la caché HTTP
  // del navegador -- mismo fix que ya tienen sw.js y sw-superadmin.js. Sin
  // esto, admin-negocio.html (el panel de finanzas/precios/IVA, el de mayor
  // riesgo si sirve una version vieja) dependia de la cache HTTP normal del
  // navegador para decidir si revalidar, en vez de ir siempre a la red
  // mientras haya conexion.
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
          .then(cached => cached || caches.match('/admin-negocio.html'))
      )
  );
});
