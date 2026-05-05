#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  S4-L1-libro-tabs-nuevos · apply.sh
#  Restructura completa del Libro del Objeto · 5 tabs nuevos
#
#  Para vehículo, conductor y grupo · misma estructura.
#
#  CAMBIOS DE ESTRUCTURA:
#
#    Renombre:
#      SummaryBookTab.tsx → CaratulaBookTab.tsx
#      ↳ Era el "Resumen" pero conceptualmente es la "Carátula"
#        del objeto · vista 360° del momento actual
#
#    Tabs nuevos (con implementación funcional):
#      + ResumenBookTab.tsx · KPIs del período + comparativa peers
#                             (vs período anterior, vs promedio flota/grupo)
#      + EvolucionBookTab.tsx · 4 gráficos de barras temporales
#                                (distancia, viajes, tiempo, eventos)
#      + ViajesBookTab.tsx · listado day-by-day usando
#                            listTripsAndStopsByDay con scope al objeto
#      + ParadasBookTab.tsx · misma query, filtra solo stops
#
#    Eliminado:
#      - ActivityBookTab.tsx · contenido distribuido entre
#        Resumen, Evolución y Viajes
#
#    object-modules.ts:
#      Nueva ModuleKey: caratula | resumen | evolucion | viajes | paradas
#      ModuleKey eliminada: actividad
#      "resumen" cambia significado (antes vista 360°, ahora KPIs tabular)
#      MATRIZ APPLICABLE_BY_TYPE actualizada para los 3 object types
#
#    page.tsx del Libro:
#      VALID_MODULES actualizado
#      Switch reescrito · 9 cases nuevos
#
#    ObjectBook.tsx:
#      Default module en buildHref · "actividad" → "caratula"
#
#    CaratulaBookTab links internos:
#      "?m=actividad" → "?m=resumen" (deep links al equivalente)
#
#  Idempotente · usa cmp -s + maneja deletes via _deletes.txt
# ═══════════════════════════════════════════════════════════════
set -e
PAYLOAD="_payload"
DELETES_FILE="_deletes.txt"
[ ! -d "$PAYLOAD" ] && echo "❌ no encuentro $PAYLOAD" && exit 1
[ ! -f "package.json" ] && echo "❌ no estoy en el root del repo" && exit 1
echo "═══ S4-L1 · Libro del Objeto · 5 tabs nuevos ═══"

C_NEW=0; C_UPD=0; C_SAME=0; C_DEL=0
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
echo "Próximo paso · reiniciar dev server:"
echo "  rm -rf .next && npm run dev"
echo ""
echo "Validación e2e:"
echo "  Vehículo:  http://localhost:3000/objeto/vehiculo/<ID>"
echo "    → Default tab: Carátula (vista 360°)"
echo "    → Click en tab Resumen     → KPIs del período + comparativa"
echo "    → Click en tab Evolución   → 4 gráficos de barras"
echo "    → Click en tab Viajes      → listado day-by-day"
echo "    → Click en tab Paradas     → listado de paradas"
echo "    → Tab Actividad NO existe"
echo "  Conductor: http://localhost:3000/objeto/conductor/<ID>"
echo "    → Mismas 5 tabs nuevas (sin Telemetría/Conductores)"
echo "  Grupo:     http://localhost:3000/objeto/grupo/<ID>"
echo "    → Mismas 5 tabs nuevas"
