-- CreateTable
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "business_name_trgm_idx" ON "business" USING GIN (name gin_trgm_ops);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "business_description_trgm_idx" ON "business" USING GIN (description gin_trgm_ops);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "business_keywords_trgm_idx" ON "business" USING GIN (keywords gin_trgm_ops);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "business_sector_trgm_idx" ON "business" USING GIN (sector gin_trgm_ops);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "business_address_trgm_idx" ON "business" USING GIN (address gin_trgm_ops);
