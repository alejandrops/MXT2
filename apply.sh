#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  Maxtracker · S2-L1.1-snapshot-null-fix · apply.sh
#  Sprint 2 · Lote 1.1 · HOTFIX runtime BoletinSnapshot
#
#  Bug:
#    PrismaClientValidationError · `accountId must not be null`
#    Causa · findUnique con compound key (period_accountId) no
#    acepta accountId = null. El caso SA/MA cross-tenant siempre
#    pasa null acá y reventaba al entrar al boletín.
#
#  Fix:
#    · getBoletinSnapshot · findFirst en vez de findUnique
#    · upsertBoletinSnapshot · pattern manual (findFirst + update/create)
#    · deleteBoletinSnapshot · ya usaba deleteMany · sin cambios
#
#  Idempotente · usa cmp -s antes de cp.
# ═══════════════════════════════════════════════════════════════

set -e
PAYLOAD="_payload"

if [ ! -d "$PAYLOAD" ]; then echo "❌ no encuentro $PAYLOAD"; exit 1; fi
if [ ! -f "package.json" ]; then echo "❌ no estoy en el root del repo"; exit 1; fi

echo "═══════════════════════════════════════════════════"
echo "  S2-L1.1-snapshot-null-fix · hotfix Prisma null"
echo "═══════════════════════════════════════════════════"

apply_file() {
  local rel="$1"
  local src="$PAYLOAD/$rel"
  local dst="$rel"
  if [ ! -f "$src" ]; then echo "  ⚠️ payload missing: $rel"; return; fi
  if [ ! -f "$dst" ]; then
    mkdir -p "$(dirname "$dst")"
    cp "$src" "$dst"
    echo "  + $rel  (nuevo)"
  elif cmp -s "$src" "$dst"; then
    echo "  = $rel  (sin cambios)"
  else
    cp "$src" "$dst"
    echo "  ~ $rel  (actualizado)"
  fi
}

apply_file "src/lib/boletin/snapshot.ts"

rm -rf "$PAYLOAD"

echo ""
echo "✅ Hotfix aplicado"
echo ""
echo "Próximo paso · reiniciar dev server:"
echo "  rm -rf .next && npm run dev"
echo ""
echo "Recargá /direccion/boletin/<período> · debería funcionar."
