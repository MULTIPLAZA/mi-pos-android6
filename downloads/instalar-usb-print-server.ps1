$logPath = Join-Path $env:TEMP "usb-install-log.txt"
try { Start-Transcript -Path $logPath -Force | Out-Null } catch {}

function Ejecutar {
    Write-Host "Cerrando version anterior..." -ForegroundColor Yellow
    $deadline = (Get-Date).AddSeconds(15)
    Stop-Process -Name usb-print-server -Force -ErrorAction SilentlyContinue
    while ((Get-Process -Name usb-print-server -ErrorAction SilentlyContinue) -and (Get-Date) -lt $deadline) {
        Start-Sleep -Milliseconds 500
        Stop-Process -Name usb-print-server -Force -ErrorAction SilentlyContinue
    }
    if (Get-Process -Name usb-print-server -ErrorAction SilentlyContinue) {
        Write-Host "ERROR: no se pudo cerrar el proceso anterior. Reinicia la PC e intenta de nuevo." -ForegroundColor Red
        return
    }
    Write-Host "OK, version anterior cerrada." -ForegroundColor Green

    $tmp = Join-Path $env:TEMP "usb-print-server-update"
    try {
        if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
        New-Item -ItemType Directory -Path $tmp | Out-Null

        Write-Host "Descargando version nueva..." -ForegroundColor Yellow
        Invoke-WebRequest -Uri "https://mi-pos-android6.pages.dev/downloads/usb-print-server-windows.zip" -OutFile "$tmp\usb.zip" -UseBasicParsing
        Expand-Archive -Path "$tmp\usb.zip" -DestinationPath $tmp -Force
    } catch {
        Write-Host ("ERROR al descargar/descomprimir: " + $_.Exception.Message) -ForegroundColor Red
        return
    }

    $dest = Join-Path $env:LOCALAPPDATA "NODOUsbPrintServer"
    if (-not (Test-Path $dest)) { New-Item -ItemType Directory -Path $dest | Out-Null }

    Write-Host "Copiando archivos nuevos..." -ForegroundColor Yellow
    $copied = $false
    for ($i = 0; $i -lt 8; $i++) {
        try {
            Copy-Item "$tmp\usb-print-server.exe" "$dest\usb-print-server.exe" -Force
            $copied = $true
            break
        } catch {
            Start-Sleep -Milliseconds 800
        }
    }
    if (-not $copied) {
        Write-Host "ERROR: el archivo sigue bloqueado despues de varios intentos. Reinicia la PC e intenta de nuevo." -ForegroundColor Red
        return
    }
    try {
        Copy-Item "$tmp\start-hidden.vbs" "$dest\start-hidden.vbs" -Force
        Copy-Item "$tmp\desinstalar.bat" "$dest\desinstalar.bat" -Force -ErrorAction SilentlyContinue

        Write-Host "Configurando arranque automatico con Windows..." -ForegroundColor Yellow
        $startup = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Startup"
        $lnkPath = Join-Path $startup "USB Print Server.lnk"
        $wsh = New-Object -ComObject WScript.Shell
        $lnk = $wsh.CreateShortcut($lnkPath)
        $lnk.TargetPath = "$dest\start-hidden.vbs"
        $lnk.WorkingDirectory = $dest
        $lnk.Save()

        Write-Host "Iniciando el agente en background..." -ForegroundColor Yellow
        Start-Process "wscript.exe" -ArgumentList "`"$dest\start-hidden.vbs`""
    } catch {
        Write-Host ("ERROR al configurar/iniciar: " + $_.Exception.Message) -ForegroundColor Red
        return
    }
    Start-Sleep -Seconds 2

    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:9200/status" -UseBasicParsing -TimeoutSec 5
        if ($r.StatusCode -eq 200) {
            Write-Host ""
            Write-Host "============================================" -ForegroundColor Green
            Write-Host "  OK - INSTALADO Y FUNCIONANDO" -ForegroundColor Green
            Write-Host "============================================" -ForegroundColor Green
            Write-Host $r.Content
            Write-Host ""
            Write-Host "Ahora anda a mi-pos: Configuracion - Impresoras - USB LOCAL y elegi tu impresora."
        } else {
            Write-Host "El agente respondio con status $($r.StatusCode)" -ForegroundColor Red
        }
    } catch {
        Write-Host ("ERROR: el agente no responde despues de instalar: " + $_.Exception.Message) -ForegroundColor Red
    }
}

Ejecutar

try { Stop-Transcript | Out-Null } catch {}
Write-Host ""
Write-Host "(Log completo guardado en $logPath)" -ForegroundColor Cyan
Write-Host ""
Read-Host "Presiona ENTER para cerrar esta ventana"
