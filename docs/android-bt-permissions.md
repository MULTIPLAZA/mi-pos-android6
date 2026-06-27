# Android Bluetooth Permissions Guide for POS Apps

Reference guide for the **BluetoothPrintServer** APK used with mi-pos.
Covers Android 6 (API 23) through Android 15+ (API 35).

Source code location: `C:/Users/Administrador/Documents/GitHub/BluetoothPrintServer/`

---

## 1. AndroidManifest.xml Permissions

The manifest must declare permissions for ALL API levels. Android ignores
permissions that don't apply to the running version.

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

    <!-- ════════════════════════════════════════════════════════════
         BLUETOOTH - Legacy (API 23-30, Android 6-11)
         ════════════════════════════════════════════════════════════ -->
    <uses-permission android:name="android.permission.BLUETOOTH"
        android:maxSdkVersion="30" />
    <uses-permission android:name="android.permission.BLUETOOTH_ADMIN"
        android:maxSdkVersion="30" />

    <!-- ════════════════════════════════════════════════════════════
         BLUETOOTH - Modern (API 31+, Android 12+)
         These are runtime permissions — must be requested at launch.
         ════════════════════════════════════════════════════════════ -->
    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
    <uses-permission android:name="android.permission.BLUETOOTH_SCAN"
        android:usesPermissionFlags="neverForLocation"
        tools:targetApi="s" />
    <!-- ADVERTISE is needed on some cheap tablets even just to list paired devices -->
    <uses-permission android:name="android.permission.BLUETOOTH_ADVERTISE" />

    <!-- ════════════════════════════════════════════════════════════
         LOCATION - Required for BT discovery on API < 31
         Not needed on API 31+ when using neverForLocation flag above.
         ════════════════════════════════════════════════════════════ -->
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />

    <!-- ════════════════════════════════════════════════════════════
         NETWORK & SERVICE
         ════════════════════════════════════════════════════════════ -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <!-- Required on API 34+ (Android 14) — must match foregroundServiceType in <service> -->
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <!-- Required on API 33+ (Android 13) for foreground service notifications -->
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <!-- Hardware feature: set required=false if the app should install on non-BT devices -->
    <uses-feature
        android:name="android.hardware.bluetooth"
        android:required="true" />

    <application ...>
        <activity
            android:name=".ui.MainActivity"
            android:exported="true"
            android:windowSoftInputMode="adjustResize"
            ... />

        <!-- foregroundServiceType is MANDATORY on API 34+ -->
        <service
            android:name=".service.PrinterService"
            android:foregroundServiceType="connectedDevice"
            ... />
    </application>
</manifest>
```

### Permission matrix by API level

| API | Android | BT Permissions Required | Location Required? | Notes |
|-----|---------|------------------------|--------------------|-------|
| 23-28 | 6.0-9.0 | BLUETOOTH + BLUETOOTH_ADMIN | ACCESS_COARSE_LOCATION | Location can be coarse |
| 29-30 | 10-11 | BLUETOOTH + BLUETOOTH_ADMIN | ACCESS_FINE_LOCATION | Must be fine location |
| 31-32 | 12-12L | BLUETOOTH_CONNECT + BLUETOOTH_SCAN | No (with neverForLocation) | New runtime permissions |
| 33 | 13 | Same + POST_NOTIFICATIONS | No | Notification permission added |
| 34 | 14 | Same | No | foregroundServiceType enforced |
| 35 | 15 | Same | No | No new BT changes |

---

## 2. Runtime Permission Request (Kotlin)

```kotlin
import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

object PermissionHelper {

    const val REQUEST_CODE_BLUETOOTH     = 1001
    const val REQUEST_CODE_NOTIFICATIONS = 1002

    /**
     * Returns the exact permissions needed for the current API level.
     * Includes BLUETOOTH_ADVERTISE for API 31+ because some budget tablets
     * (CIDEA, Kanji) require it even to enumerate paired devices.
     */
    fun requiredPermissions(): Array<String> = when {
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> arrayOf(   // API 31+
            Manifest.permission.BLUETOOTH_CONNECT,
            Manifest.permission.BLUETOOTH_SCAN,
            Manifest.permission.BLUETOOTH_ADVERTISE
        )
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q -> arrayOf(   // API 29-30
            Manifest.permission.BLUETOOTH,
            Manifest.permission.BLUETOOTH_ADMIN,
            Manifest.permission.ACCESS_FINE_LOCATION
        )
        else -> arrayOf(                                              // API 23-28
            Manifest.permission.BLUETOOTH,
            Manifest.permission.BLUETOOTH_ADMIN,
            Manifest.permission.ACCESS_COARSE_LOCATION
        )
    }

    fun hasBluetoothPermissions(context: Context): Boolean =
        requiredPermissions().all {
            ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
        }

    fun requestBluetoothPermissions(activity: Activity) {
        ActivityCompat.requestPermissions(
            activity,
            requiredPermissions(),
            REQUEST_CODE_BLUETOOTH
        )
    }

    fun allGranted(grantResults: IntArray): Boolean =
        grantResults.isNotEmpty() && grantResults.all { it == PackageManager.PERMISSION_GRANTED }

    /**
     * Returns permissions the user has NOT yet granted.
     */
    fun missingPermissions(context: Context): List<String> =
        requiredPermissions().filter {
            ContextCompat.checkSelfPermission(context, it) != PackageManager.PERMISSION_GRANTED
        }

    /**
     * True when the user checked "Don't ask again" — the system dialog won't
     * appear, so we must send the user to Settings manually.
     */
    fun isPermanentlyDenied(activity: Activity, permission: String): Boolean =
        !ActivityCompat.shouldShowRequestPermissionRationale(activity, permission) &&
        ContextCompat.checkSelfPermission(activity, permission) != PackageManager.PERMISSION_GRANTED
}
```

### Handling the result in Activity

```kotlin
override fun onRequestPermissionsResult(
    requestCode: Int,
    permissions: Array<out String>,
    grantResults: IntArray
) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults)

    if (requestCode == PermissionHelper.REQUEST_CODE_BLUETOOTH) {
        if (PermissionHelper.allGranted(grantResults)) {
            // Good to go — proceed with BT operations
        } else {
            // Check if permanently denied -> redirect to Settings
            val missing = PermissionHelper.missingPermissions(this)
            val permanentlyDenied = missing.any { PermissionHelper.isPermanentlyDenied(this, it) }

            if (permanentlyDenied) {
                // System dialog won't appear — must open app settings
                AlertDialog.Builder(this)
                    .setTitle("Bluetooth Permission Required")
                    .setMessage(
                        "This app needs Bluetooth permission to connect to your printer.\n\n" +
                        "Tap 'Open Settings', then enable:\n" +
                        "  - Nearby devices (or Bluetooth)\n" +
                        "  - Notifications\n\n" +
                        "Then come back to the app."
                    )
                    .setCancelable(false)
                    .setPositiveButton("Open Settings") { _, _ ->
                        startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                            data = Uri.fromParts("package", packageName, null)
                        })
                    }
                    .show()
            } else {
                // User denied but didn't check "Don't ask again" — can retry
                Toast.makeText(this, "Bluetooth permission is required", Toast.LENGTH_LONG).show()
            }
        }
    }
}
```

---

## 3. windowSoftInputMode for POS Apps

In the `<activity>` tag:

```xml
android:windowSoftInputMode="adjustResize"
```

**Why `adjustResize`:**
- POS apps typically have input fields for quantities, prices, search, MAC addresses.
- `adjustResize` shrinks the layout to fit above the keyboard, keeping buttons visible.
- `adjustPan` scrolls the view up, which hides the top toolbar and status indicators.
- `adjustNothing` is never appropriate for POS — the keyboard covers input fields.

**For WebView-based POS apps (like mi-pos):**
- `adjustResize` ensures the WebView's `visualViewport` resize event fires.
- JavaScript can listen to `visualViewport.resize` to reposition elements.
- On some tablets, `adjustResize` + `<meta name="viewport" content="..., interactive-widget=resizes-content">` gives the best behavior.

---

## 4. Common Pitfalls with Specific Tablet Brands

### CIDEA CM517B (Android 16 / API 36)

**Problem:** Bluetooth permissions are silently blocked even after granting them in the system dialog.

**Root cause:** CIDEA's custom Android ROM has a "Permission Manager" app that overrides standard Android permission grants. The ROM also reports Android 16 but has non-standard permission behavior.

**Fix:**
1. Go to Settings > Apps > Permission Manager (or "Security Center")
2. Find BluetoothPrintServer in the list
3. Manually enable "Nearby devices" and "Bluetooth"
4. If "Permission Manager" doesn't exist, try Settings > Apps > BluetoothPrintServer > Permissions > enable all
5. Reboot the device after changing permissions

**Code workaround:** Always check `isPermanentlyDenied()` and redirect to Settings instead of showing the system permission dialog, which may silently fail on these ROMs.

### Kanji Arata / Kanji Yubi

**Problem:** `bondedDevices` returns empty set even when printers are paired.

**Root cause:** Missing `BLUETOOTH_ADVERTISE` permission. Kanji's BT stack apparently requires all three new permissions (CONNECT + SCAN + ADVERTISE) even for read-only operations.

**Fix:** Include `BLUETOOTH_ADVERTISE` in the manifest and runtime request (already done in our code).

### Generic Chinese Tablets (RK3288/RK3368 chipset)

**Problem:** Bluetooth connection drops after 30-60 seconds of idle time.

**Root cause:** Aggressive battery optimization kills the Bluetooth socket.

**Fix:**
1. Request the user to disable battery optimization for the app:
   ```kotlin
   val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
       data = Uri.parse("package:$packageName")
   }
   startActivity(intent)
   ```
2. Use `WAKE_LOCK` to prevent the CPU from sleeping.
3. Implement reconnect with exponential backoff (already done in `BluetoothPrinterManager.kt`).

### All Budget Tablets: Bluetooth Adapter State

**Problem:** `BluetoothAdapter.getDefaultAdapter()` returns null on some devices even though they have Bluetooth hardware.

**Fix:** Use `BluetoothManager` system service instead:
```kotlin
val btManager = getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
val adapter = btManager?.adapter  // More reliable than BluetoothAdapter.getDefaultAdapter()
```

### All Brands: First-time Pairing

**Problem:** The app can't find the printer because it was never paired.

**User instruction:**
1. Turn on the printer
2. Go to Android Settings > Bluetooth > Pair new device
3. Select the printer (usually named "Printer-XXXX" or "BlueTooth Printer")
4. Enter PIN: `1234` or `0000` (standard for thermal printers)
5. THEN open the BluetoothPrintServer app

---

## 5. WebView Version Detection from Java/Kotlin

Many POS tablets ship with Chrome/WebView 60-80. The mi-pos web app requires 87+.

### Detection code

```kotlin
import android.os.Build
import android.webkit.WebView

/**
 * Get the major version of the active WebView provider.
 * Returns 0 if detection fails.
 */
fun getWebViewMajorVersion(context: Context): Int {
    return try {
        val packageInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WebView.getCurrentWebViewPackage()   // API 26+
        } else {
            context.packageManager.getPackageInfo("com.google.android.webview", 0)
        }
        packageInfo?.versionName
            ?.split(".")
            ?.firstOrNull()
            ?.toIntOrNull() ?: 0
    } catch (_: Exception) {
        0
    }
}

/**
 * Full WebView info string for diagnostics.
 * Example: "114.0.5735.196 (com.android.chrome)"
 */
fun getWebViewInfo(context: Context): String {
    return try {
        val pkg = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WebView.getCurrentWebViewPackage()
        } else {
            context.packageManager.getPackageInfo("com.google.android.webview", 0)
        }
        if (pkg != null) "${pkg.versionName} (${pkg.packageName})" else "Unknown"
    } catch (_: Exception) {
        "Detection failed"
    }
}
```

### Showing a warning dialog

```kotlin
fun checkWebViewVersion(activity: Activity) {
    val version = getWebViewMajorVersion(activity)
    if (version in 1..86) {
        AlertDialog.Builder(activity)
            .setTitle("WebView Outdated")
            .setMessage(
                "Your device has Chrome/WebView version $version.\n\n" +
                "mi-pos requires version 87 or higher.\n\n" +
                "Please update 'Android System WebView' or 'Google Chrome' " +
                "from the Play Store, or use a device with a newer browser."
            )
            .setPositiveButton("Open Play Store") { _, _ ->
                try {
                    activity.startActivity(Intent(Intent.ACTION_VIEW,
                        Uri.parse("market://details?id=com.google.android.webview")))
                } catch (_: Exception) {
                    activity.startActivity(Intent(Intent.ACTION_VIEW,
                        Uri.parse("https://play.google.com/store/apps/details?id=com.google.android.webview")))
                }
            }
            .setNegativeButton("Continue Anyway", null)
            .show()
    }
}
```

### WebView provider packages by device

| Package | When used |
|---------|-----------|
| `com.google.android.webview` | Default on most devices (API 23-28) |
| `com.android.chrome` | Chrome acts as WebView provider (API 29+) |
| `com.huawei.webview` | Huawei devices without GMS |
| `com.aspect.browser` | Some Chinese tablets |

---

## 6. build.gradle Key Settings

```groovy
android {
    compileSdk 34
    defaultConfig {
        minSdk 23          // Android 6.0 — covers 99%+ of POS tablets
        targetSdk 34       // Required for Play Store as of Aug 2024
    }
}
```

**Why targetSdk 34 matters:**
- API 34 enforces `foregroundServiceType` on `<service>` declarations. Without `connectedDevice`, the foreground service will crash on Android 14+.
- API 33 requires `POST_NOTIFICATIONS` runtime permission. Without it, the foreground service notification is silently suppressed.
- API 31 makes `BLUETOOTH_CONNECT` / `BLUETOOTH_SCAN` mandatory. Apps targeting 30 or lower get automatic grants but this won't work forever.

---

## 7. Quick Checklist for Developers

- [ ] Manifest has ALL six BT permissions (BLUETOOTH, BLUETOOTH_ADMIN, BLUETOOTH_CONNECT, BLUETOOTH_SCAN, BLUETOOTH_ADVERTISE, location)
- [ ] Legacy permissions have `android:maxSdkVersion="30"`
- [ ] BLUETOOTH_SCAN has `android:usesPermissionFlags="neverForLocation"`
- [ ] POST_NOTIFICATIONS permission is declared
- [ ] FOREGROUND_SERVICE_CONNECTED_DEVICE permission is declared
- [ ] `<service>` has `android:foregroundServiceType="connectedDevice"`
- [ ] Runtime code branches on `Build.VERSION.SDK_INT >= Build.VERSION_CODES.S`
- [ ] `isPermanentlyDenied()` check redirects to Settings (critical for CIDEA/Kanji)
- [ ] `windowSoftInputMode="adjustResize"` is set on the activity
- [ ] WebView version is checked on startup with a warning for < 87
- [ ] Battery optimization exemption is requested for reliable BT connection
- [ ] `targetSdk` is 34 in build.gradle
