-- AlterTable
ALTER TABLE "User" ADD COLUMN     "digestTiersDaily" TEXT NOT NULL DEFAULT '1,2,3',
ADD COLUMN     "digestTiersMonthly" TEXT NOT NULL DEFAULT '1,2,3',
ADD COLUMN     "digestTiersWeekly" TEXT NOT NULL DEFAULT '1,2,3';

