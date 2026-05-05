#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  S3-L4.2-cleanup-reportes-redirect · apply.sh
#  Cleanup · /actividad/reportes pasa a redirect-only
#  Resuelve también el bug del modo visual al cambiar fecha
#
#  Causa raíz que se resuelve:
#    1. Tres pantallas haciendo lo mismo · /reportes, /resumen,
#       /evolucion · deuda de un refactor incompleto · "el reporte
#       para qué es? no está deprecado?" — sí, lo estaba.
#    2. /actividad redirigía a /reportes · perpetuaba la URL vieja
#    3. BulletMetricView no preservaba modo=visual al cambiar fecha
#       · cualquier nav con la URL nueva caía en modo tabla default
#
#  Cambios:
#    ~ /actividad/reportes/page.tsx · pasa a redirect inteligente
#      preservando query params · va a /resumen si layout=metrics
#      o mode=fleet-multi/drivers-multi · sino a /evolucion
#    ~ /actividad/page.tsx · redirige a /resumen (era /reportes)
#    ~ src/lib/cmdk-screens.ts · entry "Reportes" pasa a "Resumen
#      de actividad" apuntando a /resumen
#    ~ ReportesClient.tsx · revertir botón extra "Resumen" del
#      toggle Vista (era hotfix S3-L4.1) · ya no necesario porque
#      /reportes no muestra UI · queda Heatmap/Ranking/Multiples
#    ~ BulletMetricView.tsx · buildHref siempre setea modo=visual
#      para preservar el modo al cambiar fecha/granularidad/scope
#
#  Resultado:
#    /actividad/resumen     · canónica · default tab Resumen, modo Visual = bullet
#    /actividad/evolucion   · canónica · vehículos × tiempo
#    /actividad/reportes    · redirect-only (preserva todos los params)
#    /actividad             · redirige a /resumen
#
#  URLs viejas (bookmarks, links externos, cmdk) siguen funcionando.
#
#  Idempotente · usa cmp -s antes de cp.
# ═══════════════════════════════════════════════════════════════
set -e
PAYLOAD="_payload"
[ ! -d "$PAYLOAD" ] && echo "❌ no encuentro $PAYLOAD" && exit 1
[ ! -f "package.json" ] && echo "❌ no estoy en el root del repo" && exit 1
echo "═══ S3-L4.2 · cleanup /reportes redirect ═══"

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

apply_file "src/app/(product)/actividad/reportes/page.tsx"
apply_file "src/app/(product)/actividad/reportes/ReportesClient.tsx"
apply_file "src/app/(product)/actividad/reportes/BulletMetricView.tsx"
apply_file "src/app/(product)/actividad/page.tsx"
apply_file "src/lib/cmdk-screens.ts"

echo ""
echo "  Nuevos: $C_NEW · Actualizados: $C_UPD · Sin cambios: $C_SAME"
rm -rf "$PAYLOAD"

echo ""
echo "✅ Lote aplicado"
echo ""
echo "Próximo paso · reiniciar dev server:"
echo "  rm -rf .next && npm run dev"
echo ""
echo "Validación e2e:"
echo "  1. Click 'Actividad' en sidebar → debería ir a /actividad/resumen"
echo "  2. En /actividad/resumen, click 'Visual' → bullet table aparece"
echo "  3. Cambiá la fecha con < o > → bullet se mantiene (no vuelve a tabla)"
echo "  4. Cambiá granularidad (Día/Semana/Mes) → bullet se mantiene"
echo "  5. URLs viejas: /actividad/reportes?mode=fleet-multi → redirige a /resumen"
echo "  6. Cmd+K · 'Resumen de actividad' → /resumen"
