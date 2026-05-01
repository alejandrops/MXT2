#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  apply.sh · Lote H3 · Deploy a Vercel
#  ─────────────────────────────────────────────────────────────
#
#  Prepara el repo para deploy a Vercel:
#
#  · vercel.json · config con region São Paulo + maxDuration en
#    los endpoints de ingestion (default 10s no alcanza para
#    batches grandes)
#  · package.json · agrega script `vercel-build` que corre
#    `prisma migrate deploy` antes del build (Vercel usa este
#    script automáticamente cuando vercel.json apunta a él)
#  · docs/operations/deploy-vercel.md · paso a paso del deploy,
#    env vars, smoke tests, rollback
#
#  Pre-requisitos:
#   · H1 + H2 aplicados y funcionando local
#   · Cuenta Vercel logueada con GitHub
#   · Repo Maxtracker en GitHub privado con permisos otorgados
#     a Vercel
#
#  IMPORTANTE: este lote NO ejecuta el deploy. Solo prepara
#  archivos. El deploy se hace desde el dashboard de Vercel
#  siguiendo `docs/operations/deploy-vercel.md`.
# ═══════════════════════════════════════════════════════════════

set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
GREY='\033[0;90m'
NC='\033[0m'

LOTE_NAME="H3 · Deploy a Vercel"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

if [ ! -d "$SCRIPT_DIR/scripts" ]; then
  echo "ERROR · No encuentro 'scripts' en $SCRIPT_DIR/"
  exit 1
fi

if [ ! -f "package.json" ]; then
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

echo -e "${CYAN}── Configuración Vercel ──${NC}"
apply_file "vercel.json"

echo
echo -e "${CYAN}── Helper script ──${NC}"
apply_file "scripts/patch-package-json-vercel.sh" "exec"

echo
echo -e "${CYAN}── Documentación ──${NC}"
apply_file "docs/operations/deploy-vercel.md"

echo
echo -e "${CYAN}─── Resumen archivos ───${NC}"
echo "  Nuevos:        $created"
echo "  Actualizados:  $written"
echo "  Sin cambios:   $unchanged"
echo

echo -e "${GREEN}✓ Lote $LOTE_NAME aplicado.${NC}"
echo
echo -e "${YELLOW}══ PASOS POST-APLICACIÓN ══${NC}"
echo
echo "1. Patch del package.json (agrega vercel-build script):"
echo
echo "     bash scripts/patch-package-json-vercel.sh"
echo
echo "2. Verificar que .env esté gitignored:"
echo
echo "     grep -E '^\\.env\$' .gitignore || echo '.env' >> .gitignore"
echo
echo "3. Commit y push:"
echo
echo "     git add vercel.json package.json .gitignore"
echo "     git commit -m 'chore(deploy): vercel config + vercel-build script (H3)'"
echo "     git push origin main"
echo
echo "4. Seguir el doc paso a paso para conectar Vercel:"
echo
echo "     cat docs/operations/deploy-vercel.md"
echo
echo "   Resumen del doc:"
echo "    · Importar repo en Vercel (vercel.com/new)"
echo "    · Configurar 6 env vars · DATABASE_URL, DIRECT_URL,"
echo "      NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,"
echo "      AUTH_MODE=supabase, FLESPI_INGEST_TOKEN"
echo "    · Click Deploy → esperar 3-7 min"
echo "    · Actualizar Site URL en Supabase Auth a la URL de Vercel"
echo "    · Smoke tests · login + curl al endpoint público"
