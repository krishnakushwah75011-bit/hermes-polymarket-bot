// src/scripts/review-outcomes.ts
// Outcome reviewer - reviews resolved paper trades and evaluates decision quality

import { getActiveRuleSet } from '@/lib/rules/rules-engine';
import { prisma } from '@/lib/db/client';

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
      decisionJournal: true,
    },
  });
  
  if (recentReviews.length < 20) {
    console.log('[review:outcomes] Insufficient reviews for rule adaptation (need 20+)');
    return;
  }
  
  const rules = await getActiveRuleSet();
  const currentRules = rules.rules;
  const updates: { parameter: string; oldValue: any; newValue: any; reason: string }[] = [];
  
  // Analyze patterns
  
  // 1. Low-liquidity losses
  const lowLiqLosses = recentReviews.filter(r => 
    !r.wasDecisionGood && 
    r.decisionJournal.liquidityScore < 0.3
  ).length;
  const lowLiqTotal = recentReviews.filter(r => r.decisionJournal.liquidityScore < 0.3).length;
  
  if (lowLiqTotal >= 5 && lowLiqLosses / lowLiqTotal > 0.65) {
    const oldValue = currentRules.minLiquidityForCopy || 1000;
    const newValue = Math.round(oldValue * 1.5);
    updates.push({
      parameter: 'minLiquidityForCopy',
      oldValue,
      newValue,
      reason: `${lowLiqLosses}/${lowLiqTotal} low-liquidity trades lost (${(lowLiqLosses/lowLiqTotal*100).toFixed(0)}%)`,
    });
  }
  
  // 2. Wide-spread losses
  const wideSpreadLosses = recentReviews.filter(r => 
    !r.wasDecisionGood && 
    r.decisionJournal.spreadScore < 0.3
  ).length;
  const wideSpreadTotal = recentReviews.filter(r => r.decisionJournal.spreadScore < 0.3).length;
  
  if (wideSpreadTotal >= 5 && wideSpreadLosses / wideSpreadTotal > 0.65) {
    const oldValue = currentRules.maxSpreadForCopy || 0.05;
    const newValue = Math.round(oldValue * 0.7 * 100) / 100;
    updates.push({
      parameter: 'maxSpreadForCopy',
      oldValue,
      newValue,
      reason: `${wideSpreadLosses}/${wideSpreadTotal} wide-spread trades lost`,
    });
  }
  
  // 3. Category outperformance
  // Would analyze categoryMatch scores by category
  
  // 4. One-hit-wonder losses
  const ohwLosses = recentReviews.filter(r => 
    !r.wasDecisionGood && 
    r.decisionJournal.walletQualityScore > 0.7 && // high wallet score but lost
    r.lessonsJson.includes('one-hit-wonder')
  ).length;
  
  if (updates.length > 0) {
    await createRuleVersion(currentRules, updates);
  }
  
  console.log(`[review:outcomes] Rule updates: ${updates.length}`);
}

async function createRuleVersion(currentRules: any, updates: any[]) {
  const currentVersion = await prisma.ruleSet.findFirst({
    where: { active: true },
    orderBy: { version: 'desc' },
  });
  
  const newVersion = (currentVersion?.version || 0) + 1;
  
  // Apply updates to rules
  const newRules = { ...currentRules };
  for (const update of updates) {
    newRules[update.parameter] = update.newValue;
  }
  
  // Create new rule set
  const newRuleSet = await prisma.ruleSet.create({
    data: {
      version: newVersion,
      active: true,
      rulesJson: JSON.stringify(newRules),
    },
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
        oldRuleSetId: currentVersion?.id || newRuleSet.id,
        newRuleSetId: newRuleSet.id,
        changedBy: 'hermes',
        reason: update.reason,
        evidenceSummary: `Based on ${recentReviews.length} recent outcome reviews`,
        beforeJson: JSON.stringify({ [update.parameter]: update.oldValue }),
        afterJson: JSON.stringify({ [update.parameter]: update.newValue }),
      },
    });
  }
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