// Fuente: information_schema.columns real de Supabase (CSV entregado por el usuario,
// 2026-08-10) para: licencias, activaciones, pos_config, pos_categorias, pos_productos,
// pos_mesas, pos_pedidos. `pos_salones` esta confirmada hasta la columna `activo`
// inclusive pero el export se cortó ahí — puede faltarle `orden` u otras, ver
// docs/fase0-inventario.md. `pos_ventas`, `pos_turno` y `sucursales` TODAVIA SON
// BORRADOR (docs/columnas-inferidas-core.md) — el export se cortó antes de llegar a
// ellas, no aplicar 0001_init_mvp.sql a un D1 real hasta confirmarlas.
//
// Cada tabla D1-nativa soportada declara: su columna de tenant (y de que tipo es -
// email o licencia_id numerico, la inconsistencia es real, ver docs/fase0-inventario.md),
// y el allowlist de columnas legibles/escribibles. El Worker NUNCA acepta un nombre
// de columna que no este en `columns` - es la defensa contra column-name injection.

export const TENANT_EMAIL = 'email';
export const TENANT_LICENCIA_ID = 'licencia_id';

export const TABLES = {
  // CONFIRMADA contra Supabase real.
  licencias: {
    tenant: null, // tabla raiz, no se filtra por si misma
    pk: 'id',
    columns: [
      'id', 'clave', 'plan_id', 'nombre_cliente', 'email_cliente', 'fecha_vence',
      'activa', 'notas', 'created_at', 'rubro', 'tipo_pago', 'monto', 'monto_soporte',
      'precio_terminal', 'tipo_negocio', 'capacidades',
    ],
    booleans: ['activa'],
  },
  // CONFIRMADA. Nota: real tiene `direccion` e `ip_activacion` que no estaban en el
  // borrador, y NO tiene `nombre_negocio` con ese orden... si las tiene, confirmado.
  activaciones: {
    tenant: { column: 'licencia_id', kind: TENANT_LICENCIA_ID },
    pk: 'id',
    columns: [
      'id', 'licencia_id', 'device_id', 'email', 'nombre_negocio', 'direccion',
      'fecha_activacion', 'ultima_consulta', 'activa', 'ip_activacion', 'sucursal',
      'nombre_terminal', 'deleted_at', 'modo',
    ],
    booleans: ['activa'],
  },
  // CONFIRMADA.
  pos_config: {
    tenant: { column: 'licencia_email', kind: TENANT_EMAIL },
    pk: 'id',
    columns: ['id', 'licencia_email', 'clave', 'valor', 'updated_at'],
    booleans: [],
  },
  // CONFIRMADA. OJO: la real NO tiene columna `activa`/`activo` — el borrador anterior
  // la inventaba, se saca del allowlist.
  pos_categorias: {
    tenant: { column: 'licencia_email', kind: TENANT_EMAIL },
    pk: 'id',
    columns: ['id', 'nombre', 'color', 'licencia_email', 'updated_at'],
    booleans: [],
  },
  // CONFIRMADA. Varias columnas nuevas contra el borrador (item_libre, terminal,
  // deleted_at, es_descuento, desc_tipo, desc_valor) y `stock`/`stock_min` NO EXISTEN
  // (se sacan del allowlist).
  pos_productos: {
    tenant: { column: 'licencia_email', kind: TENANT_EMAIL },
    pk: 'id',
    columns: [
      'id', 'nombre', 'precio', 'precio_variable', 'costo', 'codigo', 'categoria',
      'iva', 'color', 'color_propio', 'mitad', 'inventario', 'comanda', 'item_libre',
      'activo', 'terminal', 'licencia_email', 'updated_at', 'deleted_at', 'es_descuento',
      'desc_tipo', 'desc_valor', 'imagen', 'es_insumo', 'foto_url', 'codigos',
      'es_kilo', 'es_favorito',
    ],
    booleans: [
      'precio_variable', 'color_propio', 'mitad', 'inventario', 'comanda',
      'item_libre', 'activo', 'es_descuento', 'es_insumo', 'es_kilo', 'es_favorito',
    ],
  },
  // BORRADOR — el export real se cortó antes de llegar a esta tabla. Ver
  // docs/columnas-inferidas-core.md. NO aplicar a D1 real sin confirmar.
  pos_ventas: {
    tenant: { column: 'licencia_email', kind: TENANT_EMAIL },
    pk: 'id',
    columns: [
      'id', 'fecha', 'turno_id', 'terminal', 'sucursal', 'licencia_email', 'total',
      'metodo_pago', 'comprobante', 'items', 'div_pagos', 'mm_pagos', 'pix_mp_pagos',
      'cliente_nombre', 'tiene_factura', 'factura_ruc', 'factura_nombre', 'anulada',
      'fecha_anulacion', 'motivo_anulacion', 'fe_numero', 'fe_cdc', 'fe_qr',
      'fe_estado', 'fe_respuesta', 'fe_error', 'fe_fecha_emision', 'fe_nc_cdc',
      'fe_nc_numero', 'fe_nc_estado',
    ],
    booleans: ['tiene_factura', 'anulada'],
  },
  // BORRADOR — mismo motivo que pos_ventas.
  pos_turno: {
    tenant: { column: 'licencia_email', kind: TENANT_EMAIL },
    pk: 'id',
    columns: [
      'id', 'fecha_apertura', 'fecha_cierre', 'efectivo_inicial', 'efectivo_inicial_brl',
      'estado', 'terminal', 'licencia_email', 'total_contado', 'diferencia',
      'total_vendido', 'total_egresos', 'cantidad_ventas', 'resumen_pagos',
    ],
    booleans: [],
  },
  // CONFIRMADA hasta `activo` inclusive — el export se corta ahí, puede faltar `orden`
  // u otras columnas (pos_mesas sí tiene `orden`, es razonable que pos_salones también).
  pos_salones: {
    tenant: { column: 'licencia_id', kind: TENANT_LICENCIA_ID },
    pk: 'id',
    columns: ['id', 'licencia_id', 'sucursal_id', 'nombre', 'color', 'activo'],
    booleans: ['activo'],
  },
  // CONFIRMADA.
  pos_mesas: {
    tenant: { column: 'licencia_id', kind: TENANT_LICENCIA_ID },
    pk: 'id',
    columns: [
      'id', 'salon_id', 'licencia_id', 'sucursal_id', 'nombre', 'capacidad',
      'activo', 'orden', 'created_at',
    ],
    booleans: ['activo'],
  },
  // BORRADOR — el export real se cortó antes de llegar a esta tabla.
  sucursales: {
    tenant: { column: 'licencia_id', kind: TENANT_LICENCIA_ID },
    pk: 'id',
    columns: ['id', 'licencia_id', 'nombre', 'direccion', 'activa', 'created_at'],
    booleans: ['activa'],
  },
  // CONFIRMADA. Columnas nuevas contra el borrador: observaciones, venta_id (FK a
  // pos_ventas.id, uuid). uuidPk: la real usa gen_random_uuid() en Postgres ->
  // crypto.randomUUID() en el Worker antes del INSERT (ver postgrestShim.js).
  pos_pedidos: {
    tenant: { column: 'licencia_email', kind: TENANT_EMAIL },
    pk: 'id',
    uuidPk: true,
    columns: [
      'id', 'licencia_email', 'licencia_id', 'sucursal', 'terminal_origen', 'mesero_id',
      'numero_orden', 'mesa', 'tipo_pedido', 'estado', 'items', 'total',
      'observaciones', 'venta_id', 'created_at', 'updated_at', 'descuento_ticket',
    ],
    booleans: [],
  },
};

export function isSupportedTable(table) {
  return Object.prototype.hasOwnProperty.call(TABLES, table);
}
