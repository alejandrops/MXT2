#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  patch-package-json-vercel.sh (H3)
#  ─────────────────────────────────────────────────────────────
#  Agrega el script `vercel-build` al package.json. Vercel lo va
#  a usar en lugar del `build` default · necesario porque hay
#  que correr `prisma migrate deploy` antes de buildear el Next.
#
#  Idempotente.
# ═══════════════════════════════════════════════════════════════

set -e

if [ ! -f "package.json" ]; then
  echo "ERROR · No encuentro package.json"
  exit 1
fi

# ¿Ya está aplicado?
if grep -q '"vercel-build"' package.json; then
  echo "  ✓ vercel-build ya está · skip"
  exit 0
fi

cp package.json package.json.bak-h3
echo "  Backup: package.json.bak-h3"

# Insertar vercel-build después de "build". Usamos node por seguridad
# (preserva formato JSON correcto).
node -e '
const fs = require("fs");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf-8"));
if (!pkg.scripts) pkg.scripts = {};
// Insertar vercel-build · aplica migrations + build de Next
pkg.scripts["vercel-build"] = "prisma generate && prisma migrate deploy && next build";
fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
console.log("  ✓ vercel-build script agregado");
'
