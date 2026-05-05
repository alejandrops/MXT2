#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  S4-L3d · Recibo PDF imprimible de infracción
#  ─────────────────────────────────────────────────────────────
#  Última pieza del bloque S4-L3 (Conducción · módulo completo).
#  Ruta nueva en el route group (print) de Next.js · layout sin
#  sidebar/topbar, CSS @page A4. El usuario hace Cmd+P y guarda
#  como PDF nativo del browser.
#
#  CAMBIOS:
#
#    1. Query nueva · getInfractionById (en infractions-list.ts)
#       Fetcher individual con multi-tenant scope. Trae el nombre
#       del operador que descartó (si aplica). Devuelve null si
#       la infracción no pertenece al account del usuario · el
#       page hace notFound() en ese caso.
#
#    2. Componente extraído · SpeedCurve
#       La curva velocidad/tiempo del side panel se sacó de
#       InfractionDetailPanel y se movió a su propio componente
#       para reusarla en el recibo. SVG inline puro, sin hooks
#       (sirve tanto en server como cliente). Helper
#       parseTrackToSpeedSamples() para convertir trackJson.
#
#    3. Componente nuevo · InfractionPrintMap
#       Mapa Leaflet específico para A4 · sin controles, sin
#       interacción, polilínea más gruesa. Cliente (Leaflet
#       requiere browser).
#
#    4. Pantalla nueva · /conduccion/infraccion/[id]
#       URL limpia (sin /print/) gracias al route group (print).
#       Layout · header MAXTRACKER + datos en 2 columnas + bloque
#       inicio/fin con direcciones + mapa con polilínea + curva
#       velocidad/tiempo + footer con operador y fecha.
#
#       Si la infracción está descartada · banner rojo arriba
#       con razón + quién + cuándo.
#
#    5. Side panel actualizado · InfractionDetailPanel
#       Botón "Abrir recibo imprimible" agregado entre los datos
#       y el mapa · target=_blank para abrir en nueva tab. La
#       curva interna se reemplaza por el componente extraído
#       (cero cambio funcional, refactor limpio).
#
#  LIMITACIÓN CONOCIDA:
#
#    Las tiles de Leaflet cargan async. Si el usuario hace Cmd+P
#    inmediatamente al abrir el recibo, puede que el mapa no se
#    haya pintado completo. Workaround para el usuario · esperar
#    1-2 segundos hasta ver el mapa antes de imprimir. Soluciones
#    server-side (capture, static map API) quedan post-MVP · es
#    una optimización, no un bloqueante.
#
#  Idempotente · usa cmp -s antes de cp.
# ═══════════════════════════════════════════════════════════════
set -e
PAYLOAD="_payload"
[ ! -d "$PAYLOAD" ] && echo "❌ no encuentro $PAYLOAD" && exit 1
[ ! -f "package.json" ] && echo "❌ no estoy en el root del repo" && exit 1
echo "═══ S4-L3d · Recibo PDF imprimible de infracción ═══"

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
echo "Validación:"
echo ""
echo "  npx tsc --noEmit"
echo ""
echo "Pruebas funcionales:"
echo ""
echo "  npm run dev"
echo ""
echo "  1. Ir a /conduccion/infracciones"
echo "  2. Click en cualquier infracción → side panel abre"
echo "  3. Click en 'Abrir recibo imprimible' → nueva tab con recibo A4"
echo "  4. Ver el mapa con polilínea + curva velocidad cargados"
echo "  5. Click en 'Imprimir / Guardar PDF' (botón azul flotante)"
echo "  6. Diálogo nativo de impresión · 'Guardar como PDF'"
echo ""
echo "URL del recibo · /conduccion/infraccion/<infraction-id>"
echo ""
echo "Esto cierra el bloque S4-L3 (Conducción · módulo completo):"
echo "  · S4-L3a · modelo + cálculo de infracciones"
echo "  · S4-L3b · score + dashboard"
echo "  · S4-L3c · listado + heatmap + descartar"
echo "  · S4-L3d · recibo PDF imprimible  ← este"
