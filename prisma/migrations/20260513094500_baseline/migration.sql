-- CreateEnum
CREATE TYPE "WorkerRole" AS ENUM ('SYSTEM_ADMIN', 'BRAND_ADMIN', 'CAFE_ADMIN', 'WORKER');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "WorkerShiftStatus" AS ENUM ('ON_SHIFT', 'OFF_SHIFT');

-- CreateEnum
CREATE TYPE "WorkerScheduleAbsenceKind" AS ENUM ('VACATION', 'SICK_LEAVE');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "DeliveryType" AS ENUM ('IN_CAFE', 'TAKEOUT', 'DELIVERY');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CARD', 'BALANCE', 'CASH');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('PAYMENT', 'REFUND');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ActivityAction" AS ENUM ('LOGIN', 'LOGOUT', 'PASSWORD_CHANGE', 'TOKEN_REFRESH', 'CREATE', 'UPDATE', 'DELETE', 'BULK_UPDATE', 'BULK_DELETE', 'VIEW_LIST', 'VIEW_DETAIL', 'VIEW_REPORT', 'EXPORT_DATA', 'PAGE_VIEW', 'MODAL_OPEN', 'MODAL_CLOSE', 'TAB_SWITCH', 'UPDATE_SETTINGS', 'UPDATE_PERMISSIONS', 'FILE_UPLOAD', 'FILE_DELETE', 'PAYMENT_PROCESS');

-- CreateEnum
CREATE TYPE "ActivityCategory" AS ENUM ('AUTH', 'DATA', 'VIEW', 'CONFIG', 'FINANCIAL', 'SECURITY');

-- CreateEnum
CREATE TYPE "LogSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "BrandStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('REGISTRATION', 'LICENSE', 'CONTRACT', 'TAX_CERTIFICATE', 'BANK_STATEMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "TaskCategory" AS ENUM ('OPENING', 'SHIFT', 'CLOSING', 'GENERAL');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "TaskAssignmentType" AS ENUM ('ALL_WORKERS', 'SPECIFIC_WORKERS', 'ROLE_BASED');

-- CreateEnum
CREATE TYPE "ChatNotificationMode" AS ENUM ('ALL_WORKERS', 'ROLE_BASED', 'SPECIFIC_WORKERS');

-- CreateEnum
CREATE TYPE "ChatAuthorType" AS ENUM ('USER', 'WORKER');

-- CreateEnum
CREATE TYPE "ChatMessageType" AS ENUM ('TEXT', 'IMAGE', 'MIXED', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ChatAttachmentStatus" AS ENUM ('UPLOADING', 'UPLOADED', 'FAILED');

-- CreateTable
CREATE TABLE "worker_accounts" (
    "id" TEXT NOT NULL,
    "keycloakId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "WorkerRole" NOT NULL,
    "shiftStatus" "WorkerShiftStatus" NOT NULL DEFAULT 'OFF_SHIFT',
    "shiftSchedule" JSONB,
    "brandId" TEXT,
    "cafeId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "worker_accounts_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "keycloakId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "gender" "Gender",
    "avatar" TEXT,
    "balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "logo" TEXT,
    "primaryColor" TEXT DEFAULT '#000000',
    "secondaryColor" TEXT,
    "accentColor" TEXT,
    "backgroundColor" TEXT,
    "textColor" TEXT,
    "fontFamily" TEXT,
    "favicon" TEXT,
    "bannerImage" TEXT,
    "backgroundImage" TEXT,
    "website" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "status" "BrandStatus" NOT NULL DEFAULT 'PENDING',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "settings" JSONB,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cafes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "street" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "photos" TEXT[],
    "rating" DOUBLE PRECISION DEFAULT 0,
    "reviewsCount" INTEGER NOT NULL DEFAULT 0,
    "brandId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "cafeApiUrl" TEXT,
    "openingHours" JSONB,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "chatSettings" JSONB,

    CONSTRAINT "cafes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cafe_menu_categories" (
    "id" TEXT NOT NULL,
    "cafeId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cafe_menu_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cafe_menu_items" (
    "id" TEXT NOT NULL,
    "cafeId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BYN',
    "photoUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cafe_menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cafeId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "deliveryType" "DeliveryType" NOT NULL DEFAULT 'IN_CAFE',
    "deliveryAddress" TEXT,
    "contactPhone" TEXT,
    "notes" TEXT,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CARD',
    "paidAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalPrice" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cafeId" TEXT NOT NULL,
    "orderId" TEXT,
    "rating" DOUBLE PRECISION NOT NULL,
    "comment" TEXT,
    "pros" TEXT[],
    "cons" TEXT[],
    "photos" TEXT[],
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cafeId" TEXT NOT NULL,
    "dateTime" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "qrCode" TEXT,
    "totalAmount" DECIMAL(10,2),
    "paymentMethod" TEXT,
    "transactionId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_cards" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "last4Digits" TEXT NOT NULL,
    "cardType" TEXT NOT NULL,
    "expiryMonth" INTEGER NOT NULL,
    "expiryYear" INTEGER NOT NULL,
    "providerToken" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "holderName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "payment_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BYN',
    "orderId" TEXT,
    "cardId" TEXT,
    "provider" TEXT,
    "providerTransactionId" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_documents" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "name" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT,
    "fileSize" INTEGER,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_api_keys" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "permissions" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "brand_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL DEFAULT 'system',
    "settings" JSONB NOT NULL,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "workerEmail" TEXT NOT NULL,
    "workerRole" "WorkerRole" NOT NULL,
    "brandId" TEXT,
    "cafeId" TEXT,
    "action" "ActivityAction" NOT NULL,
    "category" "ActivityCategory" NOT NULL,
    "severity" "LogSeverity" NOT NULL DEFAULT 'INFO',
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "details" JSONB,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "endpoint" TEXT,
    "method" TEXT,
    "statusCode" INTEGER,
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "order_chats" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "cafeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brandId" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "notificationMode" "ChatNotificationMode" NOT NULL DEFAULT 'ALL_WORKERS',
    "notificationRoles" "WorkerRole"[],
    "notificationWorkerIds" TEXT[],
    "theme" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateIndex
CREATE INDEX "worker_schedule_absences_workerId_startDate_idx" ON "worker_schedule_absences"("workerId", "startDate");

-- CreateIndex
CREATE INDEX "cafe_menu_categories_cafeId_sortOrder_idx" ON "cafe_menu_categories"("cafeId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "cafe_menu_categories_cafeId_key_key" ON "cafe_menu_categories"("cafeId", "key");

-- CreateIndex
CREATE INDEX "cafe_menu_items_cafeId_categoryId_sortOrder_idx" ON "cafe_menu_items"("cafeId", "categoryId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "cafe_menu_items_cafeId_key_key" ON "cafe_menu_items"("cafeId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders"("orderNumber");

-- CreateIndex
CREATE INDEX "orders_userId_createdAt_idx" ON "orders"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "orders_cafeId_status_idx" ON "orders"("cafeId", "status");

-- CreateIndex
CREATE INDEX "orders_orderNumber_idx" ON "orders"("orderNumber");

-- CreateIndex
CREATE INDEX "orders_appointmentId_idx" ON "orders"("appointmentId");

-- CreateIndex
CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_orderId_key" ON "reviews"("orderId");

-- CreateIndex
CREATE INDEX "reviews_cafeId_createdAt_idx" ON "reviews"("cafeId", "createdAt");

-- CreateIndex
CREATE INDEX "reviews_userId_cafeId_idx" ON "reviews"("userId", "cafeId");

-- CreateIndex
CREATE INDEX "reviews_orderId_idx" ON "reviews"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_qrCode_key" ON "appointments"("qrCode");

-- CreateIndex
CREATE INDEX "payment_cards_userId_deletedAt_idx" ON "payment_cards"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "transactions_userId_createdAt_idx" ON "transactions"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

-- CreateIndex
CREATE INDEX "transactions_orderId_idx" ON "transactions"("orderId");

-- CreateIndex
CREATE INDEX "brand_documents_brandId_idx" ON "brand_documents"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "brand_api_keys_keyHash_key" ON "brand_api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "brand_api_keys_brandId_isActive_idx" ON "brand_api_keys"("brandId", "isActive");

-- CreateIndex
CREATE INDEX "brand_api_keys_keyHash_idx" ON "brand_api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "activity_logs_workerId_createdAt_idx" ON "activity_logs"("workerId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "activity_logs_brandId_createdAt_idx" ON "activity_logs"("brandId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "activity_logs_cafeId_createdAt_idx" ON "activity_logs"("cafeId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "activity_logs_action_createdAt_idx" ON "activity_logs"("action", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "activity_logs_category_createdAt_idx" ON "activity_logs"("category", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "activity_logs_severity_createdAt_idx" ON "activity_logs"("severity", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "activity_logs_resourceType_resourceId_idx" ON "activity_logs"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "task_templates_cafeId_idx" ON "task_templates"("cafeId");

-- CreateIndex
CREATE INDEX "task_templates_cafeId_isActive_idx" ON "task_templates"("cafeId", "isActive");

-- CreateIndex
CREATE INDEX "task_templates_cafeId_category_idx" ON "task_templates"("cafeId", "category");

-- CreateIndex
CREATE INDEX "task_completions_templateId_completionDate_idx" ON "task_completions"("templateId", "completionDate");

-- CreateIndex
CREATE INDEX "task_completions_workerId_completionDate_idx" ON "task_completions"("workerId", "completionDate");

-- CreateIndex
CREATE INDEX "task_completions_completionDate_idx" ON "task_completions"("completionDate");

-- CreateIndex
CREATE UNIQUE INDEX "task_completions_templateId_workerId_completionDate_key" ON "task_completions"("templateId", "workerId", "completionDate");

-- CreateIndex
CREATE UNIQUE INDEX "order_chats_orderId_key" ON "order_chats"("orderId");

-- CreateIndex
CREATE INDEX "order_chats_cafeId_updatedAt_idx" ON "order_chats"("cafeId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "order_chats_brandId_updatedAt_idx" ON "order_chats"("brandId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "order_chats_userId_updatedAt_idx" ON "order_chats"("userId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "order_chat_messages_chatId_createdAt_idx" ON "order_chat_messages"("chatId", "createdAt");

-- CreateIndex
CREATE INDEX "order_chat_messages_orderId_createdAt_idx" ON "order_chat_messages"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "order_chat_messages_cafeId_createdAt_idx" ON "order_chat_messages"("cafeId", "createdAt");

-- CreateIndex
CREATE INDEX "order_chat_attachments_messageId_sortOrder_idx" ON "order_chat_attachments"("messageId", "sortOrder");

-- CreateIndex
CREATE INDEX "order_chat_attachments_chatId_createdAt_idx" ON "order_chat_attachments"("chatId", "createdAt");

-- CreateIndex
CREATE INDEX "order_chat_read_states_chatId_unreadCount_idx" ON "order_chat_read_states"("chatId", "unreadCount");

-- CreateIndex
CREATE UNIQUE INDEX "order_chat_read_states_chatId_userId_key" ON "order_chat_read_states"("chatId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "order_chat_read_states_chatId_workerId_key" ON "order_chat_read_states"("chatId", "workerId");

-- CreateIndex
CREATE INDEX "order_chat_typing_states_chatId_expiresAt_idx" ON "order_chat_typing_states"("chatId", "expiresAt");

-- AddForeignKey
ALTER TABLE "worker_accounts" ADD CONSTRAINT "worker_accounts_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_accounts" ADD CONSTRAINT "worker_accounts_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "cafes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_schedule_absences" ADD CONSTRAINT "worker_schedule_absences_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "worker_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cafes" ADD CONSTRAINT "cafes_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cafes" ADD CONSTRAINT "cafes_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cafe_menu_categories" ADD CONSTRAINT "cafe_menu_categories_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "cafes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cafe_menu_items" ADD CONSTRAINT "cafe_menu_items_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "cafes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cafe_menu_items" ADD CONSTRAINT "cafe_menu_items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "cafe_menu_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "cafes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "cafes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "cafes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_cards" ADD CONSTRAINT "payment_cards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "payment_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_documents" ADD CONSTRAINT "brand_documents_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_api_keys" ADD CONSTRAINT "brand_api_keys_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "cafes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "worker_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "cafes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "worker_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_completions" ADD CONSTRAINT "task_completions_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "task_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_completions" ADD CONSTRAINT "task_completions_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "worker_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_chats" ADD CONSTRAINT "order_chats_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_chats" ADD CONSTRAINT "order_chats_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "cafes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_chats" ADD CONSTRAINT "order_chats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_chats" ADD CONSTRAINT "order_chats_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_chat_messages" ADD CONSTRAINT "order_chat_messages_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "order_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_chat_messages" ADD CONSTRAINT "order_chat_messages_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_chat_messages" ADD CONSTRAINT "order_chat_messages_authorWorkerId_fkey" FOREIGN KEY ("authorWorkerId") REFERENCES "worker_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_chat_attachments" ADD CONSTRAINT "order_chat_attachments_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "order_chat_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_chat_read_states" ADD CONSTRAINT "order_chat_read_states_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "order_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_chat_read_states" ADD CONSTRAINT "order_chat_read_states_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_chat_read_states" ADD CONSTRAINT "order_chat_read_states_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "worker_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_chat_read_states" ADD CONSTRAINT "order_chat_read_states_lastReadMessageId_fkey" FOREIGN KEY ("lastReadMessageId") REFERENCES "order_chat_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_chat_typing_states" ADD CONSTRAINT "order_chat_typing_states_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "order_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_chat_typing_states" ADD CONSTRAINT "order_chat_typing_states_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_chat_typing_states" ADD CONSTRAINT "order_chat_typing_states_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "worker_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

