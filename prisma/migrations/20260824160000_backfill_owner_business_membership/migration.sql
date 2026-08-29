-- Backfill team membership for existing business owners.
--
-- `user."businessId"` is only ever written by POST /api/business, so accounts
-- that onboarded before that write existed were left NULL. Every team-scoped
-- route resolves the acting business from that column, so those owners could
-- not invite anyone, see their own team list, or manage invitations.
--
-- Idempotent: only touches owners whose membership is still unset.
UPDATE "user" u
SET "businessId" = b.id
FROM "business" b
WHERE b."userId" = u.id
  AND u."businessId" IS NULL;
