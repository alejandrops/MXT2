#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  S4-L2-eventos-listado · apply.sh
#  Pantalla nueva /actividad/eventos · listado + heatmap
#
#  CAMBIOS:
#
#    1. Pantalla nueva · /actividad/eventos
#       Listado tabular de eventos del enterprise con filtros:
#         · período (PeriodNavigator estándar)
#         · tipos · multi-select agrupado por categoría
#           (Conducción / Seguridad / Geocercas)
#         · severidad · multi-select chips inline
#         · scope (grupos / tipos vehículo / conductores / search)
#       Default · sin filtro = todos los tipos.
#
#    2. Vista alternativa Heatmap
#       Toggle Lista | Heatmap arriba a la derecha.
#       Heatmap usa leaflet.heat con gradiente de calor.
#       Sub-toggle dentro · Heatmap | Pins (colorea por tipo).
#
#    3. Panel lateral de detalle
#       Click en fila → panel slide-in con:
#         · tipo + severity badge
#         · fecha/hora · vehículo (link al Libro) · conductor (link)
#         · velocidad · ubicación · metadata
#         · mini-mapa centrado en el evento
#       Cierre con X, ESC o click backdrop.
#
#    4. Componentes nuevos reusables
#       · EventHeatmap         · mapa heatmap+pins · usable en otras pantallas
#       · EventDetailPanel     · panel lateral · usable en otras pantallas
#       · EventTypeFilter      · multi-select agrupado · reusable
#       · SeverityFilter       · chips toggleables · reusable
#
#    5. Lib reusable
#       · src/lib/event-catalog.ts
#         Single source of truth · labels, colors, categorías
#         de los 19 EventType del enum
#       · src/lib/queries/events-list.ts
#         listEvents() · cross-fleet con filtros, paginación, scope
#         listEventsForHeatmap() · solo lat/lng/type, cap 10k pts
#
#    6. Sidebar + cmdk
#       Item nuevo "Actividad > Eventos"
#       Cmd+K · "Eventos", "Alarmas", "Infracciones" llevan a /actividad/eventos
#
#  DEPENDENCIA NUEVA:
#    leaflet.heat (instalado vía npm install)
#
#  Idempotente · usa cmp -s antes de cp.
# ═══════════════════════════════════════════════════════════════
set -e
PAYLOAD="_payload"
[ ! -d "$PAYLOAD" ] && echo "❌ no encuentro $PAYLOAD" && exit 1
[ ! -f "package.json" ] && echo "❌ no estoy en el root del repo" && exit 1
echo "═══ S4-L2 · /actividad/eventos · listado + heatmap ═══"

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
echo "Próximo paso · instalar dependencias y reiniciar dev server:"
echo "  npm install         # instala leaflet.heat (nuevo en package.json)"
echo "  rm -rf .next && npm run dev"
echo ""
echo "Validación e2e:"
echo "  http://localhost:3000/actividad/eventos"
echo "    → Vista lista · default · 50 eventos por página"
echo "    → Click en fila → panel lateral con detalle + mini-mapa"
echo "    → Cambiar a vista Heatmap → mapa con calor por densidad"
echo "    → Toggle Heatmap/Pins dentro del mapa"
echo "    → Filtro tipos · agrupado por Conducción/Seguridad/Geocercas"
echo "    → Filtro severidad · chips toggleables"
echo "    → Cmd+K · 'Eventos' → llega"
echo "    → Sidebar · Actividad > Eventos"
