-- Restore business trigram indexes that were dropped by the favorite_partner
-- migration. These power the desk's cross-field text search on businesses.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "business_name_trgm_idx" ON "business" USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "business_description_trgm_idx" ON "business" USING GIN (description gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "business_keywords_trgm_idx" ON "business" USING GIN (keywords gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "business_address_trgm_idx" ON "business" USING GIN (address gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "business_sector_trgm_idx" ON "business" USING GIN (sector gin_trgm_ops);
