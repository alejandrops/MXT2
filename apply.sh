#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  S3-L4.1-bullet-en-reportes · apply.sh
#  HOTFIX · el bullet table también disponible en /actividad/reportes
#
#  Causa raíz:
#    /actividad/reportes y /actividad/resumen son DOS pages independientes.
#    El bullet table (S3-L4) se aplicó solo a /resumen.
#    Cuando navegás a /actividad (sin sufijo) redirige a /reportes,
#    así que el path natural de muchos clicks termina ahí · y el
#    cambio del bullet no se ve.
#
#  Fix:
#    1. /reportes/page.tsx ahora respeta layout=metrics cuando modo=visual
#       · carga FleetMultiMetricData y usa BulletMetricView
#    2. ReportesClient · agrega 4ta opción de Vista cuando modo=visual:
#       [Heatmap] [Ranking] [Small multiples] [Resumen ← bullet table]
#       · click en Resumen pone layout=metrics en la URL
#    3. buildHref del client soporta el override de layout
#
#  Comportamiento esperado:
#    /actividad/reportes?modo=visual&layout=metrics → bullet table
#    /actividad/resumen?modo=visual                  → bullet table (igual que antes)
#    Click en toggle "Resumen" del Vista row → navega al bullet
#
#  Idempotente · usa cmp -s antes de cp.
# ═══════════════════════════════════════════════════════════════
set -e
PAYLOAD="_payload"
[ ! -d "$PAYLOAD" ] && echo "❌ no encuentro $PAYLOAD" && exit 1
[ ! -f "package.json" ] && echo "❌ no estoy en el root del repo" && exit 1
echo "═══ S3-L4.1 · bullet table en /reportes también ═══"

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

echo ""
echo "  Nuevos: $C_NEW · Actualizados: $C_UPD · Sin cambios: $C_SAME"
rm -rf "$PAYLOAD"

echo ""
echo "✅ Hotfix aplicado"
echo ""
echo "Próximo paso · reiniciar dev server:"
echo "  rm -rf .next && npm run dev"
echo ""
echo "Validación:"
echo "  1. Entrá a /actividad/reportes"
echo "  2. Click 'Visual' en el toggle Modo"
echo "  3. Vas a ver 4 botones de Vista: Heatmap · Ranking · Small multiples · Resumen"
echo "  4. Click 'Resumen' → bullet table con todos los vehículos × 8 métricas"
