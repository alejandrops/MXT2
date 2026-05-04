#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  S2-L7.1-event-type-fix · apply.sh
#  HOTFIX runtime · strings inválidos en queries Prisma EventType
#
#  Bug:
#    PrismaClientValidationError · `Invalid value for argument
#    in. Expected EventType.` Strings "OVERSPEED" e "IDLE" no
#    existen en el enum del schema · son "SPEEDING" e "IDLING".
#
#  Causa:
#    Bug pre-existente del L6 (S1) que introducí copiando un array
#    incorrecto. Se arrastró al L4b y a los archivos nuevos del
#    L7. Se manifestó al entrar al SummaryBookTab.
#
#  Fix:
#    Quitar OVERSPEED (no existe), cambiar IDLE → IDLING en los
#    4 arrays TELEMETRY_EVENT_TYPES locales:
#      · SummaryBookTab.tsx
#      · group-peers.ts
#      · driver-peers.ts
#      · group-siblings.ts
#
#  Nota: el mapa humanizeAlarmType en SummaryBookTab tiene
#  OVERSPEED como key · ese es de AlarmType (otro enum) · no
#  se toca · es válido.
#
#  Idempotente · usa cmp -s antes de cp.
# ═══════════════════════════════════════════════════════════════
set -e
PAYLOAD="_payload"
[ ! -d "$PAYLOAD" ] && echo "❌ no encuentro $PAYLOAD" && exit 1
[ ! -f "package.json" ] && echo "❌ no estoy en el root del repo" && exit 1
echo "═══ S2-L7.1-event-type-fix · enum EventType ═══"

apply_file() {
  local rel="$1"; local src="$PAYLOAD/$rel"; local dst="$rel"
  [ ! -f "$src" ] && echo "  ⚠️ payload missing: $rel" && return
  if [ ! -f "$dst" ]; then mkdir -p "$(dirname "$dst")"; cp "$src" "$dst"; echo "  + $rel"
  elif cmp -s "$src" "$dst"; then echo "  = $rel  (sin cambios)"
  else cp "$src" "$dst"; echo "  ~ $rel  (actualizado)"; fi
}

apply_file "src/app/(product)/objeto/[tipo]/[id]/modules/SummaryBookTab.tsx"
apply_file "src/lib/queries/group-peers.ts"
apply_file "src/lib/queries/driver-peers.ts"
apply_file "src/lib/queries/group-siblings.ts"

rm -rf "$PAYLOAD"
echo ""
echo "✅ Hotfix aplicado"
echo ""
echo "Próximo paso · reiniciar dev server:"
echo "  rm -rf .next && npm run dev"
