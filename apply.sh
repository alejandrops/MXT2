#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  S5-E3 · Boletín de empresa · Sistema Editorial COMPLETO
#  ─────────────────────────────────────────────────────────────
#  Quinto y último nivel del Sistema Editorial Maxtracker:
#    1. Recibo de infracción individual           ✅ (S4-L3d)
#    2. Recibo de viaje individual                ✅ (S5-T4)
#    3. Boletín de conductor (mensual + anual)    ✅ (S5-E1)
#    4. Boletín de grupo                          ✅ (S5-E2)
#    5. Boletín de empresa                        ✅ (este lote)
#
#  ─────────────────────────────────────────────────────────────
#  ESTRUCTURA DEL BOLETÍN EJECUTIVO
#  ─────────────────────────────────────────────────────────────
#
#  01 · Calificación corporativa
#       Score promedio empresa · ponderado por km de los grupos
#       KPIs · Distancia · Viajes · Conductores · Vehículos activos
#
#  02 · Infracciones agregadas
#       Distribución por severidad
#       Indicador "infracciones por 100 km" · útil para
#       comparativa multi-empresa
#
#  03 · Top 3 infracciones más graves del período
#       Tabla con conductor + grupo + vehículo + pico/vmax/exceso
#
#  04 · Ranking de grupos
#       Top 5 mejores · Bottom 5 peores
#       Ranking por SCORE · no por volumen
#
#  05 · Panorama · scatter (km vs score) por grupo
#       Tamaño del punto = conductores activos del grupo
#       (hint visual de tamaño operativo)
#
#  06 · Evolución temporal
#       Mensual · sparklines + chart
#       Anual · chart 12 meses con líneas guía
#
#  ─────────────────────────────────────────────────────────────
#  PUNTO DE ENTRADA
#  ─────────────────────────────────────────────────────────────
#
#  /conduccion/scorecard
#  En el header del módulo aparecen 2 botones:
#    · Boletín mensual  → /conduccion/boletin/empresa/{YYYY-MM}
#    · Boletín anual    → /conduccion/boletin/empresa/{YYYY}
#
#  El boletín respeta multi-tenant:
#    · CA / OP   · su propia cuenta
#    · MA / SA   · pasar ?account=X · default = scope
#
#  ─────────────────────────────────────────────────────────────
#  ARCHIVOS
#  ─────────────────────────────────────────────────────────────
#
#  Backend
#    src/lib/queries/account-boletin-data.ts
#    src/lib/conduccion/boletin-account-text.ts
#
#  Print UI
#    src/app/(print)/conduccion/boletin/empresa/[period]/
#      page.tsx              server · multi-tenant scope
#      AccountBoletin.tsx    client · port mockup v2 · scatter SVG
#      Boletin.module.css    A4 · base + ranking + scatter
#
#  Punto de entrada (mod)
#    src/app/(product)/conduccion/scorecard/ScorecardClient.tsx
#    src/app/(product)/conduccion/scorecard/ScorecardClient.module.css
#
#  ─────────────────────────────────────────────────────────────
#  CIERRA EL SISTEMA EDITORIAL · 5 niveles consistentes
#  ─────────────────────────────────────────────────────────────
#
#  Cada nivel hereda el mismo lenguaje visual:
#    · Score 42px integrado al flujo de KPIs
#    · Severidad por símbolo (○ ◐ ●) + peso tipográfico
#    · Sparklines Unicode inline para evolución
#    · Líneas guía horizontales (no bandas pintadas)
#    · Markers ○ verde / ● amarilla o roja
#    · Funciona idéntico en B&N
#    · A4 limpio · Cmd+P → PDF nativo
#
#  ─────────────────────────────────────────────────────────────
#  EN ESTE LOTE NO INCLUYE
#  ─────────────────────────────────────────────────────────────
#
#  ❌ Pre-generación con snapshot · cae a on-demand
#  ❌ Cron · sub-lote post-validación
#  ❌ Schema AccountBoletinSnapshot · sub-lote post-validación
#
#  Nota · ya existe BoletinSnapshot del S1 que es de cuenta y se
#  usa en /direccion/boletin/[period]. Ese boletín es operativo.
#  El boletín que agrega este lote es ejecutivo (con ranking de
#  grupos · scatter · etc.) y vive en /conduccion/boletin/empresa.
#  Coexisten · son productos distintos para audiencias distintas.
#
#  ─────────────────────────────────────────────────────────────
#  AUDITORÍAS
#  ─────────────────────────────────────────────────────────────
#
#  ✓ Ningún .module.css con :root real
#  ✓ Ningún server→client prop es función
#  ✓ npx tsc --noEmit · 0 errores
#  ✓ Multi-tenant scope respetado
#  ✓ Tufte + B&N first · todos los símbolos refuerzan, no son
#    señal única
#
#  Idempotente · cmp -s antes de cp.
# ═══════════════════════════════════════════════════════════════
set -e
PAYLOAD="_payload"
[ ! -d "$PAYLOAD" ] && echo "❌ no encuentro $PAYLOAD" && exit 1
[ ! -f "package.json" ] && echo "❌ no estoy en el root del repo" && exit 1
echo "═══ S5-E3 · Boletín de empresa · Sistema Editorial COMPLETO ═══"

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
echo "✅ Lote aplicado · Sistema Editorial Maxtracker COMPLETO"
echo ""
echo "  npx tsc --noEmit"
echo "  npm run dev"
echo ""
echo "Probá:"
echo ""
echo "  · /conduccion/scorecard"
echo "    En el header aparecen los nuevos botones:"
echo "      · Boletín mensual  → /conduccion/boletin/empresa/{YYYY-MM}"
echo "      · Boletín anual    → /conduccion/boletin/empresa/{YYYY}"
echo "    Junto al menú de export existente."
echo ""
echo "  · El boletín ejecutivo muestra:"
echo "      - Score corporativo 42px ponderado por km"
echo "      - KPIs · distancia · viajes · conductores · vehículos"
echo "      - Top 3 infracciones más graves"
echo "      - Ranking top 5 + bottom 5 GRUPOS"
echo "      - Scatter de grupos (km vs score) · tamaño = conductores"
echo "      - Evolución temporal (semanas o meses)"
echo ""
echo "  · Cmd+P → guardar como PDF (A4 limpio)"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo " Sistema Editorial Maxtracker · 5 niveles consistentes"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo " 1. Recibo de infracción       /infracciones/recibo/{id}"
echo " 2. Recibo de viaje            /actividad/viaje/{id}"
echo " 3. Boletín de conductor       /conduccion/boletin/conductor/{id}/{period}"
echo " 4. Boletín de grupo           /conduccion/boletin/grupo/{id}/{period}"
echo " 5. Boletín de empresa         /conduccion/boletin/empresa/{period}"
echo ""
echo " Todos · Tufte + B&N first · Cmd+P → PDF · pre-generables"
echo " con snapshot (S5-E1 ya migrado · resto on-demand por ahora)."
echo ""
