-- AlterTable
ALTER TABLE "users" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "worker_accounts" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Drop existing unique constraints
DROP INDEX IF EXISTS "users_keycloakId_key";
DROP INDEX IF EXISTS "users_email_key";
DROP INDEX IF EXISTS "worker_accounts_keycloakId_key";
DROP INDEX IF EXISTS "worker_accounts_email_key";

-- Create partial unique indexes (only for non-deleted records)
CREATE UNIQUE INDEX "users_keycloakId_deletedAt_key" ON "users"("keycloakId") WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX "users_email_deletedAt_key" ON "users"("email") WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX "worker_accounts_keycloakId_deletedAt_key" ON "worker_accounts"("keycloakId") WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX "worker_accounts_email_deletedAt_key" ON "worker_accounts"("email") WHERE "deletedAt" IS NULL;

