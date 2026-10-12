-- CreateEnum
CREATE TYPE "AvailabilityType" AS ENUM ('CINEMA', 'STREAMING', 'RENTAL', 'PURCHASE');

-- CreateTable
CREATE TABLE "CommunityReview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "movieId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "review" TEXT,
    "recommends" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityReview_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CommunityReview_rating_check" CHECK ("rating" >= 0 AND "rating" <= 10)
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovieCategory" (
    "movieId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "MovieCategory_pkey" PRIMARY KEY ("movieId", "categoryId")
);

-- CreateTable
CREATE TABLE "MovieAvailability" (
    "id" TEXT NOT NULL,
    "movieId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "type" "AvailabilityType" NOT NULL,
    "url" TEXT,
    "region" TEXT NOT NULL DEFAULT 'BR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MovieAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommunityReview_userId_movieId_key" ON "CommunityReview"("userId", "movieId");
CREATE INDEX "CommunityReview_movieId_createdAt_idx" ON "CommunityReview"("movieId", "createdAt");
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");
CREATE UNIQUE INDEX "Category_externalId_key" ON "Category"("externalId");
CREATE INDEX "MovieCategory_categoryId_movieId_idx" ON "MovieCategory"("categoryId", "movieId");
CREATE UNIQUE INDEX "MovieAvailability_movieId_provider_type_region_key" ON "MovieAvailability"("movieId", "provider", "type", "region");
CREATE INDEX "MovieAvailability_movieId_idx" ON "MovieAvailability"("movieId");

-- Preserve the categories already stored on movies.
INSERT INTO "Category" ("id", "name")
SELECT gen_random_uuid()::text, btrim(genre)
FROM "Movie", LATERAL unnest(COALESCE("genres", ARRAY[]::TEXT[])) AS genres(genre)
WHERE btrim(genre) <> ''
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "MovieCategory" ("movieId", "categoryId")
SELECT movie."id", category."id"
FROM "Movie" AS movie
CROSS JOIN LATERAL unnest(COALESCE(movie."genres", ARRAY[]::TEXT[])) AS genres(genre)
JOIN "Category" AS category ON category."name" = btrim(genre)
ON CONFLICT ("movieId", "categoryId") DO NOTHING;

-- AddForeignKey
ALTER TABLE "CommunityReview" ADD CONSTRAINT "CommunityReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityReview" ADD CONSTRAINT "CommunityReview_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MovieCategory" ADD CONSTRAINT "MovieCategory_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MovieCategory" ADD CONSTRAINT "MovieCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MovieAvailability" ADD CONSTRAINT "MovieAvailability_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
