@echo off
chcp 65001 >nul
echo ============================================
echo   Reinstalando USB Print Server (version corregida)
echo ============================================
echo.
echo Cerrando version anterior si esta corriendo...
taskkill /F /IM usb-print-server.exe >nul 2>nul
timeout /T 1 /NOBREAK >nul

set "TMPDIR=%TEMP%\usb-print-server-update"
if exist "%TMPDIR%" rmdir /S /Q "%TMPDIR%"
mkdir "%TMPDIR%"

echo Descargando version nueva...
powershell -NoProfile -Command "try { Invoke-WebRequest -Uri 'https://mi-pos-android6.pages.dev/downloads/usb-print-server-windows.zip' -OutFile '%TMPDIR%\usb-print-server.zip' -UseBasicParsing } catch { Write-Host 'ERROR AL DESCARGAR: ' $_.Exception.Message; exit 1 }"
if errorlevel 1 (
  echo.
  echo No se pudo descargar. Revisa la conexion a internet e intenta de nuevo.
  pause
  exit /b 1
)

echo Descomprimiendo...
powershell -NoProfile -Command "Expand-Archive -Path '%TMPDIR%\usb-print-server.zip' -DestinationPath '%TMPDIR%' -Force"

echo.
echo Instalando la version nueva...
echo.
call "%TMPDIR%\instalar.bat"
