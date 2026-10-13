-- AlterTable
ALTER TABLE "FeedSource" ADD COLUMN     "factCheck" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Source" ADD COLUMN     "factCheck" BOOLEAN NOT NULL DEFAULT false;

