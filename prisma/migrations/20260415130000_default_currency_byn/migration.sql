-- Align DB defaults with BYN (Belarusian ruble) as the system currency
ALTER TABLE "cafe_menu_items" ALTER COLUMN "currency" SET DEFAULT 'BYN';
ALTER TABLE "transactions" ALTER COLUMN "currency" SET DEFAULT 'BYN';
