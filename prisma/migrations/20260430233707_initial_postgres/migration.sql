-- CreateEnum
CREATE TYPE "Tier" AS ENUM ('BASE', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "MobilityType" AS ENUM ('MOBILE', 'FIXED');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('CAR', 'MOTORCYCLE', 'TRUCK', 'HEAVY_MACHINERY', 'TRAILER', 'SILO', 'GENERIC');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('MOVING', 'IDLE', 'STOPPED', 'OFFLINE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "DeviceVendor" AS ENUM ('TELTONIKA', 'QUECLINK', 'CONCOX', 'OTHER');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('STOCK', 'INSTALLED', 'IN_REPAIR', 'DECOMMISSIONED');

-- CreateEnum
CREATE TYPE "Carrier" AS ENUM ('MOVISTAR', 'CLARO', 'PERSONAL', 'ENTEL', 'OTHER');

-- CreateEnum
CREATE TYPE "SimStatus" AS ENUM ('STOCK', 'ACTIVE', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('HARSH_BRAKING', 'HARSH_ACCELERATION', 'HARSH_CORNERING', 'SPEEDING', 'IDLING', 'IGNITION_ON', 'IGNITION_OFF', 'PANIC_BUTTON', 'UNAUTHORIZED_USE', 'DOOR_OPEN', 'SIDE_DOOR_OPEN', 'CARGO_DOOR_OPEN', 'TRAILER_DETACH', 'GPS_DISCONNECT', 'POWER_DISCONNECT', 'JAMMING_DETECTED', 'SABOTAGE', 'GEOFENCE_ENTRY', 'GEOFENCE_EXIT');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlarmDomain" AS ENUM ('CONDUCCION', 'SEGURIDAD');

-- CreateEnum
CREATE TYPE "AlarmType" AS ENUM ('HARSH_DRIVING_PATTERN', 'SPEEDING_CRITICAL', 'RECKLESS_BEHAVIOR', 'PANIC', 'UNAUTHORIZED_USE', 'SABOTAGE', 'GPS_DISCONNECT', 'POWER_DISCONNECT', 'JAMMING', 'TRAILER_DETACH', 'CARGO_BREACH', 'DOOR_BREACH', 'GEOFENCE_BREACH_CRITICAL', 'DEVICE_OFFLINE');

-- CreateEnum
CREATE TYPE "AlarmStatus" AS ENUM ('OPEN', 'ATTENDED', 'CLOSED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "Theme" AS ENUM ('LIGHT', 'DARK', 'AUTO');

-- CreateEnum
CREATE TYPE "ProfileKey" AS ENUM ('SUPER_ADMIN', 'MAXTRACKER_ADMIN', 'CLIENT_ADMIN', 'OPERATOR');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "tier" "Tier" NOT NULL DEFAULT 'PRO',
    "industry" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "groupId" TEXT,
    "name" TEXT NOT NULL,
    "plate" TEXT,
    "vin" TEXT,
    "mobilityType" "MobilityType" NOT NULL DEFAULT 'MOBILE',
    "vehicleType" "VehicleType" NOT NULL DEFAULT 'GENERIC',
    "make" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "initialOdometerKm" INTEGER,
    "status" "AssetStatus" NOT NULL DEFAULT 'IDLE',
    "currentDriverId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "assetId" TEXT,
    "imei" TEXT NOT NULL,
    "serialNumber" TEXT,
    "vendor" "DeviceVendor" NOT NULL,
    "model" TEXT NOT NULL,
    "firmwareVersion" TEXT,
    "status" "DeviceStatus" NOT NULL DEFAULT 'STOCK',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "simId" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sim" (
    "id" TEXT NOT NULL,
    "iccid" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "imsi" TEXT,
    "carrier" "Carrier" NOT NULL,
    "apn" TEXT NOT NULL,
    "dataPlanMb" INTEGER NOT NULL DEFAULT 50,
    "status" "SimStatus" NOT NULL DEFAULT 'STOCK',
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "document" TEXT,
    "licenseExpiresAt" TIMESTAMP(3),
    "hiredAt" TIMESTAMP(3),
    "safetyScore" INTEGER NOT NULL DEFAULT 75,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LivePosition" (
    "assetId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "speedKmh" DOUBLE PRECISION NOT NULL,
    "heading" INTEGER,
    "ignition" BOOLEAN NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LivePosition_pkey" PRIMARY KEY ("assetId")
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "personId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "distanceKm" DOUBLE PRECISION NOT NULL,
    "avgSpeedKmh" DOUBLE PRECISION NOT NULL,
    "maxSpeedKmh" DOUBLE PRECISION NOT NULL,
    "idleMs" INTEGER NOT NULL,
    "startLat" DOUBLE PRECISION NOT NULL,
    "startLng" DOUBLE PRECISION NOT NULL,
    "endLat" DOUBLE PRECISION NOT NULL,
    "endLng" DOUBLE PRECISION NOT NULL,
    "positionCount" INTEGER NOT NULL,
    "polylineJson" TEXT NOT NULL,
    "eventCount" INTEGER NOT NULL DEFAULT 0,
    "highSeverityEventCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetDriverDay" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "distanceKm" DOUBLE PRECISION NOT NULL,
    "activeMin" INTEGER NOT NULL,
    "tripCount" INTEGER NOT NULL,
    "firstTripAt" TIMESTAMP(3) NOT NULL,
    "lastTripAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetDriverDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetWeeklyStats" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "distanceKm" DOUBLE PRECISION NOT NULL,
    "activeMin" INTEGER NOT NULL,
    "idleMin" INTEGER NOT NULL,
    "activeDays" INTEGER NOT NULL,
    "tripCount" INTEGER NOT NULL,
    "eventCount" INTEGER NOT NULL,
    "highEventCount" INTEGER NOT NULL,
    "speedingCount" INTEGER NOT NULL,
    "maxSpeedKmh" DOUBLE PRECISION NOT NULL,
    "fuelLiters" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetWeeklyStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "speedKmh" DOUBLE PRECISION NOT NULL,
    "heading" INTEGER,
    "ignition" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "personId" TEXT,
    "type" "EventType" NOT NULL,
    "severity" "Severity" NOT NULL DEFAULT 'MEDIUM',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "speedKmh" DOUBLE PRECISION,
    "metadata" TEXT,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alarm" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "personId" TEXT,
    "domain" "AlarmDomain" NOT NULL,
    "type" "AlarmType" NOT NULL,
    "severity" "Severity" NOT NULL,
    "status" "AlarmStatus" NOT NULL DEFAULT 'OPEN',
    "triggeredAt" TIMESTAMP(3) NOT NULL,
    "attendedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "notes" TEXT,

    CONSTRAINT "Alarm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "documentNumber" TEXT,
    "passwordHash" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "organizationId" TEXT NOT NULL,
    "accountId" TEXT,
    "profileId" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'es-AR',
    "theme" "Theme" NOT NULL DEFAULT 'LIGHT',
    "notifyAlarmHighCrit" BOOLEAN NOT NULL DEFAULT true,
    "notifyScoreDrop" BOOLEAN NOT NULL DEFAULT true,
    "notifyBoletinClosed" BOOLEAN NOT NULL DEFAULT true,
    "notifyCriticalEvent" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "systemKey" "ProfileKey" NOT NULL,
    "nameLabel" TEXT NOT NULL,
    "description" TEXT,
    "permissions" JSONB NOT NULL,
    "isBuiltin" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Account_slug_key" ON "Account"("slug");

-- CreateIndex
CREATE INDEX "Group_accountId_idx" ON "Group"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_plate_key" ON "Asset"("plate");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_vin_key" ON "Asset"("vin");

-- CreateIndex
CREATE INDEX "Asset_accountId_status_idx" ON "Asset"("accountId", "status");

-- CreateIndex
CREATE INDEX "Asset_groupId_idx" ON "Asset"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "Device_imei_key" ON "Device"("imei");

-- CreateIndex
CREATE UNIQUE INDEX "Device_simId_key" ON "Device"("simId");

-- CreateIndex
CREATE INDEX "Device_assetId_idx" ON "Device"("assetId");

-- CreateIndex
CREATE INDEX "Device_status_idx" ON "Device"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Sim_iccid_key" ON "Sim"("iccid");

-- CreateIndex
CREATE INDEX "Sim_status_idx" ON "Sim"("status");

-- CreateIndex
CREATE INDEX "Sim_carrier_idx" ON "Sim"("carrier");

-- CreateIndex
CREATE INDEX "Person_accountId_idx" ON "Person"("accountId");

-- CreateIndex
CREATE INDEX "LivePosition_recordedAt_idx" ON "LivePosition"("recordedAt");

-- CreateIndex
CREATE INDEX "LivePosition_speedKmh_idx" ON "LivePosition"("speedKmh");

-- CreateIndex
CREATE INDEX "Trip_startedAt_idx" ON "Trip"("startedAt");

-- CreateIndex
CREATE INDEX "Trip_assetId_startedAt_idx" ON "Trip"("assetId", "startedAt");

-- CreateIndex
CREATE INDEX "Trip_personId_startedAt_idx" ON "Trip"("personId", "startedAt");

-- CreateIndex
CREATE INDEX "AssetDriverDay_assetId_day_idx" ON "AssetDriverDay"("assetId", "day");

-- CreateIndex
CREATE INDEX "AssetDriverDay_personId_day_idx" ON "AssetDriverDay"("personId", "day");

-- CreateIndex
CREATE INDEX "AssetDriverDay_accountId_day_idx" ON "AssetDriverDay"("accountId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "AssetDriverDay_assetId_personId_day_key" ON "AssetDriverDay"("assetId", "personId", "day");

-- CreateIndex
CREATE INDEX "AssetWeeklyStats_assetId_weekStart_idx" ON "AssetWeeklyStats"("assetId", "weekStart");

-- CreateIndex
CREATE INDEX "AssetWeeklyStats_accountId_weekStart_idx" ON "AssetWeeklyStats"("accountId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "AssetWeeklyStats_assetId_weekStart_key" ON "AssetWeeklyStats"("assetId", "weekStart");

-- CreateIndex
CREATE INDEX "Position_assetId_recordedAt_idx" ON "Position"("assetId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Position_assetId_recordedAt_key" ON "Position"("assetId", "recordedAt");

-- CreateIndex
CREATE INDEX "Event_assetId_occurredAt_idx" ON "Event"("assetId", "occurredAt");

-- CreateIndex
CREATE INDEX "Event_personId_occurredAt_idx" ON "Event"("personId", "occurredAt");

-- CreateIndex
CREATE INDEX "Alarm_accountId_domain_status_triggeredAt_idx" ON "Alarm"("accountId", "domain", "status", "triggeredAt");

-- CreateIndex
CREATE INDEX "Alarm_assetId_triggeredAt_idx" ON "Alarm"("assetId", "triggeredAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_systemKey_key" ON "Profile"("systemKey");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_currentDriverId_fkey" FOREIGN KEY ("currentDriverId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_simId_fkey" FOREIGN KEY ("simId") REFERENCES "Sim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LivePosition" ADD CONSTRAINT "LivePosition_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetDriverDay" ADD CONSTRAINT "AssetDriverDay_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetDriverDay" ADD CONSTRAINT "AssetDriverDay_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetDriverDay" ADD CONSTRAINT "AssetDriverDay_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetWeeklyStats" ADD CONSTRAINT "AssetWeeklyStats_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetWeeklyStats" ADD CONSTRAINT "AssetWeeklyStats_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alarm" ADD CONSTRAINT "Alarm_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alarm" ADD CONSTRAINT "Alarm_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alarm" ADD CONSTRAINT "Alarm_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
