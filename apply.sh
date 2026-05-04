#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  Maxtracker · S1-L1-fixes · apply.sh
#  Sprint 1 · Lote 1 · 3 fixes acotados:
#    F1 · Mapa · auto-fit reactivo + soft-follow del seleccionado
#    F2 · DayWithTimePicker · selector fecha multi-fila → 1 fila
#    F3 · Boletín · unificar Excel + PDF en ExportMenu
#
#  Idempotente · usa cmp -s antes de cp · seguro de re-ejecutar.
# ═══════════════════════════════════════════════════════════════

set -e

PAYLOAD="_payload"

if [ ! -d "$PAYLOAD" ]; then
  echo "❌ ERROR · no encuentro carpeta $PAYLOAD"
  echo "   Asegurate de haber hecho 'unzip -o S1-L1-fixes.zip -d maxtracker-functional'"
  echo "   y de estar parado en el root del repo (donde está package.json)"
  exit 1
fi

if [ ! -f "package.json" ]; then
  echo "❌ ERROR · no estoy en el root del repo (no veo package.json)"
  exit 1
fi

echo "═══════════════════════════════════════════════════"
echo "  S1-L1-fixes · aplicando 3 fixes"
echo "═══════════════════════════════════════════════════"

COUNT_NEW=0
COUNT_UPD=0
COUNT_SAME=0

apply_file() {
  local rel="$1"
  local src="$PAYLOAD/$rel"
  local dst="$rel"

  if [ ! -f "$src" ]; then
    echo "  ⚠️  payload missing: $rel"
    return
  fi

  if [ ! -f "$dst" ]; then
    mkdir -p "$(dirname "$dst")"
    cp "$src" "$dst"
    echo "  + $rel  (nuevo)"
    COUNT_NEW=$((COUNT_NEW + 1))
  elif cmp -s "$src" "$dst"; then
    COUNT_SAME=$((COUNT_SAME + 1))
  else
    cp "$src" "$dst"
    echo "  ~ $rel  (actualizado)"
    COUNT_UPD=$((COUNT_UPD + 1))
  fi
}

# F1 · Mapa
apply_file "src/components/maxtracker/FleetMap.tsx"

# F2 · Selector fecha
apply_file "src/components/maxtracker/time/DayWithTimePicker.module.css"

# F3 · Boletín ExportMenu
apply_file "src/components/maxtracker/ui/ExportMenu.tsx"
apply_file "src/components/maxtracker/boletin/BoletinHeader.tsx"
apply_file "src/components/maxtracker/boletin/BoletinHeader.module.css"

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Resumen"
echo "═══════════════════════════════════════════════════"
echo "  Nuevos:        $COUNT_NEW"
echo "  Actualizados:  $COUNT_UPD"
echo "  Sin cambios:   $COUNT_SAME"
echo ""

# Cleanup payload (idempotente · si volvés a aplicar el mismo zip
# se vuelve a extraer)
rm -rf "$PAYLOAD"

echo "✅ Lote aplicado"
echo ""
echo "Próximo paso · reiniciar dev server:"
echo "  rm -rf .next && npm run dev"
