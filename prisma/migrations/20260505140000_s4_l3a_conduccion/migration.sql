-- ═══════════════════════════════════════════════════════════════
--  S4-L3a · Conducción · Migración SQL
--  ─────────────────────────────────────────────────────────────
--  1. Migra enum VehicleType (7 → 9 valores · Ley 24.449)
--  2. Crea enum RoadType (tipos de vía OSM)
--  3. Crea enum GeofenceCategory
--  4. Crea enums InfractionSeverity, InfractionStatus, DiscardReason
--  5. Agrega columna Position.roadType
--  6. Crea tablas Geofence, Infraction
--  7. Crea índices y FKs
--
--  El paso 1 es defensive · si la DB tenía datos previos, mapea
--  los valores viejos a los nuevos. En el flujo normal (reset +
--  seed) la tabla Asset llega vacía a esta migración, pero
--  protegerse no cuesta nada.
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Migración del enum VehicleType ─────────────────────────
-- Postgres no permite agregar/quitar valores de un enum y mantener
-- la columna referenciándolo · hay que recrear el tipo entero.

-- Renombrar el viejo
ALTER TYPE "VehicleType" RENAME TO "VehicleType_old";

-- Crear el nuevo
CREATE TYPE "VehicleType" AS ENUM (
  'MOTOCICLETA',
  'LIVIANO',
  'UTILITARIO',
  'PASAJEROS',
  'CAMION_LIVIANO',
  'CAMION_PESADO',
  'SUSTANCIAS_PELIGROSAS',
  'MAQUINA_VIAL',
  'ASSET_FIJO'
);

-- Drop default temporal · necesario para poder cambiar el tipo
ALTER TABLE "Asset" ALTER COLUMN "vehicleType" DROP DEFAULT;

-- Cambiar el tipo de la columna mapeando valores viejos a nuevos
ALTER TABLE "Asset"
  ALTER COLUMN "vehicleType" TYPE "VehicleType"
  USING (
    CASE "vehicleType"::text
      WHEN 'CAR'             THEN 'LIVIANO'
      WHEN 'MOTORCYCLE'      THEN 'MOTOCICLETA'
      WHEN 'TRUCK'           THEN 'CAMION_LIVIANO'
      WHEN 'HEAVY_MACHINERY' THEN 'MAQUINA_VIAL'
      WHEN 'TRAILER'         THEN 'CAMION_PESADO'
      WHEN 'SILO'            THEN 'ASSET_FIJO'
      WHEN 'GENERIC'         THEN 'LIVIANO'
    END::"VehicleType"
  );

-- Restaurar default con el valor nuevo
ALTER TABLE "Asset" ALTER COLUMN "vehicleType" SET DEFAULT 'LIVIANO';

-- Drop del tipo viejo
DROP TYPE "VehicleType_old";

-- ─── 2. Enum RoadType ──────────────────────────────────────────
CREATE TYPE "RoadType" AS ENUM (
  'URBANO_CALLE',
  'URBANO_AVENIDA',
  'RURAL',
  'SEMIAUTOPISTA',
  'AUTOPISTA',
  'CAMINO_RURAL',
  'DESCONOCIDO'
);

-- ─── 3. Enum GeofenceCategory ──────────────────────────────────
CREATE TYPE "GeofenceCategory" AS ENUM (
  'PETROLERA_PRIMARIA',
  'PETROLERA_SECUNDARIA',
  'MINERA_INTERNA',
  'PREDIO_CLIENTE',
  'CAMINO_INTERNO',
  'ZONA_ESCOLAR',
  'OTROS'
);

-- ─── 4. Enums de Infracción ────────────────────────────────────
CREATE TYPE "InfractionSeverity" AS ENUM ('LEVE', 'MEDIA', 'GRAVE');

CREATE TYPE "InfractionStatus" AS ENUM ('ACTIVE', 'DISCARDED');

CREATE TYPE "DiscardReason" AS ENUM (
  'WRONG_SPEED_LIMIT',
  'WRONG_ROAD_TYPE',
  'POOR_GPS_QUALITY',
  'DRIVER_VEHICLE_IMMUNITY'
);

-- ─── 5. Position.roadType ──────────────────────────────────────
ALTER TABLE "Position" ADD COLUMN "roadType" "RoadType";

-- ─── 6. Geofence ───────────────────────────────────────────────
CREATE TABLE "Geofence" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "polygonGeoJson" TEXT NOT NULL,
    "category" "GeofenceCategory",
    "vmaxOverrideJson" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Geofence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Geofence_accountId_active_idx" ON "Geofence"("accountId", "active");

ALTER TABLE "Geofence" ADD CONSTRAINT "Geofence_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── 7. Infraction ─────────────────────────────────────────────
CREATE TABLE "Infraction" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "driverId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "vmaxKmh" INTEGER NOT NULL,
    "peakSpeedKmh" DOUBLE PRECISION NOT NULL,
    "maxExcessKmh" DOUBLE PRECISION NOT NULL,
    "distanceMeters" DOUBLE PRECISION NOT NULL,
    "severity" "InfractionSeverity" NOT NULL,
    "vehicleType" "VehicleType" NOT NULL,
    "roadType" "RoadType" NOT NULL,
    "startLat" DOUBLE PRECISION NOT NULL,
    "startLon" DOUBLE PRECISION NOT NULL,
    "startAddress" TEXT,
    "endLat" DOUBLE PRECISION NOT NULL,
    "endLon" DOUBLE PRECISION NOT NULL,
    "endAddress" TEXT,
    "trackJson" TEXT NOT NULL,
    "status" "InfractionStatus" NOT NULL DEFAULT 'ACTIVE',
    "discardReason" "DiscardReason",
    "discardedById" TEXT,
    "discardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Infraction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Infraction_accountId_startedAt_idx" ON "Infraction"("accountId", "startedAt");
CREATE INDEX "Infraction_assetId_startedAt_idx" ON "Infraction"("assetId", "startedAt");
CREATE INDEX "Infraction_driverId_startedAt_idx" ON "Infraction"("driverId", "startedAt");

ALTER TABLE "Infraction" ADD CONSTRAINT "Infraction_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Infraction" ADD CONSTRAINT "Infraction_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "Asset"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Infraction" ADD CONSTRAINT "Infraction_driverId_fkey"
  FOREIGN KEY ("driverId") REFERENCES "Person"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
