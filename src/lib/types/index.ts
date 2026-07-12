// lib/types/index.ts
// Core type definitions for the Polymarket copy trading bot

export interface PolymarketEvent {
  id: string;
  title: string;
  slug: string;
  description?: string;
  volume: number;
  liquidity: number;
  openInterest: number;
  active: boolean;
  closed: boolean;
  category?: string;
  startDate?: string;
  endDate?: string;
  markets: PolymarketMarket[];
}

export interface PolymarketMarket {
  id: string;
  question: string;
  conditionId: string;
  slug: string;
  description?: string;
  outcomes: string;           // JSON string: ["Yes", "No"]
  outcomePrices: string;      // JSON string: ["0.65", "0.35"]
  clobTokenIds: string;       // JSON string: ["token_yes", "token_no"]
  volume: number;
  liquidity: number;
  active: boolean;
  closed: boolean;
  marketType?: string;
  endDate?: string;
  category?: string;
  createdAt?: string;
  resolvedOutcome?: string;
  status?: 'ACTIVE' | 'RESOLVED' | 'CLOSED';
}

export interface ParsedMarket {
  id: string;
  question: string;
  conditionId: string;
  slug: string;
  description?: string;
  outcomes: string[];
  outcomePrices: number[];
  clobTokenIds: string[];
  volume: number;
  liquidity: number;
  active: boolean;
  closed: boolean;
  marketType?: string;
  endDate?: string;
  category?: string;
  createdAt?: string;
  resolvedOutcome?: string;
  status?: 'ACTIVE' | 'RESOLVED' | 'CLOSED';
  spread?: number;
}

export interface LeaderboardEntry {
  rank: number;
  address: string;
  label?: string;
  pnl: number;
  roi: number;
  volume: number;
  trades: number;
  winRate: number;
  categories?: Record<string, number>;
}

export interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
}

export interface WalletTradesResponse {
  trades: WalletTrade[];
  nextCursor?: string;
}

export interface WalletTrade {
  id: string;
  wallet: string;
  market: string;
  conditionId: string;
  outcome: string;
  side: 'BUY' | 'SELL';
  size: number;
  price: number;
  timestamp: string;
  transactionHash: string;
  title?: string;
  slug?: string;
}

export interface ClobPriceResponse {
  price: string;
}

export interface ClobMidpointResponse {
  mid: string;
}

export interface ClobSpreadResponse {
  spread: string;
}

export interface ClobOrderbookResponse {
  market: string;
  asset_id: string;
  bids: ClobOrder[];
  asks: ClobOrder[];
  min_order_size: string;
  tick_size: string;
  last_trade_price: string;
}

export interface ClobOrder {
  price: string;
  size: string;
}

export interface ClobPriceHistoryResponse {
  history: ClobPricePoint[];
}

export interface ClobPricePoint {
  t: number;  // Unix timestamp
  p: string;  // Price
}

export interface ClobMarketsResponse {
  data: ClobMarket[];
  next_cursor?: string;
  limit: number;
  count: number;
}

export interface ClobMarket {
  condition_id: string;
  question: string;
  tokens: ClobToken[];
  active: boolean;
  closed: boolean;
}

export interface ClobToken {
  token_id: string;
  outcome: string;
  price: number;
}

export interface DataApiTrade {
  side: 'BUY' | 'SELL';
  size: number;
  price: number;
  timestamp: string;
  title: string;
  slug: string;
  outcome: string;
  transactionHash: string;
  conditionId: string;
  proxyWallet: string;
  asset: string;
  icon: string;
  eventSlug: string;
  outcomeIndex: number;
  name: string;
  pseudonym: string;
  bio: string;
  profileImage: string;
  profileImageOptimized: string;
}

export interface DataApiTradesResponse {
  trades: DataApiTrade[];
  nextCursor?: string;
}

export interface DataApiOiResponse {
  openInterest: number;
}

// Parsed types for internal use
export interface ParsedWalletTrade {
  id: string;
  wallet: string;
  marketId: string;
  conditionId: string;
  marketQuestion: string;
  marketCategory?: string;
  outcome: string;
  side: 'BUY' | 'SELL';
  size: number;
  price: number;
  walletEntryPrice: number;
  timestamp: Date;
  transactionHash: string;
  title?: string;
  slug?: string;
}

export interface MarketSnapshot {
  marketId: string;
  conditionId: string;
  question: string;
  category?: string;
  yesPrice?: number;
  noPrice?: number;
  bestBid?: number;
  bestAsk?: number;
  spread?: number;
  liquidity?: number;
  volume?: number;
  timeToResolution?: number; // hours
  collectedAt: Date;
}

export interface WalletScore {
  address: string;
  label?: string;
  sourceRank?: number;
  roi30d: number;
  consistencyScore: number;
  copyabilityScore: number;
  oneHitWonderPenalty: number;
  globalScore: number;
  bestCategory?: string;
  categoryStrengths: Record<string, number>;
  averageTradeSize: number;
  tradeCount30d: number;
  resolvedTradeCount30d: number;
  winRate30d: number;
  averageLiquidity: number;
  averageSpread: number;
  averageEntryTiming: number;
  copyabilityNotes?: string;
  riskNotes?: string;
  status: 'TRACK' | 'WATCH' | 'IGNORE';
  statusReason: string;
  walletEntryPrice?: number;
}

export interface TradeScore {
  walletQuality: number;      // 0-1
  priceMovement: number;      // 0-1
  liquidity: number;          // 0-1
  spread: number;             // 0-1
  timeToResolution: number;   // 0-1
  categoryMatch: number;      // 0-1
  positionSize: number;       // 0-1
  thesis: number;             // 0-1
  total: number;              // 0-1
  decision: 'PAPER_COPY' | 'WATCHLIST' | 'SKIP';
  reasons: string[];
  risks: string[];
}

export interface PaperTradeData {
  decisionJournalId: string;
  walletAddress: string;
  marketId: string;
  outcome: string;
  side: 'BUY' | 'SELL';
  entryPrice: number;
  currentPrice: number;
  simulatedPositionSize: number; // $5-$20
  unrealizedPnl: number;
  realizedPnl: number;
  status: 'OPEN' | 'CLOSED' | 'RESOLVED';
}

export interface RuleSet {
  version: number;
  active: boolean;
  rules: {
    // Wallet scoring thresholds
    minRoi30d: number;
    minConsistencyScore: number;
    minCopyabilityScore: number;
    maxOneHitWonderPenalty: number;
    minGlobalScoreForTrack: number;
    minGlobalScoreForWatch: number;
    minResolvedTrades30d: number;
    minLiquidity: number;
    maxSpread: number;
    maxEntryTimingHours: number;

    // Trade scoring thresholds
    minTradeScoreForCopy: number;
    minTradeScoreForWatch: number;
    minPriceMovementForCopy: number;
    minLiquidityForCopy: number;
    maxSpreadForCopy: number;
    minTimeToResolutionHours: number;

    // Weights
    walletScoreWeights: {
      roi: number;
      consistency: number;
      copyability: number;
      liquidity: number;
      spread: number;
      timing: number;
      diversity: number;
      oneHitWonderPenalty: number;
    };
    tradeScoreWeights: {
      walletQuality: number;
      priceMovement: number;
      liquidity: number;
      spread: number;
      timeToResolution: number;
      categoryMatch: number;
      positionSize: number;
    };
  };
}

export interface DailyReportData {
  date: Date;
  paperPnl: number;
  winRate: number;
  openPositions: number;
  newSignals: number;
  copiedSignals: number;
  watchedSignals: number;
  skippedSignals: number;
  bestWallets: Array<{ address: string; pnl: number }>;
  worstWallets: Array<{ address: string; pnl: number }>;
  ruleChanges: string[];
  summary: string;
}

// Raw data for wallet scoring
export interface WalletRawData {
  address: string;
  label?: string;
  sourceRank?: number;
  trades: ParsedWalletTrade[];
  markets: Map<string, { category?: string; liquidity: number; spread: number; endDate?: string }>;
}

// Market metadata for scoring
export interface MarketMetadata {
  conditionId: string;
  question: string;
  slug: string;
  category: string | null;
  endDate: Date | null;
  resolvedOutcome: string | null;
  active: boolean;
  closed: boolean;
  volume: number | null;
  liquidity: number | null;
  spread: number | null;
}