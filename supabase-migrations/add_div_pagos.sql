-- ─────────────────────────────────────────────────────────────
-- mi-pos · Pagos divididos (split payment)
--
-- Agrega columna div_pagos a pos_ventas para guardar el detalle de
-- ventas cobradas con varios métodos de pago.
--
-- Formato: JSONB con array de objetos { metodo, monto, comprobante }
--   Ejemplo: [
--     { "metodo": "EFECTIVO", "monto": 30000 },
--     { "metodo": "POS",      "monto": 20000, "comprobante": "ABC123" }
--   ]
--
-- USO:
--   - El dashboard (admin-dashboard.js _renderDashCharts) lee este campo
--     para descomponer ventas divididas en sus métodos individuales con
--     los montos exactos, en vez de aproximar 1/N.
--   - IndexedDB local ya guarda el mismo detalle en venta.div_pagos.
--   - Ventas no divididas dejan este campo NULL.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE pos_ventas
  ADD COLUMN IF NOT EXISTS div_pagos JSONB DEFAULT NULL;

-- Índice GIN para querys que filtren por método dentro del JSON (opcional)
CREATE INDEX IF NOT EXISTS idx_pos_ventas_div_pagos
  ON pos_ventas USING GIN (div_pagos);
