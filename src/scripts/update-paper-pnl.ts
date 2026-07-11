// src/scripts/update-paper-pnl.ts
// Hourly PnL updater for paper trades

import { getActiveRuleSet } from '@/lib/rules/rules-engine';
import { prisma } from '@/lib/db/client';

async function updatePaperPnl() {
  console.log('[paper:pnl] Starting hourly PnL update...');
  
  // Get all open paper trades
  const openTrades = await prisma.paperTrade.findMany({
    where: { status: 'OPEN' },
    include: {
      decisionJournal: {
        include: {
          observedTrade: true,
        },
      },
    },
  });
  
  console.log(`[paper:pnl] Found ${openTrades.length} open paper trades`);
  
  if (openTrades.length === 0) {
    return { success: true, updated: 0, resolved: 0 };
  }
  
  // Group by market to fetch current prices efficiently
  const marketIds = [...new Set(openTrades.map(t => t.marketId))];
  const conditionIds = [...new Set(openTrades.map(t => t.decisionJournal.observedTrade.conditionId))];
  
  // Fetch current market snapshots
  const snapshots = await prisma.marketSnapshot.findMany({
    where: {
      marketId: { in: marketIds },
      collectedAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) }, // Last 2 hours
    },
    orderBy: { collectedAt: 'desc' },
  });
  
  // Deduplicate by market (get latest)
  const latestSnapshots = new Map<string, typeof snapshots[0]>();
  for (const snap of snapshots) {
    if (!latestSnapshots.has(snap.marketId)) {
      latestSnapshots.set(snap.marketId, snap);
    }
  }
  
  const rules = await getActiveRuleSet();
  let updated = 0;
  let resolved = 0;
  
  for (const paperTrade of openTrades) {
    try {
      const snapshot = latestSnapshots.get(paperTrade.marketId);
      const obsTrade = paperTrade.decisionJournal.observedTrade;
      
      if (!snapshot) {
        console.warn(`[paper:pnl] No recent snapshot for market ${paperTrade.marketId}`);
        continue;
      }
      
      // Determine current price based on outcome
      const currentPrice = obsTrade.outcome.toLowerCase() === 'yes'
        ? (snapshot.yesPrice || paperTrade.currentPrice)
        : (snapshot.noPrice || paperTrade.currentPrice);
      
      // Calculate PnL
      const shares = paperTrade.simulatedPositionSize / paperTrade.entryPrice;
      const unrealizedPnl = (currentPrice - paperTrade.entryPrice) * shares * 
        (paperTrade.side === 'BUY' ? 1 : -1);
      
      // Update paper trade
      await prisma.paperTrade.update({
        where: { id: paperTrade.id },
        data: {
          currentPrice,
          unrealizedPnl,
        },
      });
      
      // Create PnL snapshot
      await prisma.pnlSnapshot.create({
        data: {
          paperTradeId: paperTrade.id,
          price: currentPrice,
          pnl: unrealizedPnl,
        },
      });
      
      updated++;
      
      // Check for resolution
      if (snapshot.timeToResolution && snapshot.timeToResolution <= 0) {
        // Market should be resolved - check if we have final outcome
        // In production, we'd fetch actual resolution
        console.log(`[paper:pnl] Market ${paperTrade.marketId} near resolution`);
      }
      
      // Check stop loss / take profit
      const pnlPct = unrealizedPnl / paperTrade.simulatedPositionSize;
      
      if (pnlPct <= -rules.rules.stopLossPercent) {
        // Stop loss hit
        await closePaperTrade(paperTrade.id, 'STOP_LOSS', currentPrice, unrealizedPnl);
        resolved++;
      } else if (pnlPct >= rules.rules.takeProfitPercent) {
        // Take profit hit
        await closePaperTrade(paperTrade.id, 'TAKE_PROFIT', currentPrice, unrealizedPnl);
        resolved++;
      }
      
    } catch (error) {
      console.error(`[paper:pnl] Error updating ${paperTrade.id}:`, error);
    }
  }
  
  console.log(`[paper:pnl] Completed: ${updated} updated, ${resolved} resolved`);
  
  return { success: true, updated, resolved };
}

async function closePaperTrade(
  paperTradeId: string,
  reason: 'RESOLVED' | 'STOP_LOSS' | 'TAKE_PROFIT' | 'MANUAL' | 'EXPIRED',
  exitPrice: number,
  realizedPnl: number
) {
  await prisma.paperTrade.update({
    where: { id: paperTradeId },
    data: {
      status: 'CLOSED',
      currentPrice: exitPrice,
      realizedPnl,
      unrealizedPnl: 0,
      closedAt: new Date(),
    },
  });
  
  // Create outcome review
  const paperTrade = await prisma.paperTrade.findUnique({
    where: { id: paperTradeId },
    include: { decisionJournal: true },
  });
  
  if (paperTrade?.decisionJournal) {
    await prisma.outcomeReview.create({
      data: {
        decisionJournalId: paperTrade.decisionJournalId,
        paperTradeId,
        walletAddress: paperTrade.walletAddress,
        marketId: paperTrade.marketId,
        finalOutcome: exitPrice > 0.5 ? 'Yes' : 'No', // Simplified
        simulatedPnl: realizedPnl,
        wasDecisionGood: realizedPnl > 0,
        lessonsJson: JSON.stringify({
          exitReason: reason,
          holdTimeHours: (Date.now() - paperTrade.openedAt.getTime()) / (1000 * 60 * 60),
        }),
      },
    });
  }
}

if (require.main === module) {
  updatePaperPnl()
    .then(result => {
      console.log('[paper:pnl] Completed:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('[paper:pnl] Failed:', error);
      process.exit(1);
    });
}

export { updatePaperPnl };