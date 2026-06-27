# DTF — mi-pos Fase 1: Código de barras en el POS

**Proyecto:** mi-pos (POS NODO, PWA vanilla + Supabase) — EN PRODUCCIÓN.
**Fase:** 1 de la adaptación multi-rubro (ver `docs/reporte-rubros-objetivo.html`).
**Depende de:** Fase 0 (rama `feature/tipo-negocio-retail`, sin deploy). Esta fase continúa en esa misma rama.
**Fecha:** 2026-06-03.

## 1. Objetivo
Permitir vender escaneando (o tecleando) el **código de barras / referencia** en la pantalla de venta. Hoy el cajero solo puede buscar por nombre. Esto desbloquea retail general (kiosco, minimercado, librería) y es la base de electrónica y ropa.

## 2. Alcance (qué SÍ entra)
1. **Buscar por código en la venta:** el buscador de la grilla del POS debe matchear también por `codigo`, no solo por `name`.
2. **Flujo de lector (scan-to-cart):** un lector USB/Bluetooth "tipea" el código y manda Enter. Al recibir Enter en el input de búsqueda, si hay **match exacto por código**, agregar ese producto al carrito directo, limpiar el input y dejar el foco para el próximo escaneo (operación sin mouse).
3. **Captura de código en alta/edición de producto:** el campo código ya existe; asegurar que admite escaneo y **validar unicidad por licencia** (avisar si el código ya está en otro producto). El código sigue siendo **opcional**.

## 3. Fuera de alcance (NO entra en Fase 1)
- Packs de catálogo semilla por rubro (futuro).
- Configuración de hardware del lector (los lectores actúan como teclado HID, no requieren config).
- Venta por peso, variantes, series/IMEI (otras fases).

## 4. Mapa de código (verificado)
- Input de búsqueda de venta: `#sinput` en `index.html:1558` (`oninput="filterP()"`, `placeholder="Buscar producto..."`). Se abre/foca con `toggleSearch()` (app.js).
- Filtro actual: `filterP()` → `_filterPInternal()` en `js/app.js:784-820`. Línea clave: `if(q) l = l.filter(p=>p.name.toLowerCase().includes(q));` — **acá hay que sumar el match por `p.codigo`**.
- Agregar al carrito: `addCart(id, tileEl)` en `js/ventas.js:107`.
- Referencia ya funcionando: el filtro de gestión `renderArtList` ya matchea código en `js/productos.js:569` (`(p.codigo && p.codigo.includes(filter))`) — usar como patrón.
- Campo código en alta de producto: input `artCodigo` (index.html ~948), se guarda en `codigo` (productos.js ~797, 808, 822, 1016, 1819).

## 5. Requisitos detallados

### 5.1 Match por código en `_filterPInternal()`
- Cambiar el filtro para que un producto matchee si `p.name` incluye `q` **O** `p.codigo` (normalizado) incluye/igual a `q`.
- Mantener exclusiones actuales (ítem libre, insumos, inactivos).
- Es **rubro-agnóstico**: aplica a todos los `tipo_negocio` (también gastronomía). NO gatear por flag.

### 5.2 Flujo de lector (Enter en `#sinput`)
- Agregar handler `onkeydown`/`onkeypress` en `#sinput` que detecte Enter.
- Al Enter:
  1. Normalizar el valor (trim, comparación case-insensitive; los EAN son dígitos pero contemplar espacios/mayúsculas).
  2. Buscar producto con **código exacto** = valor (excluyendo ítem libre/insumos/inactivos).
  3. Si hay match exacto → `addCart(p.id)`, limpiar `#sinput`, mantener foco en `#sinput`. (No abrir lista, no requiere click.)
  4. Si NO hay match exacto por código pero la lista filtrada tiene **exactamente 1 resultado** → agregar ese.
  5. Si hay 0 o >1 → no agregar nada (dejar la lista filtrada como está). Opcional: toast "Sin coincidencia" cuando es 0.
- No romper el comportamiento de escribir-para-filtrar (oninput sigue filtrando la grilla).
- Debe funcionar **offline** (PRODS está en memoria; el match es local, sin red).

### 5.3 Unicidad de código en alta/edición
- Al guardar un producto con código no vacío, verificar que no exista otro producto (de la misma licencia) con el mismo código.
- Si existe, avisar con toast claro y no pisar silenciosamente. Código vacío = permitido (no obliga).

## 6. Criterios de aceptación
1. En la pantalla de venta, tipear un código en "Buscar producto…" filtra por código además de por nombre.
2. Con lector: escanear un producto cargado con ese código lo agrega al carrito de una, limpia el input y deja el foco para seguir escaneando, sin tocar el mouse.
3. Escanear un código inexistente no rompe nada (no agrega; opcional toast).
4. Crear dos productos con el mismo código avisa al segundo (no duplica silencioso).
5. Todo funciona offline.
6. No hay regresión: buscar por nombre sigue igual; gastronomía no se ve afectada.
7. Bump de `sw.js` CACHE + `js/licencia.js` APP_VERSION juntos.

## 7. Reglas de trabajo
- Continuar en la rama `feature/tipo-negocio-retail` (no deployada). Commit(s) nuevo(s). **NO push, NO deploy, NO merge a main** sin aprobación de Emiliano.
- Estilo del proyecto (var en top-level, helpers existentes). NO emojis (SVG si hace falta).
- Validar manualmente: simular escaneo tecleando código + Enter en `#sinput` con un producto que tenga código cargado.
- Entregable: archivos/líneas tocadas, cómo probar el scan-to-cart, confirmación de cache bump y de que sigue en la rama sin push.
