-- Remove unique constraints on keycloakId and email for worker_accounts to support multi-account feature
-- This allows multiple WorkerAccount records with the same keycloakId and email but different roles

-- Drop the unique indexes created in add_soft_delete migration
DROP INDEX IF EXISTS "worker_accounts_keycloakId_deletedAt_key";
DROP INDEX IF EXISTS "worker_accounts_email_deletedAt_key";

-- Drop the unique indexes created in add_keycloag_id_delete_password migration
DROP INDEX IF EXISTS "worker_accounts_keycloakId_key";
DROP INDEX IF EXISTS "worker_accounts_email_key";

-- Note: We remove unique constraints to allow multiple active accounts 
-- with the same keycloakId and email but different roles

