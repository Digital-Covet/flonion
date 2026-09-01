-- AlterTable: Add schedule settings to business
ALTER TABLE "business" ADD COLUMN "workingDays" TEXT NOT NULL DEFAULT '1,2,3,4,5',
ADD COLUMN "workingStartTime" TEXT NOT NULL DEFAULT '09:00',
ADD COLUMN "workingEndTime" TEXT NOT NULL DEFAULT '18:00',
ADD COLUMN "bookingStartTime" TEXT NOT NULL DEFAULT '14:00',
ADD COLUMN "bookingEndTime" TEXT NOT NULL DEFAULT '17:00',
ADD COLUMN "slotDuration" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata';

-- AlterTable: Add title to availability_slot
ALTER TABLE "availability_slot" ADD COLUMN "title" TEXT;
