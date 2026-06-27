-- ─────────────────────────────────────────────────────────────
-- mi-pos · Foto de producto
--
-- Agrega columna foto_url a pos_productos.
-- Las imágenes se suben a Supabase Storage (bucket: productos)
-- y se guarda la URL pública aquí.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE pos_productos
  ADD COLUMN IF NOT EXISTS foto_url TEXT;
