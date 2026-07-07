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
| 13 | `13_ventas_mm_pagos.sql` | Campos `mm_pagos`/`pix_mp_pagos` en `pos_ventas` (desglose real Gs/R$/ARS/USD de un pago simple en Multi-moneda o Pix/MP) | **URGENTE — sin esto, las ventas cobradas en reales se pierden al cerrar/reabrir la app** |
| 99 | `99_SEGURIDAD_rls_hardening_...` | Cierra el acceso abierto de la base | ⚠️ **NO ejecutar solo — leer abajo** |

## Importante — orden vs. deploy del código

Los archivos **01 y 02** deben ejecutarse **ANTES** de que el código que los usa quede activo:
- El código de la Nota de Crédito ya está deployado → ejecutá **01** cuando puedas.
- El código de `venta_uuid` **todavía no está cableado** — primero ejecutá **02**, después avisame y activo esa pieza en el POS.

Los **03–06** se ejecutan cuando arranquemos el desarrollo de barbería / super-admin (el código todavía no existe).

**07 y 08 son distintos: el código del rubro Hospedaje YA ESTÁ deployado** (tablero de habitaciones, check-in, folio, check-out → cobro). Sin estas dos migraciones, cualquier licencia con rubro hotel/hospedaje/hostería no va a poder guardar nada — ejecutalas antes de asignarle ese rubro a un cliente real. Verificado con un test completo simulando toda la lógica (falta solo correr esto para que las llamadas reales a Supabase funcionen).

## ⚠️ Archivo 99 — Seguridad (RLS)

**NO lo ejecutes por tu cuenta.** Activar las reglas de acceso (RLS) **rompe la app en producción** si no se migra antes a autenticación real de Supabase — tus clientes que están facturando dejarían de poder leer sus datos.

Es el arreglo más importante de seguridad (hoy la base está abierta a cualquiera con la clave pública), pero requiere:
1. Migrar el login a Supabase Auth real.
2. Probar en un entorno de prueba.
3. Coordinar un horario de corte.

Lo hacemos juntos en una sesión dedicada. El archivo está acá solo como referencia de lo que se va a aplicar.

---
Generado el 03/07/2026. Ante cualquier error de un script, mandámelo y lo reviso.
