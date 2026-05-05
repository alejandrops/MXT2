#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  S5-T1 · DataTable v2 unificado · 5 pantallas migradas
#  ─────────────────────────────────────────────────────────────
#  Lote grande · unifica las tablas de toda la app al patrón
#  validado con el usuario (estilo "Posiciones del libro").
#
#  CAMBIOS:
#
#  1. DataTable v2 (reemplazo del v1, retrocompat)
#     · src/components/maxtracker/ui/DataTable.tsx  (~430 líneas)
#     · src/components/maxtracker/ui/DataTable.module.css
#
#     Patrón visual unificado:
#       · Headers uppercase pequeños en gris · poco peso visual
#       · Tipografía monoespaciada (--m IBM Plex Mono) en datos
#         numéricos · alineación perfecta por dígito
#       · Numeración de fila opcional (showRowNumber)
#       · Zebra striping muy sutil
#       · Hover state con tinte azul (--blu-bg)
#       · Sin bordes verticales · solo separadores horizontales
#       · Header del bloque con título + count + botón export
#       · Sticky header al scroll
#       · Empty state con texto gris centrado
#       · Click-row → side panel (callback opcional)
#       · Sortable headers (column.sortable)
#       · Paginación footer estándar
#       · Severity badges con color (mantenidos)
#
#     API retrocompat con v1 · ScorecardClient (único user de v1)
#     sigue funcionando sin cambios.
#
#  2. CSV export nativo (sin libs)
#     · src/lib/export/csv.ts
#     RFC 4180 compliant · BOM para Excel · downloadCsv() helper.
#     Cada tabla declara `exportColumns` con header + extractor.
#
#  3. Pantallas migradas:
#     · /conduccion/infracciones · InfractionsClient
#     · /actividad/eventos · EventsClient
#     · /actividad/viajes · DaysList
#     · /catalogos/grupos · usa GroupsTable wrapper
#     · /gestion/grupos · usa GroupsTable wrapper
#
#  4. GroupsTable wrapper
#     · src/components/maxtracker/groups/GroupsTable.tsx
#     Client component reusable para las dos páginas de grupos
#     (catalogos y gestion) que son server. Recibe rows +
#     linkBuilder y delega click-row a router.push.
#
#  NO MIGRADO EN ESTE LOTE:
#
#    /configuracion/empresa · EmpresaUsuariosTab
#       Cada UserRow tiene estado interno (edición inline de
#       perfil, modales por fila) que requiere descomponer el
#       componente. Es un refactor distinto · sub-lote S5-T1b.
#
#    /conduccion/scorecard · ScorecardClient
#       Ya usa DataTable (v1) · sigue funcionando con la API
#       retrocompat. Si querés migrarlo a la nueva API explícita
#       (con title, count, export) avísame.
#
#  PENDIENTE PARA SUB-LOTES:
#    · S5-T1b · Empresa Usuarios
#    · S5-E1  · Boletín de conductor (mensual/anual)
#    · S5-E2  · Boletín de grupo (ranking, scatter)
#    · S5-E3  · Boletín de empresa (cross-grupo, evolución 12m)
#
#  Idempotente · usa cmp -s antes de cp.
# ═══════════════════════════════════════════════════════════════
set -e
PAYLOAD="_payload"
[ ! -d "$PAYLOAD" ] && echo "❌ no encuentro $PAYLOAD" && exit 1
[ ! -f "package.json" ] && echo "❌ no estoy en el root del repo" && exit 1
echo "═══ S5-T1 · DataTable v2 · 5 pantallas migradas ═══"

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
echo "Probá las 5 pantallas migradas:"
echo "  · /conduccion/infracciones"
echo "  · /actividad/eventos"
echo "  · /actividad/viajes"
echo "  · /catalogos/grupos"
echo "  · /gestion/grupos"
echo ""
echo "En cualquiera deberías ver:"
echo "  · Header de tabla 'NOMBRE  count' arriba con botón Exportar CSV"
echo "  · Headers uppercase chicos en gris"
echo "  · Datos numéricos en monoespaciada alineada a la derecha"
echo "  · Hover azul claro · click abre side panel (donde aplica)"
echo "  · Zebra muy sutil · sin bordes verticales"
