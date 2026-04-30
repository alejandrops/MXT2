#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  apply.sh · Lote H5a-2 · Importers de Dispositivos + SIMs
#  ─────────────────────────────────────────────────────────────
#  Agrega bulk-import CSV a /admin/dispositivos y /admin/sims:
#
#   · Botón "Importar CSV" en el header de cada page (al lado
#     del botón "Nuevo dispositivo" / "Nueva SIM" existente).
#   · Drawer dark theme con preview, validación y bulk insert.
#   · Todos los items importados arrancan en status = STOCK,
#     sin asset/device asignado · el operador los asigna luego
#     desde el drawer de edición existente.
#
#  Permisos requeridos:
#   · canWrite("backoffice_dispositivos") · solo SA/MA
#   · canWrite("backoffice_sims")          · solo SA/MA
#  (sin cambios al sistema de permisos · ya existían)
#
#  Idempotente: solo escribe archivos que cambian (cmp -s).
#  No borra nada · NewDeviceButton.tsx y NewSimButton.tsx
#  pueden quedar huérfanos (ya no se importan en page.tsx)
#  pero no rompen nada.
# ═══════════════════════════════════════════════════════════════

set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
GREY='\033[0;90m'
NC='\033[0m'

LOTE_NAME="H5a-2 · Importers Dispositivos + SIMs"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SRC_DIR="$SCRIPT_DIR/src"

if [ ! -d "$SRC_DIR" ]; then
  echo "ERROR · No encuentro el directorio 'src' del lote en $SRC_DIR"
  exit 1
fi

if [ ! -d "src" ] || [ ! -f "package.json" ]; then
  echo "ERROR · No encuentro la raíz del proyecto Next.js."
  echo "Tenés que estar parado en ~/Downloads/maxtracker-functional al correr esto."
  exit 1
fi

echo -e "${CYAN}═══ Lote $LOTE_NAME ═══${NC}"
echo

written=0
unchanged=0
created=0

apply_file() {
  local rel="$1"
  local src="$SRC_DIR/$rel"
  local dst="src/$rel"

  if [ ! -f "$src" ]; then
    echo -e "  ${YELLOW}skip${NC}  $rel · no en el lote"
    return
  fi

  mkdir -p "$(dirname "$dst")"

  if [ ! -f "$dst" ]; then
    cp "$src" "$dst"
    echo -e "  ${GREEN}new ${NC}  $rel"
    created=$((created + 1))
    return
  fi

  if cmp -s "$src" "$dst"; then
    echo -e "  ${GREY}same${NC}  $rel"
    unchanged=$((unchanged + 1))
  else
    cp "$src" "$dst"
    echo -e "  ${GREEN}upd ${NC}  $rel"
    written=$((written + 1))
  fi
}

echo -e "${CYAN}── Dispositivos ──${NC}"

apply_file "app/admin/dispositivos/import-actions.ts"
apply_file "app/admin/dispositivos/AdminDevicesImporter.tsx"
apply_file "app/admin/dispositivos/AdminDevicesHeaderActions.tsx"
apply_file "app/admin/dispositivos/AdminDevicesHeaderActions.module.css"
apply_file "app/admin/dispositivos/page.tsx"

echo
echo -e "${CYAN}── SIMs ──${NC}"

apply_file "app/admin/sims/import-actions.ts"
apply_file "app/admin/sims/AdminSimsImporter.tsx"
apply_file "app/admin/sims/AdminSimsHeaderActions.tsx"
apply_file "app/admin/sims/AdminSimsHeaderActions.module.css"
apply_file "app/admin/sims/page.tsx"

echo
echo -e "${CYAN}─── Resumen ───${NC}"
echo "  Nuevos:        $created"
echo "  Actualizados:  $written"
echo "  Sin cambios:   $unchanged"
echo

if [ -d ".next" ]; then
  rm -rf .next
  echo -e "  ${GREY}.next eliminado${NC}"
  echo
fi

echo -e "${GREEN}✓ Lote $LOTE_NAME aplicado.${NC}"
echo
echo "Probá esto:"
echo "  npm run dev  →  loguate como sa@maxtracker.io"
echo
echo "Qué validar:"
echo "  • /admin/dispositivos · botón 'Importar CSV' (gris) al lado de"
echo "    'Nuevo dispositivo' (violeta)"
echo "  • Click → drawer dark con plantilla descargable y preview"
echo "  • Subí un CSV con columnas: imei, vendor, modelo, serial,"
echo "    firmware. Validación: IMEI 15 dígitos, vendor enum,"
echo "    duplicados detectados contra DB y dentro del archivo"
echo "  • Tras importar, los devices aparecen en status STOCK"
echo
echo "  • /admin/sims · mismo patrón"
echo "  • Columnas: iccid, carrier, apn, telefono, imsi, plan_mb"
echo "  • Validación: ICCID 19-20 dígitos, carrier enum, APN required"
echo
echo "  • Como Diego (CA) o Pablo (OP): no ven el botón Importar"
echo "    (no tienen permiso backoffice_dispositivos / backoffice_sims)"
