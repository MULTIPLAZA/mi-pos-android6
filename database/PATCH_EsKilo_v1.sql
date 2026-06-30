-- ============================================================
-- PATCH_EsKilo_v1.sql
-- Agrega la columna es_kilo a pos_productos
--
-- Ejecutar en Supabase SQL Editor (o cualquier cliente PostgreSQL)
-- ============================================================

ALTER TABLE pos_productos
ADD COLUMN IF NOT EXISTS es_kilo BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN pos_productos.es_kilo IS
  'Si true, el producto se vende por kilogramo. El precio almacenado es el precio por kg.';
