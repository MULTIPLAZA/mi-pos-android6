# Fase 0 — Inventario de alcance (Supabase → Cloudflare, solo clientes nuevos)

Generado por grep exhaustivo sobre `js/*.js` (19 archivos, 203 llamadas a `supaGet/supaPost/supaPatch/supaDelete/supaRPC`). Este documento es la fuente de verdad del alcance del shim del Worker — no adivinar operadores/tablas fuera de esta lista sin volver a grep-ear.

## Operadores PostgREST usados (confirmado, nada más que esto)

| Operador | Ocurrencias | Nota |
|---|---|---|
| `eq.` | 288 | igualdad |
| `ilike.` | 72 | case-insensitive LIKE, casi siempre sobre `licencia_email` |
| `in.` | 32 | lista de valores |
| `gte.` | 27 | rango (fechas, montos) |
| `lte.` | 25 | rango |
| `is.` | 25 | `is.null` / `is.true` / `is.false` |
| `lt.` | 2 | |
| `like.` | 2 | case-sensitive |

**No usado en ningún lado (confirmado):** `neq.`, `gt.`, `cs.`, `cd.`, filtro compuesto `or=(...)`, embeds anidados (`select=*,tabla(...)`) — estos últimos SÍ existen en `super-admin.html` (fuera del alcance del shim v1, ver plan).

Modificadores de query confirmados: `select=` (columnas planas, sin embeds), `order=col.asc|desc`, `limit=`, `on_conflict=` (upsert), headers `Prefer: resolution=merge-duplicates,return=minimal|representation`.

## Funciones RPC usadas (`supaRPC(...)`) — 6 en total

| Función | Dónde | Uso |
|---|---|---|
| `activar_licencia` | `js/licencia.js:210` | Activación de dispositivo nuevo (clave+email+device_id → token/estado) |
| `verificar_licencia` | `js/licencia.js:248,385` | Chequeo periódico de vigencia |
| `actualizar_activacion` | `js/licencia.js:917` | Actualiza datos de una activación existente |
| `crear_sucursal` | `js/licencia.js:937` | Alta de sucursal nueva |
| `avanzar_correlativo` | `js/turno.js:70` | **Requiere atomicidad** — correlativo secuencial de comprobante, riesgo de duplicados si no es atómico |
| `descontar_stock_venta` | `js/turno.js:382` | **Requiere atomicidad** — descuento de stock al vender, riesgo de inconsistencia si no es atómico |

Las dos últimas son candidatas obligatorias a lógica server-side en el Worker (no pasan por el shim genérico) — usar `db.batch()` de D1 para envolver sus escrituras.

## Tablas usadas (33 confirmadas por grep de `supaGet/supaPost/supaPatch/supaDelete`)

```
activaciones, depositos, gasto_categorias, gasto_conceptos, gastos, iva_liquidaciones,
licencias, pos_categorias, pos_config, pos_cred_clientes, pos_cred_fiado, pos_egresos,
pos_estadias, pos_habitaciones, pos_huespedes, pos_ingresos, pos_mesas,
pos_modificador_opciones, pos_modificadores, pos_pedidos, pos_producto_modificadores,
pos_productos, pos_salones, pos_turno, pos_ventas, stock, stock_comprobante_items,
stock_comprobantes, stock_conteo_items, stock_conteos, stock_movimientos, sucursales,
timbrado_terminales, timbrados
```

De estas, **8 tienen `CREATE TABLE` real versionado** en `supabase-migrations/` (fuente confiable): `pos_pedidos`, `pos_habitaciones`, `pos_estadias`, `pos_huespedes` (hospedaje), `pos_citas`/`pos_profesionales` (barbería, no listadas arriba porque no aparecen en `js/` del POS todavía), `pos_egresos`/`pos_ingresos`, `super_admins`.

**Las 25 tablas restantes (incluidas TODAS las core: `licencias`, `activaciones`, `pos_productos`, `pos_ventas`, `pos_turno`, `pos_categorias`, `pos_config`, `pos_mesas`, `pos_salones`, `sucursales`, stock, timbrados, gastos, créditos) NO tienen schema versionado en el repo** — fueron creadas directo en el dashboard de Supabase. El archivo `columnas-inferidas-core.md` (mismo directorio) reconstruye un borrador best-effort de columnas para las 10 tablas MVP a partir del uso real en JS, pero **no es autoritativo**.

## Hallazgo crítico: la clave de tenant NO es uniforme

La mayoría de las tablas operativas del POS (`pos_productos`, `pos_ventas`, `pos_turno`, `pos_categorias`, `pos_config`, `licencias`) filtran por **`licencia_email` (texto)**. Pero `pos_mesas`, `pos_salones` y `sucursales` filtran por **`licencia_id` (numérico, FK a `licencias.id`)**. Esta inconsistencia es real en el código actual (no un error de lectura) y el plan ya la contemplaba a alto nivel; el ajuste concreto es que el **Worker debe conocer, por tabla, cuál es la columna de tenant y de qué tipo es**, e inyectar el valor correcto desde el token (que debe llevar tanto `licencia_id` como `licencia_email`, ya que en Supabase están 1:1 vía la tabla `licencias`).

## Addendum — hallazgos durante la implementación (no estaban en el grep inicial)

- **`supaFetch(method, tabla, body, params, prefer)`** en `js/sync.js:540` es un 6to helper genérico (además de los 5 de `config.js`) usado 12 veces en `sync.js`, `productos.js` y `licencia.js` — crítico porque es el motor de la cola de sync offline. Ya está corregido para ser backend-aware (mismo patrón que los otros 5).
- `pos_pedidos` tiene 2 POST directos con `fetch()` crudo en `js/pedidos.js` (líneas ~184 y ~692) que no pasaban por ningún helper — corregidos también.
- `pos_pedidos` **sí tiene** `CREATE TABLE` real y confiable en `supabase-migrations/pos_pedidos_setup.sql` (a diferencia de las demás tablas MVP) — se agregó a `d1-migrations/0001_init_mvp.sql` con su PK UUID traducida a `TEXT` (generada por el Worker con `crypto.randomUUID()`).
- `js/credito.js` (`pos_cred_clientes`, `pos_cred_fiado`) tenía 2 lecturas directas con `fetch()` crudo — corregidas.
- **Dejados sin tocar a propósito** (siguen yendo directo a Supabase para TODOS los tenants, incluidos los cloudflare):
  - `js/cobro.js` — RPC `get_timbrado_terminal` y tabla `contribuyentes` (registro RUC, sin filtro de tenant — parece dato compartido/global, no por-licencia; no migrar sin confirmar con el dueño).
  - `js/admin-productos.js:917` — URL de Supabase **Storage** (fotos de producto). D1 no tiene equivalente; migrar fotos requeriría Cloudflare R2, fuera del alcance de esta migración de base de datos.
  - `js/app.js` (paneles de diagnóstico/configuración, líneas ~169, ~761-764, ~904-916) — muestran URL/latencia de Supabase a modo informativo; cosmético, no mueve datos de negocio.

## Estado del schema real (actualizado 2026-08-10)

El usuario corrió la query de abajo en Supabase Studio y pasó el CSV. **Confirmadas contra el schema real:** `licencias`, `activaciones`, `pos_config`, `pos_categorias`, `pos_productos`, `pos_mesas`, `pos_pedidos` — ya reflejadas en `src/schema.js` y `d1-migrations/0001_init_mvp.sql`. Hubo varias diferencias reales contra el borrador original (ver comentarios en esos dos archivos): `pos_categorias` NO tiene columna `activa`, `pos_productos` tiene columnas que no estaban en el borrador (`item_libre`, `terminal`, `deleted_at`, `es_descuento`, `desc_tipo`, `desc_valor`) y NO tiene `stock`/`stock_min`, `licencias.email_cliente` es nullable (no NOT NULL como se asumía), etc.

**`pos_salones` quedó confirmada solo hasta la columna `activo`** — el export se cortó ahí, puede faltarle `orden` u otra columna (`pos_mesas` sí tiene `orden`, es razonable que `pos_salones` también). **`pos_turno`, `pos_ventas` y `sucursales` siguen siendo BORRADOR** — el export se cortó antes de llegar a ellas (corte alfabético justo después de `pos_salones`).

### Acción pendiente del usuario

Correr esta query acotada (o la misma de siempre completa, prestando atención a que Supabase Studio a veces trunca el preview/export a 100 filas) y pasar el resultado:

```sql
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('pos_salones','pos_turno','pos_ventas','sucursales')
order by table_name, ordinal_position;
```

Hasta entonces, esas 3 tablas (y el resto de `pos_salones`) quedan marcadas BORRADOR en `d1-migrations/0001_init_mvp.sql` — no aplicar a un D1 real sin confirmarlas.
