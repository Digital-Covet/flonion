-- Backfill SharedReview.businessId for existing rows.
--
-- A review belongs to a person, and that person reaches a business through
-- either ownership (Business.userId) or membership (User.businessId). This
-- script sets businessId on every review where it is currently NULL.
--
-- Run AFTER the migration that adds the businessId column.
--
-- Usage:
--   psql $DATABASE_URL -f scripts/backfill-review-business-id.sql

UPDATE shared_review sr
SET business_id = COALESCE(
  -- Prefer the user's owned business
  (SELECT b.id FROM business b WHERE b.user_id = sr.user_id),
  -- Fall back to the user's team membership
  (SELECT u.business_id FROM "user" u WHERE u.id = sr.user_id AND u.business_id IS NOT NULL)
)
WHERE sr.business_id IS NULL;
