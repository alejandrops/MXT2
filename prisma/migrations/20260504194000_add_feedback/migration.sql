-- S1-L8 feedback-widget · Feedback table

-- Enums
CREATE TYPE "FeedbackCategory" AS ENUM ('BUG', 'FEATURE', 'OTHER');
CREATE TYPE "FeedbackStatus" AS ENUM ('NEW', 'REVIEWED', 'CLOSED');

-- Table
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "accountId" TEXT,
    "userId" TEXT,
    "category" "FeedbackCategory" NOT NULL DEFAULT 'OTHER',
    "message" TEXT NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "viewport" TEXT,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "adminNotes" TEXT,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "Feedback"
  ADD CONSTRAINT "Feedback_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "Feedback_status_createdAt_idx"
  ON "Feedback"("status", "createdAt");

CREATE INDEX "Feedback_accountId_createdAt_idx"
  ON "Feedback"("accountId", "createdAt");
