# SQL para ejecutar en Supabase

Ejecutá cada archivo en el **SQL Editor de Supabase**, en orden numérico.
Todos son idempotentes (`IF NOT EXISTS`): si ya corriste uno, volver a correrlo no rompe nada.

## Orden y estado

| # | Archivo | Qué hace | ¿Obligatorio? |
|---|---------|----------|----------------|
| 01 | `01_factura_electronica_nc.sql` | Campos `fe_nc_*` — Nota de Crédito por anulación (FE) | Sí, para anular facturas > 48hs |
| 02 | `02_venta_uuid_idempotencia.sql` | `venta_uuid` + índice único — evita ventas duplicadas en la nube | Recomendado |
| 03 | `03_barberia_es_servicio.sql` | `es_servicio` + `duracion_min` en productos | Solo si vas a usar barbería |
| 04 | `04_barberia_profesionales.sql` | Tabla `pos_profesionales` (barberos/estilistas) | Solo barbería |
| 05 | `05_barberia_citas.sql` | Tabla `pos_citas` (agenda de turnos) | Solo barbería |
| 06 | `06_superadmin_tipo_negocio.sql` | `tipo_negocio` + `capacidades` en licencias | Para el super-admin nuevo |
| 07 | `07_hospedaje_habitaciones.sql` | Tabla `pos_habitaciones` (rubro hotel/hostería) | **Sí — código ya deployado** |
| 08 | `08_hospedaje_estadias.sql` | Tabla `pos_estadias` (folio de huésped) | **Sí — código ya deployado** |
| 09 | `09_hospedaje_nacionalidad.sql` | Campo `huesped_nacionalidad` en `pos_estadias` | **Sí — código ya deployado** |
| 10 | `10_hospedaje_abonos.sql` | Campo `abonos` (pagos parciales durante la estadía) en `pos_estadias` | **Sí — código ya deployado** |
| 11 | `11_hospedaje_huespedes.sql` | Tabla `pos_huespedes` (registro de huéspedes para autocompletar check-in) | **Sí — código ya deployado** |
| 12 | `12_hospedaje_pago_anulado.sql` | Campos `pago_anulado`/`pago_anulado_fecha` en `pos_estadias` (avisa si se anula la venta de un check-out ya hecho) | **Sí — código ya deployado** |
| 13 | `13_ventas_mm_pagos.sql` | Campos `mm_pagos`/`pix_mp_pagos` en `pos_ventas` (desglose real Gs/R$/ARS/USD de un pago simple en Multi-moneda o Pix/MP) | ✅ **Confirmado ejecutada** (ver nota abajo) |
| 99 | `99_SEGURIDAD_rls_hardening_...` | Cierra el acceso abierto de la base | ⚠️ **NO ejecutar solo — leer abajo** |

## Importante — orden vs. deploy del código

Los archivos **01 y 02** deben ejecutarse **ANTES** de que el código que los usa quede activo:
- El código de la Nota de Crédito ya está deployado → ejecutá **01** cuando puedas.
- El código de `venta_uuid` **todavía no está cableado** — primero ejecutá **02**, después avisame y activo esa pieza en el POS.

Los **03–06** se ejecutan cuando arranquemos el desarrollo de barbería / super-admin (el código todavía no existe).

**07 y 08 son distintos: el código del rubro Hospedaje YA ESTÁ deployado** (tablero de habitaciones, check-in, folio, check-out → cobro). Sin estas dos migraciones, cualquier licencia con rubro hotel/hospedaje/hostería no va a poder guardar nada — ejecutalas antes de asignarle ese rubro a un cliente real. Verificado con un test completo simulando toda la lógica (falta solo correr esto para que las llamadas reales a Supabase funcionen).

## Nota sobre el archivo 13 (agregada 2026-08-23, loop de auditoría)

Esta fila decía "URGENTE — sin esto se pierden ventas" desde que se agregó
(commit `d39fd11`, 07/07/2026, el mismo día del incidente real de Hotel Nico
Palace con pagos en reales). Ese lenguaje quedó desactualizado: hay evidencia
fuerte (no una confirmación directa contra Supabase, que este repo no puede
hacer) de que la migración **ya se ejecutó** poco después — el 22/07/2026 se
generó un reporte de cierre de caja real para Hotel Nico leyendo datos reales
de `pos_ventas.mm_pagos` (campos `pagoGS`/`pagoBRL`), lo cual no sería posible
si la columna no existiera todavía. Antes de asumir que sigue pendiente (y
sobre todo antes de re-ejecutarla "por las dudas" en un ambiente donde no se
sepa con certeza), confirmar en el SQL Editor de Supabase con
`SELECT column_name FROM information_schema.columns WHERE table_name='pos_ventas' AND column_name IN ('mm_pagos','pix_mp_pagos');`
— si aparecen las 2 filas, esta migración ya corrió y esta fila de la tabla
se puede marcar como hecha.

**Confirmado 2026-08-23 (loop de auditoría, vuelta siguiente):** se hizo la
confirmación directa que faltaba, vía `curl` de solo lectura contra la REST
API pública de Supabase (`GET /rest/v1/pos_ventas?select=mm_pagos,pix_mp_pagos&limit=1`)
— devolvió una fila real (`{"mm_pagos":null,"pix_mp_pagos":null}`) en vez del
error `42703 column does not exist` que da Supabase cuando una columna no
existe. Confirma sin ambigüedad que la migración 13 ya corrió. De paso se
confirmó lo mismo para 01 (`fe_nc_cdc`/`fe_nc_numero`/`fe_nc_estado` existen)
y 07-12 (`pos_estadias`/`pos_huespedes` existen con datos reales) — todas ya
ejecutadas. La única de esta lista que sigue realmente pendiente es **02**
(`venta_uuid` — confirmado que la columna NO existe todavía, `42703`).

## ⚠️ Archivo 99 — Seguridad (RLS)

**NO lo ejecutes por tu cuenta.** Activar las reglas de acceso (RLS) **rompe la app en producción** si no se migra antes a autenticación real de Supabase — tus clientes que están facturando dejarían de poder leer sus datos.

Es el arreglo más importante de seguridad (hoy la base está abierta a cualquiera con la clave pública), pero requiere:
1. Migrar el login a Supabase Auth real.
2. Probar en un entorno de prueba.
3. Coordinar un horario de corte.

Lo hacemos juntos en una sesión dedicada. El archivo está acá solo como referencia de lo que se va a aplicar.

---
Generado el 03/07/2026. Ante cualquier error de un script, mandámelo y lo reviso.
