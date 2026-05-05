#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  S4-L3d-redesign · Recibo de infracción · estilo editorial
#  ─────────────────────────────────────────────────────────────
#  Reemplaza los 2 archivos del recibo PDF (Receipt.module.css +
#  InfractionReceipt.tsx) con un lenguaje editorial corporativo.
#  Primer eslabón del sistema de boletines (Conducción · Dirección
#  · post-MVP).
#
#  CAMBIOS FUNDAMENTALES vs el receipt anterior:
#
#    1. Header editorial · "MAXTRACKER · CONDUCCIÓN" uppercase
#       con tracking amplio + folio mono. Quita el look
#       "comprobante" del legacy.
#
#    2. Título h1 + subtítulo · jerarquía de revista, no de
#       formulario.
#
#    3. LEAD NARRATIVO · NUEVO. Oración que cuenta la historia
#       ("Landen Armstrong superó en +31 km/h durante 6 minutos
#       17 segundos sobre Av. del Trabajador..."). Es el quiebre
#       del legacy · función buildLead() template-based, lista
#       para reemplazo por IA generativa cuando llegue.
#
#    4. Secciones numeradas 01·02·03 · prefigura el formato del
#       boletín. Cada bloque editorial es una sección numerada.
#
#    5. KPI strip de 4 celdas · Pico/Vmax/Exceso/Distancia con
#       color funcional solo donde "duele" (Pico, Exceso).
#
#    6. Detalles como tabla clave/valor · sin bordes verticales,
#       solo separadores sutiles.
#
#    7. Footer editorial · 3 líneas centradas con autoría +
#       solicitud + identificador único mono.
#
#  TOKENS DEL REPO RESPETADOS:
#    · Tipografía  · IBM Plex Sans (--f) + Plex Mono (--m)
#    · Color marca · #2563EB (--blu) sectionNum + #1E3A8A en kicker
#    · Severidad   · #E8352A (--red) y #C42820 (--red-dark)
#    · No serif    · respeta /actividad/imprimible existente
#
#  Idempotente · usa cmp -s antes de cp.
# ═══════════════════════════════════════════════════════════════
set -e
PAYLOAD="_payload"
[ ! -d "$PAYLOAD" ] && echo "❌ no encuentro $PAYLOAD" && exit 1
[ ! -f "package.json" ] && echo "❌ no estoy en el root del repo" && exit 1
echo "═══ S4-L3d-redesign · Recibo editorial ═══"

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
echo "✅ Lote aplicado"
echo ""
echo "Probá:"
echo "  npx tsc --noEmit"
echo "  npm run dev"
echo "  → /conduccion/infracciones · click cualquier infracción"
echo "  → 'Abrir recibo imprimible' → nueva tab"
