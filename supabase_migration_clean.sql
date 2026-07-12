-- Polymarket Copy Trading Bot - Complete Database Schema
-- Project: iaxfwsjjmwvlqyqvzvfb (ap-south-1)
-- Generated: 2026-07-12
-- 
-- Instructions:
-- 1. Go to https://supabase.com/dashboard/project/iaxfwsjjmwvlqyqvzvfb/sql
-- 2. Paste this entire SQL script
-- 3. Click "Run" to execute
--
-- Tables: LeaderboardScan, WalletProfile, ObservedTrade, MarketSnapshot,
--         DecisionJournal, PaperTrade, PnlSnapshot, OutcomeReview,
--         RuleSet, RuleChange, DailyReport, HistoricalTrade,
--         MarketMetadata, DataCollectionState

-- CreateTable
CREATE TABLE "LeaderboardScan" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "walletCount" INTEGER NOT NULL,
    "lookbackDays" INTEGER NOT NULL DEFAULT 30,
    "rawSummaryJson" TEXT NOT NULL,

    CONSTRAINT "LeaderboardScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletProfile" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "label" TEXT,
    "sourceRank" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'IGNORE',
    "roi30d" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "consistencyScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "copyabilityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "oneHitWonderPenalty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "globalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bestCategory" TEXT,
    "categoryStrengthsJson" TEXT NOT NULL,
    "averageTradeSize" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tradeCount30d" INTEGER NOT NULL DEFAULT 0,
    "resolvedTradeCount30d" INTEGER NOT NULL DEFAULT 0,
    "winRate30d" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "averageLiquidity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "averageSpread" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "averageEntryTiming" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "copyabilityNotes" TEXT,
    "riskNotes" TEXT,
    "statusReason" TEXT,
    "lastScannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObservedTrade" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "conditionId" TEXT NOT NULL,
    "marketQuestion" TEXT NOT NULL,
    "marketCategory" TEXT,
    "outcome" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "walletEntryPrice" DOUBLE PRECISION NOT NULL,
    "detectedPrice" DOUBLE PRECISION NOT NULL,
    "size" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "transactionHash" TEXT,
    "rawTradeJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObservedTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketSnapshot" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "conditionId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "category" TEXT,
    "yesPrice" DOUBLE PRECISION,
    "noPrice" DOUBLE PRECISION,
    "bestBid" DOUBLE PRECISION,
    "bestAsk" DOUBLE PRECISION,
    "spread" DOUBLE PRECISION,
    "liquidity" DOUBLE PRECISION,
    "volume" DOUBLE PRECISION,
    "timeToResolution" DOUBLE PRECISION,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawMarketJson" TEXT NOT NULL,

    CONSTRAINT "MarketSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionJournal" (
    "id" TEXT NOT NULL,
    "observedTradeId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "copyScore" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "reasonsJson" TEXT NOT NULL,
    "risksJson" TEXT NOT NULL,
    "walletQualityScore" DOUBLE PRECISION NOT NULL,
    "roiScore" DOUBLE PRECISION NOT NULL,
    "consistencyScore" DOUBLE PRECISION NOT NULL,
    "copyabilityScore" DOUBLE PRECISION NOT NULL,
    "categoryFitScore" DOUBLE PRECISION NOT NULL,
    "entryTimingScore" DOUBLE PRECISION NOT NULL,
    "spreadScore" DOUBLE PRECISION NOT NULL,
    "liquidityScore" DOUBLE PRECISION NOT NULL,
    "thesisScore" DOUBLE PRECISION NOT NULL,
    "simulatedPositionSize" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionJournal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperTrade" (
    "id" TEXT NOT NULL,
    "decisionJournalId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "currentPrice" DOUBLE PRECISION NOT NULL,
    "simulatedPositionSize" DOUBLE PRECISION NOT NULL,
    "unrealizedPnl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "realizedPnl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "PaperTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PnlSnapshot" (
    "id" TEXT NOT NULL,
    "paperTradeId" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "pnl" DOUBLE PRECISION NOT NULL,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PnlSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutcomeReview" (
    "id" TEXT NOT NULL,
    "decisionJournalId" TEXT NOT NULL,
    "paperTradeId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "reviewTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "priceAfter1h" DOUBLE PRECISION,
    "priceAfter6h" DOUBLE PRECISION,
    "priceAfter24h" DOUBLE PRECISION,
    "finalOutcome" TEXT,
    "simulatedPnl" DOUBLE PRECISION NOT NULL,
    "wasDecisionGood" BOOLEAN NOT NULL,
    "lessonsJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutcomeReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleSet" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "rulesJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuleSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleChange" (
    "id" TEXT NOT NULL,
    "oldRuleSetId" TEXT NOT NULL,
    "newRuleSetId" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL DEFAULT 'hermes',
    "reason" TEXT NOT NULL,
    "evidenceSummary" TEXT NOT NULL,
    "beforeJson" TEXT NOT NULL,
    "afterJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RuleChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyReport" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "paperPnl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "winRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "openPositions" INTEGER NOT NULL DEFAULT 0,
    "newSignals" INTEGER NOT NULL DEFAULT 0,
    "copiedSignals" INTEGER NOT NULL DEFAULT 0,
    "watchedSignals" INTEGER NOT NULL DEFAULT 0,
    "skippedSignals" INTEGER NOT NULL DEFAULT 0,
    "bestWalletsJson" TEXT NOT NULL,
    "worstWalletsJson" TEXT NOT NULL,
    "ruleChangesJson" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "sentToTelegram" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyReport_pkey" PRIMARY KEY ("id")
);

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
CREATE UNIQUE INDEX "WalletProfile_address_key" ON "WalletProfile"("address");

-- CreateIndex
CREATE INDEX "WalletProfile_status_idx" ON "WalletProfile"("status");

-- CreateIndex
CREATE INDEX "WalletProfile_globalScore_idx" ON "WalletProfile"("globalScore");

-- CreateIndex
CREATE INDEX "WalletProfile_bestCategory_idx" ON "WalletProfile"("bestCategory");

-- CreateIndex
CREATE INDEX "ObservedTrade_walletAddress_idx" ON "ObservedTrade"("walletAddress");

-- CreateIndex
CREATE INDEX "ObservedTrade_marketId_idx" ON "ObservedTrade"("marketId");

-- CreateIndex
CREATE INDEX "ObservedTrade_timestamp_idx" ON "ObservedTrade"("timestamp");

-- CreateIndex
CREATE INDEX "ObservedTrade_conditionId_idx" ON "ObservedTrade"("conditionId");

-- CreateIndex
CREATE INDEX "ObservedTrade_transactionHash_idx" ON "ObservedTrade"("transactionHash");

-- CreateIndex
CREATE INDEX "MarketSnapshot_marketId_idx" ON "MarketSnapshot"("marketId");

-- CreateIndex
CREATE INDEX "MarketSnapshot_conditionId_idx" ON "MarketSnapshot"("conditionId");

-- CreateIndex
CREATE INDEX "MarketSnapshot_collectedAt_idx" ON "MarketSnapshot"("collectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DecisionJournal_observedTradeId_key" ON "DecisionJournal"("observedTradeId");

-- CreateIndex
CREATE INDEX "DecisionJournal_walletAddress_idx" ON "DecisionJournal"("walletAddress");

-- CreateIndex
CREATE INDEX "DecisionJournal_marketId_idx" ON "DecisionJournal"("marketId");

-- CreateIndex
CREATE INDEX "DecisionJournal_decision_idx" ON "DecisionJournal"("decision");

-- CreateIndex
CREATE INDEX "DecisionJournal_createdAt_idx" ON "DecisionJournal"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaperTrade_decisionJournalId_key" ON "PaperTrade"("decisionJournalId");

-- CreateIndex
CREATE INDEX "PaperTrade_walletAddress_idx" ON "PaperTrade"("walletAddress");

-- CreateIndex
CREATE INDEX "PaperTrade_marketId_idx" ON "PaperTrade"("marketId");

-- CreateIndex
CREATE INDEX "PaperTrade_status_idx" ON "PaperTrade"("status");

-- CreateIndex
CREATE INDEX "PaperTrade_openedAt_idx" ON "PaperTrade"("openedAt");

-- CreateIndex
CREATE INDEX "PnlSnapshot_paperTradeId_idx" ON "PnlSnapshot"("paperTradeId");

-- CreateIndex
CREATE INDEX "PnlSnapshot_collectedAt_idx" ON "PnlSnapshot"("collectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OutcomeReview_decisionJournalId_key" ON "OutcomeReview"("decisionJournalId");

-- CreateIndex
CREATE UNIQUE INDEX "OutcomeReview_paperTradeId_key" ON "OutcomeReview"("paperTradeId");

-- CreateIndex
CREATE INDEX "OutcomeReview_walletAddress_idx" ON "OutcomeReview"("walletAddress");

-- CreateIndex
CREATE INDEX "OutcomeReview_marketId_idx" ON "OutcomeReview"("marketId");

-- CreateIndex
CREATE INDEX "OutcomeReview_reviewTime_idx" ON "OutcomeReview"("reviewTime");

-- CreateIndex
CREATE INDEX "OutcomeReview_wasDecisionGood_idx" ON "OutcomeReview"("wasDecisionGood");

-- CreateIndex
CREATE UNIQUE INDEX "RuleSet_version_key" ON "RuleSet"("version");

-- CreateIndex
CREATE INDEX "RuleSet_active_idx" ON "RuleSet"("active");

-- CreateIndex
CREATE INDEX "RuleSet_version_idx" ON "RuleSet"("version");

-- CreateIndex
CREATE INDEX "RuleChange_oldRuleSetId_idx" ON "RuleChange"("oldRuleSetId");

-- CreateIndex
CREATE INDEX "RuleChange_newRuleSetId_idx" ON "RuleChange"("newRuleSetId");

-- CreateIndex
CREATE INDEX "RuleChange_createdAt_idx" ON "RuleChange"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DailyReport_date_key" ON "DailyReport"("date");

-- CreateIndex
CREATE INDEX "DailyReport_date_idx" ON "DailyReport"("date");

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

-- AddForeignKey
ALTER TABLE "ObservedTrade" ADD CONSTRAINT "ObservedTrade_walletAddress_fkey" FOREIGN KEY ("walletAddress") REFERENCES "WalletProfile"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionJournal" ADD CONSTRAINT "DecisionJournal_observedTradeId_fkey" FOREIGN KEY ("observedTradeId") REFERENCES "ObservedTrade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionJournal" ADD CONSTRAINT "DecisionJournal_walletAddress_fkey" FOREIGN KEY ("walletAddress") REFERENCES "WalletProfile"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperTrade" ADD CONSTRAINT "PaperTrade_decisionJournalId_fkey" FOREIGN KEY ("decisionJournalId") REFERENCES "DecisionJournal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperTrade" ADD CONSTRAINT "PaperTrade_walletAddress_fkey" FOREIGN KEY ("walletAddress") REFERENCES "WalletProfile"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PnlSnapshot" ADD CONSTRAINT "PnlSnapshot_paperTradeId_fkey" FOREIGN KEY ("paperTradeId") REFERENCES "PaperTrade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutcomeReview" ADD CONSTRAINT "OutcomeReview_decisionJournalId_fkey" FOREIGN KEY ("decisionJournalId") REFERENCES "DecisionJournal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutcomeReview" ADD CONSTRAINT "OutcomeReview_paperTradeId_fkey" FOREIGN KEY ("paperTradeId") REFERENCES "PaperTrade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutcomeReview" ADD CONSTRAINT "OutcomeReview_walletAddress_fkey" FOREIGN KEY ("walletAddress") REFERENCES "WalletProfile"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleChange" ADD CONSTRAINT "RuleChange_oldRuleSetId_fkey" FOREIGN KEY ("oldRuleSetId") REFERENCES "RuleSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleChange" ADD CONSTRAINT "RuleChange_newRuleSetId_fkey" FOREIGN KEY ("newRuleSetId") REFERENCES "RuleSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;