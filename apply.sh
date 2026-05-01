#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  apply.sh · Lote S5 · Selector de cuenta para SA/MA
#  ─────────────────────────────────────────────────────────────
#
#  Resuelve el problema de SA/MA viendo "No se pudo cargar..."
#  en todos los tabs Empresa porque no tienen accountId.
#
#  Cambios:
#
#  1) AccountSwitcher · componente nuevo · dropdown que aparece
#     arriba del grupo "Empresa" en el sidebar · solo visible
#     para SA/MA. Lista todas las cuentas de su organización.
#     Click en una → ?account=<id> en URL, navegación cliente.
#
#  2) page.tsx · resuelve targetAccountId via:
#     · CA → su propia cuenta (session.account.id)
#     · SA/MA → query param ?account=X · si falta, primera cuenta
#       de su organización
#
#  3) ConfiguracionShell · acepta props nuevas · renderea el
#     switcher arriba del grupo Empresa solo para SA/MA. Función
#     navigate() preserva el ?account al cambiar de section.
#
#  4) actions-empresa · hardening · SA/MA solo pueden mutar
#     cuentas de SU organización (antes podían tocar cualquier
#     cuenta del sistema, riesgo si escalan a multi-org).
#
#  Pre-requisitos: S1, S2, S3, S4 aplicados
#  No requiere migration.
# ═══════════════════════════════════════════════════════════════

set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
GREY='\033[0;90m'
NC='\033[0m'

LOTE_NAME="S5 · Selector de cuenta para SA/MA"
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

echo -e "${CYAN}── Components ──${NC}"
apply_file "src/app/(product)/configuracion/empresa/AccountSwitcher.tsx"
apply_file "src/app/(product)/configuracion/empresa/AccountSwitcher.module.css"

echo
echo -e "${CYAN}── Page + Shell ──${NC}"
apply_file "src/app/(product)/configuracion/page.tsx"
apply_file "src/app/(product)/configuracion/ConfiguracionShell.tsx"

echo
echo -e "${CYAN}── Server actions (hardening) ──${NC}"
apply_file "src/app/(product)/configuracion/actions-empresa.ts"

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
echo "  npm run dev"
echo
echo "  TEST 1 · COMO SA · ver tabs Empresa"
echo "    /configuracion?section=empresa-datos"
echo "    Esperado: ya NO dice 'No se pudo cargar'"
echo "    Esperado: en el sidebar, arriba del grupo EMPRESA, hay"
echo "              un dropdown 'Viendo cuenta · [primera cuenta]'"
echo
echo "  TEST 2 · CAMBIAR DE CUENTA"
echo "    Click en el dropdown 'Viendo cuenta'"
echo "    Lista todas las cuentas de tu org (4 demo cuentas)"
echo "    Click en otra → URL pasa a ?account=X&section=empresa-datos"
echo "    El form muestra los datos de la nueva cuenta"
echo
echo "  TEST 3 · NAVEGAR ENTRE TABS PRESERVA ACCOUNT"
echo "    Estás en empresa-datos viendo Frigoríficos Andinos"
echo "    Click 'Umbrales y alarmas' en el sidebar"
echo "    Esperado: URL = ?section=empresa-umbrales&account=<id>"
echo "    Esperado: muestra umbrales de Frigoríficos (no la primera)"
echo
echo "  TEST 4 · COMO CA · NO HAY DROPDOWN"
echo "    Logout y login con un user CA (ej. admin@frigorificos-andinos.cl)"
echo "    /configuracion?section=empresa-datos"
echo "    Esperado: NO aparece el dropdown 'Viendo cuenta'"
echo "    Esperado: ve solo su propia cuenta sin opción de cambiar"
echo
echo "  Si todo OK · push:"
echo "     git add ."
echo "     git commit -m 'feat(empresa): selector de cuenta para SA/MA (S5)'"
echo "     git push origin main"
