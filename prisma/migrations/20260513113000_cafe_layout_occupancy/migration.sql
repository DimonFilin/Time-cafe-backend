-- Cafe-level columns
ALTER TABLE "cafes"
ADD COLUMN IF NOT EXISTS "layoutVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "occupancyMode" TEXT NOT NULL DEFAULT 'PERCENT';

-- Appointment extensions
ALTER TABLE "appointments"
ADD COLUMN IF NOT EXISTS "roomId" TEXT,
ADD COLUMN IF NOT EXISTS "roomSnapshot" JSONB,
ADD COLUMN IF NOT EXISTS "selectedAssets" JSONB;

-- Order extension
ALTER TABLE "orders"
ADD COLUMN IF NOT EXISTS "roomSnapshot" JSONB;

-- New tables
CREATE TABLE IF NOT EXISTS "cafe_layouts" (
  "id" TEXT NOT NULL,
  "cafeId" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "title" TEXT NOT NULL,
  "schema" JSONB NOT NULL,
  "previewUrl" TEXT,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cafe_layouts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "cafe_rooms" (
  "id" TEXT NOT NULL,
  "cafeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "imageUrl" TEXT,
  "capacity" INTEGER NOT NULL DEFAULT 0,
  "workingHours" JSONB,
  "geometry" JSONB,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cafe_rooms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "cafe_layout_elements" (
  "id" TEXT NOT NULL,
  "cafeId" TEXT NOT NULL,
  "roomId" TEXT,
  "elementType" TEXT NOT NULL,
  "name" TEXT,
  "geometry" JSONB NOT NULL,
  "props" JSONB,
  "isOpen" BOOLEAN,
  "description" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cafe_layout_elements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "cafe_room_assets" (
  "id" TEXT NOT NULL,
  "cafeId" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cafe_room_assets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "cafe_shared_assets" (
  "id" TEXT NOT NULL,
  "cafeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "totalQuantity" INTEGER NOT NULL DEFAULT 1,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cafe_shared_assets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "cafe_shared_asset_reservations" (
  "id" TEXT NOT NULL,
  "cafeId" TEXT NOT NULL,
  "sharedAssetId" TEXT NOT NULL,
  "appointmentId" TEXT,
  "roomId" TEXT,
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3) NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cafe_shared_asset_reservations_pkey" PRIMARY KEY ("id")
);

-- Unique / indexes
CREATE UNIQUE INDEX IF NOT EXISTS "cafe_rooms_cafeId_name_key" ON "cafe_rooms"("cafeId", "name");
CREATE INDEX IF NOT EXISTS "appointments_cafeId_dateTime_status_idx" ON "appointments"("cafeId", "dateTime", "status");
CREATE INDEX IF NOT EXISTS "appointments_roomId_dateTime_status_idx" ON "appointments"("roomId", "dateTime", "status");
CREATE INDEX IF NOT EXISTS "cafe_layouts_cafeId_isPublished_updatedAt_idx" ON "cafe_layouts"("cafeId", "isPublished", "updatedAt");
CREATE INDEX IF NOT EXISTS "cafe_rooms_cafeId_status_idx" ON "cafe_rooms"("cafeId", "status");
CREATE INDEX IF NOT EXISTS "cafe_layout_elements_cafeId_elementType_idx" ON "cafe_layout_elements"("cafeId", "elementType");
CREATE INDEX IF NOT EXISTS "cafe_layout_elements_roomId_idx" ON "cafe_layout_elements"("roomId");
CREATE INDEX IF NOT EXISTS "cafe_room_assets_cafeId_roomId_isActive_idx" ON "cafe_room_assets"("cafeId", "roomId", "isActive");
CREATE INDEX IF NOT EXISTS "cafe_shared_assets_cafeId_isActive_idx" ON "cafe_shared_assets"("cafeId", "isActive");
CREATE INDEX IF NOT EXISTS "cafe_shared_asset_reservations_cafeId_startAt_endAt_idx" ON "cafe_shared_asset_reservations"("cafeId", "startAt", "endAt");
CREATE INDEX IF NOT EXISTS "cafe_shared_asset_reservations_sharedAssetId_startAt_endAt_idx" ON "cafe_shared_asset_reservations"("sharedAssetId", "startAt", "endAt");

-- Foreign keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cafe_layouts_cafeId_fkey'
  ) THEN
    ALTER TABLE "cafe_layouts"
    ADD CONSTRAINT "cafe_layouts_cafeId_fkey"
    FOREIGN KEY ("cafeId") REFERENCES "cafes"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cafe_rooms_cafeId_fkey'
  ) THEN
    ALTER TABLE "cafe_rooms"
    ADD CONSTRAINT "cafe_rooms_cafeId_fkey"
    FOREIGN KEY ("cafeId") REFERENCES "cafes"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'appointments_roomId_fkey'
  ) THEN
    ALTER TABLE "appointments"
    ADD CONSTRAINT "appointments_roomId_fkey"
    FOREIGN KEY ("roomId") REFERENCES "cafe_rooms"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cafe_layout_elements_cafeId_fkey'
  ) THEN
    ALTER TABLE "cafe_layout_elements"
    ADD CONSTRAINT "cafe_layout_elements_cafeId_fkey"
    FOREIGN KEY ("cafeId") REFERENCES "cafes"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cafe_layout_elements_roomId_fkey'
  ) THEN
    ALTER TABLE "cafe_layout_elements"
    ADD CONSTRAINT "cafe_layout_elements_roomId_fkey"
    FOREIGN KEY ("roomId") REFERENCES "cafe_rooms"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cafe_room_assets_cafeId_fkey'
  ) THEN
    ALTER TABLE "cafe_room_assets"
    ADD CONSTRAINT "cafe_room_assets_cafeId_fkey"
    FOREIGN KEY ("cafeId") REFERENCES "cafes"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cafe_room_assets_roomId_fkey'
  ) THEN
    ALTER TABLE "cafe_room_assets"
    ADD CONSTRAINT "cafe_room_assets_roomId_fkey"
    FOREIGN KEY ("roomId") REFERENCES "cafe_rooms"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cafe_shared_assets_cafeId_fkey'
  ) THEN
    ALTER TABLE "cafe_shared_assets"
    ADD CONSTRAINT "cafe_shared_assets_cafeId_fkey"
    FOREIGN KEY ("cafeId") REFERENCES "cafes"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cafe_shared_asset_reservations_cafeId_fkey'
  ) THEN
    ALTER TABLE "cafe_shared_asset_reservations"
    ADD CONSTRAINT "cafe_shared_asset_reservations_cafeId_fkey"
    FOREIGN KEY ("cafeId") REFERENCES "cafes"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cafe_shared_asset_reservations_sharedAssetId_fkey'
  ) THEN
    ALTER TABLE "cafe_shared_asset_reservations"
    ADD CONSTRAINT "cafe_shared_asset_reservations_sharedAssetId_fkey"
    FOREIGN KEY ("sharedAssetId") REFERENCES "cafe_shared_assets"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cafe_shared_asset_reservations_appointmentId_fkey'
  ) THEN
    ALTER TABLE "cafe_shared_asset_reservations"
    ADD CONSTRAINT "cafe_shared_asset_reservations_appointmentId_fkey"
    FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cafe_shared_asset_reservations_roomId_fkey'
  ) THEN
    ALTER TABLE "cafe_shared_asset_reservations"
    ADD CONSTRAINT "cafe_shared_asset_reservations_roomId_fkey"
    FOREIGN KEY ("roomId") REFERENCES "cafe_rooms"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
