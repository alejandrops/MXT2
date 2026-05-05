#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  S5-T3-fix1 · Archivo faltante de S4-L3d
#  ─────────────────────────────────────────────────────────────
#  Error reportado:
#    TS2307: Cannot find module '@/lib/conduccion/receipt-text'
#    en src/app/(print)/conduccion/infraccion/[id]/InfractionReceipt.tsx
#
#  Causa: el archivo se creó en S4-L3d (recibo editorial de
#  infracciones) pero parece haber quedado fuera del lote
#  recibido. Es un archivo de helpers de texto para el recibo
#  PDF.
#
#  Este fix solo agrega 1 archivo:
#    src/lib/conduccion/receipt-text.ts (103 líneas)
#
#  No tiene relación con S5-T3 · ese lote ya está OK.
# ═══════════════════════════════════════════════════════════════
set -e
PAYLOAD="_payload"
[ ! -d "$PAYLOAD" ] && echo "❌ no encuentro $PAYLOAD" && exit 1
[ ! -f "package.json" ] && echo "❌ no estoy en el root del repo" && exit 1
echo "═══ S5-T3-fix1 · receipt-text.ts faltante ═══"

C_NEW=0; C_UPD=0; C_SAME=0
apply_file() {
  local rel="$1"; local src="$PAYLOAD/$rel"; local dst="$rel"
  [ ! -f "$src" ] && return
  if [ ! -f "$dst" ]; then
    mkdir -p "$(dirname "$dst")"; cp "$src" "$dst"
    echo "  + $rel  (nuevo)"; C_NEW=$((C_NEW+1))
  elif cmp -s "$src" "$dst"; then C_SAME=$((C_SAME+1))
  else cp "$src" "$dst"; echo "  ~ $rel  (actualizado)"; C_UPD=$((C_UPD+1)); fi
}

while IFS= read -r src; do
  rel="${src#$PAYLOAD/}"
  apply_file "$rel"
done < <(find "$PAYLOAD" -type f)

echo ""
echo "  Nuevos: $C_NEW · Actualizados: $C_UPD · Sin cambios: $C_SAME"
rm -rf "$PAYLOAD"

echo ""
echo "✅ Fix aplicado"
echo ""
echo "  npx tsc --noEmit"
echo ""
echo "Debería compilar a 0 errores."
