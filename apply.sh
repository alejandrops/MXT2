#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  apply.sh · FIX-CSS · Sidebar.module.css syntax error
#  ─────────────────────────────────────────────────────────────
#
#  En el lote FIXES-1 cometí un error · cuando hice str_replace
#  para agregar text-decoration al .configBtn, dejé líneas
#  huérfanas del bloque viejo:
#
#     .configBtnActive { ... }    ← bloque nuevo (correcto)
#       background: transparent;  ← huérfano (del bloque viejo)
#       border: none;             ← huérfano
#       text-decoration: none;    ← huérfano
#       font-family: inherit;     ← huérfano
#       transition: ...;          ← huérfano
#     }                           ← cerrando bloque inexistente
#
#  Resultado: error de sintaxis CSS · build fail.
#
#  ── Fix ─────────────────────────────────────────────────────
#
#  Limpieza · las propiedades huérfanas se mueven al bloque
#  combinado `.collapseBtn, .configBtn { ... }` donde corresponden.
# ═══════════════════════════════════════════════════════════════

set -e

CYAN='\033[0;36m'; GREEN='\033[0;32m'; NC='\033[0m'
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

if [ ! -d "src/components/shell" ]; then
  echo "ERROR · raíz Next.js"; exit 1
fi

echo -e "${CYAN}═══ FIX CSS · Sidebar.module.css ═══${NC}"; echo

cp -f "$SCRIPT_DIR/src/components/shell/Sidebar.module.css" \
      "src/components/shell/Sidebar.module.css"
echo -e "  ${GREEN}upd ${NC}  src/components/shell/Sidebar.module.css"

if [ -d ".next" ]; then rm -rf .next; fi

echo
echo -e "${GREEN}✓ Fix aplicado.${NC}"
echo
echo "  git add -A"
echo "  git commit -m 'fix: sidebar CSS syntax error'"
echo "  git push origin main"
