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
| 99 | `99_SEGURIDAD_rls_hardening_...` | Cierra el acceso abierto de la base | ⚠️ **NO ejecutar solo — leer abajo** |

## Importante — orden vs. deploy del código

Los archivos **01 y 02** deben ejecutarse **ANTES** de que el código que los usa quede activo:
- El código de la Nota de Crédito ya está deployado → ejecutá **01** cuando puedas.
- El código de `venta_uuid` **todavía no está cableado** — primero ejecutá **02**, después avisame y activo esa pieza en el POS.

Los **03–06** se ejecutan cuando arranquemos el desarrollo de barbería / super-admin (el código todavía no existe).

## ⚠️ Archivo 99 — Seguridad (RLS)

**NO lo ejecutes por tu cuenta.** Activar las reglas de acceso (RLS) **rompe la app en producción** si no se migra antes a autenticación real de Supabase — tus clientes que están facturando dejarían de poder leer sus datos.

Es el arreglo más importante de seguridad (hoy la base está abierta a cualquiera con la clave pública), pero requiere:
1. Migrar el login a Supabase Auth real.
2. Probar en un entorno de prueba.
3. Coordinar un horario de corte.

Lo hacemos juntos en una sesión dedicada. El archivo está acá solo como referencia de lo que se va a aplicar.

---
Generado el 03/07/2026. Ante cualquier error de un script, mandámelo y lo reviso.
