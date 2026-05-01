#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  patch-schema-postgres.sh
#  ─────────────────────────────────────────────────────────────
#  Patch idempotente para migrar el datasource del schema.prisma
#  de SQLite a PostgreSQL (Supabase).
#
#  Cambios:
#   1. provider = "sqlite"  →  provider = "postgresql"
#   2. Agrega directUrl = env("DIRECT_URL")  (necesario para
#      migrations cuando DATABASE_URL apunta al connection pooler
#      de Supabase, que no soporta prepared statements de migrate)
#
#  Idempotente: si ya está aplicado, no hace nada.
# ═══════════════════════════════════════════════════════════════

set -e

SCHEMA="prisma/schema.prisma"

if [ ! -f "$SCHEMA" ]; then
  echo "ERROR · No encuentro $SCHEMA"
  exit 1
fi

# Detectar estado actual
if grep -q 'provider = "postgresql"' "$SCHEMA" && grep -q 'directUrl = env' "$SCHEMA"; then
  echo "  ✓ schema.prisma ya está en Postgres · skip"
  exit 0
fi

# Backup por las dudas
cp "$SCHEMA" "${SCHEMA}.bak-sqlite"
echo "  Backup: ${SCHEMA}.bak-sqlite"

# Reemplazar el bloque datasource entero · más robusto que sed line-by-line
python3 << 'PYEOF'
with open("prisma/schema.prisma", "r") as f:
    content = f.read()

old_block = '''datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}'''

new_block = '''datasource db {
  provider  = "postgresql"
  // Pooled connection · usado por la app (alta concurrencia, conexiones cortas)
  url       = env("DATABASE_URL")
  // Conexión directa · usada por `prisma migrate` y `prisma db push`
  // (migrations no funcionan vía pooler · necesitan prepared statements)
  directUrl = env("DIRECT_URL")
}'''

if old_block not in content:
    raise SystemExit("ERROR · no encontré el bloque datasource original · revisar schema manualmente")

content = content.replace(old_block, new_block)

with open("prisma/schema.prisma", "w") as f:
    f.write(content)

print("  ✓ datasource actualizado a postgresql + directUrl")
PYEOF

echo "  Listo. Próximo paso: npx prisma migrate dev --name initial_postgres"
