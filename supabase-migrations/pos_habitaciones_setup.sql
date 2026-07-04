-- ─────────────────────────────────────────────────────────────
-- mi-pos · Habitaciones (rubro hospedaje: hotel, hostería, posada, motel)
--
-- Una habitación es un recurso físico — clon de pos_mesas/pos_profesionales.
-- El campo 'estado' SOLO cubre los estados que el personal setea a mano
-- (libre / limpieza / mantenimiento). "Ocupada" NO es un estado guardado
-- acá — se DERIVA de si existe una fila en pos_estadias con
-- estado='en_estadia' para esta habitación (mismo patrón que pos_mesas:
-- la ocupación se deriva de los pendientes, no de un flag separado que
-- puede desincronizarse del dato real).
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pos_habitaciones (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  licencia_id    BIGINT,
  licencia_email TEXT NOT NULL,
  sucursal       TEXT,
  numero         TEXT NOT NULL,           -- "101", "Suite 3", etc.
  tipo           TEXT DEFAULT 'simple',   -- simple | doble | matrimonial | suite | otro
  piso           TEXT,
  capacidad      INTEGER DEFAULT 2,
  precio_noche   NUMERIC(15,0) DEFAULT 0, -- tarifa default; se puede ajustar por estadía
  estado         TEXT NOT NULL DEFAULT 'libre', -- libre | limpieza | mantenimiento
  orden          INTEGER DEFAULT 0,
  activo         BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pos_habitaciones_email
  ON pos_habitaciones (licencia_email, activo, orden);

ALTER TABLE pos_habitaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pos_habitaciones_anon_all ON pos_habitaciones;
CREATE POLICY pos_habitaciones_anon_all ON pos_habitaciones
  FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
