-- Keep deleted business data for at least a year.
--
-- Deletes happen in two apps (this one and the desk) and through
-- ON DELETE CASCADE, so they are caught in the database: an AFTER DELETE
-- trigger copies each removed row into "deleted_record" before it is gone.
-- The live tables stay as they are, so no query needs a "deletedAt" filter
-- and a deleted user's email can sign up again.

-- CreateTable
CREATE TABLE "deleted_record" (
    "id" BIGSERIAL NOT NULL,
    "tableName" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "txId" BIGINT NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purgeAfter" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deleted_record_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deleted_record_tableName_recordId_idx" ON "deleted_record"("tableName", "recordId");

-- CreateIndex
CREATE INDEX "deleted_record_txId_idx" ON "deleted_record"("txId");

-- CreateIndex
CREATE INDEX "deleted_record_purgeAfter_idx" ON "deleted_record"("purgeAfter");

-- Trigger arguments name columns to leave out of the copy (secrets).
CREATE OR REPLACE FUNCTION archive_deleted_row() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  row_data jsonb := to_jsonb(OLD);
BEGIN
  FOR i IN 0 .. TG_NARGS - 1 LOOP
    row_data := row_data - TG_ARGV[i];
  END LOOP;

  INSERT INTO "deleted_record" ("tableName", "recordId", "data", "txId", "purgeAfter")
  VALUES (
    TG_TABLE_NAME,
    row_data ->> 'id',
    row_data,
    txid_current(),
    CURRENT_TIMESTAMP + INTERVAL '1 year'
  );

  RETURN OLD;
END;
$$;

-- Returns how many archived rows were dropped.
CREATE OR REPLACE FUNCTION purge_deleted_records() RETURNS integer
LANGUAGE sql AS $$
  WITH gone AS (
    DELETE FROM "deleted_record" WHERE "purgeAfter" < CURRENT_TIMESTAMP RETURNING 1
  )
  SELECT count(*)::integer FROM gone;
$$;

-- Business data. Left out on purpose: session, verification, account,
-- "twoFactor" and google_token (credentials, not data worth keeping),
-- availability_slot (free slots are rebuilt on every regenerate; booked ones
-- live on in meeting_request) and favorite_partner (a toggle).
CREATE TRIGGER "user_archive_delete" AFTER DELETE ON "user"
  FOR EACH ROW EXECUTE FUNCTION archive_deleted_row();
CREATE TRIGGER "business_archive_delete" AFTER DELETE ON "business"
  FOR EACH ROW EXECUTE FUNCTION archive_deleted_row();
CREATE TRIGGER "meeting_request_archive_delete" AFTER DELETE ON "meeting_request"
  FOR EACH ROW EXECUTE FUNCTION archive_deleted_row();
CREATE TRIGGER "team_meeting_archive_delete" AFTER DELETE ON "team_meeting"
  FOR EACH ROW EXECUTE FUNCTION archive_deleted_row();
CREATE TRIGGER "shared_review_archive_delete" AFTER DELETE ON "shared_review"
  FOR EACH ROW EXECUTE FUNCTION archive_deleted_row();
CREATE TRIGGER "review_analytics_archive_delete" AFTER DELETE ON "review_analytics"
  FOR EACH ROW EXECUTE FUNCTION archive_deleted_row();
CREATE TRIGGER "feedback_archive_delete" AFTER DELETE ON "feedback"
  FOR EACH ROW EXECUTE FUNCTION archive_deleted_row();
CREATE TRIGGER "feedback_reply_archive_delete" AFTER DELETE ON "feedback_reply"
  FOR EACH ROW EXECUTE FUNCTION archive_deleted_row();
CREATE TRIGGER "task_archive_delete" AFTER DELETE ON "task"
  FOR EACH ROW EXECUTE FUNCTION archive_deleted_row();
CREATE TRIGGER "invitation_archive_delete" AFTER DELETE ON "invitation"
  FOR EACH ROW EXECUTE FUNCTION archive_deleted_row('token');
CREATE TRIGGER "join_request_archive_delete" AFTER DELETE ON "join_request"
  FOR EACH ROW EXECUTE FUNCTION archive_deleted_row();
CREATE TRIGGER "service_archive_delete" AFTER DELETE ON "service"
  FOR EACH ROW EXECUTE FUNCTION archive_deleted_row();
CREATE TRIGGER "project_archive_delete" AFTER DELETE ON "project"
  FOR EACH ROW EXECUTE FUNCTION archive_deleted_row();
CREATE TRIGGER "business_contact_archive_delete" AFTER DELETE ON "business_contact"
  FOR EACH ROW EXECUTE FUNCTION archive_deleted_row();
