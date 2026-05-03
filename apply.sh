#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  apply.sh · L5.A · PageHeader + container coherente
#  ─────────────────────────────────────────────────────────────
#
#  Resuelve los hallazgos H-1, H-2 y H-12 del audit L5:
#    · H-1 · Falta título de página (30/31 pantallas)
#    · H-2 · Padding/container inconsistente entre pantallas
#    · H-12 · Topbar sin actions slot (PageHeader lo provee)
#
#  ── Cambios ───────────────────────────────────────────────────
#
#   1) globals.css · 3 clases nuevas:
#      · .appPage         · default · padding 16/20/40, gap 14, max-w 1280
#      · .appPage--dense  · más denso (Trips, layouts compactos)
#      · .appPageFull     · pantalla completa sin scroll (mapas)
#
#   2) PageHeader (variant="module") aplicado a 19 pantallas:
#      · Catálogos: vehículos, conductores, grupos
#      · Gestión:   vehículos, conductores, grupos
#      · Actividad: evolución, reportes, resumen, viajes
#      · Dirección: comparativas, correlaciones, distribución-grupos
#      · Seguimiento: torre-de-control, mapa, historial
#      · Seguridad: alarmas, dashboard
#      · Configuración
#
#   3) En /actividad/reportes hay 5 returns distintos (1 por modo)
#      · Cada uno wrappeado individualmente con PageHeader
#
#   4) Pantallas ya existentes con PageHeader (no se tocan):
#      · /direccion/vista-ejecutiva (ya usaba PageHeader)
#      · /actividad/scorecard (ya usaba PageHeader)
#      · /objeto/[tipo]/[id] (variant="object")
#
#   5) Pantallas saltadas explícitamente:
#      · /direccion/boletin/[period] (header complejo propio)
#      · /direccion/boletin (redirect)
#      · /actividad/analisis (redirect)
#      · /seguimiento/{viajes,reportes,analisis} (redirects)
#
#  ── Resultado visual ──────────────────────────────────────────
#
#  ANTES · cada pantalla arrancaba directo con su filter bar / KPIs
#  AHORA · cada pantalla tiene un header consistente:
#
#    ┌─────────────────────────────────────────────┐
#    │ VEHÍCULOS                                   │  ← PageHeader
#    │ subtitle (opcional)                         │     border-bottom
#    ├─────────────────────────────────────────────┤
#    │ [Filtros activos como pills]                │  ← GlobalFilterBar
#    ├─────────────────────────────────────────────┤
#    │ [KPI strip]                                 │
#    ├─────────────────────────────────────────────┤
#    │ [Filter bar] [Tabla] [Paginación]           │
#    └─────────────────────────────────────────────┘
#
#  Esto matchea Samsara/Geotab/HubSpot · enterprise SaaS standard.
#
#  ── Subtitles aplicados ───────────────────────────────────────
#
#  Solo agregué subtitle en pantallas analíticas donde explica el
#  tipo de análisis:
#    · Comparativas · "Slope chart..."
#    · Correlaciones · "Scatter..."
#    · Distribución por grupo · "Box plot..."
#    · Dashboard de seguridad · "Estado en tiempo real..."
#
#  Las demás van con title solo (catálogos, gestión, alarmas...)
#  El user puede agregarles subtitles en lotes futuros si lo decide.
#
#  ── Notas ─────────────────────────────────────────────────────
#
#  · Los CSS modules antiguos (.page de cada pantalla) NO se
#    eliminan · siguen referenciados por otras clases (.kpiStrip,
#    .body, etc). Solo se reemplazó el container.
#
#  · Las clases .appPage y .appPageFull son globales
#    (no CSS module) porque tienen que ser aplicables desde
#    `className="appPage"` en plantillas comunes.
#
#  Pre-requisitos · L11 aplicado (drill-downs · sin conflicto).
# ═══════════════════════════════════════════════════════════════

set -e

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; GREY='\033[0;90m'; NC='\033[0m'
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

if [ ! -d "src/app" ]; then
  echo "ERROR · raíz Next.js"; exit 1
fi

echo -e "${CYAN}═══ L5.A · PageHeader + container coherente ═══${NC}"; echo

written=0; unchanged=0; created=0
apply_file() {
  local rel="$1"; local src="$SCRIPT_DIR/$rel"; local dst="$rel"
  if [ ! -f "$src" ]; then echo -e "  ${YELLOW}skip${NC}  $rel"; return; fi
  mkdir -p "$(dirname "$dst")"
  if [ ! -f "$dst" ]; then
    cp -f "$src" "$dst"
    echo -e "  ${GREEN}new ${NC}  $rel"; created=$((created + 1))
    return
  fi
  if cmp -s "$src" "$dst" 2>/dev/null; then
    echo -e "  ${GREY}same${NC}  $rel"; unchanged=$((unchanged + 1))
  else
    cp -f "$src" "$dst"
    echo -e "  ${GREEN}upd ${NC}  $rel"; written=$((written + 1))
  fi
}

echo -e "${CYAN}── globals.css (3 clases nuevas: .appPage, .appPage--dense, .appPageFull) ──${NC}"
apply_file "src/app/globals.css"

echo
echo -e "${CYAN}── Catálogos ──${NC}"
apply_file "src/app/(product)/catalogos/vehiculos/page.tsx"
apply_file "src/app/(product)/catalogos/conductores/page.tsx"
apply_file "src/app/(product)/catalogos/grupos/page.tsx"

echo
echo -e "${CYAN}── Gestión ──${NC}"
apply_file "src/app/(product)/gestion/vehiculos/page.tsx"
apply_file "src/app/(product)/gestion/conductores/page.tsx"
apply_file "src/app/(product)/gestion/grupos/page.tsx"

echo
echo -e "${CYAN}── Actividad ──${NC}"
apply_file "src/app/(product)/actividad/viajes/page.tsx"
apply_file "src/app/(product)/actividad/reportes/page.tsx"
apply_file "src/app/(product)/actividad/evolucion/page.tsx"
apply_file "src/app/(product)/actividad/resumen/page.tsx"

echo
echo -e "${CYAN}── Dirección (Clients) ──${NC}"
apply_file "src/app/(product)/direccion/comparativas/ComparativasClient.tsx"
apply_file "src/app/(product)/direccion/correlaciones/CorrelacionesClient.tsx"
apply_file "src/app/(product)/direccion/distribucion-grupos/DistribucionGruposClient.tsx"

echo
echo -e "${CYAN}── Seguimiento (full-viewport) ──${NC}"
apply_file "src/app/(product)/seguimiento/torre-de-control/page.tsx"
apply_file "src/app/(product)/seguimiento/mapa/page.tsx"
apply_file "src/app/(product)/seguimiento/historial/page.tsx"

echo
echo -e "${CYAN}── Seguridad ──${NC}"
apply_file "src/app/(product)/seguridad/alarmas/page.tsx"
apply_file "src/app/(product)/seguridad/dashboard/page.tsx"

echo
echo -e "${CYAN}── Configuración ──${NC}"
apply_file "src/app/(product)/configuracion/page.tsx"

echo
echo "  Nuevos: $created · Updated: $written · Same: $unchanged"

if [ -d ".next" ]; then rm -rf .next; fi

echo
echo -e "${GREEN}✓ L5.A aplicado.${NC}"
echo
echo -e "${YELLOW}══ TESTING ══${NC}"
echo "  TEST 1 · Navegá a /catalogos/vehiculos · debería verse:"
echo "    ┌──────────────────────────────────┐"
echo "    │ VEHÍCULOS                        │  ← header con título"
echo "    │ ────────────────────────────     │     border-bottom"
echo "    │ [filter bar]                     │"
echo "    │ [tabla]                          │"
echo "    └──────────────────────────────────┘"
echo
echo "  TEST 2 · Navegá entre Catálogos · Gestión · Actividad · Dirección"
echo "    Todas las pantallas deberían tener el mismo padding/container"
echo "    (catálogos vs alarmas vs comparativas se ven iguales)"
echo
echo "  TEST 3 · /direccion/comparativas · /correlaciones · /distribucion-grupos"
echo "    Debería verse el subtitle bajo el título (descripción del análisis)"
echo
echo "  TEST 4 · /seguimiento/torre-de-control · /mapa · /historial"
echo "    Header con título, abajo la pantalla full-viewport"
echo
echo -e "${YELLOW}══ Reiniciar dev server ══${NC}"
echo "  rm -rf .next && npm run dev"
echo "  Hard refresh · Cmd+Shift+R"
echo
echo -e "${YELLOW}══ Próximo: L5.B (KPIs + EmptyStates unificados) ══${NC}"
