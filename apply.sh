#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  apply.sh · Seed de viajes (3 meses · 4 cuentas · full data)
#  ─────────────────────────────────────────────────────────────
#
#  Genera ~10,800 viajes + ~80,000 eventos + ~600 alarmas +
#  ~325,000 positions + 120 LivePositions, distribuidos en 3
#  meses sobre los 120 vehículos creados por seed-flespi-test.
#
#  ⚠️ ATENCIÓN: borra y regenera todo el movimiento existente
#  (Trip/Event/Alarm/Position/LivePosition/AssetDriverDay/
#  AssetWeeklyStats). NO toca Account/Asset/Person/Device/Sim.
#
#  Pre-requisitos:
#   · S1 aplicado (no es estricto pero es lo más reciente)
#   · seed-flespi-test ya corrido (4 cuentas + 120 vehículos)
#   · DB en Supabase São Paulo (DATABASE_URL apunta ahí)
#
#  Tiempo estimado: 2-4 minutos (depende de latencia a Supabase)
# ═══════════════════════════════════════════════════════════════

set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
GREY='\033[0;90m'
NC='\033[0m'

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

if [ ! -f "package.json" ]; then
  echo "ERROR · No encuentro la raíz del proyecto Next.js."
  exit 1
fi

echo -e "${CYAN}═══ Lote · seed-viajes ═══${NC}"
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

apply_file "prisma/seed-viajes.ts"

echo
echo -e "${CYAN}─── Resumen ───${NC}"
echo "  Nuevos:        $created"
echo "  Actualizados:  $written"
echo "  Sin cambios:   $unchanged"
echo
echo -e "${GREEN}✓ Lote aplicado.${NC}"
echo
echo -e "${YELLOW}══ EJECUTAR SEED ══${NC}"
echo
echo "  npx tsx prisma/seed-viajes.ts"
echo
echo "  Tarda 2-4 minutos. Vas a ver progreso cada 20 vehículos"
echo "  y cada 5,000 filas insertadas."
echo
echo -e "${YELLOW}══ DESPUÉS DEL SEED ══${NC}"
echo
echo "  En tu app local (npm run dev) abrir las páginas que ahora"
echo "  van a tener data:"
echo
echo "  · /seguimiento/mapa            → 120 vehículos, ~40% en mov"
echo "  · /seguimiento/historial       → buscar viajes por fecha"
echo "  · /actividad/viajes            → listado completo"
echo "  · /actividad/scorecard         → ranking de conductores"
echo "  · /actividad/reportes          → distribuciones por hora/día"
echo "  · /seguridad/alarmas           → ~600 alarmas (40% open)"
echo "  · /seguridad/dashboard         → KPIs cargados"
echo "  · /direccion/vista-ejecutiva   → boletín con datos reales"
echo
echo "  Para deployar a Vercel: git push (ya viste cómo)"
echo "  La DB de prod es la misma · los datos ya están ahí"
echo "  (porque el seed corrió contra Supabase · no contra dev.db)"
