ALTER TABLE "Customer" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

UPDATE "Customer" AS customer
SET "position" = ranked.rn
FROM (
  SELECT
    id,
    (ROW_NUMBER() OVER (PARTITION BY "orgId" ORDER BY name ASC) - 1)::integer AS rn
  FROM "Customer"
  WHERE "deletedAt" IS NULL
) AS ranked
WHERE customer.id = ranked.id;
