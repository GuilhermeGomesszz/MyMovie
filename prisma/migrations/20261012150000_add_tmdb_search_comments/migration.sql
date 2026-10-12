CREATE EXTENSION IF NOT EXISTS "pg_trgm";

ALTER TABLE "Movie" ADD COLUMN "tmdbId" INTEGER;
CREATE UNIQUE INDEX "Movie_tmdbId_key" ON "Movie"("tmdbId");

CREATE INDEX "Movie_title_trgm_idx" ON "Movie" USING GIN ("title" gin_trgm_ops);
CREATE INDEX "Movie_overview_trgm_idx" ON "Movie" USING GIN ("overview" gin_trgm_ops);
CREATE INDEX "Movie_genres_gin_idx" ON "Movie" USING GIN ("genres");

CREATE TABLE "MovieComment" (
    "id" TEXT NOT NULL,
    "movieId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MovieComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SearchEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "normalizedQuery" TEXT NOT NULL,
    "genre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SearchEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MovieComment_movieId_parentId_createdAt_idx" ON "MovieComment"("movieId", "parentId", "createdAt");
CREATE INDEX "MovieComment_parentId_createdAt_idx" ON "MovieComment"("parentId", "createdAt");
CREATE INDEX "SearchEvent_userId_normalizedQuery_genre_idx" ON "SearchEvent"("userId", "normalizedQuery", "genre");
CREATE INDEX "SearchEvent_normalizedQuery_genre_idx" ON "SearchEvent"("normalizedQuery", "genre");
CREATE INDEX "SearchEvent_createdAt_idx" ON "SearchEvent"("createdAt");

ALTER TABLE "MovieComment" ADD CONSTRAINT "MovieComment_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MovieComment" ADD CONSTRAINT "MovieComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MovieComment" ADD CONSTRAINT "MovieComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "MovieComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SearchEvent" ADD CONSTRAINT "SearchEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
