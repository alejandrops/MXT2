-- CreateTable
CREATE TABLE "AccountSettings" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "speedLimitUrban" INTEGER NOT NULL DEFAULT 60,
    "speedLimitHighway" INTEGER NOT NULL DEFAULT 100,
    "speedTolerancePercent" INTEGER NOT NULL DEFAULT 10,
    "harshBrakingThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.35,
    "harshAccelerationThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.35,
    "harshCorneringThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.40,
    "idlingMinDuration" INTEGER NOT NULL DEFAULT 300,
    "tripMinDistanceKm" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "tripMinDurationSec" INTEGER NOT NULL DEFAULT 60,
    "alertContactEmail" TEXT,
    "alertContactPhone" TEXT,
    "integrations" JSONB NOT NULL DEFAULT '{}',
    "planOverrides" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountSettings_accountId_key" ON "AccountSettings"("accountId");

-- AddForeignKey
ALTER TABLE "AccountSettings" ADD CONSTRAINT "AccountSettings_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
