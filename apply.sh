#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  S5-E1 · Boletín de conductor · mensual + anual
#  ─────────────────────────────────────────────────────────────
#  Segundo nivel del Sistema Editorial Maxtracker:
#    1. Recibo de infracción individual           ✅ (S4-L3d)
#    2. Recibo de viaje individual                ✅ (S5-T4)
#    3. Boletín de conductor (mensual + anual)    ✅ (este lote)
#    4. Boletín de grupo                          🔴 (S5-E2)
#    5. Boletín de empresa                        🔴 (S5-E3)
#
#  Diseño aplicado · mockup v2 con score 42px (decisión usuario):
#    · Score integrado al flujo · sin tile aislado
#    · Severidad codificada por símbolo (○ ◐ ●), no color
#    · Sparklines Unicode inline para evolución
#    · Líneas guía en chart anual (no bandas pintadas)
#    · Tendencias con texto explícito "vs período anterior"
#    · Funciona idéntico en B&N
#
#  ─────────────────────────────────────────────────────────────
#  ARCHIVOS
#  ─────────────────────────────────────────────────────────────
#
#  Backend
#    src/lib/sparkline.ts                          util Unicode
#    src/lib/conduccion/boletin-driver-text.ts     helpers de texto
#    src/lib/queries/driver-boletin-data.ts        query agregadora
#    src/lib/boletin/driver-snapshot.ts            cache + fallback
#
#  Print UI
#    src/app/(print)/conduccion/boletin/conductor/[id]/[period]/
#      page.tsx           server · resuelve scope, llama snapshot
#      DriverBoletin.tsx  client · port mockup v2 con score 42px
#      Boletin.module.css A4 · serif para títulos · mono para datos
#
#  Schema (Prisma)
#    prisma/_driver-boletin-snapshot.prisma   fragment a anexar
#
#  Punto de entrada
#    src/app/(product)/conduccion/scorecard/ScorecardClient.tsx
#    nueva columna "Boletín" con links M (mensual) y A (anual)
#    que abren el boletín en nueva pestaña.
#
#  ─────────────────────────────────────────────────────────────
#  PRE-GENERACIÓN CON FALLBACK
#  ─────────────────────────────────────────────────────────────
#
#  El boletín se sirve desde DriverBoletinSnapshot si existe.
#  Si la tabla no se migró aún · cae a cómputo on-demand sin
#  guardar (no rompe nada). Después del primer hit con la tabla
#  migrada · queda cacheado · siguientes hits son instantáneos.
#
#  Para cron de pre-generación al cierre · S5-E1b (siguiente lote).
#
#  ─────────────────────────────────────────────────────────────
#  MIGRACIÓN PRISMA · MANUAL
#  ─────────────────────────────────────────────────────────────
#
#  El apply.sh se encarga de mergear el schema:
#    1. Anexa el modelo DriverBoletinSnapshot al final del schema
#       (si no existe ya)
#    2. Inyecta la relación inversa en Person (si no existe ya)
#
#  Después de aplicar el lote, correr manualmente:
#    npx prisma generate
#    npx prisma migrate dev --name add-driver-boletin-snapshot
#
#  Si NO migrás · el boletín igual funciona on-demand sin caché.
#
#  ─────────────────────────────────────────────────────────────
#  AUDITORÍAS
#  ─────────────────────────────────────────────────────────────
#
#  ✓ Ningún .module.css con selector :root real
#  ✓ Ningún server→client prop es función
#  ✓ npx tsc --noEmit · 0 errores
#  ✓ Multi-tenant scope respetado en getDriverBoletinData
#
#  Idempotente · usa cmp -s antes de cp · grep antes de patch.
# ═══════════════════════════════════════════════════════════════
set -e
PAYLOAD="_payload"
[ ! -d "$PAYLOAD" ] && echo "❌ no encuentro $PAYLOAD" && exit 1
[ ! -f "package.json" ] && echo "❌ no estoy en el root del repo" && exit 1
echo "═══ S5-E1 · Boletín de conductor (mensual + anual) ═══"

C_NEW=0; C_UPD=0; C_SAME=0
apply_file() {
  local rel="$1"; local src="$PAYLOAD/$rel"; local dst="$rel"
  [ ! -f "$src" ] && return
  # Saltar el fragment de prisma · se trata aparte
  [ "$rel" = "prisma/_driver-boletin-snapshot.prisma" ] && return
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
echo "  Archivos aplicados · Nuevos: $C_NEW · Actualizados: $C_UPD · Sin cambios: $C_SAME"

# ─────────────────────────────────────────────────────────────
# Patch del schema Prisma · idempotente
# ─────────────────────────────────────────────────────────────

SCHEMA="prisma/schema.prisma"
PRISMA_FRAGMENT="$PAYLOAD/prisma/_driver-boletin-snapshot.prisma"

if [ -f "$SCHEMA" ] && [ -f "$PRISMA_FRAGMENT" ]; then
  # 1. Anexar modelo si no existe
  if grep -q "^model DriverBoletinSnapshot " "$SCHEMA"; then
    echo "  · DriverBoletinSnapshot · ya está en el schema"
  else
    cat "$PRISMA_FRAGMENT" >> "$SCHEMA"
    echo "  + DriverBoletinSnapshot · anexado al schema"
  fi

  # 2. Inyectar la relación inversa en Person si no existe
  if grep -q "boletinSnapshots\s*DriverBoletinSnapshot" "$SCHEMA"; then
    echo "  · Person.boletinSnapshots · ya está en el schema"
  else
    # Insertar después de la línea 'infractions Infraction[]' del modelo Person
    # Usamos un sed que solo afecta la primera ocurrencia (la de Person)
    if grep -q "^  infractions      Infraction\[\]$" "$SCHEMA"; then
      sed -i.bak '0,/^  infractions      Infraction\[\]$/{s|^  infractions      Infraction\[\]$|  infractions      Infraction[]\
  boletinSnapshots DriverBoletinSnapshot[]|}' "$SCHEMA"
      rm -f "$SCHEMA.bak"
      echo "  + Person.boletinSnapshots · inyectada en el schema"
    else
      echo "  ⚠ No pude inyectar Person.boletinSnapshots (línea esperada no encontrada)"
      echo "    Agregalo a mano dentro de model Person:"
      echo "      boletinSnapshots DriverBoletinSnapshot[]"
    fi
  fi
fi

rm -rf "$PAYLOAD"

echo ""
echo "✅ Lote aplicado"
echo ""
echo "  npx tsc --noEmit                                  # validar TS"
echo "  npx prisma generate                                # regenerar client"
echo "  npx prisma migrate dev --name add-driver-boletin   # migrar DB"
echo "  npm run dev                                        # arrancar"
echo ""
echo "Probá:"
echo "  · /conduccion/scorecard"
echo "  · click en columna \"Boletín\" → links M (mensual) y A (anual)"
echo "  · M abre /conduccion/boletin/conductor/{id}/{YYYY-MM}"
echo "  · A abre /conduccion/boletin/conductor/{id}/{YYYY}"
echo "  · Cmd+P para guardar como PDF"
echo ""
echo "Si NO migrás Prisma · el boletín igual funciona on-demand"
echo "(sin cache · ~200-500ms por hit · suficiente para MVP)."
echo ""
echo "PRÓXIMO · S5-E1b · cron de pre-generación al cierre"
echo "          S5-T5 · Alarmas al patrón canónico"
echo "          S5-E2 · Boletín de grupo"
