-- CreateEnum
CREATE TYPE "GiftStatus" AS ENUM ('PENDING', 'FUNDED', 'CLAIMED', 'EXPIRED', 'REFUNDED');

-- CreateTable
CREATE TABLE "Gift" (
    "id" TEXT NOT NULL,
    "giftCode" TEXT NOT NULL,
    "senderAddress" TEXT NOT NULL,
    "recipientAddress" TEXT,
    "amount" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "transactionHash" TEXT,
    "claimTransaction" TEXT,
    "status" "GiftStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "giftId" TEXT NOT NULL,
    "referrerAddress" TEXT NOT NULL,
    "referredAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Gift_giftCode_key" ON "Gift"("giftCode");

-- CreateIndex
CREATE UNIQUE INDEX "Gift_transactionHash_key" ON "Gift"("transactionHash");

-- CreateIndex
CREATE UNIQUE INDEX "Gift_claimTransaction_key" ON "Gift"("claimTransaction");

-- CreateIndex
CREATE INDEX "Gift_senderAddress_idx" ON "Gift"("senderAddress");

-- CreateIndex
CREATE INDEX "Gift_recipientAddress_idx" ON "Gift"("recipientAddress");

-- CreateIndex
CREATE INDEX "Gift_status_expiresAt_idx" ON "Gift"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_giftId_key" ON "Referral"("giftId");

-- CreateIndex
CREATE INDEX "Referral_referrerAddress_idx" ON "Referral"("referrerAddress");

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_giftId_fkey" FOREIGN KEY ("giftId") REFERENCES "Gift"("id") ON DELETE CASCADE ON UPDATE CASCADE;
