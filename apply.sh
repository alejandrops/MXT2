#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  S2-L7-scatter-conductor-grupo · apply.sh
#  Scatter contextual extendido a Libros conductor + grupo
#
#  Cambios:
#    + src/lib/queries/driver-peers.ts
#      conductores activos del mismo account con métricas
#    + src/lib/queries/group-siblings.ts
#      grupos del mismo account con agregados
#    + src/components/maxtracker/objeto/PositionInFleetSection.tsx
#    + src/components/maxtracker/objeto/PositionAmongGroupsSection.tsx
#    ~ src/app/(product)/objeto/[tipo]/[id]/modules/ActivityBookTab.tsx
#      Promise.all extendido · render condicional por type
#
#  Reusa el componente PositionInGroupScatter (ya genérico).
#  Render solo si hay ≥ 2 peers · sino sección oculta.
#
#  Idempotente · usa cmp -s antes de cp.
# ═══════════════════════════════════════════════════════════════
set -e
PAYLOAD="_payload"
[ ! -d "$PAYLOAD" ] && echo "❌ no encuentro $PAYLOAD" && exit 1
[ ! -f "package.json" ] && echo "❌ no estoy en el root del repo" && exit 1
echo "═══ S2-L7-scatter-conductor-grupo · 3 dimensiones ═══"

C_NEW=0; C_UPD=0; C_SAME=0
apply_file() {
  local rel="$1"; local src="$PAYLOAD/$rel"; local dst="$rel"
  [ ! -f "$src" ] && echo "  ⚠️ payload missing: $rel" && return
  if [ ! -f "$dst" ]; then
    mkdir -p "$(dirname "$dst")"; cp "$src" "$dst"
    echo "  + $rel  (nuevo)"; C_NEW=$((C_NEW+1))
  elif cmp -s "$src" "$dst"; then C_SAME=$((C_SAME+1))
  else cp "$src" "$dst"; echo "  ~ $rel  (actualizado)"; C_UPD=$((C_UPD+1)); fi
}

apply_file "src/lib/queries/driver-peers.ts"
apply_file "src/lib/queries/group-siblings.ts"
apply_file "src/components/maxtracker/objeto/PositionInFleetSection.tsx"
apply_file "src/components/maxtracker/objeto/PositionAmongGroupsSection.tsx"
apply_file "src/app/(product)/objeto/[tipo]/[id]/modules/ActivityBookTab.tsx"

echo ""
echo "  Nuevos: $C_NEW · Actualizados: $C_UPD · Sin cambios: $C_SAME"
rm -rf "$PAYLOAD"

echo ""
echo "✅ Lote aplicado"
echo ""
echo "Próximo paso · reiniciar dev server:"
echo "  rm -rf .next && npm run dev"
echo ""
echo "Validación · entrá a:"
echo "  /objeto/conductor/<id>?m=actividad   → ver scatter de conductores"
echo "  /objeto/grupo/<id>?m=actividad        → ver scatter de grupos"
