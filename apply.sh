#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  apply.sh · Lote S6 · Cambiar password de otros users (admin)
#  ─────────────────────────────────────────────────────────────
#
#  Permite a CA / SA / MA cambiar la pass de cualquier user de
#  su cuenta sin saber la pass actual. Útil cuando un user
#  olvidó su password (no hay reset por email todavía).
#
#  Cambios:
#
#  1) Cliente admin Supabase · src/lib/supabase/admin.ts
#     · Usa SERVICE_ROLE_KEY (admin API) · solo server-side
#
#  2) Server action setUserPassword en actions-empresa.ts
#     · Verifica permisos (mismo patrón que las otras actions)
#     · Bloquea cambiar la propia password (eso va por Seguridad)
#     · Llama supabase.auth.admin.updateUserById({ password })
#
#  3) Componente SetPasswordModal · empresa/SetPasswordModal.tsx
#     · Form con nueva pass + repetir
#     · Validación 8+ chars, letras y números
#     · Toggle ojo · ver/ocultar password
#     · Warning sobre comunicar la nueva pass al user
#
#  4) Botón "Cambiar contraseña" en cada row de la tabla
#     · Icon KeyRound · entre Suspender y Eliminar
#     · No aparece para el current user (vos mismo)
#
#  Pre-requisitos:
#   · SUPABASE_SERVICE_ROLE_KEY en .env (Vercel + local)
#   · @supabase/supabase-js instalado (debería estar via @supabase/ssr)
#   · S5 aplicado
# ═══════════════════════════════════════════════════════════════

set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
GREY='\033[0;90m'
RED='\033[0;31m'
NC='\033[0m'

LOTE_NAME="S6 · Set password de otros users"
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

# ── Pre-check · SERVICE_ROLE_KEY ──
if [ -f ".env" ] && ! grep -q "^SUPABASE_SERVICE_ROLE_KEY=" .env; then
  echo -e "${YELLOW}⚠ WARNING · SUPABASE_SERVICE_ROLE_KEY no está en .env${NC}"
  echo "   Sin esa key, el feature falla en runtime."
  echo "   Encontrala en: Supabase Dashboard > Project Settings > API"
  echo "   La etiqueta dice 'service_role' (NO 'anon public')."
  echo "   Agregala como: SUPABASE_SERVICE_ROLE_KEY=eyJhb..."
  echo
  echo "   También agregala en Vercel: Settings > Environment Variables"
  echo
fi

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

echo -e "${CYAN}── Lib · cliente admin Supabase ──${NC}"
apply_file "src/lib/supabase/admin.ts"

echo
echo -e "${CYAN}── Server actions ──${NC}"
apply_file "src/app/(product)/configuracion/actions-empresa.ts"

echo
echo -e "${CYAN}── UI ──${NC}"
apply_file "src/app/(product)/configuracion/empresa/SetPasswordModal.tsx"
apply_file "src/app/(product)/configuracion/empresa/SetPasswordModal.module.css"
apply_file "src/app/(product)/configuracion/empresa/EmpresaUsuariosTab.tsx"

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
echo "  Antes de testear:"
echo "    1) Asegurate de tener SUPABASE_SERVICE_ROLE_KEY en .env"
echo "    2) Si la agregaste recién, reinicia npm run dev"
echo
echo "  TEST 1 · Cambiar password de un user demo"
echo "    /configuracion?section=empresa-usuarios"
echo "    Click en el icon de llave (🔑) de un user (no el tuyo)"
echo "    Modal: 'Cambiar contraseña'"
echo "    Poné nueva pass: Test1234nueva"
echo "    Esperado: 'Contraseña actualizada para [Nombre]...'"
echo
echo "  TEST 2 · Verificar que la nueva password funciona"
echo "    Logout → login con el email del user modificado + nueva pass"
echo "    Esperado: entra · puede usar la app"
echo "    Login con la pass VIEJA → 'Email o contraseña incorrectos'"
echo
echo "  TEST 3 · El icon NO aparece para vos mismo"
echo "    En la tabla, mirá tu propia fila"
echo "    Esperado: NO hay icon 🔑 (ni Pause ni Trash) · solo se ve 'Vos'"
echo
echo "  TEST 4 · CA puede cambiar pass de OPs/CAs de SU cuenta"
echo "    Logout · login como CA (admin@frigorificos-andinos.cl)"
echo "    Empresa > Usuarios y permisos"
echo "    Esperado: ve solo users de Frigoríficos · puede cambiar passwords"
echo
echo "  TEST 5 · Validación de la nueva password"
echo "    Probá pass de 5 chars → error '8+ caracteres'"
echo "    Probá 'abcdefgh' (sin números) → error 'letras y números'"
echo "    Probá pass distinta en repetir → error 'no coinciden'"
echo
echo "  Si todo OK · push:"
echo "     git add ."
echo "     git commit -m 'feat(empresa): admin set password de otros users (S6)'"
echo "     git push origin main"
echo
echo "  ⚠ NO te olvides de agregar SUPABASE_SERVICE_ROLE_KEY"
echo "    también en Vercel (Settings > Environment Variables)"
