#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  Maxtracker · S1-L9-posthog-events · apply.sh
#  Sprint 1 · Lote 9 · Eventos custom + session replay opt-in
#
#  Cambios:
#    · EventMap expandido · 18 eventos tipados (antes 13):
#      + book_tab_changed (cambio de tab del Libro)
#      + boletin_viewed (viewer de boletín · snapshot vs onDemand)
#      + feedback_opened / submitted / dismissed (widget L8)
#      + session_recording_paused / resumed (control opt-out)
#    · Session replay opt-in · activado vía env var
#      NEXT_PUBLIC_ENABLE_SESSION_REPLAY=1
#    · Banner SessionRecordingNotice bottom-left · siempre visible
#      mientras se graba · permite pausar (persistido localStorage)
#    · FeedbackWidget instrumentado · open + submit + dismiss
#      eventos para medir conversion del widget
#    · README de funnels en src/lib/analytics/README.md ·
#      catálogo completo + 4 funnels recomendados + privacy guide
#
#  Idempotente · usa cmp -s antes de cp.
# ═══════════════════════════════════════════════════════════════

set -e
PAYLOAD="_payload"

if [ ! -d "$PAYLOAD" ]; then echo "❌ no encuentro $PAYLOAD"; exit 1; fi
if [ ! -f "package.json" ]; then echo "❌ no estoy en el root del repo"; exit 1; fi

echo "═══════════════════════════════════════════════════"
echo "  S1-L9-posthog-events · custom events + session replay"
echo "═══════════════════════════════════════════════════"

COUNT_NEW=0
COUNT_UPD=0
COUNT_SAME=0

apply_file() {
  local rel="$1"
  local src="$PAYLOAD/$rel"
  local dst="$rel"
  if [ ! -f "$src" ]; then echo "  ⚠️ payload missing: $rel"; return; fi
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

apply_file "src/lib/analytics/posthog.ts"
apply_file "src/lib/analytics/README.md"
apply_file "src/components/analytics/PostHogProvider.tsx"
apply_file "src/components/analytics/SessionRecordingNotice.tsx"
apply_file "src/components/analytics/SessionRecordingNotice.module.css"
apply_file "src/components/maxtracker/feedback/FeedbackWidget.tsx"
apply_file "src/app/(product)/layout.tsx"

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Resumen"
echo "═══════════════════════════════════════════════════"
echo "  Nuevos:        $COUNT_NEW"
echo "  Actualizados:  $COUNT_UPD"
echo "  Sin cambios:   $COUNT_SAME"
echo ""

rm -rf "$PAYLOAD"

echo "✅ Lote aplicado"
echo ""
echo "═══════════════════════════════════════════════════"
echo "  Setup opcional para activar session replay"
echo "═══════════════════════════════════════════════════"
echo ""
echo "Para builds de tester (queremos ver session replays):"
echo "  Vercel → Settings → Environment Variables"
echo "  NEXT_PUBLIC_ENABLE_SESSION_REPLAY=1"
echo ""
echo "Para producción/clientes finales: dejar la var desactivada o"
echo "pedir opt-in explícito (próximo lote · checkbox /configuracion)"
echo ""
echo "Próximo paso · reiniciar dev server:"
echo "  rm -rf .next && npm run dev"
