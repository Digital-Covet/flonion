-- DropForeignKey
ALTER TABLE "meeting_request" DROP CONSTRAINT "meeting_request_requesterId_fkey";

-- AlterTable
ALTER TABLE "meeting_request" ADD COLUMN     "guestEmail" TEXT,
ADD COLUMN     "guestName" TEXT,
ADD COLUMN     "guestPhone" TEXT,
ALTER COLUMN "requesterId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "meeting_request" ADD CONSTRAINT "meeting_request_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
