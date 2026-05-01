#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  apply.sh · Lote H2 · Supabase Auth (email + password)
#  ─────────────────────────────────────────────────────────────
#
#  Reemplaza la cookie demo con autenticación real de Supabase
#  para producción, manteniendo la cookie demo en dev local
#  controlado por la env var AUTH_MODE.
#
#  Archivos del lote:
#
#  Código (src/)
#   · src/lib/supabase/client.ts       · cliente browser
#   · src/lib/supabase/server.ts       · cliente Server Components/Actions
#   · src/lib/session.ts               · UPDATED · soporta dos modos
#   · src/middleware.ts                · refresh de sesión + protección
#   · src/app/login/page.tsx           · pantalla de login
#   · src/app/login/LoginForm.tsx      · client component del form
#   · src/app/login/page.module.css
#   · src/app/auth/callback/route.ts   · callback de Supabase
#   · src/app/auth/signout/route.ts    · POST endpoint de logout
#
#  Schema (prisma/)
#   · prisma/patches/patch-user-supabase-auth-id.sh · agrega
#     campo `supabaseAuthId` a User
#   · prisma/seed-prod-users.ts        · reset limpio · solo Alejandro
#
#  Documentación (docs/)
#   · docs/operations/configurar-supabase-auth.md
#
#  Pre-requisitos:
#   · H1 aplicado (Postgres en Supabase)
#   · Proyecto Supabase con Auth habilitado
#
#  IMPORTANTE: este lote NO ejecuta nada destructivo. Después
#  de aplicarlo, hay que:
#
#   1. Instalar deps · npm install @supabase/supabase-js @supabase/ssr
#   2. Aplicar el patch del schema
#      bash prisma/patches/patch-user-supabase-auth-id.sh
#   3. Crear migration
#      npx prisma migrate dev --name add_supabase_auth_id
#   4. (Opcional) Reset de users · npx tsx prisma/seed-prod-users.ts
#   5. Configurar Supabase Auth · ver doc operations
#   6. Editar .env con NEXT_PUBLIC_SUPABASE_URL, ANON_KEY, AUTH_MODE
# ═══════════════════════════════════════════════════════════════

set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
GREY='\033[0;90m'
NC='\033[0m'

LOTE_NAME="H2 · Supabase Auth"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

if [ ! -d "$SCRIPT_DIR/src" ]; then
  echo "ERROR · No encuentro 'src' en $SCRIPT_DIR/src"
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

echo -e "${CYAN}── Supabase clients ──${NC}"
apply_file "src/lib/supabase/client.ts"
apply_file "src/lib/supabase/server.ts"

echo
echo -e "${CYAN}── Session adapter ──${NC}"
apply_file "src/lib/session.ts"

echo
echo -e "${CYAN}── Middleware ──${NC}"
apply_file "src/middleware.ts"

echo
echo -e "${CYAN}── Páginas ──${NC}"
apply_file "src/app/login/page.tsx"
apply_file "src/app/login/LoginForm.tsx"
apply_file "src/app/login/page.module.css"
apply_file "src/app/auth/callback/route.ts"
apply_file "src/app/auth/signout/route.ts"

echo
echo -e "${CYAN}── Schema patch + seed ──${NC}"
apply_file "prisma/patches/patch-user-supabase-auth-id.sh" "exec"
apply_file "prisma/seed-prod-users.ts"

echo
echo -e "${CYAN}── Documentación ──${NC}"
apply_file "docs/operations/configurar-supabase-auth.md"

echo
echo -e "${CYAN}─── Resumen ───${NC}"
echo "  Nuevos:        $created"
echo "  Actualizados:  $written"
echo "  Sin cambios:   $unchanged"
echo

echo -e "${GREEN}✓ Lote $LOTE_NAME aplicado.${NC}"
echo
echo -e "${YELLOW}══ PASOS POST-APLICACIÓN ══${NC}"
echo
echo "1. Instalar dependencias de Supabase:"
echo
echo "     npm install @supabase/supabase-js @supabase/ssr"
echo
echo "2. Patch del schema · agrega supabaseAuthId al User:"
echo
echo "     bash prisma/patches/patch-user-supabase-auth-id.sh"
echo
echo "3. Crear migration:"
echo
echo "     npx prisma migrate dev --name add_supabase_auth_id"
echo
echo "4. (RECOMENDADO) Reset users · arrancar limpio:"
echo
echo "     npx tsx prisma/seed-prod-users.ts"
echo
echo "5. Seguir el doc paso a paso para configurar Supabase Auth:"
echo
echo "     cat docs/operations/configurar-supabase-auth.md"
echo
echo "   Resumen del doc:"
echo "    · Habilitar Email provider en Supabase Auth"
echo "    · Crear user en dashboard (Authentication → Users)"
echo "    · Copiar UUID de auth.users → UPDATE \"User\" SET \"supabaseAuthId\""
echo "    · Agregar a .env:"
echo "        NEXT_PUBLIC_SUPABASE_URL=..."
echo "        NEXT_PUBLIC_SUPABASE_ANON_KEY=..."
echo "        AUTH_MODE=\"supabase\""
echo
echo "6. Probar:"
echo "     rm -rf .next && npm run dev"
echo "     → /login → email + password → debería entrar al producto"
