-- Operator console: usage ledger, audit trail, and the moderation columns the
-- back-office needs. Nothing here changes tenant-app behaviour on its own; every
-- added column is nullable or defaulted, so existing code paths are unaffected.

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "banned" BOOLEAN DEFAULT false,
ADD COLUMN     "banReason" TEXT,
ADD COLUMN     "banExpires" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "session" ADD COLUMN     "impersonatedBy" TEXT;

-- AlterTable
ALTER TABLE "business" ADD COLUMN     "ratingUpdatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "shared_review" ADD COLUMN     "businessId" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'visible',
ADD COLUMN     "hiddenById" TEXT,
ADD COLUMN     "hiddenAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "feedback" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'new',
ADD COLUMN     "assignedTo" TEXT,
ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "operatorNote" TEXT;

-- CreateTable
CREATE TABLE "ai_usage" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "businessId" TEXT,
    "endpoint" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DECIMAL(12,6),
    "latencyMs" INTEGER NOT NULL,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "errorKind" TEXT,
    "reviewId" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "note" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shared_review_businessId_idx" ON "shared_review"("businessId");

-- CreateIndex
CREATE INDEX "shared_review_status_idx" ON "shared_review"("status");

-- CreateIndex
CREATE INDEX "feedback_status_createdAt_idx" ON "feedback"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ai_usage_createdAt_idx" ON "ai_usage"("createdAt");

-- CreateIndex
CREATE INDEX "ai_usage_userId_createdAt_idx" ON "ai_usage"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_usage_businessId_createdAt_idx" ON "ai_usage"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_usage_endpoint_createdAt_idx" ON "ai_usage"("endpoint", "createdAt");

-- CreateIndex
CREATE INDEX "audit_log_entity_entityId_createdAt_idx" ON "audit_log"("entity", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_log_operatorId_createdAt_idx" ON "audit_log"("operatorId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_log_createdAt_idx" ON "audit_log"("createdAt");

-- AddForeignKey
-- SET NULL, not CASCADE: deleting a business must not delete the reviews
-- written about it. The review still belongs to its author either way.
ALTER TABLE "shared_review" ADD CONSTRAINT "shared_review_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill shared_review.businessId from the author's business.
--
-- A user reaches a business through exactly one of two links: the business they
-- own (business.userId), or the team they belong to (user.businessId). Never
-- both. COALESCE encodes that precedence, and rows whose author has neither stay
-- NULL, which is a real state -- a member who left a team has unattached reviews.
UPDATE "shared_review" sr
SET "businessId" = COALESCE(
    (SELECT b."id" FROM "business" b WHERE b."userId" = sr."userId"),
    (SELECT u."businessId" FROM "user" u WHERE u."id" = sr."userId")
)
WHERE sr."businessId" IS NULL;

-- Trigram indexes for the console's text search.
--
-- Only "business" had these before, so every other section's search would be a
-- sequential scan. pg_trgm is already installed by an earlier migration; the
-- guard keeps this runnable against a database where it is not.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "user_name_trgm_idx" ON "user" USING GIN (name gin_trgm_ops);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "user_email_trgm_idx" ON "user" USING GIN (email gin_trgm_ops);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "shared_review_text_trgm_idx" ON "shared_review" USING GIN (text gin_trgm_ops);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "feedback_message_trgm_idx" ON "feedback" USING GIN (message gin_trgm_ops);
