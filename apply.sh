#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  apply.sh · Lote S3 · Pulido Configuración personal
#  ─────────────────────────────────────────────────────────────
#
#  Tres fixes de calidad sobre los tabs personales:
#
#  1) PASSWORD CHANGE REAL (Supabase Auth)
#     · Antes · solo guardaba hash dummy en User.passwordHash ·
#       NO cambiaba el password real
#     · Ahora · valida actual con signInWithPassword + actualiza
#       con updateUser. Si la actual está mal · "Contraseña
#       actual incorrecta"
#     · En modo demo (AUTH_MODE=demo) sigue siendo cosmético
#
#  2) EMAIL READ-ONLY EN MI PERFIL
#     · Antes · permitía cambiar el email pero no se sincronizaba
#       con Supabase Auth · quedaba inconsistente
#     · Ahora · email es read-only · hint "Para cambiarlo,
#       contactá soporte". Cambios en server side ignoran el
#       campo email del input
#
#  3) COMENTARIOS DE CÓDIGO ACTUALIZADOS
#     · "Honesty notes" del SeguridadTab y comentario "Auth0"
#       reemplazados con la realidad actual (Supabase Auth)
#
#  Pre-requisitos:
#   · S2 aplicado (logout, dark mode, layout con session)
#
#  No requiere migration.
# ═══════════════════════════════════════════════════════════════

set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
GREY='\033[0;90m'
NC='\033[0m'

LOTE_NAME="S3 · Pulido Configuración"
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

apply_file "src/app/(product)/configuracion/actions.ts"
apply_file "src/app/(product)/configuracion/MiPerfilTab.tsx"
apply_file "src/app/(product)/configuracion/SeguridadTab.tsx"

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
echo "  TEST 1 · EMAIL READ-ONLY"
echo "    /configuracion?section=perfil"
echo "    El campo Email aparece grisado, no editable."
echo "    Hint: 'No editable · para cambiarlo, contactá soporte'"
echo
echo "  TEST 2 · CAMBIO DE PASSWORD REAL"
echo "    /configuracion?section=seguridad"
echo "    En modo Supabase (AUTH_MODE=supabase):"
echo "      · Pass actual MAL → 'Contraseña actual incorrecta'"
echo "      · Pass actual BIEN + nueva válida → cambio real"
echo "      · Después logout · login con la NUEVA → debería entrar"
echo "      · Login con la VIEJA → 'Email o contraseña incorrectos'"
echo "    En modo demo (AUTH_MODE=demo):"
echo "      · Cualquier pass actual pasa (no se valida)"
echo "      · Mensaje 'Contraseña actualizada (modo demo)'"
echo
echo "  TEST 3 · OTROS TABS SIN CAMBIOS"
echo "    Notificaciones · 4 toggles → guardan OK"
echo "    Preferencias · idioma + tema → guardan OK"
echo
echo "  Si todo OK · push a producción:"
echo "     git add ."
echo "     git commit -m 'fix(config): password change real + email read-only (S3)'"
echo "     git push origin main"
