#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  apply.sh · Lote L1 · Hotfixes UI
#  ─────────────────────────────────────────────────────────────
#
#  Resuelve los bugs reportados por Jere e IA en la auditoría:
#
#  1) BUG B7/BC4 · NaN en Actividad > Viajes
#     "Ver NaN más" · defensa con (totalDays ?? 0) - (days?.length ?? 0)
#     Math.max(0, ...) para no mostrar negativos.
#     File · src/app/(product)/actividad/viajes/TripsClient.tsx
#
#  2) BUG B8 · Boletín pantalla blanca
#     Refactor del index a función pura getLastClosedPeriod().
#     Si después del lote sigue blanco, hay que debugar el [period].
#     File · src/app/(product)/direccion/boletin/page.tsx
#
#  3) BUG BC5 · "ABIER" truncado en Torre de Control
#     .kpi { flex-shrink: 0 } evita que se aprete cuando el
#     header es angosto.
#     File · seguimiento/torre-de-control/TorreClient.module.css
#
#  4) BUG BC6 · KPI strip Mapa cortado ("en mov.", "detenidos")
#     Mismo fix · .kpi flex-shrink + .kpiLabel nowrap.
#     File · seguimiento/mapa/FleetTrackingClient.module.css
#
#  5) BUG BC8 · Campana se solapa con avatar
#     Aumenta gap del topbar de 10px (--gap-sm) a 14px hardcoded.
#     File · components/shell/Topbar.module.css
#
#  6) BUG BC9 · Breadcrumb "scorecard" en minúscula
#     Agrega scorecard, evolucion, resumen, configuracion, etc.
#     al diccionario PAGE_LABELS.
#     File · components/shell/Topbar.tsx
#
#  7) UX · Default período "Semana" en lugar de "Mes"
#     Cuando entrás a /actividad/reportes, default es week-days
#     no month-days. Útil porque mes-en-curso (día 1-2) está vacío.
#     File · src/app/(product)/actividad/reportes/page.tsx
#
#  8) UX · Margen del header MODO/SUJETO/VISTA
#     El TS usa styles.modesWrap pero el CSS solo definía axesWrap.
#     Resultado · sin estilo · pegado al borde. Agregamos modesWrap
#     al CSS con padding 12px 24px.
#     File · src/app/(product)/actividad/reportes/ReportesClient.module.css
#
#  9) UX · Quitar API del sidebar Actividad
#     Decidido · API va a Configuración más adelante. Por ahora
#     simplemente lo sacamos del sidebar.
#     File · components/shell/Sidebar.tsx
#
#  Pre-requisitos · S1-S6 + L0 aplicados.
#  No requiere migration. Solo cambios de código.
# ═══════════════════════════════════════════════════════════════

set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
GREY='\033[0;90m'
NC='\033[0m'

LOTE_NAME="L1 · Hotfixes UI"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

if [ ! -d "$SCRIPT_DIR/src" ]; then
  echo "ERROR · No encuentro 'src' en $SCRIPT_DIR/"
  exit 1
fi

if [ ! -d "src" ] || [ ! -f "package.json" ]; then
  echo "ERROR · No encuentro la raíz del proyecto Next.js."
  exit 1
fi

echo -e "${CYAN}═══ Lote $LOTE_NAME ═══${NC}"
echo

written=0
unchanged=0
created=0

apply_file() {
  local rel="$1"
  local src="$SCRIPT_DIR/$rel"
  local dst="$rel"

  if [ ! -f "$src" ]; then
    echo -e "  ${YELLOW}skip${NC}  $rel"
    return
  fi

  mkdir -p "$(dirname "$dst")"

  if [ ! -f "$dst" ]; then
    cp "$src" "$dst"
    echo -e "  ${GREEN}new ${NC}  $rel"
    created=$((created + 1))
    return
  fi

  if cmp -s "$src" "$dst"; then
    echo -e "  ${GREY}same${NC}  $rel"
    unchanged=$((unchanged + 1))
  else
    cp "$src" "$dst"
    echo -e "  ${GREEN}upd ${NC}  $rel"
    written=$((written + 1))
  fi
}

echo -e "${CYAN}── Bugs cr\u00edticos ──${NC}"
apply_file "src/app/(product)/actividad/viajes/TripsClient.tsx"
apply_file "src/app/(product)/direccion/boletin/page.tsx"

echo
echo -e "${CYAN}── Bugs de comportamiento (CSS) ──${NC}"
apply_file "src/app/(product)/seguimiento/torre-de-control/TorreClient.module.css"
apply_file "src/app/(product)/seguimiento/mapa/FleetTrackingClient.module.css"
apply_file "src/components/shell/Topbar.module.css"
apply_file "src/components/shell/Topbar.tsx"

echo
echo -e "${CYAN}── UX · Reportes ──${NC}"
apply_file "src/app/(product)/actividad/reportes/page.tsx"
apply_file "src/app/(product)/actividad/reportes/ReportesClient.module.css"

echo
echo -e "${CYAN}── UX · Sidebar ──${NC}"
apply_file "src/components/shell/Sidebar.tsx"

echo
echo -e "${CYAN}─── Resumen ───${NC}"
echo "  Nuevos:        $created"
echo "  Actualizados:  $written"
echo "  Sin cambios:   $unchanged"
echo

if [ -d ".next" ]; then
  rm -rf .next
  echo -e "  ${GREY}.next eliminado${NC}"
  echo
fi

echo -e "${GREEN}✓ Lote $LOTE_NAME aplicado.${NC}"
echo
echo -e "${YELLOW}══ TESTING ══${NC}"
echo
echo "  TEST 1 · NaN en Viajes (B7/BC4)"
echo "    /actividad/viajes con muchos viajes"
echo "    Antes · botón decía 'Ver NaN más'"
echo "    Después · 'Ver 20 más' o 'Ver 0 más' o desaparece"
echo
echo "  TEST 2 · Boletín NO pantalla blanca (B8)"
echo "    /direccion/boletin"
echo "    Esperado · redirect a /direccion/boletin/2026-04 funciona"
echo "    Si sigue blanco · DevTools > Console y mandame errores"
echo
echo "  TEST 3 · Torre de Control sin truncados (BC5)"
echo "    /seguimiento/torre-de-control"
echo "    KPI strip muestra 'ABIERTAS' completo (no 'ABIER')"
echo "    Achicar viewport · KPIs hacen wrap, no truncan"
echo
echo "  TEST 4 · Mapa KPIs no cortados (BC6)"
echo "    /seguimiento/mapa"
echo "    KPIs 'en mov.', 'detenidos', 'apagados', 'sin comm'"
echo "    Texto completo, no recortado"
echo
echo "  TEST 5 · Topbar sin solape (BC8)"
echo "    Mirá la campana al lado del avatar arriba a la derecha"
echo "    Esperado · hay 14px de gap, no se tocan"
echo
echo "  TEST 6 · Breadcrumb capitalizado (BC9)"
echo "    Navegá a /actividad/scorecard"
echo "    Breadcrumb dice 'Actividad / Scorecard'"
echo "    Antes · 'actividad / scorecard' (minúscula)"
echo "    Idem · /actividad/evolucion → 'Actividad / Evolución'"
echo "           /configuracion → 'Configuración'"
echo
echo "  TEST 7 · Reportes default Semana"
echo "    /actividad/reportes (sin query params)"
echo "    Esperado · botón 'Semana' destacado, datos del rango semanal"
echo "    Antes · 'Mes' destacado, mes-en-curso vacío"
echo
echo "  TEST 8 · Reportes header con margen"
echo "    /actividad/reportes"
echo "    El header MODO/SUJETO/VISTA ya no está pegado al borde"
echo "    Antes · texto pegado a la izquierda del viewport"
echo "    Después · 24px de margen"
echo
echo "  TEST 9 · API ya NO en sidebar Actividad"
echo "    Sidebar > Actividad"
echo "    Items · Reportes / Scorecard / Viajes (3 items)"
echo "    Antes · 4 items con API que daba 404"
echo
echo "  Si todo OK · push:"
echo "     git add ."
echo "     git commit -m 'fix(ui): hotfixes L1 · NaN, truncados, default semana, breadcrumbs'"
echo "     git push origin main"
