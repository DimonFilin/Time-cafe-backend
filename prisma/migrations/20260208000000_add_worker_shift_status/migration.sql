-- CreateEnum
CREATE TYPE "WorkerShiftStatus" AS ENUM ('ON_SHIFT', 'OFF_SHIFT');

-- AlterTable
ALTER TABLE "worker_accounts" ADD COLUMN "shiftStatus" "WorkerShiftStatus" NOT NULL DEFAULT 'OFF_SHIFT';
