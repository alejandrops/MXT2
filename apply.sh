#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  apply.sh · Lote O1 · /admin/ingestion-status
#  ─────────────────────────────────────────────────────────────
#  Pantalla de monitoreo en tiempo real del endpoint flespi.
#  Reemplaza el `curl /api/ingest/flespi/metrics | jq` con una UI.
#
#  Lo que muestra:
#   · KPI strip con totales acumulados (received/ok/skipped/
#     errores/duplicados) + porcentajes
#   · Card · Detección de viajes (trips creados / descartados)
#   · Card · Razones de descarte (skip reasons desglosados)
#   · Card · Devices silenciosos (5min / 1h / 24h / nunca)
#   · Auto-refresh cada 30s con toggle
#
#  Archivos nuevos:
#   · src/app/admin/ingestion-status/page.tsx · Server Component
#     con permission check (solo SA y MA)
#   · src/app/admin/ingestion-status/IngestionStatusClient.tsx ·
#     Client Component con UI + auto-refresh
#   · src/app/admin/ingestion-status/page.module.css
#
#  Archivos modificados:
#   · src/components/shell/AdminSidebar.tsx · agrega link
#     "Estado ingestion" debajo de "Dispositivos"
#
#  Pre-requisitos:
#   · I1 · endpoint /api/ingest/flespi
#   · I4 · endpoint /api/ingest/flespi/metrics
# ═══════════════════════════════════════════════════════════════

set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
GREY='\033[0;90m'
NC='\033[0m'

LOTE_NAME="O1 · /admin/ingestion-status"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

if [ ! -d "$SCRIPT_DIR/src" ]; then
  echo "ERROR · No encuentro 'src' en $SCRIPT_DIR/src"
  exit 1
fi

if [ ! -d "src" ] || [ ! -f "package.json" ]; then
  echo "ERROR · No encuentro la raíz del proyecto Next.js."
  exit 1
fi

if [ ! -f "src/app/api/ingest/flespi/metrics/route.ts" ]; then
  echo "ERROR · No encuentro src/app/api/ingest/flespi/metrics/route.ts"
  echo "        · Aplicá primero el lote I4."
  exit 1
fi

echo -e "${CYAN}═══ Lote $LOTE_NAME ═══${NC}"
echo

written=0
unchanged=0
created=0

apply_file() {
  local rel="$1"
  local src="$SCRIPT_DIR/$rel"
  local dst="$rel"

  if [ ! -f "$src" ]; then
    echo -e "  ${YELLOW}skip${NC}  $rel"
    return
  fi

  mkdir -p "$(dirname "$dst")"

  if [ ! -f "$dst" ]; then
    cp "$src" "$dst"
    echo -e "  ${GREEN}new ${NC}  $rel"
    created=$((created + 1))
    return
  fi

  if cmp -s "$src" "$dst"; then
    echo -e "  ${GREY}same${NC}  $rel"
    unchanged=$((unchanged + 1))
  else
    cp "$src" "$dst"
    echo -e "  ${GREEN}upd ${NC}  $rel"
    written=$((written + 1))
  fi
}

echo -e "${CYAN}── Pantalla nueva ──${NC}"
apply_file "src/app/admin/ingestion-status/page.tsx"
apply_file "src/app/admin/ingestion-status/IngestionStatusClient.tsx"
apply_file "src/app/admin/ingestion-status/page.module.css"

echo
echo -e "${CYAN}── Sidebar admin · agregar link ──${NC}"
apply_file "src/components/shell/AdminSidebar.tsx"

echo
echo -e "${CYAN}─── Resumen ───${NC}"
echo "  Nuevos:        $created"
echo "  Actualizados:  $written"
echo "  Sin cambios:   $unchanged"
echo

if [ -d ".next" ]; then
  rm -rf .next
  echo -e "  ${GREY}.next eliminado${NC}"
  echo
fi

echo -e "${GREEN}✓ Lote $LOTE_NAME aplicado.${NC}"
echo
echo -e "${YELLOW}══ TESTING ══${NC}"
echo
echo "  1. Como SUPER_ADMIN o MAXTRACKER_ADMIN, ir a:"
echo "       /admin → debería verse 'Estado ingestion' en el sidebar"
echo "       /admin/ingestion-status → la pantalla"
echo
echo "  2. Como CLIENT_ADMIN o OPERATOR, navegar manualmente a"
echo "     /admin/ingestion-status → redirect a /admin (acceso negado)"
echo
echo "  3. Para ver datos, simular un batch:"
echo "       bash scripts/simulate-flespi-trip.sh"
echo "     Esperar 30s o apretar 'Refrescar' · los counters deben subir"
echo
echo "  4. Apagar el toggle 'Auto-refresh 30s' · debería dejar de"
echo "     actualizarse hasta que apretes el botón manual"
