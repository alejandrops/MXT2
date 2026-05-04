#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  Maxtracker · S1-L4-libros-vehiculo · apply.sh
#  Sprint 1 · Lote 4 · Expansión del Libro del vehículo
#
#  Cambios:
#    · Matriz de aplicabilidad módulo×tipo actualizada (validada con PO)
#    · Conducción habilitada como módulo (Scorecard activo desde L2)
#    · Tab "Telemetría" NUEVA · solo aplica al vehículo
#      - Aprovecha el mock CAN del L3 · ahora visible en el Libro
#      - KPIs en vivo · RPM, temp, presión aceite, eco-score
#      - Combustible (nivel, consumo, eficiencia)
#      - Distancia y uso (odómetro real, horas motor, idle, PTO)
#      - Estados del vehículo (puerta, cinturón, freno mano)
#      - DTC codes activos cuando los hay
#      - Vehículos sin CAN (FMB920/Legacy) muestran explicación
#
#  Status: snapshot del momento. Curvas históricas vendrán cuando
#  el schema persista CAN data (Sprint 2).
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
echo "  S1-L4-libros-vehiculo · tab Telemetría + matriz"
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

apply_file "src/lib/object-modules.ts"
apply_file "src/app/(product)/objeto/[tipo]/[id]/page.tsx"
apply_file "src/app/(product)/objeto/[tipo]/[id]/modules/TelemetryBookTab.tsx"
apply_file "src/app/(product)/objeto/[tipo]/[id]/modules/TelemetryBookTab.module.css"

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
