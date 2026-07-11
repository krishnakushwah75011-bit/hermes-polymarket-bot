// src/scripts/update-rules.ts
// Automatic rule updater - reviews performance and updates scoring thresholds

import { getActiveRuleSet } from '../lib/rules/rules-engine';
import { prisma } from '../lib/db/client';
import type { RuleSet } from '../lib/types';

async function updateRules() {
  console.log('[update:rules] Starting rule update...');
  
  const stats = await calculateAdaptationStats();
  console.log('[update:rules] Adaptation stats:', stats);
  
  const currentRules = await getActiveRuleSet();
  const updates: { parameter: string; oldValue: any; newValue: any; reason: string }[] = [];
  
  // 1. Low liquidity losses
  if (stats.lowLiquidityTradeCount >= 5 && stats.lowLiquidityLossRate > 0.65) {
    const oldValue = currentRules.rules.minLiquidityForCopy || 1000;
    const newValue = Math.round(oldValue * 1.5);
    updates.push({
      parameter: 'minLiquidityForCopy',
      oldValue,
      newValue,
      reason: `Low-liquidity trades losing ${(stats.lowLiquidityLossRate * 100).toFixed(0)}% (${stats.lowLiquidityTradeCount} trades)`,
    });
  }
  
  // 2. Wide spread losses
  if (stats.wideSpreadTradeCount >= 5 && stats.wideSpreadLossRate > 0.65) {
    const oldValue = currentRules.rules.maxSpreadForCopy || 0.05;
    const newValue = Math.round(oldValue * 0.7 * 10000) / 10000;
    updates.push({
      parameter: 'maxSpreadForCopy',
      oldValue,
      newValue,
      reason: `Wide-spread trades losing ${(stats.wideSpreadLossRate * 100).toFixed(0)}% (${stats.wideSpreadTradeCount} trades)`,
    });
  }
  
  // 3. Category outperformance
  if (stats.bestCategoryTradeCount >= 10 && stats.bestCategoryWinRate > stats.avgWinRate * 1.3) {
    const oldValue = currentRules.rules.tradeScoreWeights?.categoryMatch || 0.10;
    const newValue = Math.min(oldValue * 1.5, 0.30);
    updates.push({
      parameter: 'tradeScoreWeights.categoryMatch',
      oldValue,
      newValue,
      reason: `Category ${stats.bestCategory} win rate ${(stats.bestCategoryWinRate * 100).toFixed(0)}% vs avg ${(stats.avgWinRate * 100).toFixed(0)}%`,
    });
  }
  
  // 4. One-hit-wonder losses
  if (stats.oneHitWonderTradeCount >= 5 && stats.oneHitWonderLossRate > 0.70) {
    const oldValue = currentRules.rules.maxOneHitWonderPenalty || 0.5;
    const newValue = Math.min(oldValue * 1.2, 0.8);
    updates.push({
      parameter: 'maxOneHitWonderPenalty',
      oldValue,
      newValue,
      reason: `One-hit-wonder wallets losing ${(stats.oneHitWonderLossRate * 100).toFixed(0)}%`,
    });
  }
  
  // 5. Late entry losses
  if (stats.lateEntryTradeCount >= 5 && stats.lateEntryLossRate > 0.70) {
    const oldValue = currentRules.rules.maxPriceMovementSinceEntry || 0.15;
    const newValue = Math.round(oldValue * 0.8 * 100) / 100;
    updates.push({
      parameter: 'maxPriceMovementSinceEntry',
      oldValue,
      newValue,
      reason: `Late entries (>15% move) losing ${(stats.lateEntryLossRate * 100).toFixed(0)}%`,
    });
  }
  
  // 6. Sub-threshold wallets winning
  if (stats.subThresholdWalletTradeCount >= 10 && stats.subThresholdWalletWinRate > 0.60) {
    const oldValue = currentRules.rules.minGlobalScoreForWatch || 0.45;
    const newValue = Math.max(oldValue * 0.95, 0.35);
    updates.push({
      parameter: 'minGlobalScoreForWatch',
      oldValue,
      newValue,
      reason: `Below-threshold wallets winning ${(stats.subThresholdWalletWinRate * 100).toFixed(0)}%`,
    });
  }
  
  if (updates.length === 0) {
    console.log('[update:rules] No rule changes triggered');
    return { success: true, changes: 0 };
  }
  
  console.log('[update:rules] Applying', updates.length, 'changes:');
  for (const u of updates) {
    console.log(`  ${u.parameter}: ${u.oldValue} -> ${u.newValue} (${u.reason})`);
  }
  
  // Create new rule version
  const newRules = { ...currentRules.rules };
  for (const update of updates) {
    setNestedValue(newRules, update.parameter, update.newValue);
  }
  
  const newVersion = currentRules.version + 1;
  const newRuleSet = await prisma.ruleSet.create({
    data: {
      version: newVersion,
      active: true,
      rulesJson: JSON.stringify(newRules),
    },
  });
  
  // Deactivate old
  await prisma.ruleSet.update({
    where: { id: currentRules.id },
    data: { active: false },
  });
  
  // Record changes
  for (const update of updates) {
    await prisma.ruleChange.create({
      data: {
        oldRuleSetId: currentRules.id,
        newRuleSetId: newRuleSet.id,
        changedBy: 'hermes',
        reason: update.reason,
        evidenceSummary: `Weekly review: ${stats.totalPaperTrades} paper trades analyzed`,
        beforeJson: JSON.stringify({ [update.parameter]: update.oldValue }),
        afterJson: JSON.stringify({ [update.parameter]: update.newValue }),
      },
    });
  }
  
  console.log(`[update:rules] Created rule version ${newVersion} with ${updates.length} changes`);
  
  return { success: true, version: newVersion, changes: updates.length };
}

async function calculateAdaptationStats(): Promise<any> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const reviews = await prisma.outcomeReview.findMany({
    where: { reviewTime: { gte: thirtyDaysAgo } },
    include: {
      decisionJournal: true,
      paperTrade: true,
    },
  });
  
  const paperTrades = await prisma.paperTrade.findMany({
    where: { openedAt: { gte: thirtyDaysAgo } },
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
    const review = reviews.find(r => r.paperTradeId === trade.id);
    const isLoss = review ? review.simulatedPnl < 0 : (trade.unrealizedPnl < 0);
    
    // Low liquidity
    if (trade.decisionJournal && trade.decisionJournal.liquidityScore < 0.2) {
      lowLiquidityTradeCount++;
      if (isLoss) lowLiquidityLosses++;
    }
    
    // Wide spread
    if (trade.decisionJournal && trade.decisionJournal.spreadScore < 0.3) {
      wideSpreadTradeCount++;
      if (isLoss) wideSpreadLosses++;
    }
    
    // Category tracking
    if (trade.decisionJournal && trade.decisionJournal.walletProfile?.bestCategory) {
      const cat = trade.decisionJournal.walletProfile.bestCategory;
      if (!categoryWinRates[cat]) categoryWinRates[cat] = { wins: 0, total: 0 };
      categoryWinRates[cat].total++;
      if (!isLoss) categoryWinRates[cat].wins++;
    }
    
    // One-hit-wonder
    if (trade.decisionJournal && trade.decisionJournal.walletProfile?.oneHitWonderPenalty > 0.5) {
      oneHitWonderTradeCount++;
      if (isLoss) oneHitWonderLosses++;
    }
    
    // Late entry
    if (trade.decisionJournal && trade.decisionJournal.entryTimingScore > 0.85) {
      lateEntryTradeCount++;
      if (isLoss) lateEntryLosses++;
    }
    
    // Sub-threshold wallets
    if (trade.decisionJournal && trade.decisionJournal.walletQualityScore < 0.45) {
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

function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) current[keys[i]] = {};
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
}

if (require.main === module) {
  updateRules()
    .then(result => {
      console.log('[update:rules] Completed:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('[update:rules] Failed:', error);
      process.exit(1);
    });
}

export { updateRules };