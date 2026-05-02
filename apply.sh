#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  apply.sh · Lote L2B-2 · Dashboard Seguridad → fleet-metrics
#  ─────────────────────────────────────────────────────────────
#
#  Cierra cross-tenant leak en Dashboard Seguridad. Pre-L2B-2
#  todas las queries de safety.ts contaban cross-tenant · CA / OP
#  veían alarmas, eventos y conductores de TODOS los clientes.
#
#  Cambios:
#
#  1) src/lib/queries/safety.ts
#     · Las 4 queries (getSafetyKpis, getOpenAlarms, getWorstDrivers,
#       getTopAssetsByEvents) ahora aceptan `scope?: FleetScope`
#       con default `{ accountId: null }` (backward compat con
#       /debug y otros callers que aún no pasan scope).
#     · `getSafetyKpis` delega su count de alarmas a
#       `getFleetOpenAlarmsCount` · single source of truth.
#
#  2) src/app/(product)/seguridad/dashboard/page.tsx
#     · Resuelve scope vía `resolveAccountScope(session, "seguridad")`.
#     · Pasa scope a las 4 queries en el Promise.all.
#
#  Bug que resuelve:
#  · Cross-tenant leak crítico · CA / OP veían ahora datos de otros
#    clientes en su dashboard. Con L2B-2, cada user ve solo lo de su
#    account (scope OWN_ACCOUNT) o todo (SA / MA).
#
#  Pre-requisitos · L0 + L1 + L1.5* + L2A + L2B-1 aplicados.
# ═══════════════════════════════════════════════════════════════

set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
GREY='\033[0;90m'
NC='\033[0m'

LOTE_NAME="L2B-2 · Dashboard Seguridad → fleet-metrics"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

if [ ! -d "src" ] || [ ! -f "package.json" ]; then
  echo "ERROR · No encuentro la raíz del proyecto Next.js."
  exit 1
fi

if [ ! -f "src/lib/queries/fleet-metrics.ts" ]; then
  echo "ERROR · No encuentro fleet-metrics.ts · aplicá L2A primero."
  exit 1
fi

echo -e "${CYAN}═══ Lote $LOTE_NAME ═══${NC}"
echo

written=0; unchanged=0; created=0

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

echo -e "${CYAN}── Module · safety queries con scope ──${NC}"
apply_file "src/lib/queries/safety.ts"

echo
echo -e "${CYAN}── Consumer · dashboard page ──${NC}"
apply_file "src/app/(product)/seguridad/dashboard/page.tsx"

echo
echo -e "${CYAN}─── Resumen ───${NC}"
echo "  Nuevos:        $created"
echo "  Actualizados:  $written"
echo "  Sin cambios:   $unchanged"
echo

if [ -d ".next" ]; then rm -rf .next; fi

echo -e "${GREEN}✓ Lote $LOTE_NAME aplicado.${NC}"
echo
echo -e "${YELLOW}══ TESTING ══${NC}"
echo
echo "  TEST 1 · typecheck pasa limpio"
echo "    npx tsc --noEmit; echo exit=\$?"
echo "    Esperado · exit=0"
echo
echo "  TEST 2 · Dashboard render OK"
echo "    Navegar a /seguridad/dashboard como SA / MA"
echo "    KPIs muestran totales cross-tenant (mismos números que antes)"
echo
echo "  TEST 3 · Multi-tenant scope funciona (CRÍTICO · cross-tenant leak)"
echo "    Cambiar identidad a un user CA en el switcher"
echo "    Navegar a /seguridad/dashboard"
echo "    Esperado · KPIs MENORES que como SA · solo cuenta del account del user"
echo "    Antes (bug) · CA veía mismos números que SA (cross-tenant leak)"
echo
echo "  TEST 4 · Alarmas + drivers + assets también scope-aware"
echo "    Como CA · las 'Alarmas abiertas', 'Top conductores' y 'Top assets'"
echo "    deben ser SOLO del scope, no cross-cliente"
echo
echo "  TEST 5 · /debug sigue funcionando cross-tenant"
echo "    Navegar a /debug · getSafetyKpis() sin args debe devolver totales"
echo "    cross-tenant (default DEFAULT_SCOPE = { accountId: null })"
echo
echo "  TEST 6 · Build de Next.js"
echo "    npm run build"
echo
echo "  Si todo OK · push:"
echo "     git add ."
echo "     git commit -m 'fix(seguridad): L2B-2 · close cross-tenant leak en Dashboard'"
echo "     git push origin main"
echo
echo -e "${YELLOW}══ PRÓXIMO LOTE · L2B-3 ══${NC}"
echo "  Boletín · queries inline → getFleetSummary con scope"
echo "  Cierra el OTRO cross-tenant leak (más crítico · vista directiva)"
