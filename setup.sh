#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  setup.sh · Maxtracker · install para Mac nueva
#  ─────────────────────────────────────────────────────────────
#  1. Verifica Node.js
#  2. Instala dependencias (npm install)
#  3. Crea la DB local (Prisma migrate)
#  4. Pobla con datos de demo (seed)
# ═══════════════════════════════════════════════════════════════

set -e

echo "═══════════════════════════════════════════════════════════════"
echo "  Maxtracker · Setup local · Mac nueva"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# ── 1. Verificar Node.js ────────────────────────────────────────
echo "→ Verificando Node.js…"
if ! command -v node &> /dev/null; then
  echo ""
  echo "❌ Node.js no está instalado."
  echo ""
  echo "Instalalo con Homebrew:"
  echo "  brew install node"
  echo ""
  echo "O descargalo de https://nodejs.org (versión ≥ 20)"
  exit 1
fi

NODE_MAJOR=$(node --version | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo ""
  echo "❌ Tenés Node $(node --version) · necesitás ≥ 20."
  echo "   Actualizá con: brew upgrade node"
  exit 1
fi

echo "  ✓ Node $(node --version)"
echo "  ✓ npm $(npm --version)"
echo ""

# ── 2. Instalar dependencias ────────────────────────────────────
echo "→ Instalando dependencias (puede tardar 1-2 min)…"
npm install
echo ""

# ── 3. Migración de DB ──────────────────────────────────────────
echo "→ Creando base de datos local (SQLite)…"
npx prisma db push --skip-generate
echo "  ✓ Schema aplicado"
echo ""

# ── 4. Seed de datos ────────────────────────────────────────────
echo "→ Poblando con datos de demo (12 vehículos reales · ~10k posiciones)…"
npm run db:seed
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "  ✓ Setup completo"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Para arrancar el dev server:"
echo "  npm run dev"
echo ""
echo "Después abrí http://localhost:3000 en tu browser."
echo ""
echo "Para ver la base de datos en una UI:"
echo "  npm run db:studio"
echo ""
