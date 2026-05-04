#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  S2-L6-admin-feedback · apply.sh
#  Admin UI · gestión de feedbacks recibidos vía widget (S1-L8)
#
#  Cambios:
#    + src/app/admin/feedback/page.tsx · server · tabla + filtros
#      + paginación + access control (SUPER_ADMIN/MAXTRACKER_ADMIN)
#    + src/app/admin/feedback/FeedbackRow.tsx · client expand/collapse
#      + acciones de status + notas internas (server actions)
#    + src/app/admin/feedback/actions.ts · markStatus, saveNotes
#    + src/app/admin/feedback/page.module.css
#    + src/app/admin/feedback/FeedbackRow.module.css
#    ~ src/components/shell/AdminSidebar.tsx · ítem Feedback nuevo
#
#  UX:
#    · Default filter · status=NEW · ver primero lo nuevo
#    · Filtros adicionales · category (Bug/Idea/Otro)
#    · Click en row · expandir detalle (mensaje completo, contexto,
#      notas, acciones)
#    · Status workflow · NEW → REVIEWED → CLOSED · reabrir disponible
#    · Reply · adminNotes texto libre · solo visible para admins
#
#  Sin DB migrations · usa los modelos Feedback existentes (S1-L8).
#
#  Idempotente · usa cmp -s antes de cp.
# ═══════════════════════════════════════════════════════════════
set -e
PAYLOAD="_payload"
[ ! -d "$PAYLOAD" ] && echo "❌ no encuentro $PAYLOAD" && exit 1
[ ! -f "package.json" ] && echo "❌ no estoy en el root del repo" && exit 1
echo "═══ S2-L6-admin-feedback · backoffice de feedback ═══"

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

apply_file "src/app/admin/feedback/page.tsx"
apply_file "src/app/admin/feedback/page.module.css"
apply_file "src/app/admin/feedback/FeedbackRow.tsx"
apply_file "src/app/admin/feedback/FeedbackRow.module.css"
apply_file "src/app/admin/feedback/actions.ts"
apply_file "src/components/shell/AdminSidebar.tsx"

echo ""
echo "  Nuevos: $C_NEW · Actualizados: $C_UPD · Sin cambios: $C_SAME"
rm -rf "$PAYLOAD"

echo ""
echo "✅ Lote aplicado"
echo ""
echo "Próximo paso · reiniciar dev server:"
echo "  rm -rf .next && npm run dev"
echo ""
echo "Validación · entrá a /admin como SUPER_ADMIN o MAXTRACKER_ADMIN:"
echo "  - Sidebar: nuevo ítem 'Feedback' al final de la lista"
echo "  - /admin/feedback · ver feedbacks · marcarlos como revisados/cerrados"
