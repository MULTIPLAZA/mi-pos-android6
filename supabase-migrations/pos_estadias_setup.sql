-- ─────────────────────────────────────────────────────────────
-- mi-pos · Estadías (el "folio" de hospedaje)
--
-- Una estadía es la cuenta corriente de un huésped durante su visita:
-- se abre al check-in, ACUMULA cargos (noches, extras) mientras dura la
-- estadía —posiblemente varios días, varios turnos de caja, incluso
-- distintas terminales— y se liquida al check-out, convirtiendo los
-- cargos acumulados en una venta real del sistema (mismo flujo de cobro,
-- factura y FE que cualquier venta).
--
-- Por qué NO se usa el módulo de mesas/pendientes para esto: los
-- "pendientes" (tickets guardados) son locales y de UNA sola sesión/día.
-- Una estadía de hotel debe sobrevivir cierres de turno, reinicios de
-- app y cambios de terminal — necesita estar en el servidor desde el
-- primer cargo, no solo al cobrar.
--
-- CICLO DE ESTADOS:
--   reservado → en_estadia → checkout
--                          ↘ cancelado
--
-- 'cargos' es un array JSONB que se va empujando con cada consumo:
--   [{fecha, descripcion, cantidad, precio_unitario, monto, iva}]
-- 'total' es la suma de 'cargos', mantenida por la app (no por trigger,
-- para no atar el esquema a lógica de negocio en la base).
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pos_estadias (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  licencia_id       BIGINT,
  licencia_email    TEXT NOT NULL,
  sucursal          TEXT,
  habitacion_id     BIGINT,                    -- FK lógica a pos_habitaciones
  huesped_nombre    TEXT NOT NULL,
  huesped_documento TEXT,
  huesped_tel       TEXT,
  cantidad_huespedes INTEGER DEFAULT 1,
  checkin           DATE NOT NULL,
  checkout_previsto DATE,
  checkout_real     TIMESTAMPTZ,               -- se llena recién al liquidar
  tarifa_noche      NUMERIC(15,0) DEFAULT 0,
  cargos            JSONB DEFAULT '[]'::jsonb,
  total             NUMERIC(15,0) DEFAULT 0,
  estado            TEXT NOT NULL DEFAULT 'en_estadia', -- reservado | en_estadia | checkout | cancelado
  comprobante_venta TEXT,                       -- referencia a la venta que liquidó la estadía
  nota              TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- Consulta principal: estadías activas de un negocio (para el tablero)
CREATE INDEX IF NOT EXISTS idx_pos_estadias_activas
  ON pos_estadias (licencia_email, estado, habitacion_id);

CREATE INDEX IF NOT EXISTS idx_pos_estadias_habitacion
  ON pos_estadias (habitacion_id, estado);

ALTER TABLE pos_estadias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pos_estadias_anon_all ON pos_estadias;
CREATE POLICY pos_estadias_anon_all ON pos_estadias
  FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
