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
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "photoUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cafe_menu_items_pkey" PRIMARY KEY ("id")
);

-- DropIndex
DROP INDEX IF EXISTS "orders_appointmentId_key";

-- CreateIndex
CREATE UNIQUE INDEX "cafe_menu_categories_cafeId_key_key" ON "cafe_menu_categories"("cafeId", "key");

-- CreateIndex
CREATE INDEX "cafe_menu_categories_cafeId_sortOrder_idx" ON "cafe_menu_categories"("cafeId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "cafe_menu_items_cafeId_key_key" ON "cafe_menu_items"("cafeId", "key");

-- CreateIndex
CREATE INDEX "cafe_menu_items_cafeId_categoryId_sortOrder_idx" ON "cafe_menu_items"("cafeId", "categoryId", "sortOrder");

-- CreateIndex
CREATE INDEX "orders_appointmentId_idx" ON "orders"("appointmentId");

-- AddForeignKey
ALTER TABLE "cafe_menu_categories" ADD CONSTRAINT "cafe_menu_categories_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "cafes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cafe_menu_items" ADD CONSTRAINT "cafe_menu_items_cafeId_fkey" FOREIGN KEY ("cafeId") REFERENCES "cafes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cafe_menu_items" ADD CONSTRAINT "cafe_menu_items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "cafe_menu_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;



