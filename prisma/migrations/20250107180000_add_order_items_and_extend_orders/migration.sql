-- CreateEnum
CREATE TYPE "DeliveryType" AS ENUM ('IN_CAFE', 'TAKEOUT', 'DELIVERY');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CARD', 'BALANCE', 'CASH');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "orderNumber" TEXT;
ALTER TABLE "orders" ADD COLUMN "appointmentId" TEXT;
ALTER TABLE "orders" ADD COLUMN "deliveryType" "DeliveryType" NOT NULL DEFAULT 'IN_CAFE';
ALTER TABLE "orders" ADD COLUMN "deliveryAddress" TEXT;
ALTER TABLE "orders" ADD COLUMN "contactPhone" TEXT;
ALTER TABLE "orders" ADD COLUMN "notes" TEXT;
ALTER TABLE "orders" ADD COLUMN "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CARD';
ALTER TABLE "orders" ADD COLUMN "paidAt" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN "confirmedAt" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN "completedAt" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN "cancelledAt" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN "cancellationReason" TEXT;

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

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN "totalAmount" DECIMAL(10,2);
ALTER TABLE "appointments" ADD COLUMN "paymentMethod" TEXT;
ALTER TABLE "appointments" ADD COLUMN "transactionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "orders_appointmentId_key" ON "orders"("appointmentId");

-- CreateIndex
CREATE INDEX "orders_userId_createdAt_idx" ON "orders"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "orders_cafeId_status_idx" ON "orders"("cafeId", "status");

-- CreateIndex
CREATE INDEX "orders_orderNumber_idx" ON "orders"("orderNumber");

-- CreateIndex
CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

