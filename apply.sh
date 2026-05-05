#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  S5-T2 · Sistema canónico de listas y paneles
#  ─────────────────────────────────────────────────────────────
#  Bloque grande · unifica los renderers de celdas y los side
#  panels de toda la app, no solo el frame de tabla (eso ya lo
#  hizo S5-T1). Este lote responde al feedback "las listas son
#  visualmente distintas aunque sean DataTable v2".
#
#  ─────────────────────────────────────────────────────────────
#  CAPAS NUEVAS
#  ─────────────────────────────────────────────────────────────
#
#  1. Formatters (extiende src/lib/format.ts)
#     · formatTimestamp(iso, variant)
#       variants: short | with-seconds | long | long-seconds |
#                 date-only | time-only | time-only-seconds
#       Default "short" → dd/mm/yy hh:mm · canónico para tablas
#     · formatDistance(meters) → "7.45 km" / "850 m"
#     · formatSpeed(kmh)       → "71 km/h"
#     · formatCoords(lat,lng)  → "-34.79242, -58.21453"
#     · formatDurationFromSec(sec) → "6m 17s" / "2h 35m"
#     · mapSeverityToSemantic(level) → info | warning | danger | critical
#       Mapea LOW/MEDIUM/HIGH/CRITICAL Y LEVE/MEDIA/GRAVE a la
#       misma semántica visual.
#
#  2. Cell renderers · src/components/maxtracker/cells/
#     · TimestampCell     · timestamp con formato canónico
#     · VehicleCell       · nombre bold + patente gris mono debajo
#     · DriverCell        · nombre con link · "—" si no hay
#     · SeverityBadge     · pill color funcional (acepta cualquier enum)
#     · EventTypeCell     · dot color + label
#     · LocationCell      · address o coords mono
#     · SpeedCell         · "71 km/h" mono
#     · DistanceCell      · "7.45 km" mono
#     · DurationCell      · acepta sec o ms · "6m 17s" / "2h 35m"
#
#  3. Panel canónico · src/components/maxtracker/EntityDetailPanel/
#     · EntityDetailPanel    · shell con header (kicker · título ·
#                              subtítulo · accentColor) + close ESC
#     · PanelDataSection     · grid clave/valor · uppercase labels
#     · PanelMapSection      · Leaflet 3 modos · pin / segmento /
#                              polilínea · sin controles
#     · PanelCustomSection   · contenedor genérico
#     · PanelActionsSection  · botones contextuales
#
#  ─────────────────────────────────────────────────────────────
#  PANTALLAS MIGRADAS (3 · todas usan los nuevos cells + panel)
#  ─────────────────────────────────────────────────────────────
#
#  · /actividad/eventos · CANÓNICA DE REFERENCIA
#    EventsClient.tsx · usa todos los cells canónicos
#    EventDetailPanel.tsx · reescrito sobre EntityDetailPanel
#                            con secciones modulares
#
#  · /conduccion/infracciones
#    InfractionsClient.tsx · reemplaza renderers ad-hoc por cells
#    InfractionDetailPanel.tsx · 469 → 290 líneas, mismo
#                                comportamiento (mapa con polilínea,
#                                curva velocidad, descartar)
#
#  · /actividad/viajes (DaysList)
#    DaysList.tsx · reemplaza renderers ad-hoc por cells.
#    Su panel timeline (TripDetailPanel) NO se toca · es un
#    patrón distinto (timeline cronológica del día, no "evento
#    puntual").
#
#  ─────────────────────────────────────────────────────────────
#  QUÉ NO ENTRA (lo digo de frente para no inflar expectativas)
#  ─────────────────────────────────────────────────────────────
#
#  · Alarmas · usa AlarmCard (cards apilados) no tabla. Es otro
#    patrón. Si más adelante decidís pasarlo a tabla, se incluye.
#
#  · /conduccion/scorecard · sigue funcionando pero con el v1
#    style del DataTable. Migrarlo es trivial pero no cambia su
#    función.
#
#  · /catalogos/grupos y /gestion/grupos · ya están en DataTable
#    v2 desde S5-T1. Sus celdas son simples (texto · texto ·
#    texto · número) · podrían usar cells canónicos pero no
#    aporta mucho. Lo dejo como está.
#
#  · TripDetailPanel, DriverAssetsPanel, AssetDetailPanel y los
#    otros 5 paneles del repo NO se migran. Cada uno tiene
#    propósitos distintos al patrón "evento puntual" (timelines,
#    listados, telemetría live, etc.). El EntityDetailPanel es
#    para eventos discretos · no para todo lo que es lateral.
#
#  ─────────────────────────────────────────────────────────────
#  AUDITORÍAS (lecciones de los lotes anteriores)
#  ─────────────────────────────────────────────────────────────
#
#  ✓ Ningún .module.css tiene :root (CSS Modules no lo permite)
#  ✓ Ningún server component pasa funciones a client components
#  ✓ Sin literales viejos de VehicleType (CAR/MOTORCYCLE/...)
#  ✓ npx tsc --noEmit · 0 errores
#
#  Idempotente · usa cmp -s antes de cp.
# ═══════════════════════════════════════════════════════════════
set -e
PAYLOAD="_payload"
[ ! -d "$PAYLOAD" ] && echo "❌ no encuentro $PAYLOAD" && exit 1
[ ! -f "package.json" ] && echo "❌ no estoy en el root del repo" && exit 1
echo "═══ S5-T2 · Sistema canónico de listas y paneles ═══"

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
echo "Probá las 3 pantallas:"
echo "  · /actividad/eventos       ← CANÓNICA · referencia"
echo "  · /conduccion/infracciones ← debería verse igual"
echo "  · /actividad/viajes        ← debería verse igual"
echo ""
echo "Click en cualquier fila → side panel canónico (mismo header,"
echo "mismas secciones de datos, mismo comportamiento de cierre)."
echo ""
echo "PRÓXIMO BLOQUE · S5-E1 · Boletín de conductor (mensual)"
