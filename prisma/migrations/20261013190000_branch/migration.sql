-- CreateEnum
CREATE TYPE "Branch" AS ENUM ('LEGISLATIVO', 'EXECUTIVO', 'JUDICIARIO');

-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "branch" "Branch";

-- AlterTable
ALTER TABLE "FeedSource" ADD COLUMN     "branch" "Branch";

-- CreateIndex
CREATE INDEX "Article_scope_branch_publishedAt_idx" ON "Article"("scope", "branch", "publishedAt" DESC);

