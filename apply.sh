#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  apply.sh · Lote S2 · Logout + Dark Mode + Pulido
#  ─────────────────────────────────────────────────────────────
#
#  Tres mejoras en un lote:
#
#  1) LOGOUT
#     · Botón "Cerrar sesión" en el avatar dropdown
#     · POST /auth/signout · cierra Supabase + redirect /login
#
#  2) DARK MODE FUNCIONAL
#     · Variables CSS en globals.css con [data-theme="dark"]
#     · ThemeProvider · sincroniza preferencia user con DOM
#     · ThemeBoot · script inline anti-FOUC en <html>
#     · Cookie mxt-theme · evita flash al cargar
#     · Soporta LIGHT / DARK / AUTO (sigue al OS)
#     · Sidebar · backgrounds hardcoded → variables (theme-aware)
#
#  3) UI POLISH
#     · Topbar muestra user real (nombre, email, perfil) con
#       iniciales calculadas
#     · Modo Administrador solo visible para SA / MA
#     · Configuración icon es Link funcional (pasa de div a Link)
#
#  Pre-requisitos:
#   · S1 aplicado (sidebar de configuración, AccountSettings table)
#
#  No requiere migration · usa el enum Theme existente (LIGHT,
#  DARK, AUTO ya estaban en el schema).
# ═══════════════════════════════════════════════════════════════

set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
GREY='\033[0;90m'
NC='\033[0m'

LOTE_NAME="S2 · Logout + Dark Mode + Polish"
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
  local mode="$2"
  local src="$SCRIPT_DIR/$rel"
  local dst="$rel"

  if [ ! -f "$src" ]; then
    echo -e "  ${YELLOW}skip${NC}  $rel"
    return
  fi

  mkdir -p "$(dirname "$dst")"

  if [ ! -f "$dst" ]; then
    cp "$src" "$dst"
    [ "$mode" = "exec" ] && chmod +x "$dst"
    echo -e "  ${GREEN}new ${NC}  $rel"
    created=$((created + 1))
    return
  fi

  if cmp -s "$src" "$dst"; then
    echo -e "  ${GREY}same${NC}  $rel"
    unchanged=$((unchanged + 1))
  else
    cp "$src" "$dst"
    [ "$mode" = "exec" ] && chmod +x "$dst"
    echo -e "  ${GREEN}upd ${NC}  $rel"
    written=$((written + 1))
  fi
}

echo -e "${CYAN}── Theme infrastructure ──${NC}"
apply_file "src/components/theme/ThemeBoot.tsx"
apply_file "src/components/theme/ThemeProvider.tsx"
apply_file "src/app/globals.css"

echo
echo -e "${CYAN}── Layouts (root + product) ──${NC}"
apply_file "src/app/layout.tsx"
apply_file "src/app/(product)/layout.tsx"

echo
echo -e "${CYAN}── Logout endpoint ──${NC}"
apply_file "src/app/auth/signout/route.ts"

echo
echo -e "${CYAN}── Topbar (user real + logout) ──${NC}"
apply_file "src/components/shell/Topbar.tsx"
apply_file "src/components/shell/Topbar.module.css"

echo
echo -e "${CYAN}── Sidebar (theme-aware) ──${NC}"
apply_file "src/components/shell/Sidebar.tsx"
apply_file "src/components/shell/Sidebar.module.css"

echo
echo -e "${CYAN}── Tabs configuracion (PreferenciasTab actualizado) ──${NC}"
apply_file "src/app/(product)/configuracion/PreferenciasTab.tsx"

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
echo -e "${YELLOW}══ TESTING LOCAL ══${NC}"
echo
echo "  npm run dev"
echo
echo "  TEST 1 · LOGOUT"
echo "    · Login como Alejandro (alejandrops@gmail.com)"
echo "    · Click en avatar arriba a la derecha"
echo "    · Vas a ver tu nombre real, email, y perfil ('Super admin')"
echo "    · Click 'Cerrar sesión' → redirect a /login"
echo
echo "  TEST 2 · DARK MODE"
echo "    · /configuracion?section=preferencias"
echo "    · Cambiar tema a 'Oscuro' → guardar"
echo "    · TODA la app debería cambiar a dark inmediatamente"
echo "    · Probá 'Automático' · si tu Mac está en dark, queda dark"
echo
echo "  TEST 3 · MODO ADMIN VISIBILITY"
echo "    · Como SA → ves 'Modo Administrador' en avatar dropdown"
echo "    · Logout y entrar como CA → NO aparece esa opción"
echo
echo "  TEST 4 · CONFIGURACIÓN ICON"
echo "    · Click en el engranaje del topbar (al lado del avatar)"
echo "    · Te lleva a /configuracion"
echo
echo "  Si todo OK · commit + push para deployar a Vercel:"
echo "     git add ."
echo "     git commit -m 'feat(ui): logout + dark mode + topbar polish (S2)'"
echo "     git push origin main"
