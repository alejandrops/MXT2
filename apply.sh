#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  apply.sh · L10.B · Excel export · cierre del bloque
#  ─────────────────────────────────────────────────────────────
#
#  Completa lo que faltaba de L10:
#
#  1. VisualView           · agregada opción "Excel" al ExportMenu
#  2. ScorecardClient      · agregada opción "Excel" al ExportMenu
#  3. Boletín mensual      · botón "Excel" en el header · genera
#                            workbook con 6 hojas usando data ya
#                            cargada en server-side
#
#  ── Decisión de arquitectura · Boletín ───────────────────────
#
#  loadBoletinData() son 200+ LOC inline en boletin/[period]/page.tsx.
#  Refactorizarlo a lib/queries/boletin.ts era trabajo grande.
#
#  Solución pragmática · "boletin-with-data":
#   · La page ya carga la data como server component
#   · La pasa al BoletinHeader como prop
#   · El cliente serializa la data y la POSTea al endpoint
#   · El endpoint genera el .xlsx con esa data (no requiere
#     re-query a la DB)
#
#  Beneficio: cero duplicación de query · zero refactor de la page.
#  Costo: el payload viaja por la red (~50KB típicos) · negligible.
#
#  ── Hojas del Excel del Boletín ──────────────────────────────
#
#   1. Resumen           · KPIs current vs previous + delta %
#   2. Top vehículos     · ranking eventos/100km
#   3. Top conductores   · ranking safety score
#   4. Grupos            · performance por grupo
#   5. Alarmas           · breakdown severidad/dominio + top vehículos
#   6. Eventos           · breakdown por tipo
#
#  ── Pre-requisitos ───────────────────────────────────────────
#
#  · L10 aplicado (genera lib/excel/boletin.ts y el route handler)
#  · npm install (exceljs ^4.4.0 · ya viene del L10 base)
# ═══════════════════════════════════════════════════════════════

set -e

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; GREY='\033[0;90m'; NC='\033[0m'
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

if [ ! -d "src/components/maxtracker" ]; then
  echo "ERROR · raíz Next.js"; exit 1
fi

echo -e "${CYAN}═══ L10.B · Excel export · cierre ═══${NC}"; echo

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

echo -e "${CYAN}── Reportes · VisualView + ScorecardClient ──${NC}"
apply_file "src/app/(product)/actividad/reportes/VisualView.tsx"
apply_file "src/app/(product)/actividad/scorecard/ScorecardClient.tsx"

echo
echo -e "${CYAN}── Boletín · página + header ──${NC}"
apply_file "src/app/(product)/direccion/boletin/[period]/page.tsx"
apply_file "src/components/maxtracker/boletin/BoletinHeader.tsx"

echo
echo -e "${CYAN}── Route handler · soporte boletin-with-data ──${NC}"
apply_file "src/app/api/export/xlsx/route.ts"

echo
echo "  Nuevos: $created · Updated: $written · Same: $unchanged"

if [ -d ".next" ]; then rm -rf .next; fi

echo
echo -e "${GREEN}✓ L10.B aplicado.${NC}"
echo
echo -e "${YELLOW}══ TESTING ══${NC}"
echo
echo "  TEST 1 · /actividad/reportes · modo Visual (Heatmap/Ranking/Multiples)"
echo "    · ExportMenu ahora muestra CSV + Excel + Imprimir"
echo "    · Click Excel → descarga reporte_visual_*.xlsx"
echo
echo "  TEST 2 · /actividad/scorecard"
echo "    · ExportMenu en el header con CSV + Excel + Imprimir"
echo "    · Click Excel → descarga scorecard_YYYY-MM-DD.xlsx"
echo
echo "  TEST 3 · /direccion/boletin (mes con datos)"
echo "    · En el header del boletín ahora aparece botón 'Excel' (verde)"
echo "    · Click → descarga boletin_YYYY-MM.xlsx"
echo "    · Excel debería tener 6 hojas:"
echo "        Resumen · Top vehículos · Top conductores ·"
echo "        Grupos · Alarmas · Eventos"
echo
echo -e "${YELLOW}══ Reiniciar dev server ══${NC}"
echo "  rm -rf .next && npm run dev"
