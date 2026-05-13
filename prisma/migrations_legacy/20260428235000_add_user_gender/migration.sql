DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Gender') THEN
    CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');
  END IF;
END $$;

ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "gender" "Gender";
