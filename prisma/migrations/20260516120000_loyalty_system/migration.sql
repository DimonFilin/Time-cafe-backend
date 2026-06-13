-- CreateEnum
CREATE TYPE "GuestStatus" AS ENUM ('DRAFT', 'ACTIVE', 'REFUSED');

-- CreateEnum
CREATE TYPE "PendingBonusStatus" AS ENUM ('SCHEDULED', 'CREDITED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WalletEntryType" AS ENUM ('TOP_UP_CASH', 'TOP_UP_CARD', 'TOP_UP_MOBILE', 'VISIT_CHARGE', 'LOYALTY_BONUS', 'DEBT_REPAYMENT', 'REFUND', 'ADJUSTMENT');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "pushToken" TEXT;

-- CreateTable
CREATE TABLE "platform_loyalty_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "accrualDelayHours" INTEGER NOT NULL DEFAULT 120,
    "minTopUpForBonus" DECIMAL(10,2) NOT NULL DEFAULT 20,
    "tierPercentChangeCooldownHours" INTEGER NOT NULL DEFAULT 24,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_loyalty_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_tiers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bonusPercent" DECIMAL(5,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "percentLockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "network_guests" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "registrationCafeId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "patronymic" TEXT,
    "phone" TEXT NOT NULL,
    "phoneVerifiedAt" TIMESTAMP(3),
    "email" TEXT,
    "birthDate" TIMESTAMP(3),
    "gender" "Gender",
    "accessCardNumber" TEXT,
    "status" "GuestStatus" NOT NULL DEFAULT 'DRAFT',
    "depositBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "debt" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "loyaltyTierId" TEXT,
    "loyaltyWelcomeShownAt" TIMESTAMP(3),
    "refusedReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "network_guests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_tier_history" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "fromTierId" TEXT,
    "toTierId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_tier_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_ledger_entries" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "brandId" TEXT,
    "cafeId" TEXT,
    "type" "WalletEntryType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "depositAfter" DECIMAL(12,2) NOT NULL,
    "debtAfter" DECIMAL(12,2) NOT NULL,
    "referenceId" TEXT,
    "createdBy" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_loyalty_bonuses" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "brandId" TEXT,
    "cafeId" TEXT,
    "topUpLedgerId" TEXT NOT NULL,
    "topUpAmount" DECIMAL(12,2) NOT NULL,
    "bonusPercent" DECIMAL(5,2) NOT NULL,
    "bonusAmount" DECIMAL(12,2) NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "PendingBonusStatus" NOT NULL DEFAULT 'SCHEDULED',
    "creditedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_loyalty_bonuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "network_guests_userId_key" ON "network_guests"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "network_guests_phone_key" ON "network_guests"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "network_guests_accessCardNumber_key" ON "network_guests"("accessCardNumber");

-- CreateIndex
CREATE INDEX "network_guests_status_idx" ON "network_guests"("status");

-- CreateIndex
CREATE INDEX "network_guests_loyaltyTierId_idx" ON "network_guests"("loyaltyTierId");

-- CreateIndex
CREATE INDEX "loyalty_tier_history_guestId_createdAt_idx" ON "loyalty_tier_history"("guestId", "createdAt");

-- CreateIndex
CREATE INDEX "wallet_ledger_entries_guestId_createdAt_idx" ON "wallet_ledger_entries"("guestId", "createdAt");

-- CreateIndex
CREATE INDEX "wallet_ledger_entries_brandId_createdAt_idx" ON "wallet_ledger_entries"("brandId", "createdAt");

-- CreateIndex
CREATE INDEX "wallet_ledger_entries_type_createdAt_idx" ON "wallet_ledger_entries"("type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "pending_loyalty_bonuses_topUpLedgerId_key" ON "pending_loyalty_bonuses"("topUpLedgerId");

-- CreateIndex
CREATE INDEX "pending_loyalty_bonuses_status_scheduledAt_idx" ON "pending_loyalty_bonuses"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "pending_loyalty_bonuses_guestId_idx" ON "pending_loyalty_bonuses"("guestId");

-- CreateIndex
CREATE INDEX "user_notifications_userId_readAt_idx" ON "user_notifications"("userId", "readAt");

-- CreateIndex
CREATE INDEX "user_notifications_userId_createdAt_idx" ON "user_notifications"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "network_guests" ADD CONSTRAINT "network_guests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "network_guests" ADD CONSTRAINT "network_guests_registrationCafeId_fkey" FOREIGN KEY ("registrationCafeId") REFERENCES "cafes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "network_guests" ADD CONSTRAINT "network_guests_loyaltyTierId_fkey" FOREIGN KEY ("loyaltyTierId") REFERENCES "loyalty_tiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_tier_history" ADD CONSTRAINT "loyalty_tier_history_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "network_guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_tier_history" ADD CONSTRAINT "loyalty_tier_history_fromTierId_fkey" FOREIGN KEY ("fromTierId") REFERENCES "loyalty_tiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_tier_history" ADD CONSTRAINT "loyalty_tier_history_toTierId_fkey" FOREIGN KEY ("toTierId") REFERENCES "loyalty_tiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_ledger_entries" ADD CONSTRAINT "wallet_ledger_entries_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "network_guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_loyalty_bonuses" ADD CONSTRAINT "pending_loyalty_bonuses_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "network_guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_loyalty_bonuses" ADD CONSTRAINT "pending_loyalty_bonuses_topUpLedgerId_fkey" FOREIGN KEY ("topUpLedgerId") REFERENCES "wallet_ledger_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
