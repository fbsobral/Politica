-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "parties" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "partiesChecked" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "party" TEXT;

-- CreateIndex
CREATE INDEX "Article_parties_idx" ON "Article" USING GIN ("parties");

