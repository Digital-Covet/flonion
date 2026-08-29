-- CreateTable
CREATE TABLE "availability_slot" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isBooked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "availability_slot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_request" (
    "id" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "availability_slot_businessId_date_idx" ON "availability_slot"("businessId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "availability_slot_businessId_date_startTime_key" ON "availability_slot"("businessId", "date", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_request_slotId_key" ON "meeting_request"("slotId");

-- CreateIndex
CREATE INDEX "meeting_request_businessId_status_idx" ON "meeting_request"("businessId", "status");

-- CreateIndex
CREATE INDEX "meeting_request_requesterId_idx" ON "meeting_request"("requesterId");

-- AddForeignKey
ALTER TABLE "availability_slot" ADD CONSTRAINT "availability_slot_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_request" ADD CONSTRAINT "meeting_request_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "availability_slot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_request" ADD CONSTRAINT "meeting_request_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_request" ADD CONSTRAINT "meeting_request_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
