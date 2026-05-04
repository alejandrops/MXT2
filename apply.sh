#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  S3-L1-resumen-conductor · apply.sh
#  Sprint 3 · Lote 1 · Resumen ejecutivo del conductor (360°)
#
#  Cambios:
#    ~ src/app/(product)/objeto/[tipo]/[id]/modules/SummaryBookTab.tsx
#      DriverSummary completo (270 líneas funcionales) + DriverHero
#      con safety score y estado de licencia
#    ~ src/app/(product)/objeto/[tipo]/[id]/modules/SummaryBookTab.module.css
#      estilos de driverCard, assetList, scoreRanking
#    + src/lib/queries/driver-profile.ts (97 líneas)
#      getDriverProfile · datos completos del conductor
#    + src/lib/queries/driver-month-summary.ts (75 líneas)
#      getDriverMonthSummary · KPIs últimos 30 días
#    + src/lib/queries/person-assets.ts (96 líneas)
#      getPersonAssets · vehículos manejados con totales
#    ~ src/lib/queries/alarms.ts
#      agregada getAlarmsByPerson (filtro por personId)
#    ~ src/lib/object-modules.ts
#      "resumen" habilitada para conductor · default tab del Libro
#
#  Resultado:
#    /objeto/conductor/<id> abre directo en tab Resumen con:
#      · Hero · estado licencia + safety score
#      · Vehículo actual + top 3 manejados (col izq)
#      · KPIs 30d + alarmas activas + ranking en flota (col der)
#      · Atajos a Actividad / Seguridad / Conducción / Documentación
#
#  Notas:
#    · GroupSummary sigue como placeholder (S3-L2 próximo)
#    · Si el archivo SummaryBookTab.tsx ya existe en tu local con
#      DriverSummary implementado, apply.sh detecta "sin cambios"
#      y no hace nada (idempotente).
#
#  Idempotente · usa cmp -s antes de cp.
# ═══════════════════════════════════════════════════════════════
set -e
PAYLOAD="_payload"
[ ! -d "$PAYLOAD" ] && echo "❌ no encuentro $PAYLOAD" && exit 1
[ ! -f "package.json" ] && echo "❌ no estoy en el root del repo" && exit 1
echo "═══ S3-L1-resumen-conductor · 360° del conductor ═══"

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

apply_file "src/app/(product)/objeto/[tipo]/[id]/modules/SummaryBookTab.tsx"
apply_file "src/app/(product)/objeto/[tipo]/[id]/modules/SummaryBookTab.module.css"
apply_file "src/lib/queries/driver-profile.ts"
apply_file "src/lib/queries/driver-month-summary.ts"
apply_file "src/lib/queries/person-assets.ts"
apply_file "src/lib/queries/alarms.ts"
apply_file "src/lib/object-modules.ts"

echo ""
echo "  Nuevos: $C_NEW · Actualizados: $C_UPD · Sin cambios: $C_SAME"
rm -rf "$PAYLOAD"

echo ""
echo "✅ Lote aplicado"
echo ""
echo "Próximo paso · reiniciar dev server:"
echo "  rm -rf .next && npm run dev"
echo ""
echo "Validación · entrá a /objeto/conductor/<id>:"
echo "  - Debería abrir directo en tab 'Resumen'"
echo "  - DriverHero arriba con safety score + estado licencia"
echo "  - Grid 2 col: vehículo actual / KPIs · alarmas · ranking"
echo "  - Atajos abajo a Actividad / Seguridad / Conducción / Doc"
