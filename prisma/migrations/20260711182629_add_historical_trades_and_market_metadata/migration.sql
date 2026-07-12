-- CreateTable
CREATE TABLE "HistoricalTrade" (
    "id" TEXT NOT NULL,
    "transactionHash" TEXT NOT NULL,
    "proxyWallet" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "conditionId" TEXT NOT NULL,
    "size" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT,
    "eventSlug" TEXT,
    "outcome" TEXT NOT NULL,
    "outcomeIndex" INTEGER NOT NULL,
    "name" TEXT,
    "pseudonym" TEXT,
    "bio" TEXT,
    "profileImage" TEXT,
    "profileImageOptimized" TEXT,
    "marketQuestion" TEXT,
    "marketCategory" TEXT,
    "marketEndDate" TIMESTAMP(3),
    "marketResolvedOutcome" TEXT,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricalTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketMetadata" (
    "id" TEXT NOT NULL,
    "conditionId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT,
    "endDate" TIMESTAMP(3),
    "resolvedOutcome" TEXT,
    "active" BOOLEAN NOT NULL,
    "closed" BOOLEAN NOT NULL,
    "volume" DOUBLE PRECISION,
    "liquidity" DOUBLE PRECISION,
    "spread" DOUBLE PRECISION,
    "outcomes" TEXT NOT NULL,
    "outcomePrices" TEXT NOT NULL,
    "clobTokenIds" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataCollectionState" (
    "id" TEXT NOT NULL,
    "collectionType" TEXT NOT NULL,
    "lastCursor" TEXT,
    "lastTimestamp" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3) NOT NULL,
    "totalCollected" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "errorMessage" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataCollectionState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HistoricalTrade_transactionHash_key" ON "HistoricalTrade"("transactionHash");

-- CreateIndex
CREATE INDEX "HistoricalTrade_proxyWallet_idx" ON "HistoricalTrade"("proxyWallet");

-- CreateIndex
CREATE INDEX "HistoricalTrade_conditionId_idx" ON "HistoricalTrade"("conditionId");

-- CreateIndex
CREATE INDEX "HistoricalTrade_timestamp_idx" ON "HistoricalTrade"("timestamp");

-- CreateIndex
CREATE INDEX "HistoricalTrade_collectedAt_idx" ON "HistoricalTrade"("collectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketMetadata_conditionId_key" ON "MarketMetadata"("conditionId");

-- CreateIndex
CREATE INDEX "MarketMetadata_category_idx" ON "MarketMetadata"("category");

-- CreateIndex
CREATE INDEX "MarketMetadata_endDate_idx" ON "MarketMetadata"("endDate");

-- CreateIndex
CREATE INDEX "MarketMetadata_active_idx" ON "MarketMetadata"("active");

-- CreateIndex
CREATE INDEX "MarketMetadata_closed_idx" ON "MarketMetadata"("closed");

-- CreateIndex
CREATE UNIQUE INDEX "DataCollectionState_collectionType_key" ON "DataCollectionState"("collectionType");
