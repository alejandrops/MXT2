#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  Maxtracker · S1-L2-ia-reorg · apply.sh
#  Sprint 1 · Lote 2 · Reorganización de IA
#
#  Cambios:
#    · Mover Scorecard de Actividad a Conducción
#    · Renombrar "Distribución por grupo" a "Comparativa entre objetos"
#    · Eliminar Vista Ejecutiva (queda redirect a /dashboard)
#    · Crear nueva pantalla /dashboard (scaffold)
#    · Sacar Torre de control del sidebar (URL queda accesible)
#    · Brand block del sidebar apunta a /dashboard
#    · Topbar agrega icono Home → /dashboard
#    · Habilitar módulo Conducción con Scorecard como única página
#    · Actualizar entries del CMDK
#
#  Idempotente · usa cmp -s antes de cp · seguro de re-ejecutar.
#  Soporta creates, updates y deletes.
# ═══════════════════════════════════════════════════════════════

set -e

PAYLOAD="_payload"
DELETE_LIST="$PAYLOAD/_delete.txt"

if [ ! -d "$PAYLOAD" ]; then
  echo "❌ ERROR · no encuentro carpeta $PAYLOAD"
  echo "   Asegurate de haber hecho 'unzip -o S1-L2-ia-reorg.zip -d maxtracker-functional'"
  echo "   y de estar parado en el root del repo (donde está package.json)"
  exit 1
fi

if [ ! -f "package.json" ]; then
  echo "❌ ERROR · no estoy en el root del repo (no veo package.json)"
  exit 1
fi

echo "═══════════════════════════════════════════════════"
echo "  S1-L2-ia-reorg · aplicando reorganización de IA"
echo "═══════════════════════════════════════════════════"

COUNT_NEW=0
COUNT_UPD=0
COUNT_SAME=0
COUNT_DEL=0
COUNT_DEL_SKIP=0

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

apply_delete() {
  local rel="$1"
  if [ -f "$rel" ]; then
    rm "$rel"
    echo "  - $rel  (eliminado)"
    COUNT_DEL=$((COUNT_DEL + 1))
  else
    COUNT_DEL_SKIP=$((COUNT_DEL_SKIP + 1))
  fi
}

# ── Apply files (creates + updates) ─────────────────────────
echo ""
echo "→ Procesando archivos a crear/actualizar..."

# Encuentra todos los archivos en _payload excepto _delete.txt
# y los aplica en su ruta relativa
find "$PAYLOAD" -type f ! -name "_delete.txt" | while read src; do
  rel="${src#$PAYLOAD/}"
  echo "$rel"
done | while read rel; do
  apply_file "$rel"
done

# Recalcular contadores · subshell del while pierde los counters.
# Reproducimos la cuenta acá para reportar bien.
COUNT_FILES_TOTAL=$(find "$PAYLOAD" -type f ! -name "_delete.txt" | wc -l)

# ── Apply deletes ────────────────────────────────────────────
echo ""
echo "→ Procesando archivos a eliminar..."

if [ -f "$DELETE_LIST" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    # Skip empty lines and comments
    [ -z "$line" ] && continue
    [[ "$line" =~ ^# ]] && continue
    apply_delete "$line"
  done < "$DELETE_LIST"
fi

# Cleanup · si después de borrar quedaron carpetas vacías, las dejamos
# (Next.js no se queja, y son seguras). El zip las recreará vacías
# en el próximo apply (porque las rutas de redirect viven ahí).

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Resumen"
echo "═══════════════════════════════════════════════════"
echo "  Archivos en payload:    $COUNT_FILES_TOTAL"
echo "  Eliminaciones aplicadas: $COUNT_DEL"
if [ "$COUNT_DEL_SKIP" -gt 0 ]; then
  echo "  Eliminaciones ya hechas: $COUNT_DEL_SKIP"
fi
echo ""
echo "  (corré 'git status' para ver el detalle exacto de cambios)"
echo ""

# Cleanup payload
rm -rf "$PAYLOAD"

echo "✅ Lote aplicado"
echo ""
echo "Próximo paso · reiniciar dev server:"
echo "  rm -rf .next && npm run dev"
