-- CreateEnum
CREATE TYPE "Scope" AS ENUM ('MUNICIPAL', 'ESTADUAL', 'FEDERAL');

-- CreateEnum
CREATE TYPE "SourceCategory" AS ENUM ('PORTAL_NACIONAL', 'JORNAL', 'REVISTA', 'TV', 'RADIO', 'AGENCIA_NOTICIAS', 'ORGAO_OFICIAL', 'REGIONAL', 'BLOG_INDEPENDENTE', 'OUTRO');

-- CreateEnum
CREATE TYPE "NewsCategory" AS ENUM ('ECONOMIA', 'SAUDE', 'SEGURANCA', 'EDUCACAO', 'ELEICOES', 'JUSTICA_CORRUPCAO', 'INFRAESTRUTURA', 'MEIO_AMBIENTE', 'SOCIAL', 'LEGISLATIVO', 'ADMINISTRACAO', 'INTERNACIONAL', 'OUTROS');

-- CreateEnum
CREATE TYPE "PoliticianRole" AS ENUM ('PRESIDENTE', 'VICE_PRESIDENTE', 'SENADOR', 'DEPUTADO_FEDERAL', 'GOVERNADOR', 'VICE_GOVERNADOR', 'DEPUTADO_ESTADUAL', 'PREFEITO', 'VICE_PREFEITO', 'VEREADOR');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "uf" TEXT,
    "municipality" TEXT,
    "municipalityKey" TEXT,
    "dailyDigest" BOOLEAN NOT NULL DEFAULT true,
    "alertEmails" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "homepage" TEXT,
    "category" "SourceCategory" NOT NULL DEFAULT 'OUTRO',
    "categoryKnown" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "scope" "Scope" NOT NULL,
    "uf" TEXT,
    "municipalityKey" TEXT,
    "category" "NewsCategory" NOT NULL DEFAULT 'OUTROS',
    "clusterKey" TEXT NOT NULL,
    "classified" BOOLEAN NOT NULL DEFAULT false,
    "origin" TEXT,
    "sourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Politician" (
    "id" TEXT NOT NULL,
    "externalKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ballotName" TEXT,
    "role" "PoliticianRole" NOT NULL,
    "uf" TEXT,
    "municipality" TEXT,
    "municipalityKey" TEXT,
    "party" TEXT,
    "photoUrl" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "profileUrl" TEXT,
    "mandate" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Politician_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Follow" (
    "userId" TEXT NOT NULL,
    "politicianId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("userId","politicianId")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "userId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("userId","articleId")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keyword" TEXT,
    "politicianId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertMatch" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DigestLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DigestLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL,
    "job" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "ok" BOOLEAN NOT NULL DEFAULT false,
    "info" TEXT,

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "Source_name_key" ON "Source"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Article_url_key" ON "Article"("url");

-- CreateIndex
CREATE INDEX "Article_scope_publishedAt_idx" ON "Article"("scope", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "Article_scope_uf_publishedAt_idx" ON "Article"("scope", "uf", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "Article_scope_uf_municipalityKey_publishedAt_idx" ON "Article"("scope", "uf", "municipalityKey", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "Article_clusterKey_idx" ON "Article"("clusterKey");

-- CreateIndex
CREATE INDEX "Article_classified_idx" ON "Article"("classified");

-- CreateIndex
CREATE INDEX "Article_sourceId_idx" ON "Article"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "Politician_externalKey_key" ON "Politician"("externalKey");

-- CreateIndex
CREATE INDEX "Politician_role_uf_idx" ON "Politician"("role", "uf");

-- CreateIndex
CREATE INDEX "Politician_role_uf_municipalityKey_idx" ON "Politician"("role", "uf", "municipalityKey");

-- CreateIndex
CREATE INDEX "Alert_userId_idx" ON "Alert"("userId");

-- CreateIndex
CREATE INDEX "AlertMatch_notifiedAt_idx" ON "AlertMatch"("notifiedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AlertMatch_alertId_articleId_key" ON "AlertMatch"("alertId", "articleId");

-- CreateIndex
CREATE UNIQUE INDEX "DigestLog_userId_day_key" ON "DigestLog"("userId", "day");

-- CreateIndex
CREATE INDEX "JobRun_job_startedAt_idx" ON "JobRun"("job", "startedAt" DESC);

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_politicianId_fkey" FOREIGN KEY ("politicianId") REFERENCES "Politician"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_politicianId_fkey" FOREIGN KEY ("politicianId") REFERENCES "Politician"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertMatch" ADD CONSTRAINT "AlertMatch_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertMatch" ADD CONSTRAINT "AlertMatch_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigestLog" ADD CONSTRAINT "DigestLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
