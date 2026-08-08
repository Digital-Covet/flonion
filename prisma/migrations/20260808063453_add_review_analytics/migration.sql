-- AlterTable
ALTER TABLE "business" ADD COLUMN     "keywords" TEXT,
ADD COLUMN     "reviewLink" TEXT,
ADD COLUMN     "reviewLinks" JSONB;

-- AlterTable
ALTER TABLE "shared_review" ADD COLUMN     "keywords" TEXT;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "review_analytics" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "visitCount" INTEGER NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "review_analytics_reviewId_key" ON "review_analytics"("reviewId");

-- CreateIndex
CREATE INDEX "review_analytics_reviewId_idx" ON "review_analytics"("reviewId");

-- AddForeignKey
ALTER TABLE "review_analytics" ADD CONSTRAINT "review_analytics_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "shared_review"("id") ON DELETE CASCADE ON UPDATE CASCADE;
