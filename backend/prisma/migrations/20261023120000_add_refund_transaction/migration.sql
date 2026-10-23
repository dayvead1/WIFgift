ALTER TABLE "Gift" ADD COLUMN "refundTransaction" TEXT;

CREATE UNIQUE INDEX "Gift_refundTransaction_key" ON "Gift"("refundTransaction");
