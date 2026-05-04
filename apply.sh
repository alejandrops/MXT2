#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  Maxtracker · S1-L6-vista-ejecutiva-vehiculo · apply.sh
#  Sprint 1 · Lote 6 · Vista ejecutiva del vehículo
#
#  Cambios:
#    · Tab "Resumen" NUEVA · primera tab del Libro del vehículo
#      (default cuando entrás sin elegir m=)
#    · Vista cross-módulo del "ahora" del vehículo:
#      - Hero state · estado en lenguaje natural + alarmas badge
#      - Telemetría destacada · 4 KPIs CAN (RPM, fuel, temp, eco)
#      - Conductor actual · card con scoring y métricas
#      - KPIs últimos 30 días · km, viajes, tiempo activo, eventos
#      - Alarmas activas · top 3 con severidad
#      - Atajos · links a las otras 5 tabs principales
#    · Cada sección tiene "Ver más →" que profundiza en su tab
#    · Color solo en anomalías (Tufte)
#    · Matriz · resumen agregado como ModuleKey (vehiculo-only)
#
#  Idempotente · usa cmp -s antes de cp.
# ═══════════════════════════════════════════════════════════════

set -e
PAYLOAD="_payload"

if [ ! -d "$PAYLOAD" ]; then
  echo "❌ no encuentro $PAYLOAD"
  exit 1
fi
if [ ! -f "package.json" ]; then
  echo "❌ no estoy en el root del repo"
  exit 1
fi

echo "═══════════════════════════════════════════════════"
echo "  S1-L6-vista-ejecutiva-vehiculo · tab Resumen"
echo "═══════════════════════════════════════════════════"

COUNT_NEW=0
COUNT_UPD=0
COUNT_SAME=0

apply_file() {
  local rel="$1"
  local src="$PAYLOAD/$rel"
  local dst="$rel"
  if [ ! -f "$src" ]; then echo "  ⚠️ payload missing: $rel"; return; fi
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
apply_file "src/app/(product)/objeto/[tipo]/[id]/modules/SummaryBookTab.tsx"
apply_file "src/app/(product)/objeto/[tipo]/[id]/modules/SummaryBookTab.module.css"

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
