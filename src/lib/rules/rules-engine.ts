// lib/rules/rules-engine.ts
// Self-improving rules engine with versioning and auto-adaptation

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface RuleSet {
  id: string;
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
    maxPriceMovementSinceEntry: number;
    
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
    
    // Paper trading
    paperMinPosition: number;
    paperMaxPosition: number;
    maxConcurrentPaperTrades: number;
    
    // Risk
    maxDrawdownPercent: number;
    stopLossPercent: number;
    takeProfitPercent: number;
  };
}

export const DEFAULT_RULESET: RuleSet = {
  id: '',
  version: 1,
  active: true,
  rules: {
    minRoi30d: 0.05,
    minConsistencyScore: 0.3,
    minCopyabilityScore: 0.3,
    maxOneHitWonderPenalty: 0.5,
    minGlobalScoreForTrack: 0.65,
    minGlobalScoreForWatch: 0.45,
    minResolvedTrades30d: 5,
    minLiquidity: 1000,
    maxSpread: 0.05,
    maxEntryTimingHours: 72,
    maxPriceMovementSinceEntry: 0.15,
    
    minTradeScoreForCopy: 0.65,
    minTradeScoreForWatch: 0.45,
    minPriceMovementForCopy: 0.4,
    minLiquidityForCopy: 1000,
    maxSpreadForCopy: 0.05,
    minTimeToResolutionHours: 1,
    
    walletScoreWeights: {
      roi: 0.25,
      consistency: 0.20,
      copyability: 0.20,
      liquidity: 0.10,
      spread: 0.10,
      timing: 0.05,
      diversity: 0.10,
      oneHitWonderPenalty: 0.30,
    },
    
    tradeScoreWeights: {
      walletQuality: 0.30,
      priceMovement: 0.20,
      liquidity: 0.15,
      spread: 0.10,
      timeToResolution: 0.10,
      categoryMatch: 0.10,
      positionSize: 0.05,
    },
    
    paperMinPosition: 5,
    paperMaxPosition: 20,
    maxConcurrentPaperTrades: 50,
    
    maxDrawdownPercent: 0.20,
    stopLossPercent: 0.50,
    takeProfitPercent: 1.0,
  },
};

const ADAPTATION_TRIGGERS = [
  {
    name: 'low_liquidity_losses',
    condition: (stats: AdaptationStats) => stats.lowLiquidityLossRate > 0.6 && stats.lowLiquidityTradeCount >= 5,
    parameter: 'minLiquidityForCopy',
    adjustment: (current: number) => current * 1.5,
    reason: 'Low-liquidity trades losing >60%',
    minTrades: 20,
  },
  {
    name: 'wide_spread_losses',
    condition: (stats: AdaptationStats) => stats.wideSpreadLossRate > 0.65 && stats.wideSpreadTradeCount >= 6,
    parameter: 'maxSpreadForCopy',
    adjustment: (current: number) => current * 0.7,
    reason: 'Wide-spread trades (>5%) losing >65%',
    minTrades: 20,
  },
  {
    name: 'category_outperformance',
    condition: (stats: AdaptationStats) => stats.bestCategoryWinRate > stats.avgWinRate * 1.3 && stats.bestCategoryTradeCount >= 10,
    parameter: 'tradeScoreWeights.categoryMatch',
    adjustment: (current: number) => current * 1.5,
    reason: 'One category outperforming by >30%',
    minTrades: 20,
  },
  {
    name: 'one_hit_wonder_losses',
    condition: (stats: AdaptationStats) => stats.oneHitWonderLossRate > 0.7 && stats.oneHitWonderTradeCount >= 5,
    parameter: 'maxOneHitWonderPenalty',
    adjustment: (current: number) => current * 1.2,
    reason: 'High-penalty wallets losing >70%',
    minTrades: 20,
  },
  {
    name: 'late_entry_losses',
    condition: (stats: AdaptationStats) => stats.lateEntryLossRate > 0.7 && stats.lateEntryTradeCount >= 5,
    parameter: 'maxPriceMovementSinceEntry',
    adjustment: (current: number) => current * 0.8,
    reason: 'Late entries (>15% price move) losing >70%',
    minTrades: 20,
  },
  {
    name: 'low_winrate_wallets_winning',
    condition: (stats: AdaptationStats) => stats.subThresholdWalletWinRate > 0.6 && stats.subThresholdWalletTradeCount >= 10,
    parameter: 'minGlobalScoreForWatch',
    adjustment: (current: number) => current * 0.95,
    reason: 'Sub-threshold wallets winning >60% of paper trades',
    minTrades: 20,
  },
];

export interface AdaptationStats {
  totalPaperTrades: number;
  lowLiquidityTradeCount: number;
  lowLiquidityLossRate: number;
  wideSpreadTradeCount: number;
  wideSpreadLossRate: number;
  bestCategoryWinRate: number;
  avgWinRate: number;
  bestCategoryTradeCount: number;
  oneHitWonderTradeCount: number;
  oneHitWonderLossRate: number;
  lateEntryTradeCount: number;
  lateEntryLossRate: number;
  subThresholdWalletTradeCount: number;
  subThresholdWalletWinRate: number;
}

export async function getActiveRuleSet(): Promise<RuleSet> {
  const active = await prisma.ruleSet.findFirst({
    where: { active: true },
    orderBy: { version: 'desc' },
  });
  
  if (active) {
    return {
      id: active.id,
      version: active.version,
      active: active.active,
      rules: JSON.parse(active.rulesJson),
    };
  }
  
  // Create default if none exists
  return await createRuleSet(DEFAULT_RULESET);
}

export async function createRuleSet(ruleSet: RuleSet): Promise<RuleSet> {
  // Deactivate all others
  await prisma.ruleSet.updateMany({
    where: { active: true },
    data: { active: false },
  });
  
  const created = await prisma.ruleSet.create({
    data: {
      version: ruleSet.version,
      active: true,
      rulesJson: JSON.stringify(ruleSet.rules),
    },
  });
  
  return {
    id: created.id,
    version: created.version,
    active: created.active,
    rules: JSON.parse(created.rulesJson),
  };
}

export async function recordRuleChange(
  oldVersion: number,
  newVersion: number,
  changedBy: 'hermes' | 'manual',
  reason: string,
  evidenceSummary: string,
  beforeJson: string,
  afterJson: string
): Promise<void> {
  await prisma.ruleChange.create({
    data: {
      oldRuleSetId: (await prisma.ruleSet.findUnique({ where: { version: oldVersion } }))?.id || '',
      newRuleSetId: (await prisma.ruleSet.findUnique({ where: { version: newVersion } }))?.id || '',
      changedBy,
      reason,
      evidenceSummary,
      beforeJson,
      afterJson,
    },
  });
}

export async function runWeeklyRuleAdaptation(): Promise<RuleSet | null> {
  const activeRuleSet = await getActiveRuleSet();
  const stats = await calculateAdaptationStats();
  
  if (stats.totalPaperTrades < 20) {
    console.log('Insufficient trades for rule adaptation (need 20, have', stats.totalPaperTrades, ')');
    return null;
  }
  
  let newRules = { ...activeRuleSet.rules };
  let changed = false;
  const changes: Array<{ parameter: string; before: number; after: number; reason: string }> = [];
  
  for (const trigger of ADAPTATION_TRIGGERS) {
    if (trigger.condition(stats)) {
      const currentValue = getNestedValue(newRules, trigger.parameter);
      if (typeof currentValue === 'number') {
        const newValue = trigger.adjustment(currentValue);
        const clampedValue = clampParameter(trigger.parameter, newValue);
        
        if (clampedValue !== currentValue) {
          setNestedValue(newRules, trigger.parameter, clampedValue);
          changes.push({
            parameter: trigger.parameter,
            before: currentValue,
            after: clampedValue,
            reason: trigger.reason,
          });
          changed = true;
        }
      }
    }
  }
  
  if (!changed) {
    console.log('No rule changes triggered this week');
    return null;
  }
  
  // Create new version
  const newVersion = activeRuleSet.version + 1;
  const newRuleSet = await createRuleSet({
    id: '', // Will be set by DB
    version: newVersion,
    active: true,
    rules: newRules,
  });
  
  // Record changes
  for (const change of changes) {
    await recordRuleChange(
      activeRuleSet.version,
      newVersion,
      'hermes',
      change.reason,
      `Weekly adaptation: ${changes.map(c => c.reason).join('; ')}`,
      JSON.stringify({ [change.parameter]: change.before }),
      JSON.stringify({ [change.parameter]: change.after }),
    );
  }
  
  console.log('Rule adaptation complete:', changes);
  return newRuleSet;
}

export async function calculateAdaptationStats(): Promise<AdaptationStats> {
  // Get paper trades from last 30 days with outcome reviews
  const reviews = await prisma.outcomeReview.findMany({
    where: {
      reviewTime: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
    include: {
      decisionJournal: { include: { walletProfile: true } },
      paperTrade: true,
    },
  });
  
  const paperTrades = await prisma.paperTrade.findMany({
    where: {
      openedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
    include: {
      decisionJournal: { include: { walletProfile: true } },
    },
  });
  
  let lowLiquidityTradeCount = 0;
  let lowLiquidityLosses = 0;
  let wideSpreadTradeCount = 0;
  let wideSpreadLosses = 0;
  const categoryWinRates: Record<string, { wins: number; total: number }> = {};
  let oneHitWonderTradeCount = 0;
  let oneHitWonderLosses = 0;
  let lateEntryTradeCount = 0;
  let lateEntryLosses = 0;
  let subThresholdWalletTradeCount = 0;
  let subThresholdWalletWins = 0;
  
  for (const trade of paperTrades) {
    const wallet = trade.decisionJournal?.walletProfile;
    const review = reviews.find(r => r.paperTradeId === trade.id);
    const isLoss = review ? review.simulatedPnl < 0 : (trade.unrealizedPnl < 0);
    
    // Low liquidity (< $1k)
    if (trade.decisionJournal && trade.decisionJournal.liquidityScore < 0.2) {
      lowLiquidityTradeCount++;
      if (isLoss) lowLiquidityLosses++;
    }
    
    // Wide spread (> 5%)
    if (trade.decisionJournal && trade.decisionJournal.spreadScore < 0.3) {
      wideSpreadTradeCount++;
      if (isLoss) wideSpreadLosses++;
    }
    
    // Category tracking
    if (wallet && wallet.bestCategory) {
      if (!categoryWinRates[wallet.bestCategory]) {
        categoryWinRates[wallet.bestCategory] = { wins: 0, total: 0 };
      }
      categoryWinRates[wallet.bestCategory].total++;
      if (!isLoss) categoryWinRates[wallet.bestCategory].wins++;
    }
    
    // One-hit-wonder
    if (wallet && wallet.oneHitWonderPenalty > 0.5) {
      oneHitWonderTradeCount++;
      if (isLoss) oneHitWonderLosses++;
    }
    
    // Late entry (price moved >15% since wallet entry)
    if (trade.decisionJournal && trade.decisionJournal.entryTimingScore > 0.85) {
      lateEntryTradeCount++;
      if (isLoss) lateEntryLosses++;
    }
    
    // Sub-threshold wallets
    if (wallet && wallet.globalScore < 0.45) {
      subThresholdWalletTradeCount++;
      if (!isLoss) subThresholdWalletWins++;
    }
  }
  
  // Calculate aggregate stats
  let bestCategoryWinRate = 0;
  let bestCategoryTradeCount = 0;
  for (const [cat, rates] of Object.entries(categoryWinRates)) {
    if (rates.total >= 5) {
      const wr = rates.wins / rates.total;
      if (wr > bestCategoryWinRate) {
        bestCategoryWinRate = wr;
        bestCategoryTradeCount = rates.total;
      }
    }
  }
  
  const totalWins = paperTrades.filter(t => {
    const r = reviews.find(rv => rv.paperTradeId === t.id);
    return r ? r.simulatedPnl >= 0 : t.unrealizedPnl >= 0;
  }).length;
  const avgWinRate = paperTrades.length > 0 ? totalWins / paperTrades.length : 0;
  
  return {
    totalPaperTrades: paperTrades.length,
    lowLiquidityTradeCount,
    lowLiquidityLossRate: lowLiquidityTradeCount > 0 ? lowLiquidityLosses / lowLiquidityTradeCount : 0,
    wideSpreadTradeCount,
    wideSpreadLossRate: wideSpreadTradeCount > 0 ? wideSpreadLosses / wideSpreadTradeCount : 0,
    bestCategoryWinRate,
    avgWinRate,
    bestCategoryTradeCount,
    oneHitWonderTradeCount,
    oneHitWonderLossRate: oneHitWonderTradeCount > 0 ? oneHitWonderLosses / oneHitWonderTradeCount : 0,
    lateEntryTradeCount,
    lateEntryLossRate: lateEntryTradeCount > 0 ? lateEntryLosses / lateEntryTradeCount : 0,
    subThresholdWalletTradeCount,
    subThresholdWalletWinRate: subThresholdWalletTradeCount > 0 ? subThresholdWalletWins / subThresholdWalletTradeCount : 0,
  };
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  const target = keys.reduce((o, k) => o[k] = o[k] || {}, obj);
  target[lastKey] = value;
}

function clampParameter(parameter: string, value: number): number {
  const clamps: Record<string, [number, number]> = {
    'minLiquidityForCopy': [500, 50000],
    'maxSpreadForCopy': [0.01, 0.20],
    'tradeScoreWeights.categoryMatch': [0.05, 0.30],
    'maxOneHitWonderPenalty': [0.3, 0.8],
    'maxPriceMovementSinceEntry': [0.2, 0.8],
    'minGlobalScoreForWatch': [0.3, 0.6],
  };
  
  const [min, max] = clamps[parameter] || [-Infinity, Infinity];
  return Math.max(min, Math.min(max, value));
}