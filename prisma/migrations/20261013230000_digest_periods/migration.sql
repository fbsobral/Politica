-- DropIndex
DROP INDEX "DigestLog_userId_day_key";

-- AlterTable
ALTER TABLE "DigestLog" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'daily';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "monthlyDigest" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "weeklyDigest" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "DigestLog_userId_kind_day_key" ON "DigestLog"("userId", "kind", "day");

