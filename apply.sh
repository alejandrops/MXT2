#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  Maxtracker · S1-L3-mock-can · apply.sh
#  Sprint 1 · Lote 3 · Datos demo CAN bus simulando FMC003
#
#  Cambios:
#    · Nuevo módulo src/lib/mock-can/ con generador determinístico
#    · FleetAssetLive extendido con canData (CanSnapshot | null)
#      y deviceModel (FMC003 / FMC130 / FMB920 / Legacy)
#    · 80% de la flota tiene CAN bus · 20% son equipos legacy
#      o FMB920 (solo GPS) · asignación determinística por assetId
#    · AssetDetailPanel muestra secciones reales:
#      Entradas (puerta, cinturón, freno mano, PTO)
#      Telemetría CAN (RPM, temp motor, presión aceite)
#      Combustible (nivel, consumo, eficiencia)
#      Distancia y uso (odómetro real, horas motor, idle, eco-score)
#      Diagnóstico (DTC codes cuando hay)
#      Footer · modelo del dispositivo
#    · Vehículos sin CAN muestran placeholder explicativo
#
#  Status: MOCK virtual · NO PERSISTIDO · solo en memoria.
#  Reemplazo por schema real (Prisma) llega en Sprint 2.
#
#  Idempotente · usa cmp -s antes de cp.
# ═══════════════════════════════════════════════════════════════

set -e

PAYLOAD="_payload"

if [ ! -d "$PAYLOAD" ]; then
  echo "❌ ERROR · no encuentro carpeta $PAYLOAD"
  exit 1
fi

if [ ! -f "package.json" ]; then
  echo "❌ ERROR · no estoy en el root del repo"
  exit 1
fi

echo "═══════════════════════════════════════════════════"
echo "  S1-L3-mock-can · datos demo CAN bus FMC003"
echo "═══════════════════════════════════════════════════"

COUNT_NEW=0
COUNT_UPD=0
COUNT_SAME=0

apply_file() {
  local rel="$1"
  local src="$PAYLOAD/$rel"
  local dst="$rel"

  if [ ! -f "$src" ]; then
    echo "  ⚠️  payload missing: $rel"
    return
  fi

  if [ ! -f "$dst" ]; then
    mkdir -p "$(dirname "$dst")"
    cp "$src" "$dst"
    echo "  + $rel  (nuevo)"
    COUNT_NEW=$((COUNT_NEW + 1))
  elif cmp -s "$src" "$dst"; then
    COUNT_SAME=$((COUNT_SAME + 1))
  else
    cp "$src" "$dst"
    echo "  ~ $rel  (actualizado)"
    COUNT_UPD=$((COUNT_UPD + 1))
  fi
}

apply_file "src/lib/mock-can/types.ts"
apply_file "src/lib/mock-can/generate.ts"
apply_file "src/lib/mock-can/index.ts"
apply_file "src/lib/queries/tracking.ts"
apply_file "src/app/(product)/seguimiento/mapa/FleetTrackingClient.tsx"
apply_file "src/components/maxtracker/AssetDetailPanel.tsx"
apply_file "src/components/maxtracker/AssetDetailPanel.module.css"

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Resumen"
echo "═══════════════════════════════════════════════════"
echo "  Nuevos:        $COUNT_NEW"
echo "  Actualizados:  $COUNT_UPD"
echo "  Sin cambios:   $COUNT_SAME"
echo ""

rm -rf "$PAYLOAD"

echo "✅ Lote aplicado"
echo ""
echo "Próximo paso · reiniciar dev server:"
echo "  rm -rf .next && npm run dev"
