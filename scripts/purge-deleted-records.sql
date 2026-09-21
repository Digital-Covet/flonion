-- Drop archived deletes older than a year (see the DeletedRecord model).
-- Safe to run as often as you like; schedule it daily so the archive doesn't
-- grow forever: pnpm db:purge-deleted
SELECT purge_deleted_records();
