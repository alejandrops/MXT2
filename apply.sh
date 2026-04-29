#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# apply.sh · Lote boletin-bloque-H-anomalias
# ─────────────────────────────────────────────────────────────
# Implementa el Bloque H del Boletín · Anomalías Estadísticas.
#
# Identifica vehículos cuya métrica del período cae fuera de la
# banda [μ ± 2σ] de la flota. Por cada anomalía reporta:
# vehículo, métrica, valor, banda esperada, desvío en σ.
#
# Métricas evaluadas:
#   · Distancia (km)
#   · Viajes (count)
#   · Tiempo en marcha (h)
#   · Eventos / 100km   ← alto = peor (color rojo en arriba)
#
# Filtros · solo vehículos con >50km para evitar ratios infinitos.
# Necesita >=5 vehículos en el período para análisis estadístico.
#
# Archivos:
#   · src/app/(product)/direccion/boletin/[period]/page.tsx
#       - Agrega activeMin y tripCount a VehicleRow
#       - Importa BlockH y reemplaza placeholder por componente
#   · src/components/maxtracker/boletin/BlockH_AnomaliasEstadisticas.tsx (NUEVO)
#       - Cálculo y renderizado del bloque
#   · src/components/maxtracker/boletin/Block.module.css
#       - Agrega clases para tabla densa de anomalías
#
# Idempotente.
# ═══════════════════════════════════════════════════════════════

set -uo pipefail

if [ ! -f "package.json" ] || [ ! -d "src/app" ]; then
  echo "❌ Error · ejecutá apply.sh desde la raíz del repo Maxtracker"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

apply_file() {
  local rel="$1"
  local src="$SCRIPT_DIR/$rel"
  local dst="$rel"

  if [ ! -f "$src" ]; then
    echo "⚠️  Skip · archivo fuente no existe en lote · $rel"
    return
  fi

  if [ -f "$dst" ] && cmp -s "$src" "$dst"; then
    echo "✓ Ya aplicado · $rel"
    return
  fi

  if [ -f "$dst" ]; then
    cp "$dst" "$dst.bak.$(date +%s)"
    echo "💾 Backup · $dst.bak.<ts>"
  fi

  mkdir -p "$(dirname "$dst")"
  cp "$src" "$dst"
  echo "✅ Aplicado · $rel"
}

apply_file "src/app/(product)/direccion/boletin/[period]/page.tsx"
apply_file "src/components/maxtracker/boletin/BlockH_AnomaliasEstadisticas.tsx"
apply_file "src/components/maxtracker/boletin/Block.module.css"

if [ -d ".next" ]; then
  rm -rf .next
  echo "🧹 Borrado .next (re-compilación limpia al próximo dev)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Lote aplicado · boletin-bloque-H-anomalias"
echo ""
echo "Validar:"
echo "  · Abrí /direccion/boletin/<periodo>"
echo "  · Bajá hasta el Bloque H (después del G · Conducción)"
echo "  · Debería mostrar 1+ anomalías (Camión AH460 con distancia"
echo "    extrema es candidato seguro al outlier)"
echo "  · Click en el nombre del vehículo · va al Libro del Objeto"
echo "  · El Bloque I (Sostenibilidad) sigue como placeholder"
echo "  · El Bloque J (Highlights) sigue como placeholder · próx lote"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
