# Runbook — mipos-gateway (pasos que solo puede correr el dueño)

No tengo credenciales de Cloudflare ni de la Supabase real de producción, así que estos pasos quedan para vos. Ejecutar en orden — cada uno es chico y reversible.

## 0. Schema — CERRADO (2026-08-10)

Las 11 tablas MVP están confirmadas contra `information_schema.columns` real de Supabase. `0001_init_mvp.sql` ya no tiene nada marcado BORRADOR — se puede pasar directo al paso 2.

## 1. Instalar wrangler y loguearte — HECHO (2026-08-10)

## 2. Crear la D1 y correr la migración — HECHO (2026-08-10)

D1 `mipos_cf` creada en Cloudflare (region ENAM), `database_id` ya cargado en `wrangler.toml`. Migración `0001_init_mvp.sql` aplicada tanto local (`--local`) como remota (`--remote`) — 11 tablas creadas en la D1 real, 0 errores.

Nota: `wrangler` quedó en la versión 3.114.17 (avisa que hay 4.x disponible) — no se actualizó todavía, no es bloqueante.

## 3. Cargar los secrets — HECHO (2026-08-10)

Los 4 secrets (`TOKEN_SECRET`, `SUPA_URL`, `SUPA_ANON`, `ADMIN_SECRET`) ya están cargados en el Worker `mipos-gateway` de Cloudflare — nunca tocaron git, no están en ningún archivo del repo. `TOKEN_SECRET` y `ADMIN_SECRET` se generaron random (`openssl rand -hex 32`), distintos entre sí.

**Importante — este repo es público en GitHub.** Por eso `super-admin.html` NO tiene el `ADMIN_SECRET` hardcodeado: la primera vez que uses el panel te va a pedir la clave con un `prompt()` y la guarda en el `localStorage` de tu navegador (clave `gw_admin_key`), nunca en el código fuente. **Guardá vos el valor del `ADMIN_SECRET`** (el que generó esta sesión) en tu gestor de contraseñas — si lo perdés, hay que rotarlo con `wrangler secret put ADMIN_SECRET` de nuevo y volver a ingresarlo en el panel (`localStorage.removeItem('gw_admin_key')` para que te lo vuelva a pedir).

Si en el futuro rotás algún secret, corré de nuevo el `wrangler secret put <NOMBRE>` correspondiente — sobreescribe sin downtime.

## 4. Deploy en modo "solo vos" (Fase 5, paso 1 del plan)

```
npm run deploy
```

**Deployado 2026-08-10**: `https://mipos-gateway.multitechmulti727.workers.dev` (Version ID `d4a5bd3f-4549-45d9-8ab6-9a0891aad9b6`). Coincide con el valor que ya estaba en `GATEWAY_URL` (`js/config.js`) — no hizo falta tocar ese archivo.

Rollback si algo sale mal: `npx wrangler rollback` (versión anterior en segundos) o `npx wrangler deployments list` para ver el historial.

Ver logs en vivo durante cualquier prueba: `npm run tail`.

## 5. Smoke test — HECHO (2026-08-10)

Corrido contra el Worker real, con una licencia de prueba (`TEST-SMOKE-0001`) insertada y borrada de la D1 remota al terminar:

1. Sin token → 401. Tabla no soportada → 501. Ruta inválida → 404. Alta admin sin `X-Admin-Key` → 401.
2. `activar_licencia` con la clave de prueba → `{ok:true, token, backend:'cloudflare', ...}`.
3. Con ese token, `GET pos_productos` → `[]` (tenant nuevo, vacío).
4. `POST pos_productos` mandando a propósito `licencia_email` de OTRO tenant en el body → el Worker lo ignoró e insertó con el tenant real del token.
5. `GET pos_productos?licencia_email=eq.otro@ajeno.com` (filtro trucho) → mismo resultado que sin filtro, confirma que también se ignora en las lecturas.
6. `GET pos_productos?columna_trucha=eq.1` → 400, no 500 ni datos.

Los 6 checks pasaron. **Recién ahora** conviene seguir con: cablear `js/config.js` al fleet completo (Fase 3, ya hecha en el código — falta el *ship* real vía el flujo normal de actualización de la PWA) y, más adelante, crear el primer cliente piloto real desde `super-admin.html`.

## Pendiente conocido antes de un piloto real

- `avanzar_correlativo` ya está implementado (2026-08-21, ver `d1-migrations/0003_correlativos.sql` + `src/rpc.js`) — tabla `correlativos` scopeada a `(licencia_id, terminal)`, upsert atómico con `INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING` (verificado en vivo contra D1 real, incrementa correctamente y no depende de un catálogo de timbrados que el MVP todavía no tiene). Si más adelante se agrega un catálogo de timbrados propio para Cloudflare, evaluar si el contador necesita scopearse también por `timbrado_id`.
- `descontar_stock_venta` (en `src/rpc.js`) sigue sin implementar — tira 501 a propósito. Investigado 2026-08-21 (`js/turno.js:319` `stockDescontarVenta`): es mucho más grande de lo que parecía — NO es un simple `pos_productos.stock -= cantidad`, es todo el módulo de inventario (tablas `stock`, `stock_comprobantes`, `stock_comprobante_items`, concepto de `deposito_id`/`sucursal_id`), ninguna de esas tablas existe en D1 todavía. Buena noticia: el cliente YA tiene un fallback no-atómico si la RPC falla (upsert directo a `stock` por producto, ver `turno.js:397-410`), así que un tenant Cloudflare con productos con `inventario=true` no se rompe del todo hoy, solo pierde la atomicidad. Implementar bien esto requiere portar el módulo de stock completo a D1 (migración nueva con las 3 tablas + RPC atómica con `db.batch()`), no es tarea de una sola pasada — separar en su propio ciclo de trabajo.
- Solo están las 11 tablas MVP — si el primer cliente piloto necesita hospedaje, stock, factura electrónica avanzada, gastos, créditos o modificadores de producto, esas tablas todavía no existen en D1 (ver `docs/fase0-inventario.md` para la lista completa de 33 tablas usadas por el POS).
- Fotos de producto (Supabase Storage) y el lookup de `contribuyentes` (RUC) siguen yendo a Supabase para todos los tenants a propósito — ver el addendum en `docs/fase0-inventario.md`.
