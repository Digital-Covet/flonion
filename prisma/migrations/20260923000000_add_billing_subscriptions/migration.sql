-- Cashfree subscriptions for paid plans.
--
-- "business"."plan" is only written by billing. "liveBusinessId" mirrors
-- "businessId" while a subscription is pending or active, so its unique
-- index allows one live mandate per business. "billing_payment"."cfPaymentId"
-- is unique so a payment can extend the paid period only once.

-- AlterTable
ALTER TABLE "business" ADD COLUMN     "plan" TEXT NOT NULL DEFAULT 'starter',
ADD COLUMN     "planExpiresAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "billing_subscription" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "cfSubscriptionId" TEXT,
    "businessId" TEXT NOT NULL,
    "liveBusinessId" TEXT,
    "createdById" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "billing" TEXT NOT NULL,
    "cfPlanId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INITIALIZED',
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_payment" (
    "id" TEXT NOT NULL,
    "cfPaymentId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "paymentType" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_subscription_subscriptionId_key" ON "billing_subscription"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "billing_subscription_liveBusinessId_key" ON "billing_subscription"("liveBusinessId");

-- CreateIndex
CREATE INDEX "billing_subscription_businessId_status_idx" ON "billing_subscription"("businessId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "billing_payment_cfPaymentId_key" ON "billing_payment"("cfPaymentId");

-- CreateIndex
CREATE INDEX "billing_payment_subscriptionId_idx" ON "billing_payment"("subscriptionId");

-- AddForeignKey
ALTER TABLE "billing_subscription" ADD CONSTRAINT "billing_subscription_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_payment" ADD CONSTRAINT "billing_payment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "billing_subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Billing records are financial history: archive them on delete like the
-- other business-data tables (see the archive_deleted_records migration).
CREATE TRIGGER "billing_subscription_archive_delete" AFTER DELETE ON "billing_subscription"
  FOR EACH ROW EXECUTE FUNCTION archive_deleted_row();
CREATE TRIGGER "billing_payment_archive_delete" AFTER DELETE ON "billing_payment"
  FOR EACH ROW EXECUTE FUNCTION archive_deleted_row();
