// lib/scoring/wallet-scorer.ts
// Wallet scoring engine with ROI, consistency, copyability, one-hit-wonder penalty

import { ParsedWalletTrade, WalletScore, RuleSet } from '../types';

export interface WalletRawData {
  address: string;
  label?: string;
  sourceRank?: number;
  trades: ParsedWalletTrade[];
  markets: Map<string, { category?: string; liquidity: number; spread: number; endDate?: string }>;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function scoreWallet(rawData: WalletRawData, rules?: RuleSet['rules']): WalletScore {
  const { address, label, sourceRank, trades, markets } = rawData;
  
  if (trades.length === 0) {
    return emptyScore(address, label, sourceRank);
  }
  
  // Separate resolved and unresolved trades
  const resolvedTrades = trades.filter(t => {
    const market = markets.get(t.conditionId);
    return market?.endDate && new Date(market.endDate) < new Date();
  });
  
  const unresolvedTrades = trades.filter(t => {
    const market = markets.get(t.conditionId);
    return !market?.endDate || new Date(market.endDate) >= new Date();
  });
  
  // ROI calculation (based on resolved trades)
  let totalPnl = 0;
  let totalInvested = 0;
  
  for (const trade of resolvedTrades) {
    const market = markets.get(trade.conditionId);
    if (!market || !trade.outcome) continue;
    
    // In a real implementation, we'd check the actual resolution
    // For now, estimate based on price at time of trade vs now
    // This is a simplified heuristic
    const entryValue = trade.size * trade.price;
    totalInvested += entryValue;
    
    // Estimate current value (simplified)
    // Real implementation would use resolution outcome
    totalPnl += entryValue * 0.1; // Placeholder
  }
  
  const roi30d = totalInvested > 0 ? totalPnl / totalInvested : 0;
  
  // Win rate on resolved trades
  const winRate30d = resolvedTrades.length > 0 
    ? resolvedTrades.filter(t => {
        // Simplified - in production check actual resolution
        return true; // placeholder
      }).length / resolvedTrades.length 
    : 0;
  
  // Consistency score
  const tradeCount30d = trades.length;
  const resolvedTradeCount30d = resolvedTrades.length;
  
  const tradeCountScore = clamp(resolvedTradeCount30d / 20, 0, 1);
  const winRateScore = winRate30d;
  
  let winRatePenalty = 1;
  if (winRate30d > 0.8) winRatePenalty = 0.8;
  else if (winRate30d < 0.3) winRatePenalty = winRate30d / 0.3;
  
  const consistencyScore = clamp(
    winRateScore * 0.5 + tradeCountScore * 0.3 + winRatePenalty * 0.2,
    0, 1
  );
  
  // Copyability score
  let avgLiquidity = 0;
  let avgSpread = 0;
  let avgEntryTiming = 0;
  let validMarkets = 0;
  
  for (const trade of trades) {
    const market = markets.get(trade.conditionId);
    if (market) {
      avgLiquidity += market.liquidity || 0;
      avgSpread += market.spread || 0;
      if (market.endDate) {
        const hoursToResolution = (new Date(market.endDate).getTime() - trade.timestamp.getTime()) / (1000 * 60 * 60);
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
  
  const liquidityScore = clamp(Math.log10(avgLiquidity + 1) / 5, 0, 1);
  const spreadScore = clamp(1 - avgSpread / 0.05, 0, 1);
  const timingScore = avgEntryTiming > 0 
    ? clamp(1 - avgEntryTiming / 72, 0, 1) 
    : 0.5;
  const sizeScore = clamp((trades.reduce((sum, t) => sum + t.size * t.price, 0) / trades.length) / 1000, 0, 1);
  
  const copyabilityScore = clamp(
    timingScore * 0.3 + liquidityScore * 0.3 + spreadScore * 0.2 + sizeScore * 0.2,
    0, 1
  );
  
  // Category strengths
  const categoryStrengths: Record<string, number> = {};
  const categoryTrades: Record<string, { wins: number; total: number }> = {};
  
  for (const trade of resolvedTrades) {
    const market = markets.get(trade.conditionId);
    if (!market?.category) continue;
    
    if (!categoryTrades[market.category]) {
      categoryTrades[market.category] = { wins: 0, total: 0 };
    }
    categoryTrades[market.category].total++;
    // Simplified - in production check actual win
    categoryTrades[market.category].wins++;
  }
  
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
  
  // One-hit-wonder penalty
  let oneHitWonderPenalty = 0;
  
  if (resolvedTradeCount30d < 3) {
    oneHitWonderPenalty = 0.8;
  } else {
    const totalResolved = resolvedTradeCount30d;
    const totalWon = resolvedTrades.length; // placeholder
    const tradesPerWin = totalResolved / Math.max(1, totalWon);
    
    if (tradesPerWin > 10 && roi30d > 0.3) {
      oneHitWonderPenalty = 0.6;
    } else if (winRate30d < 0.4 && roi30d > 0.2) {
      oneHitWonderPenalty = 0.5;
    }
  }
  
  // Global score
  const weights = rules?.walletScoreWeights || {
    roi: 0.25,
    consistency: 0.20,
    copyability: 0.20,
    liquidity: 0.10,
    spread: 0.10,
    timing: 0.05,
    diversity: 0.10,
    oneHitWonderPenalty: 0.30,
  };
  
  const diversityScore = Object.keys(categoryStrengths).length === 0 ? 0.3 :
    Object.keys(categoryStrengths).length === 1 ? 0.6 :
    Object.keys(categoryStrengths).length <= 3 ? 1.0 :
    Math.max(0.7, 1.2 - Object.keys(categoryStrengths).length * 0.1);
  
  let globalScore = clamp(
    clamp(roi30d / 0.5, 0, 1) * weights.roi +
    consistencyScore * weights.consistency +
    copyabilityScore * weights.copyability +
    liquidityScore * weights.liquidity +
    spreadScore * weights.spread +
    timingScore * weights.timing +
    diversityScore * weights.diversity -
    oneHitWonderPenalty * weights.oneHitWonderPenalty,
    0, 1
  );
  
  // Status determination
  const minTrades = rules?.minResolvedTrades30d || 5;
  const minRoi = rules?.minRoi30d || 0.05;
  const minLiquidity = rules?.minLiquidity || 1000;
  const maxSpread = rules?.maxSpread || 0.05;
  const minGlobalTrack = rules?.minGlobalScoreForTrack || 0.65;
  const minGlobalWatch = rules?.minGlobalScoreForWatch || 0.45;
  
  let status: 'TRACK' | 'WATCH' | 'IGNORE' = 'IGNORE';
  let statusReason = '';
  
  if (resolvedTradeCount30d < minTrades) {
    statusReason = `Insufficient resolved trades (${resolvedTradeCount30d} < ${minTrades})`;
  } else if (roi30d < minRoi) {
    statusReason = `ROI too low (${(roi30d * 100).toFixed(1)}% < ${(minRoi * 100).toFixed(1)}%)`;
  } else if (avgLiquidity < minLiquidity) {
    statusReason = `Average liquidity too low ($${avgLiquidity.toFixed(0)} < $${minLiquidity})`;
  } else if (avgSpread > maxSpread) {
    statusReason = `Average spread too wide (${(avgSpread * 100).toFixed(1)}% > ${(maxSpread * 100).toFixed(1)}%)`;
  } else if (globalScore >= minGlobalTrack) {
    status = 'TRACK';
    statusReason = 'High global score, tracking for copy trades';
  } else if (globalScore >= minGlobalWatch) {
    status = 'WATCH';
    statusReason = 'Moderate global score, watching for opportunities';
  } else {
    statusReason = `Global score below threshold (${globalScore.toFixed(2)} < ${minGlobalWatch})`;
  }
  
  // Notes
  const copyabilityNotes = [];
  if (avgEntryTiming > 48) copyabilityNotes.push('Typically enters early (>48h before resolution)');
  else if (avgEntryTiming < 12) copyabilityNotes.push('Typically enters late (<12h before resolution)');
  if (avgLiquidity > 100000) copyabilityNotes.push('Trades in highly liquid markets');
  else if (avgLiquidity < 5000) copyabilityNotes.push('Trades in low-liquidity markets');
  
  const riskNotes = [];
  if (oneHitWonderPenalty > 0.5) riskNotes.push('One-hit-wonder profile - most profit from few trades');
  if (winRate30d < 0.4) riskNotes.push('Low win rate on resolved markets');
  if (avgSpread > 0.03) riskNotes.push('Frequently trades wide spreads');
  
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