#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  apply.sh · HOTFIX 2 · Vercel build · boletin.ts font assignment
#  ─────────────────────────────────────────────────────────────
#
#  Error en build de Vercel:
#    src/lib/excel/boletin.ts:119:3
#    Type error: Type 'Partial<Font> | undefined' is not assignable
#    to type 'Partial<Font>'.
#
#  Causa: en strict mode, KPI_TITLE_STYLE.font puede ser undefined
#  (porque KPI_TITLE_STYLE es Partial<Style>) y TS no me deja
#  asignarlo directo a row.font (que espera Partial<Font> sin undefined).
#
#  Fix: guard `if (KPI_TITLE_STYLE.font)` antes de la asignación.
#  Sintácticamente trivial · runtime idéntico.
#
#  Este es el segundo error TS introducido en L10 que mata el
#  build de Vercel. El primero fue del L5.A (ReportesClient props
#  faltantes) ya arreglado.
#
#  Verifiqué que es el único en lib/excel/ con asignación directa
#  a propiedad opcional · el resto usa Object.assign() que es
#  más permisivo.
# ═══════════════════════════════════════════════════════════════

set -e

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; GREY='\033[0;90m'; NC='\033[0m'
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

if [ ! -d "src/lib/excel" ]; then
  echo "ERROR · raíz Next.js · no existe src/lib/excel"; exit 1
fi

echo -e "${CYAN}═══ HOTFIX 2 · boletin.ts font ═══${NC}"; echo

apply_file() {
  local rel="$1"; local src="$SCRIPT_DIR/$rel"; local dst="$rel"
  if [ ! -f "$src" ]; then echo -e "  ${YELLOW}skip${NC}  $rel"; return; fi
  mkdir -p "$(dirname "$dst")"
  if cmp -s "$src" "$dst" 2>/dev/null; then
    echo -e "  ${GREY}same${NC}  $rel"
  else
    cp -f "$src" "$dst"
    echo -e "  ${GREEN}upd ${NC}  $rel"
  fi
}

apply_file "src/lib/excel/boletin.ts"

if [ -d ".next" ]; then rm -rf .next; fi

echo
echo -e "${GREEN}✓ Hotfix 2 aplicado.${NC}"
echo
echo -e "${YELLOW}══ COMMIT + PUSH ══${NC}"
echo "  git add -A"
echo "  git commit -m 'fix: boletin.ts font assignment guard'"
echo "  git push origin main"
