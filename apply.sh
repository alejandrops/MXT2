#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# apply.sh · Fix · PersonEditDrawer · variable shadowing global document
# ─────────────────────────────────────────────────────────────
# Bug del lote A4 · declaré una variable de estado llamada
# `document` que tapaba el global `document` del navegador. Por
# eso fallaba `document.addEventListener` en useEffect del drawer.
#
# Fix · renombrar variable local de `document` a `documentNumber`.
# El field del schema sigue siendo `document` (en Person.document)
# · solo cambia el nombre interno de la variable React.
#
# Archivos:
#   · src/app/(product)/catalogos/conductores/PersonEditDrawer.tsx (mod)
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

apply_file "src/app/(product)/catalogos/conductores/PersonEditDrawer.tsx"

if [ -d ".next" ]; then
  rm -rf .next
  echo "🧹 Borrado .next"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Fix aplicado · PersonEditDrawer · doc shadow"
echo ""
echo "Próximo paso: npm run dev"
echo ""
echo "Validar:"
echo "  · /catalogos/conductores → click '+ Nuevo conductor'"
echo "  · Drawer abre sin error 'addEventListener is not a function'"
echo "  · El campo Documento sigue funcionando normal"
echo "  · ESC cierra el drawer"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
