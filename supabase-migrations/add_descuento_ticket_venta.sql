-- ─────────────────────────────────────────────────────────────
-- mi-pos · Trazabilidad de descuento manual en pos_ventas
--
-- CONTEXTO (hallazgo 2026-08-22, loop-vulnerabilidades): el descuento de
-- ticket (ticketDescuento, un % 0-100 aplicado en cobro.js/ventas.js antes
-- de cobrar) SÍ se guarda como columna `descuento_ticket` en pos_pedidos
-- (ver supabase-migrations/pos_pedidos_setup.sql) y en pos_ventas del lado
-- D1/mipos-gateway (ver workers/mipos-gateway/d1-migrations/0001_init_mvp.sql
-- y src/schema.js) -- pero NO existe en pos_ventas del lado Supabase, que es
-- el backend que usan la mayoria de los clientes reales hoy.
--
-- Efecto práctico: cuando se cobra una venta con descuento de ticket, el
-- monto ya rebajado se guarda en `total` (registrarVentaEnTurno/
-- supaInsertVenta en js/turno.js), pero el % de descuento aplicado NUNCA
-- viaja a Supabase -- se pierde por completo. No hay forma de auditar
-- "qué ventas tuvieron descuento manual y de cuánto" desde pos_ventas, ni de
-- sumar el total descontado en un período. Vector clásico de fraude en caja
-- (sweethearting via descuento manual, sin auditoria) además de ser una
-- limitación de reportes.
--
-- ORDEN DE APLICACIÓN (mismo criterio que add_venta_uuid_idempotencia.sql):
--   1. Ejecutar esta migración PRIMERO (agrega la columna, con default 0 —
--      no rompe filas existentes ni requiere backfill).
--   2. Recién después modificar js/turno.js (registrarVentaEnTurno/
--      supaInsertVenta) para que el payload de pos_ventas incluya
--      `descuento_ticket: data.ticketDescuento||0` (mismo patrón ya usado
--      en js/pedidos.js linea ~190 y ~714 para pos_pedidos). Si se despliega
--      el código antes de la columna, PostgREST rechaza el insert de TODA
--      venta ("column does not exist") -- mismo riesgo ya documentado para
--      venta_uuid, por eso este script se deja preparado pero el código NO
--      se toca todavía.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE pos_ventas
  ADD COLUMN IF NOT EXISTS descuento_ticket NUMERIC(15,0) NOT NULL DEFAULT 0;

-- Forzar recarga del schema en PostgREST
NOTIFY pgrst, 'reload schema';
