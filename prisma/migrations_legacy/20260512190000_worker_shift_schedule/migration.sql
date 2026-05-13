-- CreateEnum
CREATE TYPE "WorkerScheduleAbsenceKind" AS ENUM ('VACATION', 'SICK_LEAVE');

-- AlterTable
ALTER TABLE "worker_accounts" ADD COLUMN "shiftSchedule" JSONB;

-- CreateTable
CREATE TABLE "worker_schedule_absences" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "kind" "WorkerScheduleAbsenceKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByWorkerId" TEXT,

    CONSTRAINT "worker_schedule_absences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "worker_schedule_absences_workerId_startDate_idx" ON "worker_schedule_absences"("workerId", "startDate");

-- AddForeignKey
ALTER TABLE "worker_schedule_absences" ADD CONSTRAINT "worker_schedule_absences_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "worker_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
