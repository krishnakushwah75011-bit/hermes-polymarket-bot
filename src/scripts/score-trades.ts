// src/scripts/score-trades.ts
// Trade scorer - scores pending observed trades and makes decisions

import { scoreTrade, TradeScoringInput } from '@/lib/scoring/trade-scorer';
import { getActiveRuleSet } from '@/lib/rules/rules-engine';
import { prisma } from '@/lib/db/client';
import { calculateSimulatedPositionSize } from '@/lib/engine/paper-engine';

async function scoreTrades() {
  console.log('[score:trades] Starting trade scoring...');
  
  const rules = await getActiveRuleSet();
  
  // Get unscored observed trades (no decision journal yet)
  const unscoredTrades = await prisma.observedTrade.findMany({
    where: {
      decisions: { none: {} },
    },
    take: 100,
    orderBy: { createdAt: 'desc' },
  });
  
  console.log(`[score:trades] Found ${unscoredTrades.length} unscored trades`);
  
  let scored = 0;
  let paperCopied = 0;
  let watchlisted = 0;
  let skipped = 0;
  
  for (const trade of unscoredTrades) {
    try {
      // Get wallet profile
      const wallet = await prisma.walletProfile.findUnique({
        where: { address: trade.walletAddress },
      });
      
      if (!wallet || wallet.status !== 'TRACK') {
        // Skip if wallet not tracked
        await prisma.decisionJournal.create({
          data: {
            observedTradeId: trade.id,
            walletAddress: trade.walletAddress,
            marketId: trade.marketId,
            decision: 'SKIP',
            copyScore: 0,
            confidence: 0,
            reasonsJson: JSON.stringify(['Wallet not tracked']),
            risksJson: JSON.stringify([]),
            walletQualityScore: wallet?.globalScore || 0,
            roiScore: 0,
            consistencyScore: 0,
            copyabilityScore: 0,
            categoryFitScore: 0,
            entryTimingScore: 0,
            spreadScore: 0,
            liquidityScore: 0,
            thesisScore: 0,
            simulatedPositionSize: 0,
          },
        });
        skipped++;
        continue;
      }
      
      // Get market snapshot
      const market = await prisma.marketSnapshot.findFirst({
        where: { marketId: trade.marketId },
        orderBy: { collectedAt: 'desc' },
      });
      
      if (!market) {
        console.warn(`[score:trades] No market snapshot for ${trade.marketId}`);
        continue;
      }
      
      const scoringInput: TradeScoringInput = {
        wallet: {
          address: wallet.address,
          label: wallet.label,
          globalScore: wallet.globalScore,
          bestCategory: wallet.bestCategory || undefined,
          categoryStrengths: JSON.parse(wallet.categoryStrengthsJson || '{}'),
          averageEntryTiming: wallet.averageEntryTiming,
          status: wallet.status,
        },
        trade: {
          id: trade.id,
          wallet: trade.walletAddress,
          marketId: trade.marketId,
          conditionId: trade.conditionId,
          marketQuestion: trade.marketQuestion,
          marketCategory: trade.marketCategory,
          outcome: trade.outcome,
          side: trade.side,
          size: trade.size,
          price: trade.walletEntryPrice,
          timestamp: trade.timestamp,
          transactionHash: trade.rawTradeJson ? JSON.parse(trade.rawTradeJson).transactionHash : '',
        },
        market: {
          marketId: market.marketId,
          conditionId: market.conditionId,
          question: market.question,
          category: market.category,
          yesPrice: market.yesPrice,
          noPrice: market.noPrice,
          bestBid: market.bestBid,
          bestAsk: market.bestAsk,
          spread: market.spread,
          liquidity: market.liquidity,
          volume: market.volume,
          timeToResolution: market.timeToResolution,
          collectedAt: market.collectedAt,
        },
        rules: rules.rules,
      };
      
      const tradeScore = scoreTrade(scoringInput);
      const positionSize = calculateSimulatedPositionSize(tradeScore);
      
      // Create decision journal
      await prisma.decisionJournal.create({
        data: {
          observedTradeId: trade.id,
          walletAddress: trade.walletAddress,
          marketId: trade.marketId,
          decision: tradeScore.decision,
          copyScore: tradeScore.total,
          confidence: tradeScore.total,
          reasonsJson: JSON.stringify(tradeScore.reasons),
          risksJson: JSON.stringify(tradeScore.risks),
          walletQualityScore: tradeScore.walletQuality,
          roiScore: tradeScore.priceMovement,
          consistencyScore: tradeScore.liquidity,
          copyabilityScore: tradeScore.spread,
          categoryFitScore: tradeScore.categoryMatch,
          entryTimingScore: tradeScore.timeToResolution,
          spreadScore: tradeScore.spread,
          liquidityScore: tradeScore.liquidity,
          thesisScore: tradeScore.thesis,
          simulatedPositionSize: positionSize,
        },
      });
      
      scored++;
      
      // Create paper trade if PAPER_COPY
      if (tradeScore.decision === 'PAPER_COPY') {
        const entryPrice = trade.outcome.toLowerCase() === 'yes' 
          ? (market.yesPrice || trade.walletEntryPrice)
          : (market.noPrice || trade.walletEntryPrice);
        
        await prisma.paperTrade.create({
          data: {
            decisionJournalId: trade.id, // This should be decisionJournal.id, need to fix
            walletAddress: trade.walletAddress,
            marketId: trade.marketId,
            outcome: trade.outcome,
            side: trade.side,
            entryPrice,
            currentPrice: entryPrice,
            simulatedPositionSize: positionSize,
            unrealizedPnl: 0,
            realizedPnl: 0,
            status: 'OPEN',
          },
        });
        paperCopied++;
      } else if (tradeScore.decision === 'WATCHLIST') {
        watchlisted++;
      } else {
        skipped++;
      }
      
    } catch (error) {
      console.error(`[score:trades] Error scoring trade ${trade.id}:`, error);
    }
  }
  
  console.log(`[score:trades] Completed: ${scored} scored, ${paperCopied} paper copied, ${watchlisted} watchlisted, ${skipped} skipped`);
  
  return { success: true, scored, paperCopied, watchlisted, skipped };
}

if (require.main === module) {
  scoreTrades()
    .then(result => {
      console.log('[score:trades] Completed:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('[score:trades] Failed:', error);
      process.exit(1);
    });
}

export { scoreTrades };