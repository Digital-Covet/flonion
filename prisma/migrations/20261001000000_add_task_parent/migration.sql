-- Subtasks: a task may point at one parent task; deleting the parent removes
-- its subtasks with it.

-- AlterTable
ALTER TABLE "task" ADD COLUMN     "parentId" TEXT;

-- CreateIndex
CREATE INDEX "task_parentId_idx" ON "task"("parentId");

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
