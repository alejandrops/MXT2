-- CreateTable
CREATE TABLE "DriverBoletinSnapshot" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "accountId" TEXT,
    "payload" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'onDemand',

    CONSTRAINT "DriverBoletinSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupBoletinSnapshot" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "accountId" TEXT,
    "payload" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'onDemand',

    CONSTRAINT "GroupBoletinSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountBoletinSnapshot" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'onDemand',

    CONSTRAINT "AccountBoletinSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DriverBoletinSnapshot_generatedAt_idx" ON "DriverBoletinSnapshot"("generatedAt");

-- CreateIndex
CREATE INDEX "DriverBoletinSnapshot_accountId_period_idx" ON "DriverBoletinSnapshot"("accountId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "DriverBoletinSnapshot_driverId_period_key" ON "DriverBoletinSnapshot"("driverId", "period");

-- CreateIndex
CREATE INDEX "GroupBoletinSnapshot_generatedAt_idx" ON "GroupBoletinSnapshot"("generatedAt");

-- CreateIndex
CREATE INDEX "GroupBoletinSnapshot_accountId_period_idx" ON "GroupBoletinSnapshot"("accountId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "GroupBoletinSnapshot_groupId_period_key" ON "GroupBoletinSnapshot"("groupId", "period");

-- CreateIndex
CREATE INDEX "AccountBoletinSnapshot_generatedAt_idx" ON "AccountBoletinSnapshot"("generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AccountBoletinSnapshot_accountId_period_key" ON "AccountBoletinSnapshot"("accountId", "period");

-- AddForeignKey
ALTER TABLE "DriverBoletinSnapshot" ADD CONSTRAINT "DriverBoletinSnapshot_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupBoletinSnapshot" ADD CONSTRAINT "GroupBoletinSnapshot_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountBoletinSnapshot" ADD CONSTRAINT "AccountBoletinSnapshot_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
