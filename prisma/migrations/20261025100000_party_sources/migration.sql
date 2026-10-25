-- AlterEnum
ALTER TYPE "SourceCategory" ADD VALUE 'PARTIDO';

-- AlterTable
ALTER TABLE "FeedSource" ADD COLUMN     "party" TEXT;

