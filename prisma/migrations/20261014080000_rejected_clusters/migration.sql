-- CreateTable
CREATE TABLE "RejectedCluster" (
    "clusterKey" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RejectedCluster_pkey" PRIMARY KEY ("clusterKey")
);

