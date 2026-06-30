-- PATCH: agregar columna es_favorito a pos_productos
-- Ejecutar en Supabase SQL Editor

ALTER TABLE pos_productos
  ADD COLUMN IF NOT EXISTS es_favorito BOOLEAN NOT NULL DEFAULT FALSE;
