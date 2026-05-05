#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  S4-L3b-fix2 · ModuleKey inválido en /conduccion/dashboard
#  ─────────────────────────────────────────────────────────────
#  El page del dashboard pasaba "conduccion" como ModuleKey al
#  resolver de tenant-scope, pero ese key no existe en el enum
#  ModuleKey (src/lib/permissions.ts). El sistema definido tiene:
#    seguimiento | actividad | seguridad | direccion | catalogos
#    | configuracion | backoffice_*
#
#  Cuando el ModuleKey no matchea, getPerm() devuelve undefined →
#  getScopedAccountIds() devuelve [] → resolveAccountScope()
#  devuelve NEVER_MATCHING_ACCOUNT ("__no_account__"). Las queries
#  ejecutan con ese sentinel y el filtro queda imposible de
#  satisfacer · pero algunas no fallan limpio en producción y
#  generan el "Application error" de Vercel.
#
#  En desarrollo no rompía porque el Prisma client del sandbox
#  estaba en stub y devolvía vacíos sin error.
#
#  CORRECCIÓN:
#
#    Cambiar el ModuleKey de "conduccion" a "actividad" en el
#    page del dashboard. Es lo que hace ya el ScorecardClient
#    del mismo módulo Conducción · ambos comparten el bucket de
#    permisos "actividad" hasta que Conducción tenga uno propio
#    (no en MVP).
#
#  Idempotente · usa cmp -s antes de cp.
# ═══════════════════════════════════════════════════════════════
set -e
PAYLOAD="_payload"
[ ! -d "$PAYLOAD" ] && echo "❌ no encuentro $PAYLOAD" && exit 1
[ ! -f "package.json" ] && echo "❌ no estoy en el root del repo" && exit 1
echo "═══ S4-L3b-fix2 · ModuleKey inválido en /conduccion/dashboard ═══"

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
echo "Validación local:"
echo "  npx tsc --noEmit"
echo ""
echo "Después committear y pushear · Vercel auto-deploy."
