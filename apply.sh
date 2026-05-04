#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  Maxtracker · S1-L8-feedback-widget · apply.sh
#  Sprint 1 · Lote 8 · Widget de feedback de testers
#
#  Cambios:
#    · Schema · NUEVO modelo Feedback + 2 enums (Category, Status)
#    · Migration SQL para Feedback (20260504194000)
#    · User · relación inversa feedbacks
#    · Endpoint POST /api/feedback · auth + valida + persiste
#    · Widget UI flotante · botón bottom-right + modal con form
#    · Categorías: Bug · Idea · Otro
#    · Captura automática contexto: pageUrl, userAgent, viewport
#    · Montado en layout · siempre visible para users autenticados
#    · Cerrar con ESC · click backdrop · botón cancelar
#    · Mail aviso al PO · TODO Sprint 2 (cuando integremos Resend)
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
echo "  S1-L8-feedback-widget · widget global de feedback"
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
apply_file "prisma/migrations/20260504194000_add_feedback/migration.sql"
apply_file "src/app/api/feedback/route.ts"
apply_file "src/components/maxtracker/feedback/FeedbackWidget.tsx"
apply_file "src/components/maxtracker/feedback/FeedbackWidget.module.css"
apply_file "src/app/(product)/layout.tsx"

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
echo "1. Regenerar Prisma client (modelo Feedback nuevo):"
echo "   npx prisma generate"
echo ""
echo "2. Aplicar migration al DB:"
echo "   npx prisma migrate deploy"
echo ""
echo "3. Reiniciar dev server:"
echo "   rm -rf .next && npm run dev"
echo ""
echo "Para ver feedbacks recibidos (mientras no haya admin UI):"
echo "  SELECT * FROM \"Feedback\" ORDER BY \"createdAt\" DESC;"
