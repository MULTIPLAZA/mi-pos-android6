#!/usr/bin/env bash
# Deploy manual de mi-pos-android6 a Cloudflare Pages.
#
# Por que existe este script y no un simple `wrangler pages deploy .`:
# el proyecto no esta conectado a Git en Cloudflare Pages (deploy 100% manual), y
# `wrangler pages deploy .` NO respeta `.assetsignore` en este modo (confirmado
# 2026-08-10: un archivo nunca antes subido quedo accesible igual). Sin esto,
# quedan publicos node_modules/, supabase-migrations/, database/, y sobre todo
# android-apk/ (keystore.jks + contrasenas en texto plano). Este script arma una
# copia limpia en un directorio temporal y deploya desde ahi.
#
# Uso: correr desde la raiz del repo (bash scripts/deploy-pages.sh)
set -euo pipefail
cd "$(dirname "$0")/.."

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
# robocopy es un exe nativo de Windows - hay DOS trampas de traduccion de rutas de
# Git Bash/MSYS acá, confirmadas ambas en vivo el 2026-08-11:
#  1. Sin MSYS_NO_PATHCONV, bash mal-traduce el flag /E de robocopy (lo confunde con
#     una ruta de unidad "E:/" - error "parametro no valido").
#  2. CON MSYS_NO_PATHCONV=1 puesto a lo bruto en toda la linea, bash NO traduce
#     tampoco el path de $STAGE (que viene en formato posix de mktemp), y robocopy
#     interpreta "/tmp/xxx" como "raiz del drive actual" (C:\tmp\xxx) - una carpeta
#     DISTINTA de donde realmente esta $STAGE. robocopy copiaba bien pero a la
#     carpeta equivocada, y el wrangler de abajo (que sí recibe $STAGE bien
#     traducido por bash, sin el override) deployaba un directorio vacío ->
#     "Uploaded 0 files" silencioso, sitio en blanco en producción.
# Solución: resolver la ruta a formato Windows UNA sola vez con cygpath ANTES de
# poner MSYS_NO_PATHCONV=1 (que sigue haciendo falta, pero solo para proteger el /E).
STAGE_WIN="$(cygpath -w "$STAGE")"

MSYS_NO_PATHCONV=1 robocopy . "$STAGE_WIN" /E \
  /XD .git .github .wrangler node_modules _EJECUTAR_EN_SUPABASE database docs \
      supabase-migrations test-results tests workers android-apk scripts \
  /XF .gitignore .eslintignore .eslintrc.json .prettierignore .prettierrc.json \
      .editorconfig .assetsignore package.json package-lock.json \
      playwright.config.js mockup-tema-moderno.html mockup-inventario-historial.html \
  || true  # robocopy exit codes 0-7 son exito, solo >=8 es error real

# Verificacion minima: si esto no existe, el deploy de abajo subiria un sitio vacio
# en silencio otra vez. Mejor fallar ruidoso aca que descubrirlo con el sitio roto.
if [ ! -f "$STAGE/index.html" ]; then
  echo "ERROR: robocopy no copio index.html a $STAGE_WIN - abortando deploy." >&2
  exit 1
fi

npx wrangler pages deploy "$STAGE" --project-name=mi-pos-android6 --commit-dirty=true
