#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  patch-account-settings.sh (S1)
#  ─────────────────────────────────────────────────────────────
#  Agrega tabla AccountSettings (1:1 con Account) para guardar:
#
#  · UMBRALES (columnas tipadas) · velocidades máx, g-force,
#    duración mínima ralentí, etc. Se consultan frecuentemente
#    en el pipeline de detección de eventos · queremos índices
#    + validación estricta.
#
#  · INTEGRATIONS (Json) · cada provider tiene shape distinto
#    (flespi, future API X). Permitir shape flexible.
#
#  · PLAN_INFO (Json) · features incluidos en el tier · puede
#    extenderse sin migrations.
#
#  La relación es 1:1 · cada Account tiene UNA settings row.
#  Se crea automáticamente al insertar el Account (con defaults).
#
#  Idempotente.
# ═══════════════════════════════════════════════════════════════

set -e

SCHEMA="prisma/schema.prisma"

if [ ! -f "$SCHEMA" ]; then
  echo "ERROR · No encuentro $SCHEMA"
  exit 1
fi

if grep -q "model AccountSettings" "$SCHEMA"; then
  echo "  ✓ AccountSettings ya está · skip"
  exit 0
fi

cp "$SCHEMA" "${SCHEMA}.bak-s1"
echo "  Backup: ${SCHEMA}.bak-s1"

python3 << 'PYEOF'
with open("prisma/schema.prisma", "r") as f:
    content = f.read()

# 1. Agregar relación opcional en Account (después de assets)
old_account_block = "  groups         Group[]\n  assets         Asset[]"
new_account_block = "  groups         Group[]\n  assets         Asset[]\n  settings       AccountSettings?"

if old_account_block in content:
    content = content.replace(old_account_block, new_account_block, 1)
    print("  ✓ Relación settings agregada en Account")
else:
    print("  ⚠ No encontré 'groups + assets' en Account · revisar manualmente")

# 2. Agregar el modelo AccountSettings al final · antes de los enums
new_model = '''

// ═══════════════════════════════════════════════════════════════
//  AccountSettings · 1:1 con Account
//  ─────────────────────────────────────────────────────────────
//  Settings configurables por el CLIENT_ADMIN. Una row por
//  Account · creada al provisionar el cliente con defaults LATAM.
// ═══════════════════════════════════════════════════════════════

model AccountSettings {
  id        String  @id @default(cuid())
  accountId String  @unique
  account   Account @relation(fields: [accountId], references: [id], onDelete: Cascade)

  // ─── Umbrales · velocidad ────────────────────────────────
  /// Velocidad máxima en zona urbana (km/h)
  speedLimitUrban       Int @default(60)
  /// Velocidad máxima en ruta nacional/provincial (km/h)
  speedLimitHighway     Int @default(100)
  /// Tolerancia · % por encima del límite antes de disparar alarma
  speedTolerancePercent Int @default(10)

  // ─── Umbrales · conducción agresiva ──────────────────────
  /// Frenada brusca · g-force mínimo · default LATAM 0.35g
  /// (US standard 0.45g · LATAM ajustado por estudios locales)
  harshBrakingThreshold     Float @default(0.35)
  /// Aceleración brusca · g-force mínimo
  harshAccelerationThreshold Float @default(0.35)
  /// Curva agresiva · g-force lateral mínimo
  harshCorneringThreshold    Float @default(0.40)

  // ─── Umbrales · ralentí ──────────────────────────────────
  /// Tiempo mínimo de ralentí para disparar alarma (segundos)
  idlingMinDuration Int @default(300)

  // ─── Umbrales · viajes ───────────────────────────────────
  /// Distancia mínima para considerar un viaje válido (km)
  tripMinDistanceKm Float @default(0.5)
  /// Duración mínima para considerar un viaje válido (segundos)
  tripMinDurationSec Int @default(60)

  // ─── Notificaciones a nivel cuenta ───────────────────────
  /// Email de contacto general del cliente para alertas críticas
  alertContactEmail String?
  /// Teléfono de contacto · capaz para SMS post-MVP
  alertContactPhone String?

  // ─── Integraciones (flexible · shape varía por provider) ──
  /// JSON con configuración de integraciones activas
  /// Ejemplo: { flespi: { token: "...", enabled: true }, ... }
  integrations Json @default("{}")

  // ─── Plan extras (flexible) ──────────────────────────────
  /// Features adicionales habilitados manualmente fuera del tier
  /// Ejemplo: { extraVehicles: 50, customReports: true }
  planOverrides Json @default("{}")

  // ─── Audit ───────────────────────────────────────────────
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
'''

# Insertar después del modelo Account (al final de Account, antes del próximo model)
# Buscamos el cierre del modelo Account
import re
account_match = re.search(r'(model Account \{[^}]+\})', content)
if account_match:
    end_pos = account_match.end()
    content = content[:end_pos] + new_model + content[end_pos:]
    print("  ✓ Modelo AccountSettings agregado")
else:
    print("  ⚠ No encontré model Account · agregando al final")
    content += new_model

with open("prisma/schema.prisma", "w") as f:
    f.write(content)

print()
print("  Próximo: npx prisma migrate dev --name add_account_settings")
PYEOF
