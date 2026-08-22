# RLS en Supabase — plan para sesión dedicada

Informe preparado a pedido del usuario (loop de auditoría, 2026-08-22) para arrancar
una sesión dedicada a este tema. No ejecutar nada de esto sin acompañamiento — el
paso 1 rompe el acceso de todos los clientes actuales si se hace mal.

## El problema (confirmado en vivo)

Row Level Security está desactivado en TODAS las tablas de negocio de Supabase
(`licencias`, `pos_ventas`, `pos_turno`, `activaciones`, `stock`, etc). Confirmado
con un curl 100% anónimo (sin login, solo la anon key pública que está en
`js/config.js`):

```
curl "https://kmreiniqgcvqgdtzvmel.supabase.co/rest/v1/licencias?select=id&limit=1" \
  -H "apikey: <anon key>" -H "Authorization: Bearer <anon key>"
→ [{"id":3}]
```

Cualquiera que copie la anon key del bundle JS (trivial, es pública) puede leer o
escribir la tabla completa de licencias (email, clave, plan, monto...) y el resto
de las tablas de negocio de TODOS los clientes. Ver memoria
`project_mipos_supabase_rls_desactivado` para el detalle completo.

## Por qué no se puede activar RLS tal cual

El SQL ya escrito (`_EJECUTAR_EN_SUPABASE/99_SEGURIDAD_rls_hardening_NO_EJECUTAR_SOLO.sql`)
usa policies basadas en `auth.jwt() ->> 'email'` — necesitan que el cliente esté
autenticado con **Supabase Auth real** (sesión con `access_token`), no solo con la
anon key + un email de query string como hace la app hoy.

Hoy, TODO el login de la app (`admin-negocio.html doLogin()`, `js/licencia.js`,
super-admin.html) es: consultar `licencias?clave=eq.X` directo con la anon key, sin
crear ninguna sesión de Supabase Auth. Activar RLS sin este paso previo bloquea el
acceso de todos los clientes el mismo día.

## Qué necesita la migración, concretamente

### 1. Provisionar cuentas de Supabase Auth para las licencias existentes
- **21 licencias activas hoy** (confirmado con `Prefer: count=exact` sobre
  `licencias?activa=eq.true`) — universo chico, migración manual o script único es
  viable, no hace falta un proceso masivo.
- Cada licencia tiene `email_cliente`. Hay que crear un usuario de Supabase Auth por
  cada una (`supabase.auth.admin.createUser` desde un script con la service_role
  key, o a mano desde el dashboard). Definir la contraseña: ¿la propia `clave` de
  licencia? ¿una generada y comunicada aparte? Esto es una decisión de producto, no
  solo técnica — afecta qué le pedimos al cliente que tipee para loguearse.
- Nuevas licencias (dadas de alta después de la migración) necesitan este paso
  agregado a `super-admin.html guardarL()`.

### 2. Cambiar el flujo de login para crear una sesión real
- Hoy `doLogin()` (`admin-negocio.html`) y la activación de licencia.js consultan
  `licencias?clave=eq.X` directo.
- Después de validar la clave, hay que llamar al endpoint de Auth de Supabase
  (`POST /auth/v1/token?grant_type=password` con `email` + la contraseña definida en
  el paso 1) para obtener un `access_token` + `refresh_token` reales.
- Guardar esos tokens (localStorage, mismo lugar donde hoy vive `lic_token`) y
  manejar refresh (el `access_token` expira, típicamente 1 hora — hay que renovarlo
  con el `refresh_token` antes de que expire, o interceptar 401 y renovar ahí).
- **No hay que inventar este patrón: ya existe y funciona en `super-admin.html`**
  (`saSignIn`, `saRefrescarToken`, `_saFetch`, `_saAutoLogin` — agregado/endurecido
  2026-08-22, commit `a555efa`, incluye manejo de refresh ante 401). Es la mejor
  plantilla de partida para el login principal del POS en vez de escribir el flujo
  de Auth desde cero.

### 3. Usar el token de sesión en vez de la anon key para las requests autenticadas
- **Punto de cambio centralizado, buena noticia:** todas las requests pasan por
  `supaHeaders()`/`backendHeaders()` en `js/config.js` (una sola función). Ahí es
  donde hoy se arma `Authorization: Bearer <SUPA_ANON>` — cambiarlo a
  `Authorization: Bearer <access_token de la sesión>` cuando existe sesión, con
  fallback a la anon key para lo que deba seguir siendo público (ninguna tabla de
  negocio debería quedar así, pero puede haber alguna consulta intencionalmente
  pública que haya que revisar caso por caso).
- Esto significa que la mayoría de las ~200 llamadas `supaGet/supaPost/supaPatch`
  repartidas por todo `js/*.js` **no necesitan tocarse una por una** — heredan el
  cambio automáticamente vía el helper central. El trabajo real está en los pasos 1
  y 2, no en reescribir queries.

### 4. Validar `get_my_licencia_id()` y aplicar RLS de a poco
- Ya está escrito en el SQL de referencia. Probar primero con UN usuario real y UNA
  tabla poco crítica (`plan_gastos_categorias`, sugerido en el propio archivo).
- Verificar que las policies no rompen ningún flujo donde el filtro por
  `licencia_email`/`licencia_id` en la query string difiera de lo que resuelve
  `get_my_licencia_id()` — por ejemplo, `admin-dashboard.js` u otras pantallas que un
  super-admin usa para ver datos de OTROS tenants (la policy actual solo contempla
  `is_super_admin()` para eso — confirmar que existe esa función y que el rol
  super-admin real la cumple).
- Recién ahí aplicar al resto de las tablas (lista completa ya en el archivo SQL).

### 5. Caso aparte: `mipos-gateway` (Cloudflare D1)
No usa Supabase en absoluto — su propio esquema D1 y su propio token HMAC. No se ve
afectado por esta migración; queda fuera de este plan.

## Riesgos a tener presentes
- Si un cliente cambia de dispositivo/borra localStorage, pierde la sesión de Auth
  y necesita volver a loguearse — igual que hoy pierde `lic_token`, pero ahora
  también hay que re-autenticar contra Supabase Auth, no solo re-consultar
  `licencias`. Revisar que el flujo de reactivación (`limpiarCacheTenantAnterior()`,
  `doActivar`) contemple esto.
- El `refresh_token` mal manejado (no renovado a tiempo) puede dejar una terminal
  sin poder sincronizar en medio de un turno — mismo tipo de incidente que Hotel
  Nico/Bodemarket pero por token vencido en vez de por bug de sync. Vale la pena
  loguear/alertar visiblemente cuando el refresh falla, no solo reintentar en
  silencio.
- Decidir la contraseña del paso 1 con cuidado: si se usa la `clave` de licencia
  tal cual, seguimos con el mismo problema de baja entropía (ver
  `project_mipos_gateway_activacion_bruteforce`) pero ahora contra el endpoint de
  Auth de Supabase en vez de contra `licencias` directo — Supabase Auth sí tiene
  rate-limiting nativo en su endpoint de password grant, así que esto mejora la
  situación igual, pero no está de más generar una contraseña separada más fuerte
  si el esfuerzo lo permite.

## Alternativa más acotada (si migrar a Auth es demasiado por ahora)
El propio archivo SQL lo sugiere como plan B: mantener el modelo de login actual
(sin Supabase Auth) y en su lugar mover las operaciones sensibles a RPCs de Postgres
`SECURITY DEFINER` que validen el `licencia_id` server-side a partir de un parámetro
firmado (no simplemente confiado del query string). Mitiga el problema sin tocar
todo el modelo de login, a costa de reescribir cada operación como una RPC en vez de
un REST directo — más acotado pero también más trabajo de reescritura de queries que
la opción de Auth (que centraliza el cambio en `supaHeaders()`).
