-- Cafe chat settings
ALTER TABLE "cafes" ADD COLUMN "chatSettings" JSONB;

-- Enums
CREATE TYPE "ChatNotificationMode" AS ENUM ('ALL_WORKERS', 'ROLE_BASED', 'SPECIFIC_WORKERS');
CREATE TYPE "ChatAuthorType" AS ENUM ('USER', 'WORKER');
CREATE TYPE "ChatMessageType" AS ENUM ('TEXT', 'IMAGE', 'MIXED', 'SYSTEM');
CREATE TYPE "ChatAttachmentStatus" AS ENUM ('UPLOADING', 'UPLOADED', 'FAILED');

-- Core chat table (1:1 with order)
CREATE TABLE "order_chats" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "cafeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brandId" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "notificationMode" "ChatNotificationMode" NOT NULL DEFAULT 'ALL_WORKERS',
    "notificationRoles" "WorkerRole"[] DEFAULT ARRAY[]::"WorkerRole"[],
    "notificationWorkerIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "theme" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "order_chats_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "order_chats_orderId_key" ON "order_chats"("orderId");
CREATE INDEX "order_chats_cafeId_updatedAt_idx" ON "order_chats"("cafeId", "updatedAt" DESC);
CREATE INDEX "order_chats_brandId_updatedAt_idx" ON "order_chats"("brandId", "updatedAt" DESC);
CREATE INDEX "order_chats_userId_updatedAt_idx" ON "order_chats"("userId", "updatedAt" DESC);

-- Messages
CREATE TABLE "order_chat_messages" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "cafeId" TEXT NOT NULL,
    "authorType" "ChatAuthorType" NOT NULL,
    "authorUserId" TEXT,
    "authorWorkerId" TEXT,
    "messageType" "ChatMessageType" NOT NULL DEFAULT 'TEXT',
    "text" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "order_chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "order_chat_messages_chatId_createdAt_idx" ON "order_chat_messages"("chatId", "createdAt");
CREATE INDEX "order_chat_messages_orderId_createdAt_idx" ON "order_chat_messages"("orderId", "createdAt");
CREATE INDEX "order_chat_messages_cafeId_createdAt_idx" ON "order_chat_messages"("cafeId", "createdAt");

-- Attachments
CREATE TABLE "order_chat_attachments" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "messageId" TEXT,
    "bucket" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "status" "ChatAttachmentStatus" NOT NULL DEFAULT 'UPLOADED',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "order_chat_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "order_chat_attachments_messageId_sortOrder_idx" ON "order_chat_attachments"("messageId", "sortOrder");
CREATE INDEX "order_chat_attachments_chatId_createdAt_idx" ON "order_chat_attachments"("chatId", "createdAt");

-- Read state
CREATE TABLE "order_chat_read_states" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "userId" TEXT,
    "workerId" TEXT,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "lastReadMessageId" TEXT,
    "lastReadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "order_chat_read_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "order_chat_read_states_chatId_userId_key" ON "order_chat_read_states"("chatId", "userId");
CREATE UNIQUE INDEX "order_chat_read_states_chatId_workerId_key" ON "order_chat_read_states"("chatId", "workerId");
CREATE INDEX "order_chat_read_states_chatId_unreadCount_idx" ON "order_chat_read_states"("chatId", "unreadCount");

-- Typing state
CREATE TABLE "order_chat_typing_states" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "userId" TEXT,
    "workerId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "order_chat_typing_states_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "order_chat_typing_states_chatId_expiresAt_idx" ON "order_chat_typing_states"("chatId", "expiresAt");

-- FKs
ALTER TABLE "order_chats"
  ADD CONSTRAINT "order_chats_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "order_chats_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "cafes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "order_chats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "order_chats_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "order_chat_messages"
  ADD CONSTRAINT "order_chat_messages_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "order_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "order_chat_messages_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "order_chat_messages_authorWorkerId_fkey" FOREIGN KEY ("authorWorkerId") REFERENCES "worker_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "order_chat_attachments"
  ADD CONSTRAINT "order_chat_attachments_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "order_chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_chat_read_states"
  ADD CONSTRAINT "order_chat_read_states_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "order_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "order_chat_read_states_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "order_chat_read_states_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "worker_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "order_chat_read_states_lastReadMessageId_fkey" FOREIGN KEY ("lastReadMessageId") REFERENCES "order_chat_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "order_chat_typing_states"
  ADD CONSTRAINT "order_chat_typing_states_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "order_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "order_chat_typing_states_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "order_chat_typing_states_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "worker_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
