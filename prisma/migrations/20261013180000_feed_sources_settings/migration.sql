-- CreateTable
CREATE TABLE "FeedSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "feedUrl" TEXT NOT NULL,
    "homepage" TEXT,
    "category" "SourceCategory" NOT NULL DEFAULT 'OUTRO',
    "scope" "Scope" NOT NULL DEFAULT 'FEDERAL',
    "uf" TEXT,
    "municipality" TEXT,
    "municipalityKey" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastOkAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeedSource_name_key" ON "FeedSource"("name");

-- CreateIndex
CREATE UNIQUE INDEX "FeedSource_feedUrl_key" ON "FeedSource"("feedUrl");

