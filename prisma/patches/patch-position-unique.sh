#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  patch-position-unique.sh
#  ─────────────────────────────────────────────────────────────
#  Agrega @@unique([assetId, recordedAt]) al modelo Position en
#  prisma/schema.prisma · idempotente, no toca el archivo si la
#  línea ya existe.
#
#  Uso:
#    bash prisma/patches/patch-position-unique.sh
#
#  Después de aplicarlo, hay que correr la migration:
#    npx prisma migrate dev --name add-position-unique-recorded-at
# ═══════════════════════════════════════════════════════════════

set -e

SCHEMA="prisma/schema.prisma"

if [ ! -f "$SCHEMA" ]; then
  echo "ERROR · No encuentro $SCHEMA · estás parado en la raíz?"
  exit 1
fi

# 1. Si ya existe el unique, no hacer nada
if grep -q "@@unique(\[assetId, recordedAt\])" "$SCHEMA"; then
  echo "✓ schema ya tiene @@unique([assetId, recordedAt]) · sin cambios"
  exit 0
fi

# 2. Validar que existe el modelo Position con el index actual · para
#    asegurarnos que estamos pegando en el lugar correcto
if ! grep -q "@@index(\[assetId, recordedAt\])" "$SCHEMA"; then
  echo "ERROR · No encontré @@index([assetId, recordedAt]) en $SCHEMA"
  echo "       · esperaba que el modelo Position lo tuviera ya."
  echo "       · agregá manualmente esta línea dentro del model Position { ... }:"
  echo "           @@unique([assetId, recordedAt])"
  exit 1
fi

# 3. Insertar la línea @@unique justo después del @@index existente
#    Usamos awk porque sed -i tiene comportamiento distinto en macOS y Linux
TMP=$(mktemp)
awk '
  /@@index\(\[assetId, recordedAt\]\)/ {
    print
    # Tomar la indentación de la línea original
    match($0, /^[[:space:]]*/)
    indent = substr($0, RSTART, RLENGTH)
    print indent "@@unique([assetId, recordedAt])"
    next
  }
  { print }
' "$SCHEMA" > "$TMP"

mv "$TMP" "$SCHEMA"

echo "✓ schema actualizado · @@unique([assetId, recordedAt]) agregado al modelo Position"
echo
echo "Ahora corré la migration:"
echo "  npx prisma migrate dev --name add-position-unique-recorded-at"
echo
echo "Si la migration falla porque ya hay rows duplicados en la tabla Position,"
echo "limpiá primero:"
echo "  echo 'DELETE FROM Position;' | npx prisma db execute --stdin"
echo "  npx prisma migrate dev --name add-position-unique-recorded-at"
