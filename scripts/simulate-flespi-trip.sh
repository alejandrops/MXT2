#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  simulate-flespi-trip.sh
#  ─────────────────────────────────────────────────────────────
#  Posta un fixture de 9 messages que simula un viaje completo:
#   · 8 positions con ignition=ON
#   · 1 position final con ignition=OFF (dispara cierre del trip)
#
#  Después podés ver el Trip creado:
#   · UI: /historicos · debería aparecer el viaje
#   · DB: SELECT * FROM "Trip" ORDER BY "createdAt" DESC LIMIT 1;
#
#  Pre-requisitos:
#   · Lote I2 aplicado (seed con device IMEI 350612073987001 INSTALLED)
#   · Lote I3 aplicado (trip-detection invocado por el endpoint)
#   · FLESPI_INGEST_TOKEN configurado en .env.local
# ═══════════════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
FIXTURE="${1:-$SCRIPT_DIR/simulate-flespi-trip-fixture.json}"
BASE_URL="${2:-${BASE_URL:-http://localhost:3000}}"
TOKEN="${FLESPI_INGEST_TOKEN:-}"

if [ ! -f "$FIXTURE" ]; then
  echo "ERROR · fixture no existe: $FIXTURE"
  exit 1
fi

if [ -z "$TOKEN" ]; then
  ENV_FILE="$SCRIPT_DIR/../.env.local"
  if [ -f "$ENV_FILE" ]; then
    TOKEN=$(grep "^FLESPI_INGEST_TOKEN=" "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")
  fi
fi

if [ -z "$TOKEN" ]; then
  echo "ERROR · FLESPI_INGEST_TOKEN no está en env ni en .env.local"
  exit 1
fi

echo "→ POST $BASE_URL/api/ingest/flespi"
echo "→ fixture trip: $FIXTURE"
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
echo "✓ done · si trips.tripsCreated=1, el Trip quedó persistido"
