#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  S5-T3 · Unificación profunda de Viajes
#  ─────────────────────────────────────────────────────────────
#  Resuelve el feedback "Viajes es muy distinto a Eventos e
#  Infracciones · unifiquemos". Reescribe Viajes desde cero
#  como clon canónico de Eventos.
#
#  ─────────────────────────────────────────────────────────────
#  CAMBIOS
#  ─────────────────────────────────────────────────────────────
#
#  1. XLSX export integrado al DataTable v2
#     · src/lib/export/xlsx.ts (nuevo)
#       Carga SheetJS desde CDN on-demand. NO agrega deps al
#       package.json. Se cachea en window.XLSX.
#     · src/components/maxtracker/ui/DataTable.tsx (mod)
#       Default exportFormats = ["csv", "xlsx"] cuando hay
#       exportFilename. El menú export ahora muestra ambas
#       opciones en TODAS las tablas migradas.
#
#  2. Viajes · reescrito desde cero como clon de Eventos
#     · src/app/(product)/actividad/viajes/page.tsx
#       Adopta los mismos URL params que /actividad/eventos:
#         g · d · view · grp · type · driver · q · page
#       Sin cap. Paginación normal page/pageSize. Heatmap
#       deriva puntos desde startLat/Lng de items kind="trip".
#
#     · src/app/(product)/actividad/viajes/TripsClient.tsx
#       Layout idéntico a EventsClient:
#         · PageHeader
#         · Toolbar · PeriodNavigator + tabs Lista/Heatmap
#         · ScopeFiltersBar (grupos · tipos vehículo · conductor · search)
#         · DataTable full-width o EventHeatmap
#         · Side panel canónico DayDetailPanel deslizable
#       Sin split layout 60/40, sin TripsKpiStrip, sin
#       TripsExportButton, sin TripsFilterBar.
#
#  3. DayDetailPanel · panel canónico para Viajes
#     · src/components/maxtracker/days/DayDetailPanel.tsx
#     · src/components/maxtracker/days/DayDetailPanel.module.css
#       Usa EntityDetailPanel + cells canónicos. Mantiene el
#       valor único de Viajes (la timeline cronológica del día)
#       dentro de PanelCustomSection. Click en un trip de la
#       timeline → abre PanelMapSection con el recorrido.
#
#  ─────────────────────────────────────────────────────────────
#  CÓDIGO MUERTO (no se borra · queda por si querés cleanup)
#  ─────────────────────────────────────────────────────────────
#
#  Estos archivos ya no se importan de ningún lado · no entran
#  al bundle. Si querés borrarlos, hacelo a mano o pedime un
#  sub-lote S5-T3-cleanup:
#
#    src/components/maxtracker/TripsKpiStrip.tsx (+ .module.css)
#    src/components/maxtracker/TripsFilterBar.tsx (+ .module.css)
#    src/app/(product)/actividad/viajes/TripsExportButton.tsx (+ .module.css)
#    src/app/(product)/actividad/viajes/TripDetailPanel.tsx (+ .module.css)
#
#  ─────────────────────────────────────────────────────────────
#  EFECTO COLATERAL · las 5 tablas migradas ganan XLSX
#  ─────────────────────────────────────────────────────────────
#
#  Después de aplicar este lote, estas tablas muestran menú
#  CSV + XLSX automáticamente (sin tocarlas):
#    · /conduccion/infracciones
#    · /actividad/eventos
#    · /actividad/viajes
#    · /catalogos/grupos
#    · /gestion/grupos
#
#  ─────────────────────────────────────────────────────────────
#  AUDITORÍAS
#  ─────────────────────────────────────────────────────────────
#
#  ✓ Ningún .module.css tiene :root
#  ✓ Ningún server component pasa funciones a client components
#    (TripsClient recibe scope, available, rows, heatPoints,
#    todos serializables · igual que EventsClient)
#  ✓ npx tsc --noEmit · 0 errores
#
#  Idempotente · usa cmp -s antes de cp.
# ═══════════════════════════════════════════════════════════════
set -e
PAYLOAD="_payload"
[ ! -d "$PAYLOAD" ] && echo "❌ no encuentro $PAYLOAD" && exit 1
[ ! -f "package.json" ] && echo "❌ no estoy en el root del repo" && exit 1
echo "═══ S5-T3 · Unificación profunda de Viajes ═══"

C_NEW=0; C_UPD=0; C_SAME=0
apply_file() {
  local rel="$1"; local src="$PAYLOAD/$rel"; local dst="$rel"
  [ ! -f "$src" ] && return
  if [ ! -f "$dst" ]; then
    mkdir -p "$(dirname "$dst")"; cp "$src" "$dst"
    echo "  + $rel  (nuevo)"; C_NEW=$((C_NEW+1))
  elif cmp -s "$src" "$dst"; then C_SAME=$((C_SAME+1))
  else cp "$src" "$dst"; echo "  ~ $rel  (actualizado)"; C_UPD=$((C_UPD+1)); fi
}

while IFS= read -r src; do
  rel="${src#$PAYLOAD/}"
  apply_file "$rel"
done < <(find "$PAYLOAD" -type f)

echo ""
echo "  Nuevos: $C_NEW · Actualizados: $C_UPD · Sin cambios: $C_SAME"
rm -rf "$PAYLOAD"

echo ""
echo "✅ Lote aplicado"
echo ""
echo "  npx tsc --noEmit"
echo "  npm run dev"
echo ""
echo "Probá Viajes:"
echo "  · /actividad/viajes"
echo ""
echo "Debería verse INDISTINGUIBLE de Eventos e Infracciones:"
echo "  · Mismo PageHeader · misma toolbar · mismos selectores"
echo "  · Tabs Lista/Heatmap como Eventos"
echo "  · Click fila → side panel deslizable canónico"
echo "  · Menú export con CSV + XLSX (igual que las otras)"
echo "  · Sin KPI strip · sin botón Excel separado · sin split layout"
echo ""
echo "Cleanup opcional · borrar archivos muertos:"
echo "  rm src/components/maxtracker/TripsKpiStrip.tsx"
echo "  rm src/components/maxtracker/TripsKpiStrip.module.css"
echo "  rm src/components/maxtracker/TripsFilterBar.tsx"
echo "  rm src/components/maxtracker/TripsFilterBar.module.css"
echo "  rm src/app/(product)/actividad/viajes/TripsExportButton.tsx"
echo "  rm src/app/(product)/actividad/viajes/TripsExportButton.module.css"
echo "  rm src/app/(product)/actividad/viajes/TripDetailPanel.tsx"
echo "  rm src/app/(product)/actividad/viajes/TripDetailPanel.module.css"
