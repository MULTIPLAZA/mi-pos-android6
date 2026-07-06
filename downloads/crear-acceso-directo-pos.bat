@echo off
title Crear acceso directo Ampersand POS (impresion silenciosa)

echo ============================================================
echo  Crear acceso directo Ampersand POS con impresion directa
echo ============================================================
echo.

set "CHROME="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"

if "%CHROME%"=="" (
  echo  ERROR: no se encontro Chrome instalado en esta PC.
  echo  Instala Google Chrome primero y volve a correr este archivo.
  echo.
  pause
  exit /b 1
)

echo  Chrome encontrado en:
echo    %CHROME%
echo.

echo  [1/3] Configurando politica de Chrome para desactivar
echo        la vista previa de impresion...
reg add "HKCU\Software\Policies\Google\Chrome" /v PrintPreviewDisabled /t REG_DWORD /d 1 /f >NUL
if %ERRORLEVEL%==0 (
  echo        OK - politica aplicada.
) else (
  echo        ATENCION: no se pudo aplicar la politica de registro.
)
echo.

set "APPDIR=%LOCALAPPDATA%\AmpersandPOS"
if not exist "%APPDIR%" mkdir "%APPDIR%"
set "ICO=%APPDIR%\pos-icon.ico"

echo  [2/3] Descargando icono...
powershell -NoProfile -Command ^
  "try { Invoke-WebRequest -Uri 'https://mi-pos-android6.pages.dev/downloads/pos-icon.ico' -OutFile '%ICO%' -UseBasicParsing; Write-Host '       OK - icono descargado.' } catch { Write-Host '       ATENCION: no se pudo descargar el icono, se usara el de Chrome.' }"
echo.

set "DESKTOP=%USERPROFILE%\Desktop"
set "LNK=%DESKTOP%\Ampersand POS.lnk"

echo  [3/3] Creando acceso directo...
if exist "%ICO%" (
  powershell -NoProfile -Command ^
    "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%LNK%');" ^
    "$s.TargetPath='%CHROME%';" ^
    "$s.Arguments='--kiosk-printing --app=https://mi-pos-android6.pages.dev';" ^
    "$s.IconLocation='%ICO%';" ^
    "$s.Description='Ampersand POS - imprime directo sin dialogo';" ^
    "$s.Save()"
) else (
  powershell -NoProfile -Command ^
    "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%LNK%');" ^
    "$s.TargetPath='%CHROME%';" ^
    "$s.Arguments='--kiosk-printing --app=https://mi-pos-android6.pages.dev';" ^
    "$s.Description='Ampersand POS - imprime directo sin dialogo';" ^
    "$s.Save()"
)

if exist "%LNK%" (
  echo ============================================================
  echo  LISTO
  echo ============================================================
  echo.
  echo  Se creo el icono "Ampersand POS" en el Escritorio y se
  echo  desactivo la vista previa de impresion de Chrome ^(afecta a
  echo  Chrome en general en esta cuenta de Windows, no solo al POS^).
  echo.
  echo  IMPORTANTE antes de usarlo:
  echo    1. La impresora termica tiene que estar configurada como
  echo       PREDETERMINADA en Windows ^(Configuracion - Dispositivos -
  echo       Impresoras y escaneres - click en la termica -
  echo       "Establecer como predeterminada"^).
  echo    2. CERRA TODAS las ventanas de Chrome que esten abiertas
  echo       ahora mismo ^(la politica nueva no aplica a ventanas ya
  echo       abiertas^).
  echo    3. De ahora en mas, abri el POS SIEMPRE con el icono nuevo
  echo       "Ampersand POS" ^(no con un Chrome normal^). Podes borrar
  echo       o dejar de usar cualquier otro acceso directo/marcador
  echo       viejo del POS para no confundirte.
  echo.
) else (
  echo  ERROR: no se pudo crear el acceso directo.
  echo.
)

echo Presione cualquier tecla para cerrar...
pause 1>NUL
