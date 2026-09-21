-- Business moderation and support-inbox replies for the operator console.
-- Every added column is defaulted or nullable, so existing rows stay active and
-- visible and no tenant code path changes until it reads the new columns.

-- AlterTable
ALTER TABLE "business" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN     "suspendReason" TEXT,
ADD COLUMN     "suspendedById" TEXT,
ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "marketplaceHidden" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "feedback_reply" (
    "id" TEXT NOT NULL,
    "feedbackId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "operatorLabel" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "deliveryStatus" TEXT NOT NULL DEFAULT 'sent',
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_reply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "business_status_marketplaceHidden_idx" ON "business"("status", "marketplaceHidden");

-- CreateIndex
CREATE INDEX "feedback_reply_feedbackId_createdAt_idx" ON "feedback_reply"("feedbackId", "createdAt");

-- AddForeignKey
ALTER TABLE "feedback_reply" ADD CONSTRAINT "feedback_reply_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "feedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;
