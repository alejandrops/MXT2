#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  S3-L4.3-cleanup-real-y-fix-period · apply.sh
#  Cleanup real de /reportes + fix bug year-weeks/year-months +
#  navegador simple en /resumen + seed dinámico
#
#  Cambios:
#    DELETE
#      - src/app/(product)/actividad/reportes/page.tsx
#        URL /actividad/reportes deja de existir · 404
#        Componentes shared (BulletMetricView, MultiMetricView,
#        VisualView, ReportesClient, etc.) quedan en el dir
#        porque los siguen importando /resumen y /evolucion
#
#    REDIRECTS legacy a /reportes ahora apuntan a /evolucion
#      ~ /actividad/analisis/page.tsx
#      ~ /seguimiento/reportes/page.tsx
#
#    BUG · year-weeks/year-months no persistían
#      ~ DistributionView · "if (g !== year-weeks)" → siempre setear
#      ~ MultiMetricView · "if (g !== month-days)" → siempre setear
#      ~ BulletMetricView · idem
#      ~ VisualView · idem
#      ~ DriversDistributionView · idem
#      ~ DriversMultiMetricView · idem
#
#    NAVEGADOR SIMPLE · /resumen sin sub-divisiones
#      ~ PeriodNavigator · nuevo prop `simple={true}`
#        oculta los sub-hints ("por días", "por meses")
#        y muestra solo 4 botones: Día / Semana / Mes / Año
#        donde "Año" siempre es year-months (no year-weeks)
#      ~ /resumen normaliza year-weeks → year-months al parsear
#      ~ BulletMetricView, MultiMetricView, DriversMultiMetricView
#        pasan simple={true} al PeriodNavigator
#
#    SEED · dato hasta hoy
#      ~ prisma/seed.ts · NOW = new Date() · era hardcodeado a 2026-04-24
#
#  Idempotente · usa cmp -s + maneja deletes via _deletes.txt
# ═══════════════════════════════════════════════════════════════
set -e
PAYLOAD="_payload"
DELETES_FILE="_deletes.txt"
[ ! -d "$PAYLOAD" ] && echo "❌ no encuentro $PAYLOAD" && exit 1
[ ! -f "package.json" ] && echo "❌ no estoy en el root del repo" && exit 1
echo "═══ S3-L4.3 · cleanup real + fix bugs ═══"

C_NEW=0; C_UPD=0; C_SAME=0; C_DEL=0
apply_file() {
  local rel="$1"; local src="$PAYLOAD/$rel"; local dst="$rel"
  [ ! -f "$src" ] && echo "  ⚠️ payload missing: $rel" && return
  if [ ! -f "$dst" ]; then
    mkdir -p "$(dirname "$dst")"; cp "$src" "$dst"
    echo "  + $rel  (nuevo)"; C_NEW=$((C_NEW+1))
  elif cmp -s "$src" "$dst"; then C_SAME=$((C_SAME+1))
  else cp "$src" "$dst"; echo "  ~ $rel  (actualizado)"; C_UPD=$((C_UPD+1)); fi
}

# Aplicar cambios
apply_file "src/app/(product)/actividad/page.tsx"
apply_file "src/app/(product)/actividad/analisis/page.tsx"
apply_file "src/app/(product)/seguimiento/reportes/page.tsx"
apply_file "src/app/(product)/actividad/resumen/page.tsx"
apply_file "src/lib/cmdk-screens.ts"
apply_file "src/components/maxtracker/period/PeriodNavigator.tsx"
apply_file "src/app/(product)/actividad/reportes/BulletMetricView.tsx"
apply_file "src/app/(product)/actividad/reportes/MultiMetricView.tsx"
apply_file "src/app/(product)/actividad/reportes/DistributionView.tsx"
apply_file "src/app/(product)/actividad/reportes/VisualView.tsx"
apply_file "src/app/(product)/actividad/reportes/DriversDistributionView.tsx"
apply_file "src/app/(product)/actividad/reportes/DriversMultiMetricView.tsx"
apply_file "src/app/(product)/actividad/reportes/ReportesClient.tsx"
apply_file "prisma/seed.ts"

# Aplicar deletes
if [ -f "$DELETES_FILE" ]; then
  while IFS= read -r del; do
    [ -z "$del" ] && continue
    if [ -f "$del" ]; then
      rm "$del"; echo "  - $del  (borrado)"; C_DEL=$((C_DEL+1))
    fi
  done < "$DELETES_FILE"
fi

echo ""
echo "  Nuevos: $C_NEW · Actualizados: $C_UPD · Sin cambios: $C_SAME · Borrados: $C_DEL"
rm -rf "$PAYLOAD" "$DELETES_FILE"

echo ""
echo "✅ Lote aplicado"
echo ""
echo "Próximo paso · reset DB con seed actualizado + restart server:"
echo ""
echo "  npx prisma migrate reset --force --skip-seed"
echo "  npm run db:seed"
echo "  rm -rf .next && npm run dev"
echo ""
echo "⚠️  El reset de DB borra TODO · solo en local/dev"
echo ""
echo "Validación e2e:"
echo "  1. /actividad → redirige a /actividad/resumen"
echo "  2. /actividad/reportes → 404 (URL eliminada)"
echo "  3. /actividad/resumen → bullet table con datos hasta hoy"
echo "  4. Navegador en /resumen muestra 4 botones: Día / Semana / Mes / Año"
echo "  5. Click 'Año' → year-months · datos del año actual"
echo "  6. /actividad/evolucion → cambiar a 'Año por meses' o 'Año por semanas'"
echo "     · datos persisten al navegar (bug arreglado)"
