#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  apply.sh · Lote S1 · /configuracion completo (sidebar + 9 tabs)
#  ─────────────────────────────────────────────────────────────
#
#  Reestructura /configuracion con sidebar contextual estilo
#  Notion/Linear · 2 grupos:
#
#  MI CUENTA (todos los users)
#   · Mi perfil           ← reaprovechado de A1
#   · Notificaciones      ← reaprovechado de A2
#   · Preferencias        ← reaprovechado de A1
#   · Seguridad           ← reaprovechado de A2
#
#  EMPRESA (solo CLIENT_ADMIN+)
#   · Datos de la cuenta  ← NUEVO
#   · Umbrales y alarmas  ← NUEVO (tabla AccountSettings)
#   · Integraciones       ← NUEVO (placeholder cards)
#   · Plan y facturación  ← NUEVO (read-only · muestra tier)
#   · Usuarios y permisos ← NUEVO (CRUD completo)
#
#  Schema:
#   · Tabla AccountSettings (1:1 con Account) · umbrales tipados
#     + integraciones JSON + plan overrides JSON
#
#  Sidebar:
#   · Botón "Configuración" pasa de DISABLED a Link funcional
#
#  Pre-requisitos:
#   · H1 + H2 aplicados (Postgres + Auth)
#   · DB seedeada
#
#  Workflow post-apply:
#
#   1. bash prisma/patches/patch-account-settings.sh
#   2. npx prisma migrate dev --name add_account_settings
#   3. npx tsx prisma/backfill-account-settings.ts
#   4. rm -rf .next && npm run dev
#   5. Como SA · /configuracion debería tener todos los tabs
#   6. Cambiar a CA (admin@frigorificos-andinos.cl o similar) ·
#      verás tu propio account en el grupo Empresa
#   7. Cambiar a OP (operador1@...) · solo ves grupo Mi cuenta
# ═══════════════════════════════════════════════════════════════

set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
GREY='\033[0;90m'
NC='\033[0m'

LOTE_NAME="S1 · /configuracion completo"
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

echo -e "${CYAN}── Schema patch + migration ──${NC}"
apply_file "prisma/patches/patch-account-settings.sh" "exec"
apply_file "prisma/backfill-account-settings.ts"

echo
echo -e "${CYAN}── Páginas de configuración ──${NC}"
apply_file "src/app/(product)/configuracion/page.tsx"
apply_file "src/app/(product)/configuracion/ConfiguracionShell.tsx"
apply_file "src/app/(product)/configuracion/ConfiguracionPage.module.css"

echo
echo -e "${CYAN}── Tabs personales (Mi cuenta) ──${NC}"
apply_file "src/app/(product)/configuracion/MiPerfilTab.tsx"
apply_file "src/app/(product)/configuracion/MiPerfilTab.module.css"
apply_file "src/app/(product)/configuracion/NotificacionesTab.tsx"
apply_file "src/app/(product)/configuracion/NotificacionesTab.module.css"
apply_file "src/app/(product)/configuracion/PreferenciasTab.tsx"
apply_file "src/app/(product)/configuracion/PreferenciasTab.module.css"
apply_file "src/app/(product)/configuracion/SeguridadTab.tsx"
apply_file "src/app/(product)/configuracion/SeguridadTab.module.css"
apply_file "src/app/(product)/configuracion/actions.ts"

echo
echo -e "${CYAN}── Tabs empresa (NUEVOS) ──${NC}"
apply_file "src/app/(product)/configuracion/empresa/EmpresaDatosTab.tsx"
apply_file "src/app/(product)/configuracion/empresa/EmpresaUmbralesTab.tsx"
apply_file "src/app/(product)/configuracion/empresa/EmpresaIntegracionesTab.tsx"
apply_file "src/app/(product)/configuracion/empresa/EmpresaIntegracionesTab.module.css"
apply_file "src/app/(product)/configuracion/empresa/EmpresaPlanTab.tsx"
apply_file "src/app/(product)/configuracion/empresa/EmpresaPlanTab.module.css"
apply_file "src/app/(product)/configuracion/empresa/EmpresaUsuariosTab.tsx"
apply_file "src/app/(product)/configuracion/empresa/EmpresaUsuariosTab.module.css"
apply_file "src/app/(product)/configuracion/actions-empresa.ts"

echo
echo -e "${CYAN}── Sidebar (habilitar Configuración) ──${NC}"
apply_file "src/components/shell/Sidebar.tsx"
apply_file "src/components/shell/Sidebar.module.css"

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
echo -e "${YELLOW}══ PASOS POST-APLICACIÓN ══${NC}"
echo
echo "1. Patch del schema (agrega tabla AccountSettings):"
echo "     bash prisma/patches/patch-account-settings.sh"
echo
echo "2. Migration en Supabase:"
echo "     npx prisma migrate dev --name add_account_settings"
echo
echo "3. Backfill · crear settings con defaults LATAM para los"
echo "   accounts existentes:"
echo "     npx tsx prisma/backfill-account-settings.ts"
echo
echo "4. Iniciar dev server:"
echo "     npm run dev"
echo
echo -e "${YELLOW}══ TESTING ══${NC}"
echo
echo "  Como SA (alejandro):"
echo "    /configuracion → debería redirect a ?section=perfil"
echo "    Sidebar muestra · Mi cuenta (4) + Empresa (5)"
echo "    Como SA NO tenés account, los tabs de empresa van a fallar"
echo "    (no es bug del código · es que SA no tiene una cuenta propia)"
echo
echo "  Como CA (admin@frigorificos-andinos.cl):"
echo "    /configuracion → ves tu propia cuenta en grupo Empresa"
echo "    Probá editar Datos · cambiar industria · Guardar"
echo "    Probá editar Umbrales · cambiar velocidad urbana · Guardar"
echo "    Probá Usuarios · crear uno nuevo, suspender, eliminar"
echo
echo "  Como OP (operador1@...):"
echo "    /configuracion → solo ves grupo 'Mi cuenta' (4 tabs)"
echo "    Si tipeás manualmente ?section=empresa-usuarios → redirect"
echo
echo "  Sidebar:"
echo "    El botón 'Configuración' al pie ahora es clickeable"
echo "    (antes estaba en gris/disabled)"
echo
echo "  Una vez aprobado, commit + push para deployar a Vercel:"
echo "     git add ."
echo "     git commit -m 'feat(config): full settings page with sidebar (S1)'"
echo "     git push origin main"
