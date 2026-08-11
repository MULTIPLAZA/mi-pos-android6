# Runbook — mipos-gateway (pasos que solo puede correr el dueño)

No tengo credenciales de Cloudflare ni de la Supabase real de producción, así que estos pasos quedan para vos. Ejecutar en orden — cada uno es chico y reversible.

## 0. Schema — CERRADO (2026-08-10)

Las 11 tablas MVP están confirmadas contra `information_schema.columns` real de Supabase. `0001_init_mvp.sql` ya no tiene nada marcado BORRADOR — se puede pasar directo al paso 2.

## 1. Instalar wrangler y loguearte

```
cd workers/mipos-gateway
npm install
npx wrangler login
```

## 2. Crear la D1 y correr la migración (una sola vez)

```
npx wrangler d1 create mipos_cf
```

Copiá el `database_id` que te devuelve y pegalo en `wrangler.toml` (reemplazando `PENDIENTE-completar-tras-wrangler-d1-create`). Después:

```
npm run d1:migrate:local    # probar primero en local
npm run d1:migrate:remote   # recién cuando estés conforme, aplica contra la D1 real
```

## 3. Cargar los secrets (nunca van en wrangler.toml ni se commitean)

```
npx wrangler secret put TOKEN_SECRET
npx wrangler secret put SUPA_URL
npx wrangler secret put SUPA_ANON
npx wrangler secret put ADMIN_SECRET
```

- `TOKEN_SECRET`: cualquier string largo random (ej. `openssl rand -hex 32`). Es la clave HMAC que firma los tokens de activación.
- `SUPA_URL`: `https://kmreiniqgcvqgdtzvmel.supabase.co`
- `SUPA_ANON`: la anon key actual (la que hoy está hardcodeada en `js/config.js`). Queda solo en el Worker, nunca más expuesta al cliente para tenants nuevos.
- `ADMIN_SECRET`: otro string largo random, **distinto** de `TOKEN_SECRET`. Autentica a `super-admin.html` (que crea licencias nuevas, una operación admin-only, no de un tenant) — nunca se lo des a un dispositivo cliente. Hay que pegarlo también en `super-admin.html` (buscar `GWADMIN_KEY` cerca de `SURL`/`SKEY`) tras el deploy.

## 4. Deploy en modo "solo vos" (Fase 5, paso 1 del plan)

```
npm run deploy
```

Esto te da una URL tipo `https://mipos-gateway.<tu-cuenta>.workers.dev`. **No cambies `js/config.js` todavía.** Probá manualmente contra esa URL (Postman/curl/Playwright apuntado a esa URL) antes de que cualquier dispositivo real la use.

Rollback si algo sale mal: `npx wrangler rollback` (versión anterior en segundos) o `npx wrangler deployments list` para ver el historial.

Ver logs en vivo durante cualquier prueba: `npm run tail`.

## 5. Smoke test manual sugerido (antes de crear el primer cliente real)

1. `POST /rest/v1/rpc/activar_licencia` con una clave que insertaste a mano en la `licencias` de D1 (vía `wrangler d1 execute mipos_cf --remote --command "INSERT INTO licencias (...) VALUES (...)"`) → debe devolver `{ok:true, token, backend:'cloudflare'}`.
2. Con ese token en `Authorization: Bearer <token>`, `GET /rest/v1/pos_productos` → debe devolver `[]` (tabla vacía, tenant nuevo).
3. `POST /rest/v1/pos_productos` con un producto de prueba → confirmar que `licencia_email`/`licencia_id` quedó igual al del token, sin importar qué mandaste en el body.
4. Probar a propósito un request malformado: una columna que no existe (`GET /rest/v1/pos_productos?columna_trucha=eq.1`) → debe devolver 400, no 500 ni datos.
5. Recién ahí seguir con la Fase 3 (cablear `js/config.js`) y, más adelante, el primer cliente piloto real desde `super-admin.html`.

## Pendiente conocido antes de un piloto real

- `avanzar_correlativo` y `descontar_stock_venta` (en `src/rpc.js`) están sin implementar — tiran 501 a propósito. Hace falta leer la función Postgres original en Supabase Studio → Database → Functions para replicar el comportamiento exacto antes de que un cliente Cloudflare las necesite (número de comprobante y descuento de stock son datos financieros, no vale la pena adivinar).
- Solo están las 11 tablas MVP — si el primer cliente piloto necesita hospedaje, stock, factura electrónica avanzada, gastos, créditos o modificadores de producto, esas tablas todavía no existen en D1 (ver `docs/fase0-inventario.md` para la lista completa de 33 tablas usadas por el POS).
- Fotos de producto (Supabase Storage) y el lookup de `contribuyentes` (RUC) siguen yendo a Supabase para todos los tenants a propósito — ver el addendum en `docs/fase0-inventario.md`.
