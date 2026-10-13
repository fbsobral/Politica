-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "factCheck" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Article_factCheck_scope_publishedAt_idx" ON "Article"("factCheck", "scope", "publishedAt" DESC);

UPDATE "Article" a SET "factCheck" = true FROM "Source" s WHERE a."sourceId" = s.id AND s."factCheck" = true;
