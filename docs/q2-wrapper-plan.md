# APK Wrapper para JICAI Q2 — Plan de Implementación

## Dispositivo objetivo

| Campo | Valor |
|-------|-------|
| Modelo | JICAI Q2 |
| Android | 6.0 (API 23), Build/MRA58K |
| Chrome/WebView | 106.0.5249.126 (32-bit) |
| CPU | armeabi-v7a (32-bit) |
| Google Play Services | SDK=223380000, Installed=261332000 |
| Impresora integrada | 58mm térmica, AIDL `woyou.aidlservice.jiuiv5` |
| Pantalla | ~5.5" |

## Problema

1. **TLS roto**: Android 6 no tiene el certificado raíz ISRG Root X1 (Let's Encrypt). Cloudflare Pages es HTTPS-only y rota entre Let's Encrypt y GTS — ambos sin soporte en Android 6.
2. **Cert manual bloqueado**: El firmware modificado del Q2 no permite instalar certificados CA desde Ajustes (pide PIN y falla).
3. **APK actual incompatible**: BluetoothPrintServer usa Kotlin, Java 17, foregroundServiceType API 29, FLAG_IMMUTABLE — crashea en el Q2.
4. **Impresora integrada sin usar**: El Q2 tiene impresora térmica accesible vía AIDL, pero el sistema actual solo soporta Bluetooth externo.

## Solución: APK wrapper dedicado

### Arquitectura

```
┌──────────────────────────────────────────────┐
│              mi-pos-q2-wrapper APK            │
│                                               │
│  WebView ← file:///android_asset/www/         │
│  (index.html, css/, js/ — todo local)         │
│         │                                     │
│         │ fetch("/supabase/...")               │
│         ▼                                     │
│  NanoHTTPD proxy (127.0.0.1:8090)             │
│  └─ OkHttp con ISRG Root X1 embebido         │
│     └─ Reenvía a https://...supabase.co       │
│                                               │
│  JS Bridge: window.Q2Printer                  │
│  └─ AIDL woyou.aidlservice.jiuiv5            │
│     └─ Impresora térmica integrada 58mm       │
└──────────────────────────────────────────────┘
```

**Flujo:**
1. La UI carga desde archivos locales (sin red, sin TLS)
2. Solo las llamadas a Supabase API pasan por el proxy local
3. El proxy usa OkHttp con certificado ISRG Root X1 embebido en el APK
4. La impresora se controla vía JS bridge → AIDL directo al hardware

### Stack técnico

| Decisión | Valor | Motivo |
|----------|-------|--------|
| Lenguaje | **Java puro** (NO Kotlin) | Máxima compatibilidad con ART de Android 6 modificado |
| Java target | **1.8** | ART viejo no soporta bytecode de Java 17 |
| minSdk | **23** | Android 6.0 del Q2 |
| targetSdk | **28** | Permite HTTP a localhost sin network_security_config (que Android 6 ignora) |
| compileSdk | **34** | Para compilar con herramientas modernas |
| UI | **Programática** (sin XML layouts) | Evita dependencias de ViewBinding/DataBinding |
| HTTP server | **NanoHTTPD** | Liviano, Java puro, ya usado en BluetoothPrintServer |
| HTTP client | **OkHttp 4.x** | Soporta custom TrustManager para ISRG Root X1 |
| Impresora | **AIDL woyou.aidlservice.jiuiv5** | Confirmado en JICAI Q2 por repos open-source |
| GMS | **play-services-base** | Para ProviderInstaller (intenta actualizar TLS del sistema) |

## Estructura del proyecto

```
mi-pos-q2-wrapper/
├── app/
│   ├── build.gradle
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── assets/
│       │   ├── isrgrootx1.pem              ← Certificado ISRG Root X1
│       │   └── www/                         ← Copia de mi-pos (se sincroniza)
│       │       ├── index.html
│       │       ├── css/pos.css
│       │       ├── js/config.js             ← Modificado: SUPA_URL apunta a proxy local
│       │       ├── js/state.js
│       │       ├── js/selectors.js
│       │       ├── js/ui.js
│       │       ├── js/ventas.js
│       │       ├── js/cobro.js
│       │       ├── js/pedidos.js
│       │       ├── js/impresion.js
│       │       ├── js/turno.js
│       │       ├── js/productos.js
│       │       ├── js/sync.js
│       │       ├── js/licencia.js
│       │       ├── js/mesas.js
│       │       ├── js/app.js
│       │       ├── js/init.js
│       │       ├── manifest.json
│       │       ├── icon.png
│       │       ├── icon-192.png
│       │       └── icon-512.png
│       ├── aidl/woyou/aidlservice/jiuiv5/
│       │   ├── IWoyouService.aidl           ← Interfaz de impresora JICAI/Sunmi
│       │   ├── ICallback.aidl
│       │   └── TransBean.aidl
│       └── java/com/ampersandpos/q2/
│           ├── MainActivity.java            ← WebView + fullscreen + bridges
│           ├── ProxyServer.java             ← NanoHTTPD proxy con OkHttp+ISRG
│           ├── Q2PrinterBridge.java         ← JS bridge para impresora AIDL
│           └── TlsHelper.java              ← OkHttpClient con cert custom
├── build.gradle                             ← Project-level
├── settings.gradle
└── gradle/wrapper/
```

## Componentes detallados

### 1. MainActivity.java

- Fullscreen immersive (sin barra de estado/navegación)
- WebView cargando `file:///android_asset/www/index.html`
- Mixed content permitido (para fetch a 127.0.0.1)
- JavaScript habilitado, DOM storage, cookies
- Registra JS bridge: `webView.addJavascriptInterface(new Q2PrinterBridge(...), "Q2Printer")`
- Intenta `ProviderInstaller.installIfNeeded()` al inicio como safety net
- `softInputMode = adjustPan` para que el teclado no aplaste la UI POS
- Back button navega dentro del WebView (no cierra la app)

### 2. ProxyServer.java (NanoHTTPD)

- Escucha en `127.0.0.1:8090`
- Rutas:
  - `/supabase/*` → reenvía a `https://kmreiniqgcvqgdtzvmel.supabase.co/*` via OkHttp
  - `/health` → responde 200 OK (para verificar que el proxy corre)
- Headers: copia apikey, Authorization, Content-Type, Prefer del request original
- Body: pasa tal cual para POST/PATCH/DELETE
- Timeout: 30s por request

### 3. TlsHelper.java

- Carga `isrgrootx1.pem` desde assets
- Crea un `KeyStore` con el cert ISRG + los certs del sistema
- Construye `TrustManager` compuesto (sistema + custom)
- Devuelve un `OkHttpClient` configurado con el SSLContext custom

### 4. Q2PrinterBridge.java

- Bind al servicio AIDL `woyou.aidlservice.jiuiv5.IWoyouService`
- Métodos expuestos a JavaScript:

```javascript
// Desde el JS de mi-pos:
window.Q2Printer.printText("Texto\n");              // Imprime texto
window.Q2Printer.printBold("TITULO\n");              // Texto en negrita
window.Q2Printer.printBarcode("1234567890");          // Código de barras
window.Q2Printer.feedLines(3);                        // Avanza papel
window.Q2Printer.cutPaper();                          // Corta papel
window.Q2Printer.printReceipt(jsonTicketData);        // Imprime ticket completo
window.Q2Printer.isConnected();                       // Verifica conexión
```

- `printReceipt(json)`: recibe el mismo formato de datos que `imprimirRecibo()` usa, parsea el JSON y genera la secuencia de impresión con `IWoyouService`
- Fallback a ESC/POS sobre `/dev/ttyS1` si el servicio AIDL no está disponible

### 5. Modificaciones a mi-pos para el wrapper

En `assets/www/js/config.js`:
```javascript
// Detectar si estamos dentro del wrapper Q2
var ES_Q2_WRAPPER = typeof window.Q2Printer !== 'undefined';

// Redirigir Supabase a través del proxy local
if (ES_Q2_WRAPPER) {
  var SUPA_URL = 'http://127.0.0.1:8090/supabase';
} else {
  var SUPA_URL = 'https://kmreiniqgcvqgdtzvmel.supabase.co';
}
```

En `assets/www/js/impresion.js` — agregar detección del Q2:
```javascript
function isQ2Terminal() {
  return typeof window.Q2Printer !== 'undefined';
}

// En imprimirRecibo(), agregar al inicio:
if (isQ2Terminal()) {
  window.Q2Printer.printReceipt(JSON.stringify(data));
  toast('✓ Impreso');
  return;
}
```

## Comandos ADB para ejecutar antes de compilar

Estos comandos confirman la configuración del dispositivo y son necesarios para ajustar el APK:

```bash
# 1. Confirmar servicio de impresora AIDL
adb shell service list | grep -i -E "woyou|sunmi|print"
adb shell pm list packages | grep -i -E "woyou|sunmi|print|jicai"
adb shell dumpsys activity services | grep -i -E "woyou|sunmi|print"

# 2. Capturar crash log del APK actual
adb shell am start -n com.printserver/.MainActivity
adb logcat -s "AndroidRuntime:E" | head -50

# 3. Puertos serial (fallback para impresora)
adb shell ls -la /dev/ttyS*
adb shell ls -la /dev/ttyMT*

# 4. Confirmar arquitectura CPU
adb shell getprop ro.product.cpu.abi

# 5. Ver WebView provider
adb shell dumpsys webviewupdate

# 6. Verificar almacén de certificados del sistema
adb shell ls /system/etc/security/cacerts/ | wc -l
adb shell ls /system/etc/security/cacerts/ | grep -i isrg
```

## Dependencias (build.gradle app)

```groovy
dependencies {
    implementation 'com.google.android.gms:play-services-base:18.3.0'  // ProviderInstaller
    implementation 'com.squareup.okhttp3:okhttp:4.12.0'                // HTTP client con TLS custom
    implementation 'org.nanohttpd:nanohttpd:2.3.1'                     // Proxy server local
}
```

## Flujo de actualización de la web app

Cuando se actualiza mi-pos en producción, hay que actualizar los assets del wrapper:

1. Copiar los archivos actualizados de `mi-pos/` a `mi-pos-q2-wrapper/app/src/main/assets/www/`
2. Aplicar la modificación de `config.js` (SUPA_URL condicional)
3. Compilar nueva versión del APK
4. Instalar en el Q2 vía `adb install -r app-release.apk`

**Mejora futura**: implementar hot-update donde el APK descarga los assets actualizados al almacenamiento interno y los sirve desde ahí en vez de desde `/android_asset/`. Así no se necesita reinstalar el APK para cada actualización de la web.

## Repos de referencia

- [areeb111/jicai-q2-sdk](https://github.com/areeb111/jicai-q2-sdk) — SDK original JICAI Q2
- [std66/TomiSoft.Printing.Thermal.AndroidQ2Pos](https://github.com/std66/TomiSoft.Printing.Thermal.AndroidQ2Pos) — Testeado en JICAI Q2 Android 6.0
- [Woyou IWoyouService AIDL](https://github.com/nickstenning/escposprinter/tree/master/app/src/main/aidl/woyou/aidlservice/jiuiv5) — Definición AIDL
- [DantSu/ESCPOS-ThermalPrinter-Android](https://github.com/DantSu/ESCPOS-ThermalPrinter-Android) — ESC/POS por serial (fallback)
- [NanoHTTPD](https://github.com/NanoHttpd/nanohttpd) — Servidor HTTP embebido
- [Let's Encrypt ISRG Root X1](https://letsencrypt.org/certs/isrgrootx1.pem) — Certificado a embeber

## Estimación de esfuerzo

| Fase | Tarea | Tiempo estimado |
|------|-------|----------------|
| 1 | Ejecutar comandos ADB, confirmar AIDL y capturar crash | 30 min |
| 2 | Crear proyecto Android, MainActivity + WebView | 2 horas |
| 3 | Implementar ProxyServer + TlsHelper | 2 horas |
| 4 | Implementar Q2PrinterBridge (AIDL) | 3 horas |
| 5 | Copiar assets de mi-pos, modificar config.js | 30 min |
| 6 | Testing en dispositivo real, ajustes | 2 horas |
| **Total** | | **~10 horas** |
