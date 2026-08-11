# Columnas inferidas — 10 tablas MVP (SUPERADO, ver docs/fase0-inventario.md)

**Este documento quedó obsoleto el 2026-08-10** — las 11 tablas MVP ya están confirmadas contra el schema real de Supabase en `src/schema.js` y `d1-migrations/0001_init_mvp.sql`, que son la fuente de verdad ahora. Se deja este archivo solo como referencia histórica del borrador original; no usarlo para nada nuevo.

Reconstruido por grep de payloads (`supaPost`/`supaPatch`), filtros de query string y lecturas `row.campo` en `js/*.js` y `super-admin.html`. Confianza: **alta** (aparece en INSERT/UPDATE) / **media** (solo en filtro o `select=`) / **baja** (solo lectura, nunca escrito por este código). Cualquier columna con confianza media/baja lleva comentario `-- validar` en el DDL de `0001_init_mvp.sql`.

## licencias (tenant: es la tabla raíz del tenant)
id·serial·NOT NULL · clave·text·NOT NULL,único · plan_id·int·NOT NULL,default 2 · nombre_cliente·text·null · email_cliente·text·NOT NULL · fecha_vence·date·NOT NULL · notas·text·null · rubro·text·null(legacy) · tipo_pago·text·default 'anual' · tipo_negocio·text·default 'gastronomia' · capacidades·jsonb→TEXT·null · monto·numeric·null · monto_soporte·numeric·null · precio_terminal·numeric·null · activa·bool·default true · created_at·timestamptz→TEXT·default now()

> Nota explícita hallada en `js/licencia.js:608`: `licencias` NO tiene `nombre_negocio` (vive en `activaciones`).

## activaciones (tenant: licencia_id numérico)
id·serial·NOT NULL · device_id·text·NOT NULL · email·text·NOT NULL · licencia_id·int·NOT NULL(FK licencias.id) · nombre_negocio·text·null · nombre_terminal·text·null,default 'Terminal 1' · sucursal·text·null · modo·text·default 'caja' · activa·bool·default true · fecha_activacion·timestamptz→TEXT·default now() · ultima_consulta·timestamptz→TEXT·null · deleted_at·timestamptz→TEXT·null(soft delete, filtrado `is.null`)

## pos_config (tenant: licencia_email; clave-valor genérica)
id·serial·NOT NULL · licencia_email·text·NOT NULL · clave·text·NOT NULL · valor·text(JSON string)·NOT NULL · UNIQUE(licencia_email, clave) — confirmado por `on_conflict=licencia_email,clave`

## pos_categorias (tenant: licencia_email)
id·int·NOT NULL(sin autoincrement server-side, frontend calcula max(id)+1) · nombre·text·NOT NULL · color·text·default '#546e7a' · licencia_email·text·NOT NULL · activa·bool·default true · updated_at·timestamptz→TEXT·enviado siempre por la app

## pos_productos (tenant: licencia_email — la tabla más grande)
id·int·NOT NULL(sin autoincrement server-side) · nombre·text·NOT NULL · precio·numeric·default 0 · precio_variable·bool·default false · costo·numeric·default 0 · codigo·text·null · codigos·text(JSON array)·null · categoria·text·default 'Sin categoría' · iva·text·default '10' · color·text·default '#546e7a' · color_propio·bool·default false · mitad·bool·default false · inventario·bool·default false · comanda·bool·default false · es_kilo·bool·default false · es_favorito·bool·default false · es_insumo·bool·default false · activo·bool·default true · imagen·text·null -- validar (¿mismo campo que foto_url?) · foto_url·text·null -- validar · licencia_email·text·NOT NULL · updated_at·timestamptz→TEXT·enviado siempre · stock·numeric·null -- validar (confianza baja) · stock_min·numeric·null -- validar (confianza baja)

## pos_ventas (tenant: licencia_email)
id·serial·NOT NULL · fecha·timestamptz→TEXT·NOT NULL · turno_id·int·null(FK pos_turno.id) · terminal·text·null · sucursal·text·null,default 'Principal' · licencia_email·text·NOT NULL · total·numeric·default 0 · metodo_pago·text·NOT NULL · comprobante·text·null · items·text(JSON array)·NOT NULL · div_pagos·text(JSON)·null · mm_pagos·text(JSON)·null · pix_mp_pagos·text(JSON)·null · cliente_nombre·text·null · tiene_factura·bool·default false · factura_ruc·text·default '' · factura_nombre·text·default '' · anulada·bool·default false · fecha_anulacion·timestamptz→TEXT·null · motivo_anulacion·text(500)·null · fe_numero·text·null · fe_cdc·text·null · fe_qr·text·null · fe_estado·text·null · fe_respuesta·text·null · fe_error·text(300)·null · fe_fecha_emision·timestamptz→TEXT·null -- validar (confianza baja) · fe_nc_cdc·text·null · fe_nc_numero·text·null · fe_nc_estado·text·null

## pos_turno (tenant: licencia_email)
id·serial·NOT NULL · fecha_apertura·timestamptz→TEXT·NOT NULL · fecha_cierre·timestamptz→TEXT·null · efectivo_inicial·numeric·default 0 · efectivo_inicial_brl·numeric·default 0 · estado·text·NOT NULL('abierto'/'cerrado') · terminal·text·NOT NULL · licencia_email·text·NOT NULL · total_contado·numeric·null · diferencia·numeric·null · total_vendido·numeric·null · total_egresos·numeric·null · cantidad_ventas·numeric·null · resumen_pagos·text(JSON)·null

## pos_mesas (tenant: licencia_id numérico — distinto del resto)
id·serial·NOT NULL · salon_id·int·NOT NULL(FK pos_salones.id) · licencia_id·int·NOT NULL(FK licencias.id) · sucursal_id·int·null(FK sucursales.id) · nombre·text·NOT NULL · capacidad·int·default 4 · activo·bool·default true -- validar · orden·int·null -- validar

> Nota: el estado ocupado/libre de una mesa NO es columna propia — se deriva cruzando con `pos_pedidos` pendientes en el frontend. No agregar columna.

## pos_salones (tenant: licencia_id numérico)
id·serial·NOT NULL · licencia_id·int·NOT NULL(FK licencias.id) · sucursal_id·int·null(FK sucursales.id) · nombre·text·NOT NULL · color·text·null · activo·bool·default true · orden·int·null -- validar

## sucursales (tenant: licencia_id numérico — cobertura más débil, mayormente vía RPC crear_sucursal)
id·serial·NOT NULL · licencia_id·int·NOT NULL(FK licencias.id) · nombre·text·NOT NULL · direccion·text·null -- validar (visto solo como parámetro `p_direccion` de la RPC) · activa·bool·default true · created_at·timestamptz→TEXT·null -- validar

---

Regla de traducción de tipos aplicada en el DDL: `jsonb`→`TEXT` (todo se serializa/deserializa a mano en el cliente, sin operadores JSON de PostgREST), `timestamptz`→`TEXT` ISO8601 (SQLite no tiene tipo fecha nativo; UTC normalizado por el Worker), `gen_random_uuid()`/autoincrement de Postgres → `INTEGER PRIMARY KEY AUTOINCREMENT` de SQLite para PKs numéricas (D1 lo soporta nativo, no hace falta `crypto.randomUUID()` para estas — se reserva para IDs que el código actual ya trata como opacos, si los hubiera).
