// src/scripts/monitor-trades.ts
// Trade monitor - detects new trades from tracked wallets and scores them (using pg pool)

import { getAllWalletTrades, collectMarketSnapshot, getMarketBySlug, getMarketByConditionId } from '../lib/api/polymarket-client';
import { scoreTrade, TradeScoringInput } from '../lib/scoring/trade-scorer';
import { getActiveRuleSet } from '../lib/rules/rules-engine';
import { createPaperTrade, calculateSimulatedPositionSize } from '../lib/engine/paper-engine';
import { query } from '../lib/db/pool';
import type { MarketSnapshot, ParsedWalletTrade } from '../lib/types';

interface TrackedWallet {
  address: string;
  label?: string;
  globalScore: number;
  bestCategory?: string;
  categoryStrengthsJson: string;
  averageEntryTiming: number;
  roi30d: number;
  consistencyScore: number;
  copyabilityScore: number;
  oneHitWonderPenalty: number;
  averageTradeSize: number;
  tradeCount30d: number;
  resolvedTradeCount30d: number;
  winRate30d: number;
  averageLiquidity: number;
  averageSpread: number;
  sourceRank?: number;
  statusReason: string;
}

async function monitorTrades() {
  console.log('[monitor:trades] Starting trade monitoring...');
  
  const rules = await getActiveRuleSet();
  
  // Get wallets with TRACK status
  const trackedWalletsResult = await query(`
    SELECT * FROM "WalletProfile" WHERE status = 'TRACK'
  `);
  
  const trackedWallets: TrackedWallet[] = trackedWalletsResult.rows;
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
        const existing = await query(`
          SELECT * FROM "ObservedTrade" 
          WHERE "walletAddress" = $1 AND "conditionId" = $2 AND "transactionHash" = $3
        `, [wallet.address, trade.conditionId, trade.transactionHash]);
        
        if (existing.rows.length > 0) continue;
        
        console.log(`[monitor:trades] New trade detected: ${wallet.address} -> ${trade.conditionId}`);
        newTradesDetected++;
        
        // Collect market snapshot - need to fetch market data first
        const market = await getMarketBySlug(trade.marketId) || await getMarketByConditionId(trade.conditionId);
        let marketSnapshot: MarketSnapshot | null = null;
        if (market) {
          marketSnapshot = await collectMarketSnapshot(market);
        } else {
          // Fallback: create minimal snapshot from trade data
          marketSnapshot = {
            marketId: trade.marketId,
            conditionId: trade.conditionId,
            question: trade.marketQuestion,
            category: trade.marketCategory,
            yesPrice: trade.outcome.toLowerCase() === 'yes' ? trade.price : undefined,
            noPrice: trade.outcome.toLowerCase() === 'no' ? trade.price : undefined,
            spread: undefined,
            liquidity: undefined,
            volume: undefined,
            timeToResolution: undefined,
            collectedAt: new Date(),
          };
        }
        
        if (!marketSnapshot) {
          console.warn(`[monitor:trades] Could not get market snapshot for ${trade.conditionId}`);
          continue;
        }
        
        // Create observed trade record
        const observedTradeResult = await query(`
          INSERT INTO "ObservedTrade" (
            id, "walletAddress", "marketId", "conditionId", "marketQuestion", 
            "marketCategory", outcome, side, "walletEntryPrice", "detectedPrice", 
            size, timestamp, "rawTradeJson"
          ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING *
        `, [
          wallet.address,
          trade.marketId,
          trade.conditionId,
          trade.marketQuestion,
          trade.marketCategory || marketSnapshot.category,
          trade.outcome,
          trade.side,
          trade.price,
          trade.outcome.toLowerCase() === 'yes' 
            ? (marketSnapshot.yesPrice || trade.price)
            : (marketSnapshot.noPrice || trade.price),
          trade.size,
          trade.timestamp,
          JSON.stringify(trade),
        ]);
        
        const observedTrade = observedTradeResult.rows[0];
        
        // Score the trade
        const scoringInput: TradeScoringInput = {
          wallet: {
            address: wallet.address,
            label: wallet.label || undefined,
            globalScore: wallet.globalScore,
            bestCategory: wallet.bestCategory || undefined,
            categoryStrengths: wallet.categoryStrengthsJson ? JSON.parse(wallet.categoryStrengthsJson) : {},
            averageEntryTiming: wallet.averageEntryTiming,
            status: 'TRACK',
            roi30d: wallet.roi30d,
            consistencyScore: wallet.consistencyScore,
            copyabilityScore: wallet.copyabilityScore,
            oneHitWonderPenalty: wallet.oneHitWonderPenalty,
            averageTradeSize: wallet.averageTradeSize,
            tradeCount30d: wallet.tradeCount30d,
            resolvedTradeCount30d: wallet.resolvedTradeCount30d,
            winRate30d: wallet.winRate30d,
            averageLiquidity: wallet.averageLiquidity,
            averageSpread: wallet.averageSpread,
            sourceRank: wallet.sourceRank,
            statusReason: wallet.statusReason || '',
          },
          trade: trade,
          market: marketSnapshot,
          rules: rules.rules,
        };
        
        const tradeScore = scoreTrade(scoringInput);
        
        // Create decision journal
        await query(`
          INSERT INTO "DecisionJournal" (
            id, "observedTradeId", "walletAddress", "marketId", decision, "copyScore",
            confidence, "reasonsJson", "risksJson", "walletQualityScore", "roiScore",
            "consistencyScore", "copyabilityScore", "categoryFitScore", "entryTimingScore",
            "spreadScore", "liquidityScore", "thesisScore", "simulatedPositionSize"
          ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        `, [
          observedTrade.id,
          wallet.address,
          trade.marketId,
          tradeScore.decision,
          tradeScore.total,
          tradeScore.total,
          JSON.stringify(tradeScore.reasons),
          JSON.stringify(tradeScore.risks),
          tradeScore.walletQuality,
          tradeScore.priceMovement,
          tradeScore.liquidity,
          tradeScore.spread,
          tradeScore.categoryMatch,
          tradeScore.timeToResolution,
          tradeScore.spread,
          tradeScore.liquidity,
          tradeScore.thesis,
          calculateSimulatedPositionSize(tradeScore.total),
        ]);
        
        scored++;
        
        // Create paper trade if PAPER_COPY
        if (tradeScore.decision === 'PAPER_COPY') {
          await createPaperTrade({
            decisionJournalId: observedTrade.id,
            walletAddress: wallet.address,
            marketId: trade.marketId,
            outcome: trade.outcome,
            side: trade.side,
            entryPrice: tradeScore.priceMovement > 0.5 
              ? (marketSnapshot.yesPrice || trade.price) 
              : trade.price,
            currentPrice: trade.outcome.toLowerCase() === 'yes' 
              ? (marketSnapshot.yesPrice || trade.price)
              : (marketSnapshot.noPrice || trade.price),
            simulatedPositionSize: calculateSimulatedPositionSize(tradeScore.total),
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