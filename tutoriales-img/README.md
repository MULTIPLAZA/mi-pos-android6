# Capturas de los tutoriales

Acá van las imágenes que muestran cómo se ve cada paso de los tutoriales del admin.

## Estructura

Una carpeta por tutorial, con el **id** del tutorial como nombre:

```
tutoriales-img/
├── productos/
│   ├── 01.png
│   ├── 02.png
│   └── 03.png
├── compras/
│   ├── 01.png
│   └── 02.png
├── conteo/
│   └── ...
```

## IDs de tutoriales disponibles

| ID en la carpeta | Tutorial |
|---|---|
| `productos` | Cargar y editar productos |
| `importar` | Importar productos desde Excel |
| `insumos` | Insumos: qué son y cómo cargarlos |
| `inventarios` | Controlar mi stock — Inventarios |
| `extracto` | Extracto de un producto |
| `compras` | Cargar compras de mercadería |
| `movstock` | Movimientos de stock |
| `conteo` | Conteo físico |
| `cajas` | Cajas y turnos |
| `terminales` | Terminales |
| `gastos` | Gastos fijos |
| `plan-gastos` | Plan de Gastos |
| `balance` | Balance P&G |
| `iva` | Liquidación IVA |

## Cómo nombrar las capturas

Numeradas según el paso al que corresponden, con padding de 2 dígitos:

- `01.png` = primer paso
- `02.png` = segundo paso
- ...
- `12.png` = doceavo paso

Si un paso no tiene captura, simplemente no la subas. El tutorial lo muestra sin imagen, sin romper nada.

## Formato recomendado

- **Tamaño**: ancho 1200-1600 px (capturas de pantalla de tu navegador).
- **Formato**: PNG para máxima calidad (mejor para UI), o JPG si pesa mucho.
- **Peso**: menos de 300 KB por imagen idealmente.
- **Foco**: capturá la parte relevante. Si la pantalla tiene mucho contenido, usá Snipping Tool de Windows o equivalente para recortar.
- **Highlight**: si querés marcar dónde apretar, usá un cuadro rojo (con Paint o cualquier editor). No es obligatorio.

## Después de pegar las imágenes

Cloudflare Pages las sirve automáticamente — no hace falta tocar código.
Solo hacés:
1. Push al repo.
2. Esperás 1-2 min al deploy.
3. Refrescás el admin → entrás al tutorial → las capturas aparecen.

Si no aparecen y todo lo demás funciona, revisá:
- Que la carpeta se llame **exactamente** igual al id (ej. `plan-gastos` con guión, no `plan_gastos`).
- Que el archivo se llame `01.png`, `02.png` (no `1.png` ni `paso01.png`).
- Que no haya espacios en los nombres.
