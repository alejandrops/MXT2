#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  S3-L5 · centro de notificaciones · Bell del Topbar funcional
#
#  Cambios:
#    + src/lib/queries/user-notifications.ts
#      getUserNotifications agrega: alarmas críticas + boletines
#      cerrados (24h) + feedback respondido (semana)
#    + src/app/api/notifications/route.ts · GET endpoint
#    + src/components/shell/NotificationsBell.tsx · client component
#      con dropdown · fetch lazy on open · auto-close on outside click + ESC
#    + src/components/shell/NotificationsBell.module.css
#    ~ src/components/shell/Topbar.tsx · reemplaza Bell decorativo
#
#  Comportamiento:
#    · Click en Bell → abre dropdown
#    · Auto-fetch al abrir si no hay data cargada
#    · Empty state · "Estás al día"
#    · Items linkean a su página (alarma → vehículo, boletín → /direccion/
#      boletin/<periodo>, feedback → /admin/feedback)
#    · Footer link a /configuracion?seccion=notificaciones
#    · Sin DB nueva · solo agrega lectura · próximas iteraciones
#      podrían persistir read state
#
#  Idempotente · usa cmp -s antes de cp.
# ═══════════════════════════════════════════════════════════════
set -e
PAYLOAD="_payload"
[ ! -d "$PAYLOAD" ] && echo "❌ no encuentro $PAYLOAD" && exit 1
[ ! -f "package.json" ] && echo "❌ no estoy en el root del repo" && exit 1
echo "═══ S3-L5 · centro de notificaciones ═══"

C_NEW=0; C_UPD=0; C_SAME=0
apply_file() {
  local rel="$1"; local src="$PAYLOAD/$rel"; local dst="$rel"
  [ ! -f "$src" ] && echo "  ⚠️ payload missing: $rel" && return
  if [ ! -f "$dst" ]; then
    mkdir -p "$(dirname "$dst")"; cp "$src" "$dst"
    echo "  + $rel  (nuevo)"; C_NEW=$((C_NEW+1))
  elif cmp -s "$src" "$dst"; then C_SAME=$((C_SAME+1))
  else cp "$src" "$dst"; echo "  ~ $rel  (actualizado)"; C_UPD=$((C_UPD+1)); fi
}

apply_file "src/lib/queries/user-notifications.ts"
apply_file "src/app/api/notifications/route.ts"
apply_file "src/components/shell/NotificationsBell.tsx"
apply_file "src/components/shell/NotificationsBell.module.css"
apply_file "src/components/shell/Topbar.tsx"

echo ""
echo "  Nuevos: $C_NEW · Actualizados: $C_UPD · Sin cambios: $C_SAME"
rm -rf "$PAYLOAD"

echo ""
echo "✅ Lote aplicado"
echo ""
echo "Próximo paso · reiniciar dev server:"
echo "  rm -rf .next && npm run dev"
echo ""
echo "Validación · click en el Bell del Topbar (esquina superior derecha):"
echo "  - Debería abrir dropdown con tu data real"
echo "  - Si no hay nada · empty state 'Estás al día'"
