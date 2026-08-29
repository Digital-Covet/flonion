-- DropIndex
DROP INDEX "business_address_trgm_idx";

-- DropIndex
DROP INDEX "business_description_trgm_idx";

-- DropIndex
DROP INDEX "business_keywords_trgm_idx";

-- DropIndex
DROP INDEX "business_name_trgm_idx";

-- DropIndex
DROP INDEX "business_sector_trgm_idx";

-- CreateTable
CREATE TABLE "favorite_partner" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorite_partner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "favorite_partner_userId_idx" ON "favorite_partner"("userId");

-- CreateIndex
CREATE INDEX "favorite_partner_businessId_idx" ON "favorite_partner"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "favorite_partner_userId_businessId_key" ON "favorite_partner"("userId", "businessId");

-- CreateIndex
CREATE INDEX "business_sector_idx" ON "business"("sector");

-- CreateIndex
CREATE INDEX "business_rating_createdAt_idx" ON "business"("rating", "createdAt");

-- AddForeignKey
ALTER TABLE "favorite_partner" ADD CONSTRAINT "favorite_partner_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
