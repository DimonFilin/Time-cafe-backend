-- AlterTable
ALTER TABLE "network_guests" ADD COLUMN "phoneVerifyCodeHash" TEXT,
ADD COLUMN "phoneVerifyExpiresAt" TIMESTAMP(3);
