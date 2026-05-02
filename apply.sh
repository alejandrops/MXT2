#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  apply.sh · Lote L0 · Datos consistentes
#  ─────────────────────────────────────────────────────────────
#
#  Resuelve los bugs B2-B6 (datos contradictorios) instalando:
#
#  1) prisma/generate-weekly-stats.ts (NUEVO script)
#     Genera AssetWeeklyStats desde AssetDriverDay + Event + Trip.
#     Esta tabla está vacía porque el seed-viajes.ts la borra
#     pero no la regenera. Sin esto, la sección Reportes muestra
#     0 vehículos y Scorecard muestra 0 conductores.
#
#  2) src/lib/asset-status.ts (NUEVO helper)
#     Función deriveAssetState() · única fuente de verdad para
#     "moviendo / detenido / sin señal" en TODA la app. Reemplaza
#     el patrón anterior donde cada pantalla calculaba distinto.
#
#  3) prisma/refresh-live-positions.ts (NUEVO script)
#     Mueve los vehículos · simula tracker en vivo. Sincroniza
#     Asset.status con el estado derivado de LivePosition. Ejecutar
#     manualmente cuando quieras refrescar la demo.
#
#  Después de aplicar, ejecutar EN ORDEN:
#    1. npx tsx prisma/generate-weekly-stats.ts  · ~1 min
#    2. npx tsx prisma/refresh-live-positions.ts · ~30 seg
#
#  Pre-requisitos: Lotes S1-S6 aplicados.
#  No requiere migration · usa schema existente.
# ═══════════════════════════════════════════════════════════════

set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
GREY='\033[0;90m'
NC='\033[0m'

LOTE_NAME="L0 · Datos consistentes"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

if [ ! -d "$SCRIPT_DIR/src" ] && [ ! -d "$SCRIPT_DIR/prisma" ]; then
  echo "ERROR · No encuentro 'src' ni 'prisma' en $SCRIPT_DIR/"
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

echo -e "${CYAN}── Scripts prisma ──${NC}"
apply_file "prisma/generate-weekly-stats.ts"
apply_file "prisma/refresh-live-positions.ts"

echo
echo -e "${CYAN}── Lib · helper de estado ──${NC}"
apply_file "src/lib/asset-status.ts"

echo
echo -e "${CYAN}─── Resumen ───${NC}"
echo "  Nuevos:        $created"
echo "  Actualizados:  $written"
echo "  Sin cambios:   $unchanged"
echo

echo -e "${GREEN}✓ Lote $LOTE_NAME aplicado.${NC}"
echo
echo -e "${YELLOW}══ EJECUTAR AHORA (en orden) ══${NC}"
echo
echo -e "  ${CYAN}1) Generar AssetWeeklyStats${NC} (~1 min)"
echo "     npx tsx prisma/generate-weekly-stats.ts"
echo
echo -e "  ${CYAN}2) Refrescar LivePositions${NC} (~30 seg)"
echo "     npx tsx prisma/refresh-live-positions.ts"
echo
echo -e "${YELLOW}══ VERIFICACIÓN ══${NC}"
echo
echo "  Después de los 2 scripts, ejecutá este check:"
echo
cat << 'CHECK'
  npx tsx -e "
  const { PrismaClient } = require('@prisma/client');
  const db = new PrismaClient();
  Promise.all([
    db.assetWeeklyStats.count(),
    db.asset.groupBy({ by: ['status'], _count: true }),
  ]).then(([wsCount, statusGroups]) => {
    console.log('AssetWeeklyStats:', wsCount, '(esperado: ~2000)');
    console.log('Asset status:');
    statusGroups.forEach(g => console.log('  ', g.status + ':', g._count));
    db.\$disconnect();
  });
  "
CHECK
echo
echo "  Esperado:"
echo "    AssetWeeklyStats: ~1500-3000 (no 0)"
echo "    Asset status: distribución entre MOVING/IDLE/STOPPED"
echo
echo -e "${YELLOW}══ TESTING EN UI ══${NC}"
echo
echo "  TEST 1 · Reportes ya muestra vehículos"
echo "    /actividad/reportes"
echo "    Antes: 0 vehículos"
echo "    Después: 120 vehículos"
echo
echo "  TEST 2 · Scorecard ya muestra conductores"
echo "    /actividad/scorecard"
echo "    Antes: 0 conductores"
echo "    Después: lista con scores"
echo
echo "  TEST 3 · Mapa muestra vehículos en movimiento"
echo "    /seguimiento/mapa"
echo "    Esperado: vehículos con velocidad real"
echo "    KPI strip: 'X en mov.', 'Y detenidos', etc. con números > 0"
echo
echo "  TEST 4 · Catálogos consistente con Mapa"
echo "    /catalogos/vehiculos"
echo "    Antes: todos 'Sin señal' (OFFLINE)"
echo "    Después: distribución MOVING / IDLE / STOPPED igual que Mapa"
echo
echo "  Si todo OK · push:"
echo "     git add ."
echo "     git commit -m 'fix(data): weekly stats + live status sync (L0)'"
echo "     git push origin main"
echo
echo -e "${YELLOW}══ NOTA SOBRE PRODUCCIÓN ══${NC}"
echo
echo "  ⚠ Estos scripts conectan a la DB del .env (Supabase São Paulo"
echo "    en tu caso). Lo que ejecutás localmente afecta producción."
echo "    Los 2 scripts son IDEMPOTENTES y SEGUROS · podés correrlos"
echo "    todas las veces que quieras."
