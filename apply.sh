#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  Maxtracker · S1-L7-cron-scaffold · apply.sh
#  Sprint 1 · Lote 7 · Vercel Cron + BoletinSnapshot scaffold
#
#  Cambios:
#    · Schema · NUEVO modelo BoletinSnapshot (period, accountId,
#      payload Json, generatedAt, source)
#    · Migration SQL para BoletinSnapshot (20260504190000)
#    · vercel.json · crons config · daily 06:00 UTC = 03:00 AR
#    · Endpoint /api/cron/generate-boletines · auth via CRON_SECRET
#      + lista accounts + persiste snapshot por account
#    · Helper src/lib/boletin/snapshot.ts · read/write/upsert
#    · Page del boletín · check snapshot first, fallback on-demand
#
#  Estado: SCAFFOLD puro · payload generado por el cron es PLACEHOLDER.
#  La generación real del payload del boletín viene en Sprint 2 cuando
#  refactor de loadBoletinData a un module separado.
#
#  ⚠ POST-APPLY OBLIGATORIO · ver mensaje al final
#
#  Idempotente · usa cmp -s antes de cp.
# ═══════════════════════════════════════════════════════════════

set -e
PAYLOAD="_payload"

if [ ! -d "$PAYLOAD" ]; then echo "❌ no encuentro $PAYLOAD"; exit 1; fi
if [ ! -f "package.json" ]; then echo "❌ no estoy en el root del repo"; exit 1; fi

echo "═══════════════════════════════════════════════════"
echo "  S1-L7-cron-scaffold · BoletinSnapshot + Vercel Cron"
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

apply_file "prisma/schema.prisma"
apply_file "prisma/migrations/20260504190000_add_boletin_snapshot/migration.sql"
apply_file "vercel.json"
apply_file "src/lib/boletin/snapshot.ts"
apply_file "src/app/api/cron/generate-boletines/route.ts"
apply_file "src/app/(product)/direccion/boletin/[period]/page.tsx"

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
echo "═══════════════════════════════════════════════════"
echo "  ⚠ POST-APPLY OBLIGATORIO"
echo "═══════════════════════════════════════════════════"
echo ""
echo "1. Regenerar Prisma client (modelo nuevo):"
echo "   npx prisma generate"
echo ""
echo "2. Aplicar migration al DB:"
echo "   npx prisma migrate deploy   # producción / Supabase"
echo "   # o si usás migrate dev en local:"
echo "   # npx prisma migrate dev"
echo ""
echo "3. Configurar env var CRON_SECRET en Vercel:"
echo "   Settings → Environment Variables → CRON_SECRET=<random>"
echo "   Generar uno: openssl rand -hex 32"
echo ""
echo "4. Reiniciar dev server:"
echo "   rm -rf .next && npm run dev"
