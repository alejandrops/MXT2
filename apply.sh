#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  Maxtracker · S1-L5-libro-conductores · apply.sh
#  Sprint 1 · Lote 5 · Tab Conductores en el Libro del vehículo
#
#  Cambios:
#    · Matriz · agregada tab "Conductores" para vehículo (intrínseca)
#    · DriversBookTab wraps el AssetDriversPanel existente:
#      - Tabla de conductores que pasaron por el vehículo
#      - Heatmap semanal por conductor × 53 semanas
#      - Métricas: días, viajes, km, tiempo activo, safety score
#    · Solo 4 archivos · aprovecha componente reusable preexistente
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
echo "  S1-L5-libro-conductores · tab Conductores"
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
apply_file "src/app/(product)/objeto/[tipo]/[id]/modules/DriversBookTab.tsx"
apply_file "src/app/(product)/objeto/[tipo]/[id]/modules/DriversBookTab.module.css"

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
