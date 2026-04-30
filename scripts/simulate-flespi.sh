#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  simulate-flespi.sh
#  ─────────────────────────────────────────────────────────────
#  Posta el sample fixture al endpoint /api/ingest/flespi para
#  testing en local.
#
#  Uso:
#    bash scripts/simulate-flespi.sh
#    bash scripts/simulate-flespi.sh path/to/custom.json
#    bash scripts/simulate-flespi.sh path/to/file.json https://otro.host
#
#  Variables de entorno:
#    FLESPI_INGEST_TOKEN  · debe matchear el de .env.local
#    BASE_URL             · default http://localhost:3000
# ═══════════════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
FIXTURE="${1:-$SCRIPT_DIR/simulate-flespi-fixture.json}"
BASE_URL="${2:-${BASE_URL:-http://localhost:3000}}"
TOKEN="${FLESPI_INGEST_TOKEN:-}"

if [ ! -f "$FIXTURE" ]; then
  echo "ERROR · fixture no existe: $FIXTURE"
  exit 1
fi

if [ -z "$TOKEN" ]; then
  # Probamos leer del .env.local del proyecto
  ENV_FILE="$SCRIPT_DIR/../.env.local"
  if [ -f "$ENV_FILE" ]; then
    TOKEN=$(grep "^FLESPI_INGEST_TOKEN=" "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")
  fi
fi

if [ -z "$TOKEN" ]; then
  echo "ERROR · FLESPI_INGEST_TOKEN no está en env ni en .env.local"
  echo "Ejemplo: FLESPI_INGEST_TOKEN=tk_dev_test bash $0"
  exit 1
fi

echo "→ POST $BASE_URL/api/ingest/flespi"
echo "→ fixture: $FIXTURE"
echo

curl -sS -X POST "$BASE_URL/api/ingest/flespi" \
  -H "Content-Type: application/json" \
  -H "X-Flespi-Token: $TOKEN" \
  --data-binary @"$FIXTURE" | {
    if command -v jq > /dev/null 2>&1; then
      jq .
    else
      cat
      echo
    fi
  }

echo
echo "✓ done"
