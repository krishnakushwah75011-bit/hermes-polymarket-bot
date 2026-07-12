// src/lib/scoring/wallet-scorer-v2.ts
// Improved wallet scoring using historical trade data and resolved market outcomes (using pg pool)

import { query } from '../db/pool';
import { ParsedWalletTrade, WalletScore, RuleSet, WalletRawData, MarketMetadata } from '../types';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

interface ScoredWallet {
  address: string;
  label?: string;
  sourceRank?: number;
  trades: ParsedWalletTrade[];
  marketMetadata: Map<string, MarketMetadata>;
}

export async function scoreWalletV2(
  rawData: WalletRawData,
  rules?: RuleSet['rules']
): Promise<WalletScore> {
  const { address, label, sourceRank, trades, markets } = rawData;
  
  if (trades.length === 0) {
    return emptyScore(address, label, sourceRank);
  }
  
  // Fetch market metadata for all trades
  const conditionIds = Array.from(new Set(trades.map(t => t.conditionId)));
  const marketMetadata = await fetchMarketMetadata(conditionIds);
  
  // Separate resolved and unresolved trades
  const { resolvedTrades, unresolvedTrades } = separateResolvedTrades(trades, marketMetadata);
  
  // Calculate ROI from resolved trades
  const { roi30d, winRate30d, totalInvested, totalPnl } = calculateROI(resolvedTrades, marketMetadata);
  
  // Trade counts
  const tradeCount30d = trades.length;
  const resolvedTradeCount30d = resolvedTrades.length;
  
  // Consistency score
  const consistencyScore = calculateConsistency(resolvedTrades, tradeCount30d, resolvedTradeCount30d, winRate30d);
  
  // Copyability score (liquidity, spread, timing, size)
  const { copyabilityScore, avgLiquidity, avgSpread, avgEntryTiming } = calculateCopyability(
    trades,
    marketMetadata
  );
  
  // Category strengths
  const { categoryStrengths, bestCategory } = calculateCategoryStrengths(
    resolvedTrades,
    marketMetadata
  );
  
  // One-hit-wonder penalty
  const oneHitWonderPenalty = calculateOneHitWonderPenalty(
    resolvedTradeCount30d,
    winRate30d,
    roi30d,
    trades
  );
  
  // Diversity score
  const diversityScore = calculateDiversity(categoryStrengths);
  
  // Global score
  const weights = rules?.walletScoreWeights || defaultWeights();
  const globalScore = clamp(
    clamp(roi30d / 0.5, 0, 1) * weights.roi +
    consistencyScore * weights.consistency +
    copyabilityScore * weights.copyability +
    (avgLiquidity / 100000) * weights.liquidity +  // normalize liquidity
    (1 - avgSpread) * weights.spread +
    avgEntryTiming * weights.timing +
    diversityScore * weights.diversity -
    oneHitWonderPenalty * weights.oneHitWonderPenalty,
    0, 1
  );
  
  // Status determination
  const { status, statusReason } = determineStatus({
    resolvedTradeCount30d,
    roi30d,
    avgLiquidity,
    avgSpread,
    globalScore,
    rules,
  });
  
  // Notes
  const copyabilityNotes = generateCopyabilityNotes(avgEntryTiming, avgLiquidity, avgSpread);
  const riskNotes = generateRiskNotes(oneHitWonderPenalty, winRate30d, avgSpread);
  
  return {
    address,
    label,
    sourceRank,
    status,
    roi30d,
    consistencyScore,
    copyabilityScore,
    oneHitWonderPenalty,
    globalScore,
    bestCategory,
    categoryStrengths,
    averageTradeSize: trades.reduce((sum, t) => sum + t.size * t.price, 0) / trades.length,
    tradeCount30d,
    resolvedTradeCount30d,
    winRate30d,
    averageLiquidity: avgLiquidity,
    averageSpread: avgSpread,
    averageEntryTiming: avgEntryTiming,
    copyabilityNotes: copyabilityNotes.join('; '),
    riskNotes: riskNotes.join('; '),
    statusReason,
  };
}

async function fetchMarketMetadata(conditionIds: string[]): Promise<Map<string, MarketMetadata>> {
  if (conditionIds.length === 0) return new Map();
  
  const placeholders = conditionIds.map((_, i) => `$${i + 1}`).join(',');
  const result = await query(`
    SELECT "conditionId", question, slug, category, "endDate", "resolvedOutcome", active, closed, volume, liquidity, spread
    FROM "MarketMetadata" 
    WHERE "conditionId" IN (${placeholders})
  `, conditionIds);
  
  const map = new Map<string, MarketMetadata>();
  for (const m of result.rows) {
    map.set(m.conditionId, {
      conditionId: m.conditionId,
      question: m.question,
      slug: m.slug,
      category: m.category,
      endDate: m.endDate ? new Date(m.endDate) : undefined,
      resolvedOutcome: m.resolvedOutcome,
      active: m.active,
      closed: m.closed,
      volume: m.volume,
      liquidity: m.liquidity,
      spread: m.spread,
    });
  }
  return map;
}

function separateResolvedTrades(
  trades: ParsedWalletTrade[],
  marketMetadata: Map<string, MarketMetadata>
): { resolvedTrades: ParsedWalletTrade[]; unresolvedTrades: ParsedWalletTrade[] } {
  const resolved: ParsedWalletTrade[] = [];
  const unresolved: ParsedWalletTrade[] = [];
  
  for (const trade of trades) {
    const meta = marketMetadata.get(trade.conditionId);
    const isResolved = meta?.resolvedOutcome && meta.endDate && new Date(meta.endDate) < new Date();
    
    if (isResolved) {
      resolved.push(trade);
    } else {
      unresolved.push(trade);
    }
  }
  
  return { resolvedTrades: resolved, unresolvedTrades: unresolved };
}

function calculateROI(
  resolvedTrades: ParsedWalletTrade[],
  marketMetadata: Map<string, MarketMetadata>
): { roi30d: number; winRate30d: number; totalInvested: number; totalPnl: number } {
  let totalInvested = 0;
  let totalPnl = 0;
  let wins = 0;
  let resolvedCount = 0;
  
  for (const trade of resolvedTrades) {
    const meta = marketMetadata.get(trade.conditionId);
    if (!meta || !meta.resolvedOutcome) continue;
    
    const entryValue = trade.size * trade.walletEntryPrice;
    totalInvested += entryValue;
    
    // Check if trade won
    const won = trade.outcome === meta.resolvedOutcome;
    if (won) {
      // Win: get back shares * 1 (for binary markets, winner gets $1 per share)
      const payout = trade.size * 1.0;
      totalPnl += payout - entryValue;
      wins++;
    } else {
      // Loss: lose entry value
      totalPnl -= entryValue;
    }
    resolvedCount++;
  }
  
  const roi30d = totalInvested > 0 ? totalPnl / totalInvested : 0;
  const winRate30d = resolvedCount > 0 ? wins / resolvedCount : 0;
  
  return { roi30d, winRate30d, totalInvested, totalPnl };
}

function calculateConsistency(
  resolvedTrades: ParsedWalletTrade[],
  tradeCount30d: number,
  resolvedTradeCount30d: number,
  winRate30d: number
): number {
  // Need minimum resolved trades for meaningful consistency
  if (resolvedTrades.length < 3) return 0.2;
  
  const tradeCountScore = clamp(resolvedTrades.length / 20, 0, 1);
  const winRateScore = winRate30d;
  
  let winRatePenalty = 1;
  if (winRate30d > 0.8) winRatePenalty = 0.8;
  else if (winRate30d < 0.3) winRatePenalty = winRate30d / 0.3;
  
  return clamp(
    winRateScore * 0.5 + tradeCountScore * 0.3 + winRatePenalty * 0.2,
    0, 1
  );
}

function calculateCopyability(
  trades: ParsedWalletTrade[],
  marketMetadata: Map<string, MarketMetadata>
): { copyabilityScore: number; avgLiquidity: number; avgSpread: number; avgEntryTiming: number } {
  let avgLiquidity = 0;
  let avgSpread = 0;
  let avgEntryTiming = 0;
  let validMarkets = 0;
  
  for (const trade of trades) {
    const meta = marketMetadata.get(trade.conditionId);
    if (meta) {
      avgLiquidity += meta.liquidity || 0;
      avgSpread += meta.spread || 0;
      if (meta.endDate) {
        const hoursToResolution = (new Date(meta.endDate).getTime() - trade.timestamp.getTime()) / (1000 * 60 * 60);
        avgEntryTiming += Math.max(0, hoursToResolution);
      }
      validMarkets++;
    }
  }
  
  if (validMarkets > 0) {
    avgLiquidity /= validMarkets;
    avgSpread /= validMarkets;
    avgEntryTiming /= validMarkets;
  }
  
  // Score components
  const liquidityScore = clamp(Math.log10(avgLiquidity + 1) / 6, 0, 1);
  const spreadScore = clamp(1 - avgSpread / 0.05, 0, 1);
  const timingScore = avgEntryTiming > 0
    ? clamp(1 - avgEntryTiming / 72, 0, 1)
    : 0.5;
  const sizeScore = clamp(
    (trades.reduce((sum, t) => sum + t.size * t.price, 0) / trades.length) / 1000, 
    0, 1
  );
  
  const copyabilityScore = clamp(
    timingScore * 0.3 + liquidityScore * 0.3 + spreadScore * 0.2 + sizeScore * 0.2,
    0, 1
  );
  
  return { copyabilityScore, avgLiquidity, avgSpread, avgEntryTiming };
}

function calculateCategoryStrengths(
  resolvedTrades: ParsedWalletTrade[],
  marketMetadata: Map<string, MarketMetadata>
): { categoryStrengths: Record<string, number>; bestCategory?: string } {
  const categoryTrades: Record<string, { wins: number; total: number }> = {};
  
  for (const trade of resolvedTrades) {
    const meta = marketMetadata.get(trade.conditionId);
    if (!meta?.category) continue;
    
    if (!categoryTrades[meta.category]) {
      categoryTrades[meta.category] = { wins: 0, total: 0 };
    }
    categoryTrades[meta.category].total++;
    
    if (meta.resolvedOutcome && trade.outcome === meta.resolvedOutcome) {
      categoryTrades[meta.category].wins++;
    }
  }
  
  const categoryStrengths: Record<string, number> = {};
  let bestCategory: string | undefined;
  let bestCategoryScore = 0;
  
  for (const [category, rates] of Object.entries(categoryTrades)) {
    if (rates.total >= 3) {
      const score = rates.wins / rates.total;
      categoryStrengths[category] = score;
      if (score > bestCategoryScore) {
        bestCategoryScore = score;
        bestCategory = category;
      }
    }
  }
  
  return { categoryStrengths, bestCategory };
}

function calculateOneHitWonderPenalty(
  resolvedTradeCount30d: number,
  winRate30d: number,
  roi30d: number,
  trades: ParsedWalletTrade[]
): number {
  if (resolvedTradeCount30d < 3) {
    return 0.8;
  }
  
  const totalResolved = resolvedTradeCount30d;
  const totalWon = Math.round(resolvedTradeCount30d * winRate30d);
  const tradesPerWin = totalResolved / Math.max(1, totalWon);
  
  if (tradesPerWin > 10 && roi30d > 0.3) {
    return 0.6;
  } else if (winRate30d < 0.4 && roi30d > 0.2) {
    return 0.5;
  }
  return 0;
}

function calculateDiversity(categoryStrengths: Record<string, number>): number {
  const count = Object.keys(categoryStrengths).length;
  if (count === 0) return 0.3;
  if (count === 1) return 0.6;
  if (count <= 3) return 1.0;
  return Math.max(0.7, 1.2 - count * 0.1);
}

function defaultWeights() {
  return {
    roi: 0.25,
    consistency: 0.20,
    copyability: 0.20,
    liquidity: 0.10,
    spread: 0.10,
    timing: 0.05,
    diversity: 0.10,
    oneHitWonderPenalty: 0.30,
  };
}

function determineStatus({
  resolvedTradeCount30d,
  roi30d,
  avgLiquidity,
  avgSpread,
  globalScore,
  rules,
}: {
  resolvedTradeCount30d: number;
  roi30d: number;
  avgLiquidity: number;
  avgSpread: number;
  globalScore: number;
  rules?: RuleSet['rules'];
}): { status: 'TRACK' | 'WATCH' | 'IGNORE'; statusReason: string } {
  const minTrades = rules?.minResolvedTrades30d || 5;
  const minRoi = rules?.minRoi30d || 0.05;
  const minLiquidity = rules?.minLiquidity || 1000;
  const maxSpread = rules?.maxSpread || 0.05;
  const minGlobalTrack = rules?.minGlobalScoreForTrack || 0.65;
  const minGlobalWatch = rules?.minGlobalScoreForWatch || 0.45;
  
  if (resolvedTradeCount30d < minTrades) {
    return { status: 'IGNORE', statusReason: `Insufficient resolved trades (${resolvedTradeCount30d} < ${minTrades})` };
  }
  if (roi30d < minRoi) {
    return { status: 'IGNORE', statusReason: `ROI too low (${(roi30d * 100).toFixed(1)}% < ${(minRoi * 100).toFixed(1)}%)` };
  }
  if (avgLiquidity < minLiquidity) {
    return { status: 'IGNORE', statusReason: `Average liquidity too low ($${avgLiquidity.toFixed(0)} < $${minLiquidity})` };
  }
  if (avgSpread > maxSpread) {
    return { status: 'IGNORE', statusReason: `Average spread too wide (${(avgSpread * 100).toFixed(1)}% > ${(maxSpread * 100).toFixed(1)}%)` };
  }
  if (globalScore >= minGlobalTrack) {
    return { status: 'TRACK', statusReason: 'High global score, tracking for copy trades' };
  }
  if (globalScore >= minGlobalWatch) {
    return { status: 'WATCH', statusReason: 'Moderate global score, watching for opportunities' };
  }
  return { status: 'IGNORE', statusReason: `Global score below threshold (${globalScore.toFixed(2)} < ${minGlobalWatch})` };
}

function generateCopyabilityNotes(avgEntryTiming: number, avgLiquidity: number, avgSpread: number): string[] {
  const notes: string[] = [];
  if (avgEntryTiming > 48) notes.push('Typically enters early (>48h before resolution)');
  else if (avgEntryTiming < 12) notes.push('Typically enters late (<12h before resolution)');
  if (avgLiquidity > 100000) notes.push('Trades in highly liquid markets');
  else if (avgLiquidity < 5000) notes.push('Trades in low-liquidity markets');
  if (avgSpread > 0.03) notes.push('Frequently trades wide spreads');
  return notes;
}

function generateRiskNotes(oneHitWonderPenalty: number, winRate30d: number, avgSpread: number): string[] {
  const notes: string[] = [];
  if (oneHitWonderPenalty > 0.5) notes.push('One-hit-wonder profile - most profit from few trades');
  if (winRate30d < 0.4) notes.push('Low win rate on resolved markets');
  if (avgSpread > 0.03) notes.push('Frequently trades wide spreads');
  return notes;
}

function emptyScore(address: string, label?: string, sourceRank?: number): WalletScore {
  return {
    address,
    label,
    sourceRank,
    status: 'IGNORE',
    roi30d: 0,
    consistencyScore: 0,
    copyabilityScore: 0,
    oneHitWonderPenalty: 0,
    globalScore: 0,
    bestCategory: undefined,
    categoryStrengths: {},
    averageTradeSize: 0,
    tradeCount30d: 0,
    resolvedTradeCount30d: 0,
    winRate30d: 0,
    averageLiquidity: 0,
    averageSpread: 0,
    averageEntryTiming: 0,
    copyabilityNotes: 'No trades found in lookback period',
    riskNotes: 'No trading history',
    statusReason: 'No trades in lookback period',
  };
}

export { scoreWalletV2 as scoreWallet };