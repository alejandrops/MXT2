#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  patch-user-supabase-auth-id.sh (H2)
#  ─────────────────────────────────────────────────────────────
#  Agrega el campo `supabaseAuthId` a model User · es la columna
#  que mapea al auth.users.id de Supabase Auth.
#
#  · Tipo: String? · nullable porque users del seed pueden no
#    estar en auth.users todavía
#  · @unique · evita que dos User locales apunten al mismo
#    auth user
#  · Indexado para lookup rápido en getSession()
#
#  Idempotente: si ya está, no hace nada.
# ═══════════════════════════════════════════════════════════════

set -e

SCHEMA="prisma/schema.prisma"

if [ ! -f "$SCHEMA" ]; then
  echo "ERROR · No encuentro $SCHEMA"
  exit 1
fi

if grep -q "supabaseAuthId" "$SCHEMA"; then
  echo "  ✓ supabaseAuthId ya está en User · skip"
  exit 0
fi

cp "$SCHEMA" "${SCHEMA}.bak-h2"
echo "  Backup: ${SCHEMA}.bak-h2"

python3 << 'PYEOF'
with open("prisma/schema.prisma", "r") as f:
    content = f.read()

# Buscar el modelo User · agregar supabaseAuthId después de email
# El email field es la primera identidad estable que tiene el user
# y suele estar al principio del modelo.

# Patrón a buscar (con tolerancia a espacios)
import re

# Match el bloque "model User {" hasta el primer "}" (cuidado con
# nested braces · usamos un regex simple porque el schema no tiene
# estructuras anidadas en model User)
pattern = r'(model User \{)([^}]+)(\})'
match = re.search(pattern, content)
if not match:
    raise SystemExit("ERROR · no encontré el bloque model User")

block = match.group(2)
# Insertar el campo después de email (que sabemos que está)
if 'supabaseAuthId' in block:
    # Ya estaba (defensa doble · el grep arriba ya lo chequeó)
    pass
else:
    # Buscar la línea de email y agregar nuestro campo después
    email_pattern = r'(\n\s+email\s+String\s+@unique\s*\n)'
    if not re.search(email_pattern, block):
        raise SystemExit("ERROR · no encontré email field con @unique")

    new_field = (
        '\n  /// ID en auth.users de Supabase. Null si el user todavía\n'
        '  /// no fue provisionado en Supabase Auth (caso seed inicial).\n'
        '  supabaseAuthId String?     @unique\n'
    )
    new_block = re.sub(email_pattern, r'\1' + new_field, block, count=1)

    new_content = content[:match.start()] + match.group(1) + new_block + match.group(3) + content[match.end():]
    content = new_content

with open("prisma/schema.prisma", "w") as f:
    f.write(content)

print("  ✓ Campo supabaseAuthId agregado a User")
PYEOF

echo "  Próximo: npx prisma migrate dev --name add_supabase_auth_id"
