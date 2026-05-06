#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  S6-WIKI · Sistema de documentación in-app
#  ─────────────────────────────────────────────────────────────
#  22 archivos · 3201 líneas · 0 errores TS.
#
#  Implementación end-to-end de un sistema de ayuda contextual
#  servida desde archivos MDX en el repo.
#
#  ─────────────────────────────────────────────────────────────
#  ARQUITECTURA
#  ─────────────────────────────────────────────────────────────
#
#                   ┌──────────────────────────────┐
#                   │ docs/wiki/{slug}.mdx         │
#                   │ (Markdown puro · versionado) │
#                   └──────────────┬───────────────┘
#                                  │ readFile
#                   ┌──────────────▼───────────────┐
#                   │ /api/public/wiki/[...slug]   │
#                   │ (route handler · cache 5min) │
#                   └──────────────┬───────────────┘
#                                  │ fetch JSON
#                   ┌──────────────▼───────────────┐
#                   │ HelpDrawer (client)          │
#                   │ react-markdown + remark-gfm  │
#                   └──────────────▲───────────────┘
#                                  │ open/close
#                   ┌──────────────┴───────────────┐
#                   │ HelpButton "?" en PageHeader │
#                   │ activable por prop helpSlug  │
#                   └──────────────────────────────┘
#
#  ─────────────────────────────────────────────────────────────
#  CONVENCIÓN DE SLUGS
#  ─────────────────────────────────────────────────────────────
#
#  El slug coincide con el path de la URL del producto:
#
#    URL                               Slug                   Archivo
#    ──────────────────                ──────────────────     ──────────────────────────────
#    /conduccion/scorecard             conduccion/scorecard   docs/wiki/conduccion/scorecard.mdx
#    /seguridad/alarmas                seguridad/alarmas      docs/wiki/seguridad/alarmas.mdx
#    /actividad/eventos                actividad/eventos      docs/wiki/actividad/eventos.mdx
#
#  Validación · solo a-z, 0-9, _, - en cada segmento. Anti
#  path-traversal · resolved path debe estar dentro de docs/wiki/.
#
#  ─────────────────────────────────────────────────────────────
#  ARCHIVOS DEL LOTE
#  ─────────────────────────────────────────────────────────────
#
#  Backend
#    src/app/api/public/wiki/[...slug]/route.ts
#      · GET catchall · lee MDX del FS
#      · Anti path-traversal con regex + path.resolve check
#      · Cache headers · 5min cache · 1h stale-while-revalidate
#      · 200 / 404 / 400 / 500 según corresponda
#
#  UI Components
#    src/components/help/HelpDrawer.tsx + .module.css
#      · Side panel desde la derecha · 480px
#      · Estados loading · empty · error · loaded
#      · react-markdown + remark-gfm (tablas, GFM)
#      · Lock body scroll · Esc para cerrar
#      · Tipografía editorial (h1 serif, h2 con peso/letterspacing)
#
#    src/components/help/HelpButton.tsx + .module.css
#      · Botón "?" con HelpCircle icon
#      · 28x28 · borde fino · hover azul
#      · Wrapper que abre el HelpDrawer
#
#    src/components/maxtracker/ui/PageHeader.tsx (mod)
#      · Prop nuevo opcional helpSlug?: string
#      · Si está · render HelpButton dentro de actions
#      · Backwards-compatible · sin helpSlug todo igual
#
#  Wiki content (MDX)
#    docs/wiki/_TEMPLATE.mdx              · plantilla para nuevos
#    docs/wiki/_index.mdx                 · overview general
#    docs/wiki/seguimiento/mapa.mdx
#    docs/wiki/seguimiento/historial.mdx
#    docs/wiki/actividad/eventos.mdx
#    docs/wiki/actividad/viajes.mdx
#    docs/wiki/actividad/resumen.mdx
#    docs/wiki/seguridad/alarmas.mdx
#    docs/wiki/conduccion/scorecard.mdx
#    docs/wiki/conduccion/infracciones.mdx
#
#  Vistas con botón "?" activado (mods)
#    src/app/(product)/seguridad/alarmas/AlarmsClient.tsx
#    src/app/(product)/conduccion/scorecard/ScorecardClient.tsx
#    src/app/(product)/conduccion/infracciones/InfractionsClient.tsx
#    src/app/(product)/actividad/eventos/EventsClient.tsx
#    src/app/(product)/actividad/viajes/TripsClient.tsx
#    src/app/(product)/seguimiento/mapa/page.tsx
#
#  ─────────────────────────────────────────────────────────────
#  DEPENDENCIAS NUEVAS
#  ─────────────────────────────────────────────────────────────
#
#  El lote requiere instalar:
#    · react-markdown@^9
#    · remark-gfm@^4
#
#  El apply.sh corre `npm install` automáticamente al final.
#
#  ─────────────────────────────────────────────────────────────
#  CÓMO AGREGAR DOC A UNA VISTA NUEVA
#  ─────────────────────────────────────────────────────────────
#
#  1. Crear docs/wiki/{modulo}/{vista}.mdx (usar _TEMPLATE.mdx
#     como base)
#  2. Editar el componente client de la vista y pasar helpSlug
#     al PageHeader:
#
#       <PageHeader
#         variant="module"
#         title="..."
#         helpSlug="modulo/vista"   ← NUEVO
#       />
#
#  3. El botón "?" aparece automáticamente · click abre el drawer
#     que fetch /api/public/wiki/modulo/vista
#
#  ─────────────────────────────────────────────────────────────
#  AUDITORÍAS
#  ─────────────────────────────────────────────────────────────
#
#  ✓ Ningún .module.css con :root real
#  ✓ Endpoint con anti path-traversal (regex + path.resolve)
#  ✓ Endpoint cacheable · sin DB · sin auth (es público)
#  ✓ HelpDrawer tipado · API explícita { open, slug, onClose }
#  ✓ PageHeader backwards-compatible · sin helpSlug todo igual
#  ✓ npx tsc --noEmit · 0 errores
#
#  Idempotente · cmp -s antes de cp · npm install inteligente.
# ═══════════════════════════════════════════════════════════════
set -e
PAYLOAD="_payload"
[ ! -d "$PAYLOAD" ] && echo "❌ no encuentro $PAYLOAD" && exit 1
[ ! -f "package.json" ] && echo "❌ no estoy en el root del repo" && exit 1
echo "═══ S6-WIKI · Sistema de documentación in-app ═══"

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

# ─── Instalar dependencias nuevas si faltan ──────────
echo ""
echo "─── Verificando dependencias ───"
NEED_INSTALL=0
if ! node -e "require.resolve('react-markdown')" 2>/dev/null; then
  echo "  · react-markdown · faltante · se va a instalar"
  NEED_INSTALL=1
fi
if ! node -e "require.resolve('remark-gfm')" 2>/dev/null; then
  echo "  · remark-gfm · faltante · se va a instalar"
  NEED_INSTALL=1
fi

if [ $NEED_INSTALL -eq 1 ]; then
  echo ""
  echo "  Ejecutando: npm install react-markdown@^9 remark-gfm@^4"
  npm install --no-audit --no-fund react-markdown@^9 remark-gfm@^4
  echo "  ✓ Dependencias instaladas"
else
  echo "  ✓ react-markdown y remark-gfm ya están instalados"
fi

echo ""
echo "✅ Lote aplicado"
echo ""
echo "  npx tsc --noEmit"
echo "  npm run dev"
echo ""
echo "Probá:"
echo ""
echo "  · /conduccion/scorecard       → click en '?' del header"
echo "  · /seguridad/alarmas          → click en '?'"
echo "  · /conduccion/infracciones    → click en '?'"
echo "  · /actividad/eventos          → click en '?'"
echo "  · /actividad/viajes           → click en '?'"
echo "  · /seguimiento/mapa           → click en '?'"
echo ""
echo "  · El drawer se abre desde la derecha · Esc o click fuera lo cierra"
echo "  · Si pedís un slug inexistente · muestra estado 'doc no disponible'"
echo "    con instrucciones para contribuir"
echo ""
echo "Para agregar doc a una vista nueva:"
echo "  1. Crear docs/wiki/{slug}.mdx (template en _TEMPLATE.mdx)"
echo "  2. Pasar helpSlug=\"...\" al PageHeader del componente client"
echo ""
echo "PRÓXIMO · Agregar wikis para las vistas restantes"
echo "          (dashboard·s · direccion · catalogos · gestion)"
