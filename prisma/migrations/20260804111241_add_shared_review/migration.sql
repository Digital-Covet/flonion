-- CreateTable
CREATE TABLE "shared_review" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "reviewerName" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shared_review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shared_review_userId_idx" ON "shared_review"("userId");

-- AddForeignKey
ALTER TABLE "shared_review" ADD CONSTRAINT "shared_review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
