-- ─────────────────────────────────────────────────────────────
-- mi-pos · Citas / Agenda (rubro barbería / peluquería / estética)
--
-- Una cita es un turno reservado: quién, con qué profesional, qué
-- servicios, cuándo y en qué estado. Patrón JSONB + estado, igual que
-- pos_pedidos. Los servicios se guardan como líneas de carrito (JSONB)
-- para que al cobrar se carguen directo al flujo de venta existente.
--
-- CICLO DE ESTADOS:
--   reservado → confirmado → en_atencion → completado → cobrado
--                                                     ↘ cancelado
--                                                     ↘ no_show
--
-- Al cobrar, la cita se convierte en venta (pos_ventas) y se guarda el
-- venta_id acá; los servicios ya viajan como líneas de esa venta.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pos_citas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  licencia_id     BIGINT,
  licencia_email  TEXT NOT NULL,
  sucursal        TEXT,
  profesional_id  BIGINT,                       -- FK lógica a pos_profesionales
  cliente_id      BIGINT,                       -- FK lógica a pos_clientes (opcional)
  cliente_nombre  TEXT,                         -- nombre rápido si no hay cliente cargado
  cliente_tel     TEXT,
  inicio          TIMESTAMPTZ NOT NULL,
  fin             TIMESTAMPTZ,
  duracion_min    INTEGER DEFAULT 30,
  servicios       JSONB,                        -- array de líneas: {id,name,price,qty,duracion_min,iva}
  total           NUMERIC(15,0) DEFAULT 0,
  estado          TEXT NOT NULL DEFAULT 'reservado',
  venta_id        BIGINT,                       -- se llena al cobrar
  nota            TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Consulta principal: agenda de un negocio por profesional y rango de fechas
CREATE INDEX IF NOT EXISTS idx_pos_citas_agenda
  ON pos_citas (licencia_email, profesional_id, inicio);

-- Filtro por estado (ej. mostrar solo pendientes del día)
CREATE INDEX IF NOT EXISTS idx_pos_citas_estado
  ON pos_citas (licencia_email, estado, inicio);

ALTER TABLE pos_citas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pos_citas_anon_all ON pos_citas;
CREATE POLICY pos_citas_anon_all ON pos_citas
  FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
