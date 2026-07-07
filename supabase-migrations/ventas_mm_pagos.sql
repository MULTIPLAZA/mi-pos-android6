-- Agrega las columnas mm_pagos y pix_mp_pagos a pos_ventas.
-- Sin esto, el desglose real Gs/R$/ARS/USD de un pago simple (Multi-moneda
-- o Pix/Mercado Pago) nunca llegaba a guardarse en Supabase — solo vivía en
-- memoria mientras duraba la sesión, y se perdía apenas se cerraba la app o
-- se reconstruía el turno. Esto es lo que causó que ventas cobradas en
-- reales (ej. HRIO, R$425) no aparecieran en el cierre de caja de dos
-- monedas: el dato nunca sobrevivió más allá del momento del cobro.

ALTER TABLE pos_ventas ADD COLUMN IF NOT EXISTS mm_pagos JSONB;
ALTER TABLE pos_ventas ADD COLUMN IF NOT EXISTS pix_mp_pagos JSONB;

NOTIFY pgrst, 'reload schema';
