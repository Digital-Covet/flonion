-- Added task columns: a team adds columns (text, number, link, tags, ...) to
-- its task table and fills them in per task. Deleting a team, a column or a
-- task removes the matching rows.

-- CreateTable
CREATE TABLE "task_field" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_field_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_field_value" (
    "taskId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_field_value_pkey" PRIMARY KEY ("taskId","fieldId")
);

-- CreateIndex
CREATE INDEX "task_field_businessId_position_idx" ON "task_field"("businessId", "position");

-- CreateIndex
CREATE INDEX "task_field_value_fieldId_idx" ON "task_field_value"("fieldId");

-- AddForeignKey
ALTER TABLE "task_field" ADD CONSTRAINT "task_field_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_field_value" ADD CONSTRAINT "task_field_value_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_field_value" ADD CONSTRAINT "task_field_value_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "task_field"("id") ON DELETE CASCADE ON UPDATE CASCADE;
