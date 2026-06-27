# DTF — mi-pos Fase 0: "Tipo de negocio" (modo retail)

**Proyecto:** mi-pos (POS NODO, PWA vanilla + Supabase)
**Fase:** 0 de la adaptación multi-rubro (ver `docs/reporte-adaptacion-rubros.html`)
**Fecha:** 2026-06-02
**Objetivo:** Permitir que un mismo mi-pos atienda negocios NO gastronómicos (kiosco, librería, despensa básica) ocultando lo específico de comida detrás de flags, **sin que ningún cliente de comida actual note ningún cambio**.

---

## 1. Principio rector (NO NEGOCIABLE)

**Default = gastronomía con todo prendido.** Si una licencia no tiene configurado nada, se comporta EXACTAMENTE como hoy. Cero regresión para clientes existentes. Todo lo nuevo nace apagado/“como antes” salvo activación explícita.

## 2. Modelo de configuración

Agregar a la config de negocio (misma mecánica que ya usan `comandasHabilitadas` en `app.js:149` y `pos_modo_terminal` en `licencia.js:31` — persistir en `pos_config` de Supabase + cache en localStorage):

- `tipo_negocio`: `'gastronomia'` (default) | `'retail'`
  - Es una propiedad **del negocio/licencia**, no de la terminal.
- Flags de feature granulares (cada uno **independiente y override-able**), con default derivado de `tipo_negocio`:

| Flag | Default si `gastronomia` | Default si `retail` | Qué controla |
|------|--------------------------|---------------------|--------------|
| `usa_mesas` | true | false | Módulo salones/mesas + selección de mesa en POS |
| `usa_cocina` | = `comandasHabilitadas` actual | false | Impresión de comanda a cocina |
| `usa_delivery` | true | false | Tipo "delivery" + ítem de cargo de envío |
| `usa_mitades` | true | false | Opción pizza mitad-y-mitad (alta producto + modal POS) |

**Regla de defaults:** `tipo_negocio` setea los defaults de los 4 flags, pero si un flag fue seteado explícitamente, gana el valor explícito (permite un retail que SÍ haga delivery, etc.).

Respetar `usa_cocina` ya existente: no duplicar, **plegar** `comandasHabilitadas` dentro de este esquema (alias/compatibilidad hacia atrás).

## 3. Dónde se setea (UI)

1. **admin-negocio.html → Configuración:** selector "Tipo de negocio: Gastronomía / Comercio (retail)". Al cambiar a retail, aplicar los defaults de los flags (mostrando que mesas/cocina/delivery/mitades quedan off, con la posibilidad de re-prender cada uno).
2. **super-admin.html:** que NODO pueda ver/forzar el `tipo_negocio` por licencia al dar de alta un cliente (read + set).

## 4. Qué se oculta/gatea en el POS y admin (mapa de código)

Gatear **render/visibilidad** (no borrar lógica):

- **Mesas/salones** — `js/mesas.js` (módulo completo). Ocultar entrada/tab de mesas en el POS y la sección de gestión de Salones/Mesas en `admin-negocio.html` cuando `usa_mesas=false`.
- **Tipo de pedido** local/llevar/delivery — `js/state.js:16` (`tipoPedido`), `js/ventas.js:~203-228`. En retail: ocultar el selector y forzar una venta genérica de mostrador. No romper el guardado (`pos_ventas.tipo_pedido` puede quedar con un valor por defecto tipo `'mostrador'`/`'llevar'`).
- **Cargo de delivery** — `js/ventas.js:~225` (`delivery_item`). Ocultar cuando `usa_delivery=false`.
- **Pizza mitad** — `js/productos.js:~1435` (flag `mitad`, modal de 2 sabores). Ocultar opción en alta de producto y el flujo de mitades en el POS cuando `usa_mitades=false`.
- **Comanda a cocina** — `js/app.js:149`, `js/impresion.js:~541` (`generarHTMLComanda`) e `imprimirComanda` (~1179). No imprimir comanda cuando `usa_cocina=false` (ya soportado vía `comandasHabilitadas`; alinear).

**Importante:** el ticket de venta y todo el flujo de cobro/turno/SIFEN/inventario NO se tocan (son genéricos).

## 5. Datos

- **Sin migración obligatoria de schema:** `pos_config` ya es clave/valor y aguanta los flags nuevos. Si se agrega columna a alguna tabla, debe ser **nullable / con default compatible**.
- Campos legacy (`pos_pedidos.mesa`, `pos_ventas.tipo_pedido`, `pos_productos.mitad/comanda`) se respetan; en retail simplemente no se usan/llenan.

## 6. Criterios de aceptación

1. Una licencia **sin** `tipo_negocio` (o `='gastronomia'`) se ve y opera **idéntica a hoy** (mesas, comanda, delivery, mitades disponibles). — *regresión cero*
2. Una licencia `='retail'`:
   - No muestra mesas/salones (ni en POS ni en admin).
   - No muestra selector local/llevar/delivery; vende directo de mostrador.
   - No imprime comanda de cocina.
   - No muestra opción de pizza mitad.
   - Sigue vendiendo, cobrando, facturando (SIFEN), controlando stock y cerrando turno normalmente.
3. Cada flag granular se puede re-prender individualmente aunque el tipo sea retail.
4. El cambio de `tipo_negocio` se persiste en Supabase (`pos_config`) y cachea en localStorage; al recargar/sincronizar se mantiene.
5. Bump de `sw.js` CACHE + `js/licencia.js` `APP_VERSION` juntos (regla del proyecto) para forzar actualización en dispositivos.

## 7. Fuera de alcance (Fase 0)

- Venta por peso/balanza, lotes/vencimiento, variantes talla×color (Fases 2-4).
- Lector de código de barras en el buscador del POS (Fase 1 — el campo `codigo` ya existe).
- Packs de catálogo semilla por rubro (Fase 1).
- Terminología avanzada parametrizable (Fase 0 solo oculta; renombres mínimos si ayudan).

## 8. Reglas de trabajo para el desarrollo

- Rama local `feature/tipo-negocio-retail`. **NO** push, **NO** deploy a producción sin aprobación explícita de Emiliano.
- No usar emojis en UI (regla NODO): íconos SVG stroke si hace falta.
- Validar manualmente: simular una licencia retail y una gastronómica y verificar los 5 criterios de aceptación.
- Entregar al final: resumen de archivos tocados, cómo se prueba, y qué falta para deploy (cache bump incluido).
