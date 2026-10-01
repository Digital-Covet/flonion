-- When a task was finished, for the kanban's month-by-month calendar.
--
-- Tasks already in Done never recorded the moment they got there; their last
-- update is the closest thing we have.

-- AlterTable
ALTER TABLE "task" ADD COLUMN     "completedAt" TIMESTAMP(3);

-- Backfill
UPDATE "task" SET "completedAt" = "updatedAt" WHERE "column" = 'done';
