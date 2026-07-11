// src/scripts/review-outcomes.ts
// Outcome reviewer - reviews resolved paper trades and evaluates decision quality

import { getActiveRuleSet, createRuleSet } from '../lib/rules/rules-engine';
import { prisma } from '../lib/db/client';
import type { WalletScore } from '../lib/types';

async function reviewOutcomes() {
  console.log('[review:outcomes] Starting outcome review...');
  
  // Find paper trades that have been resolved but not reviewed
  const unreviewedTrades = await prisma.paperTrade.findMany({
    where: {
      status: 'RESOLVED',
      outcomeReview: null,
    },
    include: {
      decisionJournal: {
        include: {
          observedTrade: true,
        },
      },
    },
  });
  
  console.log(`[review:outcomes] Found ${unreviewedTrades.length} unreviewed resolved trades`);
  
  let reviewed = 0;
  let goodDecisions = 0;
  let badDecisions = 0;
  
  for (const paperTrade of unreviewedTrades) {
    try {
      const decisionJournal = paperTrade.decisionJournal;
      const observedTrade = decisionJournal?.observedTrade;
      
      if (!decisionJournal || !observedTrade) {
        console.warn(`[review:outcomes] Missing decision journal or observed trade for ${paperTrade.id}`);
        continue;
      }
      
      // Get final market snapshot
      const finalSnapshot = await prisma.marketSnapshot.findFirst({
        where: { marketId: paperTrade.marketId },
        orderBy: { collectedAt: 'desc' },
      });
      
      // Get price at 1h, 6h, 24h after entry
      const priceAfter1h = await getPriceAtTime(paperTrade.marketId, paperTrade.openedAt.getTime() + 60 * 60 * 1000);
      const priceAfter6h = await getPriceAtTime(paperTrade.marketId, paperTrade.openedAt.getTime() + 6 * 60 * 60 * 1000);
      const priceAfter24h = await getPriceAtTime(paperTrade.marketId, paperTrade.openedAt.getTime() + 24 * 60 * 60 * 1000);
      
      const wasDecisionGood = paperTrade.realizedPnl > 0;
      if (wasDecisionGood) goodDecisions++;
      else badDecisions++;
      
      // Generate lessons
      const lessons = generateLessons(decisionJournal, paperTrade, finalSnapshot, {
        priceAfter1h,
        priceAfter6h,
        priceAfter24h,
      });
      
      // Create outcome review
      await prisma.outcomeReview.create({
        data: {
          decisionJournalId: decisionJournal.id,
          paperTradeId: paperTrade.id,
          walletAddress: paperTrade.walletAddress,
          marketId: paperTrade.marketId,
          priceAfter1h,
          priceAfter6h,
          priceAfter24h,
          finalOutcome: finalSnapshot ? 
            (observedTrade.outcome.toLowerCase() === 'yes' ? (finalSnapshot.yesPrice || 1) : (finalSnapshot.noPrice || 1)) > 0.5 ? 'Yes' : 'No'
            : observedTrade.outcome,
          simulatedPnl: paperTrade.realizedPnl,
          wasDecisionGood,
          lessonsJson: JSON.stringify(lessons),
        },
      });
      
      reviewed++;
      
    } catch (error) {
      console.error(`[review:outcomes] Error reviewing ${paperTrade.id}:`, error);
    }
  }
  
  // Feed lessons into rules engine for potential updates
  if (reviewed > 0) {
    await feedLessonsToRulesEngine();
  }
  
  console.log(`[review:outcomes] Completed: ${reviewed} reviewed, ${goodDecisions} good, ${badDecisions} bad`);
  
  return { success: true, reviewed, goodDecisions, badDecisions };
}

async function getPriceAtTime(marketId: string, targetTime: number): Promise<number | null> {
  const snapshot = await prisma.pnlSnapshot.findFirst({
    where: {
      paperTrade: { marketId },
      collectedAt: { lte: new Date(targetTime) },
    },
    orderBy: { collectedAt: 'desc' },
    select: { price: true },
  });
  
  return snapshot?.price || null;
}

function generateLessons(
  decisionJournal: any,
  paperTrade: any,
  finalSnapshot: any,
  priceHistory: { priceAfter1h: number | null; priceAfter6h: number | null; priceAfter24h: number | null }
): any {
  const lessons: string[] = [];
  
  const holdTimeHours = (paperTrade.resolvedAt?.getTime() || Date.now() - paperTrade.openedAt.getTime()) / (1000 * 60 * 60);
  
  // Decision quality
  if (paperTrade.realizedPnl > 0) {
    lessons.push(`GOOD: Decision to ${decisionJournal.decision.toLowerCase()} was profitable (+$${paperTrade.realizedPnl.toFixed(2)})`);
  } else {
    lessons.push(`BAD: Decision to ${decisionJournal.decision.toLowerCase()} lost $${Math.abs(paperTrade.realizedPnl).toFixed(2)}`);
  }
  
  // Entry timing
  if (priceHistory.priceAfter1h) {
    const earlyMove = (priceHistory.priceAfter1h - paperTrade.entryPrice) / paperTrade.entryPrice;
    if (earlyMove > 0.05) lessons.push('Price moved favorably within 1 hour');
    else if (earlyMove < -0.05) lessons.push('Price moved against position within 1 hour');
  }
  
  // Spread/liquidity impact
  if (finalSnapshot) {
    if (finalSnapshot.spread && finalSnapshot.spread > 0.05) {
      lessons.push('Wide spread at resolution may have impacted exit price');
    }
    if (finalSnapshot.liquidity && finalSnapshot.liquidity < 5000) {
      lessons.push('Low liquidity market - execution risk');
    }
  }
  
  // Wallet quality correlation
  if (decisionJournal.walletQualityScore > 0.7 && paperTrade.realizedPnl < 0) {
    lessons.push('High-quality wallet trade still lost - market conditions changed');
  }
  if (decisionJournal.walletQualityScore < 0.4 && paperTrade.realizedPnl > 0) {
    lessons.push('Low-quality wallet trade won - possible lucky entry');
  }
  
  // Category fit
  if (decisionJournal.categoryFitScore > 0.7) {
    lessons.push('Strong category match for wallet');
  } else if (decisionJournal.categoryFitScore < 0.3) {
    lessons.push('Weak category match - wallet may lack edge here');
  }
  
  // Score calibration
  const score = decisionJournal.copyScore;
  if (score > 0.7 && paperTrade.realizedPnl < 0) {
    lessons.push(`High score (${score.toFixed(2)}) but lost - consider raising thresholds`);
  }
  if (score < 0.5 && paperTrade.realizedPnl > 0) {
    lessons.push(`Low score (${score.toFixed(2)}) but won - consider lowering watch threshold`);
  }
  
  const wasDecisionGood = paperTrade.realizedPnl > 0;
  
  return {
    decision: decisionJournal.decision,
    score,
    outcome: wasDecisionGood ? 'profitable' : 'loss',
    pnl: paperTrade.realizedPnl,
    holdTimeHours: Math.round(holdTimeHours * 10) / 10,
    lessons,
  };
}

async function feedLessonsToRulesEngine() {
  console.log('[review:outcomes] Feeding lessons to rules engine...');
  
  // Get recent outcome reviews (last 7 days)
  const recentReviews = await prisma.outcomeReview.findMany({
    where: {
      reviewTime: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
    include: {
      decisionJournal: {
        include: {
          walletProfile: true,
        },
      },
    },
  });
  
  if (recentReviews.length < 20) {
    console.log('[review:outcomes] Insufficient reviews for rule adaptation (need 20+)');
    return;
  }
  
  const rules = await getActiveRuleSet();
  const currentRules = rules.rules;
  
  // Calculate statistics
  let lowLiqLosses = 0;
  let lowLiqTotal = 0;
  let wideSpreadLosses = 0;
  let wideSpreadTotal = 0;
  const categoryWinRates: Record<string, { wins: number; total: number }> = {};
  let oneHitWonderLosses = 0;
  let oneHitWonderTotal = 0;
  let lateEntryLosses = 0;
  let lateEntryTotal = 0;
  let subThresholdWalletWins = 0;
  let subThresholdWalletTotal = 0;
  
  for (const review of recentReviews) {
    const decisionJournal = review.decisionJournal;
    if (!decisionJournal) continue;
    
    const isLoss = !review.wasDecisionGood;
    
    // Low liquidity
    if (decisionJournal.liquidityScore < 0.2) {
      lowLiqTotal++;
      if (!review.wasDecisionGood) lowLiqLosses++;
    }
    
    // Wide spread
    if (decisionJournal.spreadScore < 0.3) {
      wideSpreadTotal++;
      if (isLoss) wideSpreadLosses++;
    }
    
    // Category tracking
    if (decisionJournal.walletProfile?.bestCategory) {
      const cat = decisionJournal.walletProfile.bestCategory;
      if (!categoryWinRates[cat]) categoryWinRates[cat] = { wins: 0, total: 0 };
      categoryWinRates[cat].total++;
      if (!review.wasDecisionGood) categoryWinRates[cat].wins++;
    }
    
    // One-hit-wonder
    if (decisionJournal.walletQualityScore > 0.7 && isLoss) {
      oneHitWonderTotal++;
      if (isLoss) oneHitWonderLosses++;
    }
    
    // Late entry
    if (decisionJournal.entryTimingScore > 0.85) {
      lateEntryTotal++;
      if (isLoss) lateEntryLosses++;
    }
    
    // Sub-threshold wallets
    if (decisionJournal.walletQualityScore < 0.4 && !review.wasDecisionGood) {
      subThresholdWalletTotal++;
      subThresholdWalletWins++;
    }
  }
  
  // Calculate aggregate stats
  const lowLiqLossRate = lowLiqTotal > 0 ? lowLiqLosses / lowLiqTotal : 0;
  const wideSpreadLossRate = wideSpreadTotal > 0 ? wideSpreadLosses / wideSpreadTotal : 0;
  
  // Find best category
  let bestCategory = '';
  let bestCategoryWinRate = 0;
  let bestCategoryTotal = 0;
  let avgWinRate = 0;
  let totalWins = 0;
  let totalTrades = 0;
  
  for (const [cat, rates] of Object.entries(categoryWinRates)) {
    const winRate = rates.total > 0 ? rates.wins / rates.total : 0;
    totalWins += rates.wins;
    totalTrades += rates.total;
    if (rates.total >= 5 && winRate > bestCategoryWinRate) {
      bestCategoryWinRate = winRate;
      bestCategory = cat;
      bestCategoryTotal = rates.total;
    }
  }
  avgWinRate = totalTrades > 0 ? totalWins / totalTrades : 0;
  
  // Define rule updates with flexible parameter names
  type RuleUpdate = { parameter: string; condition: boolean; adjustment: (currentValue: number) => number; reason: string };
  
  const ruleDefinitions = [
    { parameter: 'minLiquidityForCopy', condition: lowLiqTotal >= 5 && lowLiqTotal > 0 && lowLiqLosses / lowLiqTotal > 0.65, adjustment: (currentValue: number) => Math.round(currentValue * 1.5), reason: `Low-liquidity trades losing ${(lowLiqLosses/lowLiqTotal*100).toFixed(0)}%` },
    { parameter: 'maxSpreadForCopy', condition: wideSpreadTotal >= 5 && wideSpreadTotal > 0 && wideSpreadLosses / wideSpreadTotal > 0.65, adjustment: (currentValue: number) => Math.round(currentValue * 0.7 * 100) / 100, reason: `Wide-spread trades losing ${(wideSpreadLosses/wideSpreadTotal*100).toFixed(0)}%` },
    { parameter: 'tradeScoreWeights.categoryMatch', condition: bestCategoryTotal >= 10 && bestCategoryTotal > 0 && bestCategoryWinRate > avgWinRate * 1.3, adjustment: (currentValue: number) => Math.min(currentValue * 1.5, 0.3), reason: `Category ${bestCategory} win rate ${(bestCategoryWinRate*100).toFixed(0)}% vs avg ${(avgWinRate*100).toFixed(0)}%` },
    { parameter: 'maxOneHitWonderPenalty', condition: true && oneHitWonderTotal >= 5 && oneHitWonderTotal > 0 && oneHitWonderLosses / oneHitWonderTotal > 0.7, adjustment: (currentValue: number) => Math.min(currentValue * 1.2, 0.8), reason: `High-penalty wallets losing ${(oneHitWonderLosses/oneHitWonderTotal*100).toFixed(0)}%` },
    { parameter: 'maxPriceMovementSinceEntry', condition: lateEntryTotal >= 5 && lateEntryTotal > 0 && lateEntryLosses / lateEntryTotal > 0.7, adjustment: (currentValue: number) => Math.round(currentValue * 0.8 * 100) / 100, reason: `Late entries losing ${(lateEntryLosses/lateEntryTotal*100).toFixed(0)}%` },
    { parameter: 'minGlobalScoreForWatch', condition: subThresholdWalletTotal >= 10 && subThresholdWalletTotal > 0 && subThresholdWalletWins / subThresholdWalletTotal > 0.6, adjustment: (currentValue: number) => Math.max(currentValue * 0.95, 0.35), reason: `Below-threshold wallets winning ${(subThresholdWalletWins/subThresholdWalletTotal*100).toFixed(0)}%` },
  ];
  
  const updates: Array<{ parameter: string; oldValue: number; newValue: number; reason: string }> = [];
  
  for (const rule of ruleDefinitions) {
      if (rule.condition) {
        // Handle nested paths like "tradeScoreWeights.categoryMatch"
        const pathParts = rule.parameter.split('.');
        let currentValue: any = currentRules;
        for (const part of pathParts) {
          currentValue = currentValue?.[part];
        }
        const oldValue = currentValue;
        const newValue = rule.adjustment(oldValue as number);
        updates.push({ parameter: rule.parameter, oldValue: oldValue as number, newValue: newValue as number, reason: rule.reason });
      }
    }
  
  if (updates.length > 0) {
    const currentVersion = await prisma.ruleSet.findFirst({
      where: { active: true },
      orderBy: { version: 'desc' },
    });
    
    const newVersion = (currentVersion?.version || 0) + 1;
    
    // Apply updates to rules
    const newRules: Record<string, any> = JSON.parse(JSON.stringify(currentRules));
    for (const update of updates) {
      newRules[update.parameter] = update.newValue;
    }
    
    await createRuleSet({
      id: '',
      version: newVersion,
      active: true,
      rules: newRules as any,
    });
    
    // Deactivate old
    if (currentVersion) {
      await prisma.ruleSet.update({
        where: { id: currentVersion.id },
        data: { active: false },
      });
    }
    
    // Record changes
    for (const update of updates) {
      await prisma.ruleChange.create({
        data: {
          oldRuleSetId: currentVersion?.id || '',
          newRuleSetId: (await prisma.ruleSet.findFirst({ where: { version: newVersion, active: true } }))?.id || '',
          changedBy: 'hermes',
          reason: update.reason,
          evidenceSummary: `Based on ${recentReviews.length} recent outcome reviews`,
          beforeJson: JSON.stringify({ [update.parameter]: update.oldValue }),
          afterJson: JSON.stringify({ [update.parameter]: update.newValue }),
        },
      });
    }
    
    console.log(`[review:outcomes] Rule updates: ${updates.length}`);
  }
  
  console.log(`[review:outcomes] Rule updates: ${0}`);
}

if (require.main === module) {
  reviewOutcomes()
    .then(result => {
      console.log('[review:outcomes] Completed:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('[review:outcomes] Failed:', error);
      process.exit(1);
    });
}

export { reviewOutcomes };