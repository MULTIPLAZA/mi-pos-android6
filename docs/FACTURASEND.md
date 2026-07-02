# Factura Electrónica — Integración FacturaSend

Estado: **Fase 0-3 completa** — infra + emisión al cobrar + cola offline +
polling de estados. Falta: credenciales (sandbox o server propio), QR en
ticket (fase 4), anulación/NC (fase 5).

**IMPORTANTE:** ejecutar `supabase-migrations/add_factura_electronica.sql`
ANTES de activar FE — sin las columnas fe_*, los inserts de ventas con
factura electrónica fallan.

## Flujo de emisión (fase 2-3, implementado)

1. Cobro con timbrado electrónico + FE activa → `feDocumentoParaVenta()`
   arma el DE (turno.js → supaInsertVenta).
2. Online: `feEmitirVenta()` emite ANTES del insert — la fila nace con
   fe_cdc/fe_qr/fe_estado='0'. Offline o error: la venta se guarda igual
   con fe_numero y el DE va a la cola localStorage `fe_cola`.
3. Cola: reintenta c/3 min (y al volver internet). Emite UNA sola vez por
   número; persiste con PATCH por licencia_email+fe_numero.
4. Estados: CDCs pendientes en `fe_pend_cdcs`, polling c/10 min →
   PATCH fe_estado/fe_respuesta por fe_cdc. (También manual en el admin.)
5. El cobro nunca se bloquea por FE — todo corre en background.
Plan completo: ver artifact "Plan de Integración FacturaSend".

## Arquitectura

```
POS (PWA) → js/factura-electronica.js → /api/fe/* (Cloudflare Function proxy) → api.facturasend.com.py
```

- **`js/factura-electronica.js`** — capa adaptadora. Interfaz genérica del POS
  hacia el proveedor FE. Para migrar a NODO Engine: reimplementar estas mismas
  funciones, cero cambios en cobro.js/sync.js/impresion.js.
- **`functions/api/fe/[[ruta]].js`** — proxy catch-all. Resuelve CORS y arma el
  header `Authorization: Bearer api_key_...`. Las credenciales viajan del
  cliente en headers `X-FE-Tenant` / `X-FE-ApiKey`.
- **Credenciales** — por negocio (multi-tenant), en Supabase `pos_config`
  (clave `facturasend_config`) + copia local: `fe_tenant_id`, `fe_api_key`,
  `fe_api_url`, `fe_activa`. Se configuran en Panel Admin → Factura Electrónica.
- **Servidor** — por defecto la nube (`api.facturasend.com.py`). Tenemos un
  FacturaSend **self-hosted propio** en `http://207.244.255.146:85` cuya API
  es `http://207.244.255.146:85/api` (poner esa URL en el campo Servidor).
  El proxy la recibe via header `X-FE-BaseUrl` — también resuelve el mixed
  content (PWA https → server http).

## Fase 0 — Checklist sandbox (manual, hacer una vez)

1. [ ] Crear cuenta gratuita en https://console.facturasend.com.py
2. [ ] Configurar **ambiente de pruebas** (la consola genera certificado de prueba)
       — docs: https://facturasend.com.py/documentacion/configuracion-ambiente-pruebas-en-facturasend/
3. [ ] Copiar el **tenantId** y generar una **API Key** en la consola
4. [ ] Deploy de este proyecto a Cloudflare Pages (el proxy `/api/fe/` sube solo)
5. [ ] En el POS, abrir la consola del navegador (F12) y cargar credenciales:

```js
feSetConfig({ tenantId: 'TU_TENANT', apiKey: 'TU_API_KEY', activa: true });
feTestConexion().then(console.log).catch(console.error);
// esperado: [FE] Conexión OK — 18 departamentos recibidos
```

6. [ ] Emitir la primera factura de prueba (draft NO va a SIFEN; sacale el draft
       para el envío real al ambiente test):

```js
feEmitir([FE_EJEMPLO_FACTURA], { draft: true, qr: true })
  .then(function(r){ console.log('CDC:', r.deList[0].cdc, 'Lote:', r.loteId); })
  .catch(console.error);
```

7. [ ] Consultar el estado hasta ver `2-Aprobado`:

```js
feConsultarEstados(['<cdc del paso anterior>']).then(console.log);
```

## JSON de ejemplo (formato validado en producción por el TPV)

```js
var FE_EJEMPLO_FACTURA = {
  tipoDocumento: '1',
  establecimiento: '001',
  punto: '001',
  numero: 1,
  fecha: '2026-07-02T10:00:00',   // ISO local SIN zona horaria — ojo reloj del equipo
  tipoEmision: 1, tipoTransaccion: 1, tipoImpuesto: 1, moneda: 'PYG',
  cliente: {
    contribuyente: true,
    ruc: '3648965-4',              // CON dígito verificador
    razonSocial: 'CLIENTE DE PRUEBA',
    tipoOperacion: 1,              // 1=B2B · 2=B2C consumidor final
    direccion: '', pais: 'PRY', tipoContribuyente: '1',
    documentoTipo: '', documentoNumero: '',
    telefono: '', celular: '', email: '', codigo: '00001',
  },
  Usuario: { documentoTipo: 1, documentoNumero: null, nombre: 'CAJA', cargo: 'VENDEDOR' },
  factura: { presencia: 1 },
  condicion: {
    tipo: 1,                       // 1=contado · 2=crédito
    entregas: [{ tipo: 1, monto: 39900, moneda: 'PYG', monedaDescripcion: 'Guarani', cambio: 0 }],
  },
  items: [{
    codigo: '00001', descripcion: 'PRODUCTO PRUEBA', observacion: '',
    unidadMedida: 77, cantidad: 1.0, precioUnitario: 39900,
    ivaTipo: 1, ivaBase: 100, iva: 10,
  }],
};
```

Consumidor final (caso a validar en sandbox — el TPV no lo cubre):
`contribuyente: false, ruc: '', tipoOperacion: 2, documentoTipo: 5` (innominado).

## Estados FacturaSend

| Código | Estado | Acción |
|---|---|---|
| -1 | Borrador | — |
| 0 | Generado | seguir polling |
| 1 | Enviado en lote | seguir polling |
| 2 | Aprobado | venta facturada OK |
| 3 | Aprobado c/observación | válido, mostrar obs |
| 4 | Rechazado | mostrar motivo, corregir/inutilizar |
| 99 | Cancelado | reflejar anulación |

## Próximas fases

- **Fase 2:** campos `fe_*` en BD, tipo de timbrado "Electrónico", mapeo
  venta→JSON (`feArmarDocumento(venta)`), emisión al cobrar.
- **Fase 3:** cola offline (sync_queue) + polling de estados en el ciclo de sync.
- **Fase 4:** QR + CDC en ticket térmico (impresion.js), KuDE PDF para reimpresión.
- **Fase 5:** anulación (48hs → cancelación, después → NC con documentoAsociado),
  pantalla admin, reenvío email/WhatsApp.
- **Fase 6:** timbrado real del cliente piloto, ambiente producción.
