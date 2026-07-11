// src/scripts/monitor-trades.ts
// Trade monitor - detects new trades from tracked wallets and scores them

import { getAllWalletTrades, collectMarketSnapshot } from '@/lib/api/polymarket-client';
import { scoreTrade, TradeScoringInput } from '@/lib/scoring/trade-scorer';
import { getActiveRuleSet } from '@/lib/rules/rules-engine';
import { createPaperTrade, calculateSimulatedPositionSize } from '@/lib/engine/paper-engine';
import { prisma } from '@/lib/db/client';

async function monitorTrades() {
  console.log('[monitor:trades] Starting trade monitoring...');
  
  const rules = await getActiveRuleSet();
  
  // Get wallets with TRACK status
  const trackedWallets = await prisma.walletProfile.findMany({
    where: { status: 'TRACK' },
    select: { address: true, globalScore: true, bestCategory: true },
  });
  
  console.log(`[monitor:trades] Monitoring ${trackedWallets.length} tracked wallets`);
  
  let newTradesDetected = 0;
  let scored = 0;
  let paperCopied = 0;
  let watchlisted = 0;
  let skipped = 0;
  
  for (const wallet of trackedWallets) {
    try {
      // Get recent trades (last 24 hours to catch new ones)
      const trades = await getAllWalletTrades(wallet.address, 1); // 1 day lookback
      
      for (const trade of trades) {
        // Check if already observed
        const existing = await prisma.observedTrade.findFirst({
          where: {
            walletAddress: wallet.address,
            conditionId: trade.conditionId,
            transactionHash: trade.transactionHash,
          },
        });
        
        if (existing) continue;
        
        console.log(`[monitor:trades] New trade detected: ${wallet.address} -> ${trade.conditionId}`);
        newTradesDetected++;
        
        // Collect market snapshot
        const marketSnapshot = await collectMarketSnapshot(trade);
        
        if (!marketSnapshot) {
          console.warn(`[monitor:trades] Could not get market snapshot for ${trade.conditionId}`);
          continue;
        }
        
        // Create observed trade record
        const observedTrade = await prisma.observedTrade.create({
          data: {
            walletAddress: wallet.address,
            marketId: trade.marketId,
            conditionId: trade.conditionId,
            marketQuestion: trade.marketQuestion,
            marketCategory: trade.marketCategory || marketSnapshot.category,
            outcome: trade.outcome,
            side: trade.side,
            walletEntryPrice: trade.price,
            detectedPrice: trade.outcome.toLowerCase() === 'yes' 
              ? (marketSnapshot.yesPrice || trade.price)
              : (marketSnapshot.noPrice || trade.price),
            size: trade.size,
            timestamp: trade.timestamp,
            rawTradeJson: JSON.stringify(trade),
          },
        });
        
        // Score the trade
        const scoringInput: TradeScoringInput = {
          wallet: {
            address: wallet.address,
            label: undefined,
            globalScore: wallet.globalScore,
            bestCategory: wallet.bestCategory || undefined,
            categoryStrengths: {}, // Would load from wallet profile
            averageEntryTiming: 0,
            status: 'TRACK',
          },
          trade: trade,
          market: marketSnapshot,
          rules: rules.rules,
        };
        
        const tradeScore = scoreTrade(scoringInput);
        
        // Create decision journal
        await prisma.decisionJournal.create({
          data: {
            observedTradeId: observedTrade.id,
            walletAddress: wallet.address,
            marketId: trade.marketId,
            decision: tradeScore.decision,
            copyScore: tradeScore.total,
            confidence: tradeScore.total,
            reasonsJson: JSON.stringify(tradeScore.reasons),
            risksJson: JSON.stringify(tradeScore.risks),
            walletQualityScore: tradeScore.walletQuality,
            roiScore: tradeScore.priceMovement, // placeholder
            consistencyScore: tradeScore.liquidity, // placeholder
            copyabilityScore: tradeScore.spread, // placeholder
            categoryFitScore: tradeScore.categoryMatch,
            entryTimingScore: tradeScore.timeToResolution,
            spreadScore: tradeScore.spread,
            liquidityScore: tradeScore.liquidity,
            thesisScore: tradeScore.thesis,
            simulatedPositionSize: calculateSimulatedPositionSize(tradeScore),
          },
        });
        
        scored++;
        
        // Create paper trade if PAPER_COPY
        if (tradeScore.decision === 'PAPER_COPY') {
          await createPaperTrade({
            decisionJournalId: observedTrade.id,
            walletAddress: wallet.address,
            marketId: trade.marketId,
            outcome: trade.outcome,
            side: trade.side,
            entryPrice: tradeScore.priceMovement > 0.5 ? marketSnapshot.yesPrice || trade.price : trade.price,
            currentPrice: trade.outcome.toLowerCase() === 'yes' 
              ? (marketSnapshot.yesPrice || trade.price)
              : (marketSnapshot.noPrice || trade.price),
            simulatedPositionSize: calculateSimulatedPositionSize(tradeScore),
          });
          paperCopied++;
        } else if (tradeScore.decision === 'WATCHLIST') {
          watchlisted++;
        } else {
          skipped++;
        }
        
      }
      
      // Rate limit between wallets
      await new Promise(r => setTimeout(r, 200));
      
    } catch (error) {
      console.error(`[monitor:trades] Error monitoring ${wallet.address}:`, error);
    }
  }
  
  console.log(`[monitor:trades] Completed: ${newTradesDetected} new trades, ${scored} scored, ${paperCopied} paper copied, ${watchlisted} watchlisted, ${skipped} skipped`);
  
  return {
    success: true,
    newTradesDetected,
    scored,
    paperCopied,
    watchlisted,
    skipped,
  };
}

if (require.main === module) {
  monitorTrades()
    .then(result => {
      console.log('[monitor:trades] Completed:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('[monitor:trades] Failed:', error);
      process.exit(1);
    });
}

export { monitorTrades };