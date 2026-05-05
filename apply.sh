#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  S3-L4-resumen-visual-bullet · apply.sh
#  Sprint 3 · Lote 4 · Bullet table en /actividad/resumen modo visual
#
#  Cambios:
#    + src/app/(product)/actividad/reportes/BulletMetricView.tsx
#      Variante visual del MultiMetricView · misma estructura, cada
#      celda tiene una micro-barra escalada al max de la columna.
#      Color contextual: barra warn cuando vehículo está top 25% en
#      métrica reverse (eventos, idle, excesos, vmax).
#    + src/app/(product)/actividad/reportes/BulletMetricView.module.css
#      CSS base + classes nuevas para bullet (track, bar, warn, value)
#    ~ src/app/(product)/actividad/reportes/ReportesClient.tsx
#      PropsVisualMetrics ahora puede recibir multiData o visualData
#      Switch usa BulletMetricView si tiene multiData (default S3-L4)
#    ~ src/app/(product)/actividad/_lib/loadReportesData.ts
#      Nuevo kind "visual-metrics" carga FleetMultiMetricData
#      cuando modo=visual + subject=vehicles + layout=metrics
#    ~ src/app/(product)/actividad/resumen/page.tsx
#      Wire del nuevo kind al ReportesClient
#
#  Comportamiento:
#    /actividad/resumen?modo=visual → bullet table con vehículos × 8 métricas
#    Distancia · Horas · Idle · Viajes · Eventos · Excesos · Vmax · Fuel
#
#  Idempotente · usa cmp -s antes de cp.
# ═══════════════════════════════════════════════════════════════
set -e
PAYLOAD="_payload"
[ ! -d "$PAYLOAD" ] && echo "❌ no encuentro $PAYLOAD" && exit 1
[ ! -f "package.json" ] && echo "❌ no estoy en el root del repo" && exit 1
echo "═══ S3-L4-resumen-visual-bullet · vehículos × métricas (visual) ═══"

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

apply_file "src/app/(product)/actividad/reportes/BulletMetricView.tsx"
apply_file "src/app/(product)/actividad/reportes/BulletMetricView.module.css"
apply_file "src/app/(product)/actividad/reportes/ReportesClient.tsx"
apply_file "src/app/(product)/actividad/_lib/loadReportesData.ts"
apply_file "src/app/(product)/actividad/resumen/page.tsx"

echo ""
echo "  Nuevos: $C_NEW · Actualizados: $C_UPD · Sin cambios: $C_SAME"
rm -rf "$PAYLOAD"

echo ""
echo "✅ Lote aplicado"
echo ""
echo "Próximo paso · reiniciar dev server:"
echo "  rm -rf .next && npm run dev"
echo ""
echo "Validación · entrá a /actividad/resumen y elegí modo Visual:"
echo "  - Tabla de vehículos × 8 métricas con barras inline"
echo "  - Barras gris para métricas neutras"
echo "  - Barras rojo para anomalías (top 25% en métricas reverse:"
echo "    idle, eventos, excesos, vmax)"
