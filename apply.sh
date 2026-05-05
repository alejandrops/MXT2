#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  S3-L4.7-fleet-multiplier · apply.sh
#  Seed con flota multiplicada · consolida L4.3/L4.5/L4.6/L4.7
#
#  Cambios:
#    1. NOW dinámico (S3-L4.3) · era hardcodeado a 2026-04-24
#    2. Dedup positions por recordedAt (S3-L4.5) · evita P2002
#    3. Re-anchor de timestamps (S3-L4.6) · última posición = NOW
#    4. NUEVO · multiplicación de flota (S3-L4.7)
#       · FLEET_MULTIPLIER = 4 · 23 reales × 4 = ~92 vehículos
#       · Distribuidos cíclicamente entre los 3 accounts
#       · Cada clone reusa el mismo CSV con shift de -2 días * cloneIdx
#         para que las trayectorias no se solapen exactamente
#       · Plate único · primera pasada usa la real (AB456RM),
#         clones agregan sufijo (AB456RM-2, AB456RM-3, AB456RM-4)
#       · Driver y group asignados por account, no global
#
#  Resultado:
#    Antes  · 23 vehículos en 1 solo account · datos del 20-26 abr
#    Ahora  · ~92 vehículos en 3 accounts · datos hasta hoy con
#             distintos rangos temporales por clone
#
#  IMPORTANTE: este lote SOBRESCRIBE seed.ts · si ya tenés aplicado
#  L4.3/L4.5/L4.6, este los incluye. Solo correr este (no L4.x previos).
#
#  Idempotente · usa cmp -s antes de cp.
# ═══════════════════════════════════════════════════════════════
set -e
PAYLOAD="_payload"
[ ! -d "$PAYLOAD" ] && echo "❌ no encuentro $PAYLOAD" && exit 1
[ ! -f "package.json" ] && echo "❌ no estoy en el root del repo" && exit 1
echo "═══ S3-L4.7 · fleet multiplier × 4 · consolida L4.3+L4.5+L4.6+L4.7 ═══"

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
echo "✅ Aplicado"
echo ""
echo "Próximo paso · re-correr seed:"
echo "  npm run db:reset"
echo ""
echo "Vas a ver:"
echo "  · 'creating real-trajectory vehicles (× 4)…'"
echo "  · '92 real-trajectory vehicles created across 3 accounts'"
echo "  · ~80,000-100,000 positions con re-anchor a NOW"
echo "  · Mapa con muchos vehículos activos hoy"
