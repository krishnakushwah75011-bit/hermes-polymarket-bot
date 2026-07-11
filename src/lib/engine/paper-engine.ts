// lib/engine/paper-engine.ts
// Paper trading engine - simulates copy trades with $5-$20 position sizing

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface PaperTradeInput {
  decisionJournalId: string;
  walletAddress: string;
  marketId: string;
  outcome: string;
  side: 'BUY' | 'SELL';
  entryPrice: number;
  currentPrice: number;
  simulatedPositionSize: number; // $5-$20
}

export interface PaperTradeResult {
  id: string;
  unrealizedPnl: number;
  realizedPnl: number;
  status: 'OPEN' | 'CLOSED' | 'RESOLVED';
  pnlPercent: number;
}

export async function createPaperTrade(input: PaperTradeInput): Promise<PaperTradeResult> {
  const paperTrade = await prisma.paperTrade.create({
    data: {
      decisionJournalId: input.decisionJournalId,
      walletAddress: input.walletAddress,
      marketId: input.marketId,
      outcome: input.outcome,
      side: input.side,
      entryPrice: input.entryPrice,
      currentPrice: input.currentPrice,
      simulatedPositionSize: input.simulatedPositionSize,
      unrealizedPnl: 0,
      realizedPnl: 0,
      status: 'OPEN',
      openedAt: new Date(),
    },
  });
  
  return {
    id: paperTrade.id,
    unrealizedPnl: 0,
    realizedPnl: 0,
    status: 'OPEN',
    pnlPercent: 0,
  };
}

export async function updatePaperTradePrices(): Promise<number> {
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
  
  console.log(`[paper-engine] Updating ${openTrades.length} open paper trades`);
  
  if (openTrades.length === 0) return 0;
  
  // Group by market to fetch snapshots efficiently
  const marketIds = Array.from(new Set(openTrades.map(t => t.marketId)));
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
  
  let updated = 0;
  
  for (const trade of openTrades) {
    try {
      const snapshot = latestSnapshots.get(trade.marketId);
      
      if (!snapshot) {
        console.warn(`[paper-engine] No recent snapshot for market ${trade.marketId}`);
        continue;
      }
      
      // Determine current price based on outcome
      const currentPrice = trade.outcome.toLowerCase() === 'yes'
        ? (snapshot.yesPrice || trade.currentPrice)
        : (snapshot.noPrice || trade.currentPrice);
      
      // Calculate PnL
      const shares = trade.simulatedPositionSize / trade.entryPrice;
      let pnl = 0;
      
      if (trade.side === 'BUY') {
        pnl = (currentPrice - trade.entryPrice) * shares;
      } else {
        pnl = (trade.entryPrice - currentPrice) * shares;
      }
      
      // Record PnL snapshot
      await prisma.pnlSnapshot.create({
        data: {
          paperTradeId: trade.id,
          price: currentPrice,
          pnl: pnl,
        },
      });
      
      // Update paper trade
      await prisma.paperTrade.update({
        where: { id: trade.id },
        data: {
          currentPrice,
          unrealizedPnl: pnl,
        },
      });
      
      updated++;
      
    } catch (error) {
      console.error(`[paper-engine] Failed to update trade ${trade.id}:`, error);
    }
  }
  
  return updated;
}

export async function resolvePaperTrades(): Promise<number> {
  const openTrades = await prisma.paperTrade.findMany({
    where: { status: 'OPEN' },
  });
  
  let resolved = 0;
  
  for (const trade of openTrades) {
    // Check if market is resolved
    const market = await prisma.marketSnapshot.findFirst({
      where: { marketId: trade.marketId },
      orderBy: { collectedAt: 'desc' },
    });
    
    // In production, check actual market resolution status
    // For now, check if time to resolution has passed
    if (market && market.timeToResolution && market.timeToResolution <= 0) {
      const finalPnl = trade.unrealizedPnl;
      
      await prisma.paperTrade.update({
        where: { id: trade.id },
        data: {
          status: 'RESOLVED',
          realizedPnl: finalPnl,
          unrealizedPnl: 0,
          currentPrice: trade.outcome.toLowerCase() === 'yes' 
            ? (market.yesPrice || 1) 
            : (market.noPrice || 1),
          resolvedAt: new Date(),
        },
      });
      
      // Create outcome review
      await createOutcomeReview(trade.id, finalPnl);
      
      resolved++;
    }
  }
  
  return resolved;
}

async function createOutcomeReview(paperTradeId: string, finalPnl: number): Promise<void> {
  const paperTrade = await prisma.paperTrade.findUnique({
    where: { id: paperTradeId },
    include: { decisionJournal: true },
  });
  
  if (!paperTrade || !paperTrade.decisionJournal) return;
  
  const wasDecisionGood = finalPnl > 0;
  
  await prisma.outcomeReview.create({
    data: {
      decisionJournalId: paperTrade.decisionJournalId,
      paperTradeId: paperTrade.id,
      walletAddress: paperTrade.walletAddress,
      marketId: paperTrade.marketId,
      finalOutcome: paperTrade.outcome,
      simulatedPnl: finalPnl,
      wasDecisionGood,
      lessonsJson: JSON.stringify({
        decision: paperTrade.decisionJournal.decision,
        score: paperTrade.decisionJournal.copyScore,
        outcome: wasDecisionGood ? 'profitable' : 'loss',
        pnl: finalPnl,
      }),
    },
  });
}

export async function closePaperTrade(
  paperTradeId: string,
  reason: 'STOP_LOSS' | 'MANUAL' | 'EXPIRED' | 'TAKE_PROFIT'
): Promise<void> {
  const trade = await prisma.paperTrade.findUnique({
    where: { id: paperTradeId },
  });
  
  if (!trade || trade.status !== 'OPEN') return;
  
  await prisma.paperTrade.update({
    where: { id: paperTradeId },
    data: {
      status: 'CLOSED',
      realizedPnl: trade.unrealizedPnl,
      unrealizedPnl: 0,
      closedAt: new Date(),
    },
  });
  
  // Create outcome review
  await createOutcomeReview(paperTradeId, trade.unrealizedPnl);
}

export async function getPaperPortfolioSummary(): Promise<{
  totalUnrealizedPnl: number;
  totalRealizedPnl: number;
  openPositions: number;
  totalPositions: number;
  winRate: number;
}> {
  const trades = await prisma.paperTrade.findMany();
  
  const openTrades = trades.filter(t => t.status === 'OPEN');
  const closedTrades = trades.filter(t => t.status === 'CLOSED' || t.status === 'RESOLVED');
  const winningTrades = closedTrades.filter(t => t.realizedPnl > 0);
  
  const totalUnrealizedPnl = openTrades.reduce((sum, t) => sum + t.unrealizedPnl, 0);
  const totalRealizedPnl = closedTrades.reduce((sum, t) => sum + t.realizedPnl, 0);
  
  return {
    totalUnrealizedPnl,
    totalRealizedPnl,
    openPositions: openTrades.length,
    totalPositions: trades.length,
    winRate: closedTrades.length > 0 ? winningTrades.length / closedTrades.length : 0,
  };
}

export function calculateSimulatedPositionSize(score: number): number {
  // Score 0.65-1.0 maps to $5-$20
  const minSize = 5;
  const maxSize = 20;
  const normalizedScore = Math.max(0, Math.min(1, (score - 0.65) / 0.35));
  return minSize + normalizedScore * (maxSize - minSize);
}

export { PrismaClient };