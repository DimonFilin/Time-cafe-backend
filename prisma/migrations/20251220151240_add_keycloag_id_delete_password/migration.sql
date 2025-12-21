/*
  Warnings:

  - You are about to drop the column `password` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `worker_accounts` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[keycloakId]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[keycloakId]` on the table `worker_accounts` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `keycloakId` to the `users` table without a default value. This is not possible if the table is not empty.
  - Added the required column `keycloakId` to the `worker_accounts` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "users" DROP COLUMN "password",
ADD COLUMN     "keycloakId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "worker_accounts" DROP COLUMN "password",
ADD COLUMN     "keycloakId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_keycloakId_key" ON "users"("keycloakId");

-- CreateIndex
CREATE UNIQUE INDEX "worker_accounts_keycloakId_key" ON "worker_accounts"("keycloakId");
