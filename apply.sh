#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  S3-L4.5-seed-dedup-positions · apply.sh
#  HOTFIX seed · deduplicar positions por (assetId, recordedAt)
#
#  Causa raíz:
#    Los CSVs reales en prisma/seed-data/real-trajectories/ tienen
#    timestamps duplicados (eventos múltiples al mismo segundo) ·
#    37 a 177 duplicados por archivo · 23 archivos.
#    El schema tiene unique constraint en (assetId, recordedAt) en
#    el modelo Position. createMany() explota con P2002.
#
#    Bug pre-existente · nunca se había hecho un reset desde scratch
#    en este repo · al hacerlo ahora se manifiesta.
#
#  Fix:
#    Antes de createMany(), filtrar positions con un Set<recordedAt>
#    descartando duplicados. Pierde ~1.5% de las filas (los duplicados
#    son redundantes igual · mismo asset, mismo segundo).
#
#  Events NO afectado · Event no tiene unique en (assetId, occurredAt).
#
#  Idempotente · usa cmp -s antes de cp.
# ═══════════════════════════════════════════════════════════════
set -e
PAYLOAD="_payload"
[ ! -d "$PAYLOAD" ] && echo "❌ no encuentro $PAYLOAD" && exit 1
[ ! -f "package.json" ] && echo "❌ no estoy en el root del repo" && exit 1
echo "═══ S3-L4.5 · seed dedup positions ═══"

apply_file() {
  local rel="$1"; local src="$PAYLOAD/$rel"; local dst="$rel"
  [ ! -f "$src" ] && echo "  ⚠️ payload missing: $rel" && return
  if [ ! -f "$dst" ]; then
    mkdir -p "$(dirname "$dst")"; cp "$src" "$dst"; echo "  + $rel  (nuevo)"
  elif cmp -s "$src" "$dst"; then echo "  = $rel  (sin cambios)"
  else cp "$src" "$dst"; echo "  ~ $rel  (actualizado)"; fi
}

apply_file "prisma/seed.ts"

rm -rf "$PAYLOAD"
echo ""
echo "✅ Hotfix aplicado"
echo ""
echo "Próximo paso:"
echo "  npm run db:reset    # corre seed completo · debería terminar OK ahora"
echo "  rm -rf .next && npm run dev"
