-- S1-L7 cron-scaffold · BoletinSnapshot table
-- Cache pre-computed monthly bulletin payloads.

CREATE TABLE "BoletinSnapshot" (
    "id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "accountId" TEXT,
    "payload" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'cron',

    CONSTRAINT "BoletinSnapshot_pkey" PRIMARY KEY ("id")
);

-- Unicidad por (period, accountId) · un snapshot por mes/account
CREATE UNIQUE INDEX "BoletinSnapshot_period_accountId_key"
  ON "BoletinSnapshot"("period", "accountId");

-- Index por generatedAt para limpieza/análisis temporal
CREATE INDEX "BoletinSnapshot_generatedAt_idx"
  ON "BoletinSnapshot"("generatedAt");
