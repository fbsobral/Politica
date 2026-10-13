-- CreateEnum
CREATE TYPE "ElectionOffice" AS ENUM ('PRESIDENTE', 'GOVERNADOR', 'SENADOR', 'DEPUTADO');

-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "cargo" "ElectionOffice",
ADD COLUMN     "poll" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "externalKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ballotName" TEXT NOT NULL,
    "number" INTEGER,
    "party" TEXT,
    "office" "ElectionOffice" NOT NULL,
    "uf" TEXT,
    "status" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_externalKey_key" ON "Candidate"("externalKey");

-- CreateIndex
CREATE INDEX "Candidate_office_uf_idx" ON "Candidate"("office", "uf");

-- CreateIndex
CREATE INDEX "Article_cargo_publishedAt_idx" ON "Article"("cargo", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "Article_poll_publishedAt_idx" ON "Article"("poll", "publishedAt" DESC);

