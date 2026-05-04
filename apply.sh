#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  Maxtracker · S1-L4b-posicion-en-grupo · apply.sh
#  Sprint 1 · Lote 4b · Scatter contextual del Libro
#
#  Cambios:
#    · Nueva query getGroupPeers · vehículos del mismo grupo con
#      métricas comparables del período (km, eventos, safety score)
#    · Nuevo componente PositionInGroupScatter (client) · scatter
#      con Recharts · resalta el activo, peers en gris atenuado
#    · Nueva sección PositionInGroupSection · 2 scatters lado a lado:
#        - Distancia × Safety score
#        - Distancia × Eventos cada 100km
#    · Integrada en ActivityBookTab del vehículo · solo aparece si
#      el vehículo está en grupo con ≥ 2 peers
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
echo "  S1-L4b-posicion-en-grupo · scatter contextual"
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

apply_file "src/lib/queries/group-peers.ts"
apply_file "src/components/maxtracker/objeto/PositionInGroupScatter.tsx"
apply_file "src/components/maxtracker/objeto/PositionInGroupScatter.module.css"
apply_file "src/components/maxtracker/objeto/PositionInGroupSection.tsx"
apply_file "src/components/maxtracker/objeto/PositionInGroupSection.module.css"
apply_file "src/app/(product)/objeto/[tipo]/[id]/modules/ActivityBookTab.tsx"

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
