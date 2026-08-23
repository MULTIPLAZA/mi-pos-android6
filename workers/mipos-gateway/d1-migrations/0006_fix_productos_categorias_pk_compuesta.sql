-- BUG ESTRUCTURAL CONFIRMADO 2026-08-23 (loop de auditoria mi-pos-android6,
-- leyendo codigo, sin poder correr esto contra el D1 real -- necesita
-- wrangler d1 execute, credenciales que este loop no tiene).
--
-- pos_productos y pos_categorias declaran `id INTEGER PRIMARY KEY` SIN
-- AUTOINCREMENT y SIN componer con licencia_email (ver d1-migrations/
-- 0001_init_mvp.sql lineas 56-95). En SQLite/D1 eso es una PK de UNA sola
-- columna, unica en TODA la tabla -- no por tenant.
--
-- El cliente calcula el proximo id de un producto/categoria como
-- MAX(id) WHERE licencia_email=<tenant> + 1 (js/admin-productos.js
-- _nextProductoId(), js/productos.js _nextCategoriaId() equivalente) --
-- SIEMPRE empieza en 1,2,3... para CADA tenant nuevo, sin conocer los ids
-- que ya usan otros tenants. Es el MISMO mecanismo que ya causo el
-- incidente de colision de id entre tenants ya resuelto del lado Supabase
-- (ver memoria project_mipos_id_colision_tenants, arreglado 2026-08-18 con
-- UNIQUE(licencia_email,id) -- la tabla real de Supabase SI tiene esa
-- constraint compuesta; esta tabla de D1 nunca la tuvo).
--
-- Consecuencia confirmada leyendo postgrestShim.js + index.js (no en vivo):
--   1) INSERT simple (_postProductoConIdSeguro, on_conflict=null): si el id
--      calculado ya lo usa OTRO tenant, SQLite tira "UNIQUE constraint
--      failed" -> el Worker lo traduce a 409 (ver handleRest() en
--      index.js) -> el cliente reintenta recalculando el MISMO
--      MAX(id) WHERE licencia_email=<mismo tenant> (que no cambio) ->
--      obtiene el MISMO id ya colisionado -> vuelve a fallar. Ese tenant
--      queda sin poder crear un producto con ese numero de id hasta que
--      cambie algo del lado del otro tenant (nunca, en la practica).
--   2) UPSERT (js/productos.js supaUpsertProducto, on_conflict=
--      'licencia_email,id'): SQLite exige que el target de ON CONFLICT
--      coincida EXACTO con una constraint UNIQUE/PK ya declarada. Como acá
--      solo existe `id` como PK simple (no una compuesta licencia_email+id),
--      esta sentencia deberia fallar directo con error de SQLite ("no such
--      constraint") -- bloqueando CUALQUIER guardado de producto vía este
--      camino (el camino normal de "editar producto existente") para
--      tenants Cloudflare, no solo el caso de colision.
--
-- No se pudo confirmar en vivo si esto ya esta pasando hoy con tenants
-- reales del gateway (lanzado 2026-08-10) -- requiere wrangler tail o
-- acceso a D1 que este loop no tiene. Documentado como ALTA prioridad
-- porque el camino (2) rompería el guardado de producto en TODO tenant
-- Cloudflare que edite un producto existente, no solo en el caso raro de
-- colision entre tenants.
--
-- ANTES DE APLICAR: correr esta consulta contra el D1 real para ver si hay
-- ids que hoy pisan datos de otro tenant (si esto devuelve filas, resolver
-- esos duplicados a mano ANTES de la migracion, o el INSERT...SELECT de
-- abajo va a fallar por violar la nueva PK compuesta):
--   SELECT id, COUNT(DISTINCT licencia_email) tenants
--   FROM pos_productos GROUP BY id HAVING tenants > 1;
--   (mismo query cambiando pos_productos por pos_categorias)
--
-- SQLite no soporta ALTER TABLE ADD CONSTRAINT -- se usa el patron
-- estandar: crear tabla nueva con la PK correcta, copiar los datos, soltar
-- la vieja, renombrar. Los tipos/columnas quedan IDENTICOS al original
-- (0001_init_mvp.sql) -- unico cambio real es la PK.
--
-- APLICAR CON (ajustar el nombre de la base D1 segun wrangler.toml):
--   wrangler d1 execute mipos-gateway-db --remote --file=./d1-migrations/0006_fix_productos_categorias_pk_compuesta.sql

CREATE TABLE pos_productos_new (
  id              INTEGER,
  nombre          TEXT NOT NULL,
  precio          REAL DEFAULT 0,
  precio_variable INTEGER DEFAULT 0,
  costo           REAL DEFAULT 0,
  codigo          TEXT,
  categoria       TEXT,
  iva             TEXT DEFAULT '10',
  color           TEXT,
  color_propio    INTEGER DEFAULT 0,
  mitad           INTEGER DEFAULT 0,
  inventario      INTEGER DEFAULT 0,
  comanda         INTEGER DEFAULT 0,
  item_libre      INTEGER DEFAULT 0,
  activo          INTEGER DEFAULT 1,
  terminal        TEXT,
  licencia_email  TEXT,
  updated_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at      TEXT,
  es_descuento    INTEGER DEFAULT 0,
  desc_tipo       TEXT,
  desc_valor      REAL,
  imagen          TEXT,
  es_insumo       INTEGER NOT NULL DEFAULT 0,
  foto_url        TEXT,
  codigos         TEXT DEFAULT '[]',
  es_kilo         INTEGER NOT NULL DEFAULT 0,
  es_favorito     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (licencia_email, id)
);
INSERT INTO pos_productos_new SELECT
  id, nombre, precio, precio_variable, costo, codigo, categoria, iva, color,
  color_propio, mitad, inventario, comanda, item_libre, activo, terminal,
  licencia_email, updated_at, deleted_at, es_descuento, desc_tipo, desc_valor,
  imagen, es_insumo, foto_url, codigos, es_kilo, es_favorito
FROM pos_productos;
DROP TABLE pos_productos;
ALTER TABLE pos_productos_new RENAME TO pos_productos;
CREATE INDEX ix_pos_productos_tenant ON pos_productos(licencia_email);

CREATE TABLE pos_categorias_new (
  id             INTEGER,
  nombre         TEXT NOT NULL,
  color          TEXT,
  licencia_email TEXT,
  updated_at     TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (licencia_email, id)
);
INSERT INTO pos_categorias_new SELECT id, nombre, color, licencia_email, updated_at FROM pos_categorias;
DROP TABLE pos_categorias;
ALTER TABLE pos_categorias_new RENAME TO pos_categorias;
CREATE INDEX ix_pos_categorias_tenant ON pos_categorias(licencia_email);
