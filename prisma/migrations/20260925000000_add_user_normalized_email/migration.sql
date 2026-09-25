-- better-auth-harmony email normalization.
--
-- Nullable so existing rows migrate without a value; run
-- scripts/backfill-normalized-email.ts afterwards to fill them in. NULLs don't
-- collide under a Postgres unique index.

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "normalizedEmail" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "user_normalizedEmail_key" ON "user"("normalizedEmail");
