#!/usr/bin/env bash
# Empacota o launcher e instala na LG C1 (device "lgc1" do @webos-tools/cli).
# Uso: ./scripts/deploy.sh            -> empacota, instala e abre
#      ./scripts/deploy.sh --no-launch
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/dist"
[ -f "$ROOT/.env" ] && . "$ROOT/.env"
DEVICE="${DEVICE:-lgc1}"
APP_ID="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["id"])' "$ROOT/app/appinfo.json")"
VERSION="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["version"])' "$ROOT/app/appinfo.json")"

mkdir -p "$OUT"
ares-package "$ROOT/app" -o "$OUT"
ares-install --device "$DEVICE" "$OUT/${APP_ID}_${VERSION}_all.ipk"

if [[ "${1:-}" != "--no-launch" ]]; then
    ares-launch --device "$DEVICE" --close "$APP_ID" >/dev/null 2>&1 || true
    ares-launch --device "$DEVICE" "$APP_ID"
fi
