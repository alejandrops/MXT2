#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  apply.sh · L3-style-2-FIX · restaurar exports completos en ui/index.ts
#  ─────────────────────────────────────────────────────────────
#
#  HOTFIX para error de runtime:
#    "Element type is invalid · GlobalFilterBar undefined"
#    en src/app/(product)/layout.tsx
#
#  Causa:
#    El index.ts del lote L3-style-2 sobreescribió el index.ts
#    legacy · solo exportaba los 3 componentes nuevos
#    (FilterFieldGroup, SelectField, SearchField) y omitió todos
#    los exports preexistentes (GlobalFilterBar, KpiCard,
#    PageHeader, EmptyState, ExportMenu, RankingList, etc.)
#
#  Fix:
#    Reemplazar el index.ts con uno que tenga TODOS los exports:
#    legacy + nuevos.
#
#  1 archivo:
#   src/components/maxtracker/ui/index.ts
#
#  Pre-requisitos · L3-style-2 aplicado (este lote lo arregla).
# ═══════════════════════════════════════════════════════════════

set -e

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; NC='\033[0m'
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

if [ ! -d "src/components/maxtracker/ui" ]; then
  echo "ERROR · src/components/maxtracker/ui no existe"
  exit 1
fi

echo -e "${CYAN}═══ L3-style-2-FIX · Restaurar exports en ui/index.ts ═══${NC}"; echo

cp -f "$SCRIPT_DIR/src/components/maxtracker/ui/index.ts" \
      "src/components/maxtracker/ui/index.ts"
echo -e "  ${GREEN}upd${NC}  src/components/maxtracker/ui/index.ts"

if [ -d ".next" ]; then rm -rf .next; fi

echo
echo -e "${GREEN}✓ HOTFIX aplicado.${NC}"
echo
echo -e "${YELLOW}══ TESTING ══${NC}"
echo "  TEST 1 · npx tsc --noEmit · debe pasar limpio"
echo "  TEST 2 · navegar a cualquier pantalla · GlobalFilterBar debe renderizar"
echo
echo "  Reiniciá dev server: rm -rf .next && npm run dev"
echo "  Hard refresh: Cmd+Shift+R"
