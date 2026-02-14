-- CreateEnum
CREATE TYPE "TaskCategory" AS ENUM ('OPENING', 'SHIFT', 'CLOSING', 'GENERAL');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "TaskAssignmentType" AS ENUM ('ALL_WORKERS', 'SPECIFIC_WORKERS', 'ROLE_BASED');

-- CreateTable
CREATE TABLE "task_templates" (
    "id" TEXT NOT NULL,
    "cafeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "TaskCategory" NOT NULL,
    "priority" "TaskPriority" NOT NULL,
    "requiresPhoto" BOOLEAN NOT NULL DEFAULT false,
    "requiresComment" BOOLEAN NOT NULL DEFAULT false,
    "estimatedMinutes" INTEGER,
    "assignmentType" "TaskAssignmentType" NOT NULL,
    "assignedWorkerIds" TEXT[],
    "assignedRoles" "WorkerRole"[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "daysOfWeek" INTEGER[],
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_completions" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completionDate" TIMESTAMP(3) NOT NULL,
    "photoUrl" TEXT,
    "comment" TEXT,
    "durationMinutes" INTEGER,

    CONSTRAINT "task_completions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_templates_cafeId_idx" ON "task_templates"("cafeId");

-- CreateIndex
CREATE INDEX "task_templates_cafeId_isActive_idx" ON "task_templates"("cafeId", "isActive");

-- CreateIndex
CREATE INDEX "task_templates_cafeId_category_idx" ON "task_templates"("cafeId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "task_completions_templateId_workerId_completionDate_key" ON "task_completions"("templateId", "workerId", "completionDate");

-- CreateIndex
CREATE INDEX "task_completions_templateId_completionDate_idx" ON "task_completions"("templateId", "completionDate");

-- CreateIndex
CREATE INDEX "task_completions_workerId_completionDate_idx" ON "task_completions"("workerId", "completionDate");

-- CreateIndex
CREATE INDEX "task_completions_completionDate_idx" ON "task_completions"("completionDate");

-- AddForeignKey
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "cafes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "worker_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_completions" ADD CONSTRAINT "task_completions_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "task_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_completions" ADD CONSTRAINT "task_completions_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "worker_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
