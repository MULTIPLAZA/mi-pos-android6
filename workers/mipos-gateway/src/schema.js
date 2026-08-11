// Fuente: workers/mipos-gateway/docs/columnas-inferidas-core.md (BORRADOR, ver ese doc).
// Cada tabla D1-nativa soportada declara: su columna de tenant (y de que tipo es -
// email o licencia_id numerico, la inconsistencia es real, ver docs/fase0-inventario.md),
// y el allowlist de columnas legibles/escribibles. El Worker NUNCA acepta un nombre
// de columna que no este en `columns` - es la defensa contra column-name injection.

export const TENANT_EMAIL = 'email';
export const TENANT_LICENCIA_ID = 'licencia_id';

export const TABLES = {
  licencias: {
    tenant: null, // tabla raiz, no se filtra por si misma
    pk: 'id',
    columns: [
      'id', 'clave', 'plan_id', 'nombre_cliente', 'email_cliente', 'fecha_vence',
      'notas', 'rubro', 'tipo_pago', 'tipo_negocio', 'capacidades', 'monto',
      'monto_soporte', 'precio_terminal', 'activa', 'created_at',
    ],
    booleans: ['activa'],
  },
  activaciones: {
    tenant: { column: 'licencia_id', kind: TENANT_LICENCIA_ID },
    pk: 'id',
    columns: [
      'id', 'device_id', 'email', 'licencia_id', 'nombre_negocio', 'nombre_terminal',
      'sucursal', 'modo', 'activa', 'fecha_activacion', 'ultima_consulta', 'deleted_at',
    ],
    booleans: ['activa'],
  },
  pos_config: {
    tenant: { column: 'licencia_email', kind: TENANT_EMAIL },
    pk: 'id',
    columns: ['id', 'licencia_email', 'clave', 'valor'],
    booleans: [],
  },
  pos_categorias: {
    tenant: { column: 'licencia_email', kind: TENANT_EMAIL },
    pk: 'id',
    columns: ['id', 'nombre', 'color', 'licencia_email', 'activa', 'updated_at'],
    booleans: ['activa'],
  },
  pos_productos: {
    tenant: { column: 'licencia_email', kind: TENANT_EMAIL },
    pk: 'id',
    columns: [
      'id', 'nombre', 'precio', 'precio_variable', 'costo', 'codigo', 'codigos',
      'categoria', 'iva', 'color', 'color_propio', 'mitad', 'inventario', 'comanda',
      'es_kilo', 'es_favorito', 'es_insumo', 'activo', 'imagen', 'foto_url',
      'licencia_email', 'updated_at', 'stock', 'stock_min',
    ],
    booleans: [
      'precio_variable', 'color_propio', 'mitad', 'inventario', 'comanda',
      'es_kilo', 'es_favorito', 'es_insumo', 'activo',
    ],
  },
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
  pos_salones: {
    tenant: { column: 'licencia_id', kind: TENANT_LICENCIA_ID },
    pk: 'id',
    columns: ['id', 'licencia_id', 'sucursal_id', 'nombre', 'color', 'activo', 'orden'],
    booleans: ['activo'],
  },
  pos_mesas: {
    tenant: { column: 'licencia_id', kind: TENANT_LICENCIA_ID },
    pk: 'id',
    columns: [
      'id', 'salon_id', 'licencia_id', 'sucursal_id', 'nombre', 'capacidad', 'activo', 'orden',
    ],
    booleans: ['activo'],
  },
  sucursales: {
    tenant: { column: 'licencia_id', kind: TENANT_LICENCIA_ID },
    pk: 'id',
    columns: ['id', 'licencia_id', 'nombre', 'direccion', 'activa', 'created_at'],
    booleans: ['activa'],
  },
  // Fuente confiable: supabase-migrations/pos_pedidos_setup.sql (unico CREATE TABLE
  // real de las tablas MVP - no es un borrador inferido como las demas). Clave
  // primaria UUID en Postgres (gen_random_uuid()) -> generada en el Worker con
  // crypto.randomUUID() antes del INSERT (ver uuidPk abajo y postgrestShim.js).
  pos_pedidos: {
    tenant: { column: 'licencia_email', kind: TENANT_EMAIL },
    pk: 'id',
    uuidPk: true,
    columns: [
      'id', 'licencia_email', 'licencia_id', 'terminal_origen', 'numero_orden', 'mesa',
      'sucursal', 'tipo_pedido', 'estado', 'items', 'total', 'descuento_ticket',
      'mesero_id', 'created_at', 'updated_at',
    ],
    booleans: [],
  },
};

export function isSupportedTable(table) {
  return Object.prototype.hasOwnProperty.call(TABLES, table);
}
