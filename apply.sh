#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  apply.sh · FIXES 1 · Issues post-deploy de L5.A
#  ─────────────────────────────────────────────────────────────
#
#  Dos issues reportados después de deploy con login picker:
#
#  ── Issue 1 · /seguimiento/historial · selector de fecha
#      apilado en columna en vez de horizontal ───────────────
#
#  Causas:
#   1. El page tenía 3 children dentro de un grid de 2 rows
#      (HistoricosFilterBar + HistoricosLastSeenSync + RoutePlayback).
#      Eso forzaba layout incorrecto.
#   2. El .bar del HistoricosFilterBar no declaraba width
#      explícito · quedaba comprimido.
#   3. El DayWithTimePicker.wrap no tenía min-width · al estar
#      dentro de flex-wrap se contraía a la columna más pequeña.
#
#  Fixes:
#   · page.tsx · HistoricosLastSeenSync sale del grid (es invisible,
#     no tiene que ocupar cell)
#   · HistoricosFilterBar.module.css · width: 100% explícito
#   · DayWithTimePicker.module.css · min-width: 480px + flex grow
#
#  ── Issue 2 · Configuración no anda desde el menú ──────────
#
#  Causa: el botón "Configuración" del sidebar era un
#  `<button disabled>` sin onClick. Estaba ahí como placeholder
#  visual solo. La page /configuracion existe y funciona ·
#  solo no había forma de llegar desde el menú.
#
#  Fix: cambiar a `<Link href="/configuracion">` con clase
#  active según pathname.
# ═══════════════════════════════════════════════════════════════

set -e

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; GREY='\033[0;90m'; NC='\033[0m'
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

if [ ! -d "src" ]; then
  echo "ERROR · raíz Next.js"; exit 1
fi

echo -e "${CYAN}═══ FIXES 1 · Historial + Configuración ═══${NC}"; echo

written=0; unchanged=0
apply_file() {
  local rel="$1"; local src="$SCRIPT_DIR/$rel"; local dst="$rel"
  if [ ! -f "$src" ]; then echo -e "  ${YELLOW}skip${NC}  $rel"; return; fi
  mkdir -p "$(dirname "$dst")"
  if cmp -s "$src" "$dst" 2>/dev/null; then
    echo -e "  ${GREY}same${NC}  $rel"; unchanged=$((unchanged + 1))
  else
    cp -f "$src" "$dst"
    echo -e "  ${GREEN}upd ${NC}  $rel"; written=$((written + 1))
  fi
}

echo -e "${CYAN}── Issue 2 · Configuración como Link ──${NC}"
apply_file "src/components/shell/Sidebar.tsx"
apply_file "src/components/shell/Sidebar.module.css"

echo
echo -e "${CYAN}── Issue 1 · Historial · selector de fecha ──${NC}"
apply_file "src/app/(product)/seguimiento/historial/page.tsx"
apply_file "src/components/maxtracker/HistoricosFilterBar.module.css"
apply_file "src/components/maxtracker/time/DayWithTimePicker.module.css"

echo
echo "  Updated: $written · Same: $unchanged"

if [ -d ".next" ]; then rm -rf .next; fi

echo
echo -e "${GREEN}✓ Fixes aplicados.${NC}"
echo
echo -e "${YELLOW}══ COMMIT + PUSH ══${NC}"
echo "  git add -A"
echo "  git commit -m 'fix: historial date picker layout + sidebar config link'"
echo "  git push origin main"
echo
echo -e "${YELLOW}══ TEST después del deploy ══${NC}"
echo "  · /seguimiento/historial · selector de día y hora ahora horizontal"
echo "  · Click en 'Configuración' del sidebar bottom · te lleva a /configuracion"
