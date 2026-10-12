-- CreateIndex
CREATE INDEX "Movie_title_idx" ON "Movie" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Movie_overview_idx" ON "Movie" USING GIN ("overview" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Movie_genres_idx" ON "Movie" USING GIN ("genres");
