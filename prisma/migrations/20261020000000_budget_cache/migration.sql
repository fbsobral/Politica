-- CreateTable
CREATE TABLE "BudgetCache" (
    "key" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetCache_pkey" PRIMARY KEY ("key")
);

