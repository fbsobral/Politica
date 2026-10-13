-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "directUrl" TEXT,
ADD COLUMN     "summary" TEXT,
ADD COLUMN     "summaryAt" TIMESTAMP(3),
ADD COLUMN     "summaryKind" TEXT;

