// src/scripts/score-trades.ts
// Trade scorer - scores pending observed trades and makes decisions (pg version)

import { scoreTrade, TradeScoringInput } from '../lib/scoring/trade-scorer';
import { query } from '../lib/db/pool';

async function getActiveRules() {
  const result = await query('SELECT * FROM "RuleSet" WHERE active = true ORDER BY version DESC LIMIT 1');
  if (result.rows.length === 0) {
    throw new Error('No active rule set found');
  }
  const rule = result.rows[0];
  return {
    id: rule.id,
    version: rule.version,
    active: rule.active,
    rules: JSON.parse(rule.rulesJson),
  };
}

async function scoreTrades() {
  console.log('[score:trades] Starting trade scoring...');
  
  const rules = await getActiveRules();
  
  // Get unscored observed trades (no decision journal yet)
  const unscoredResult = await query(`
    SELECT ot.* FROM "ObservedTrade" ot
    LEFT JOIN "DecisionJournal" dj ON ot.id = dj."observedTradeId"
    WHERE dj.id IS NULL
    ORDER BY ot."createdAt" DESC
    LIMIT 100
  `);
  const unscoredTrades = unscoredResult.rows;
  
  console.log(`[score:trades] Found ${unscoredTrades.length} unscored trades`);
  
  let scored = 0;
  let paperCopied = 0;
  let watchlisted = 0;
  let skipped = 0;
  
  for (const trade of unscoredTrades) {
    try {
      // Get wallet profile
      const walletResult = await query(
        'SELECT * FROM "WalletProfile" WHERE address = $1',
        [trade.walletAddress.toLowerCase()]
      );
      const wallet = walletResult.rows[0] || null;
      
      // Skip if wallet not tracked
      if (!wallet || wallet.status !== 'TRACK') {
        const decisionId = `dec_${trade.id}_${Date.now()}`;
        await query(`
          INSERT INTO "DecisionJournal" (
            id, "observedTradeId", "walletAddress", "marketId",
            decision, "copyScore", confidence, "reasonsJson", "risksJson",
            "createdAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        `, [
          decisionId, trade.id, trade.walletAddress, trade.marketId,
          'SKIP', 0, 0,
          JSON.stringify(['Wallet not tracked']),
          JSON.stringify([])
        ]);
        
        skipped++;
        console.log(`[score:trades] ${trade.id.substring(0, 10)}...: SKIP (wallet not tracked)`);
        continue;
      }
      
      // Get market snapshot for liquidity/spread data
      const marketResult = await query(
        `SELECT * FROM "MarketSnapshot" WHERE "conditionId" = $1 ORDER BY "collectedAt" DESC LIMIT 1`,
        [trade.conditionId]
      );
      const market = marketResult.rows[0] || {
        liquidity: 1000,
        yesBid: trade.walletEntryPrice * 0.98,
        yesAsk: trade.walletEntryPrice * 1.02,
      };
      
      // Build scoring input
      const scoringInput: TradeScoringInput = {
        trade: {
          id: trade.id,
          wallet: trade.walletAddress.toLowerCase(),
          marketId: trade.marketId,
          conditionId: trade.conditionId,
          marketQuestion: trade.marketQuestion,
          marketCategory: trade.marketCategory || undefined,
          outcome: trade.outcome,
          side: trade.side,
          size: trade.size,
          price: trade.walletEntryPrice,
          walletEntryPrice: trade.walletEntryPrice,
          timestamp: trade.timestamp,
          transactionHash: trade.transactionHash || '',
          title: trade.marketQuestion,
        },
        wallet: {
          address: wallet.address,
          label: wallet.label || undefined,
          sourceRank: wallet.sourceRank,
          roi30d: wallet.roi30d,
          consistencyScore: wallet.consistencyScore,
          copyabilityScore: wallet.copyabilityScore,
          oneHitWonderPenalty: wallet.oneHitWonderPenalty,
          globalScore: wallet.globalScore,
          bestCategory: wallet.bestCategory || undefined,
          categoryStrengths: JSON.parse(wallet.categoryStrengthsJson || '{}'),
          averageTradeSize: wallet.averageTradeSize,
          tradeCount30d: wallet.tradeCount30d,
          resolvedTradeCount30d: wallet.resolvedTradeCount30d,
          winRate30d: wallet.winRate30d,
          averageLiquidity: wallet.averageLiquidity,
          averageSpread: wallet.averageSpread,
          averageEntryTiming: wallet.averageEntryTiming,
          status: wallet.status as 'TRACK' | 'WATCH' | 'IGNORE',
          statusReason: wallet.statusReason || '',
        },
        market: {
          marketId: trade.marketId,
          conditionId: trade.conditionId,
          question: trade.marketQuestion,
          category: market.category || undefined,
          yesPrice: market.yesBid || trade.walletEntryPrice,
          noPrice: market.yesAsk || (1 - trade.walletEntryPrice),
          bestBid: market.yesBid,
          bestAsk: market.yesAsk,
          spread: market.spread || 0.02,
          liquidity: market.liquidity || 1000,
          volume: market.volume24h,
          timeToResolution: undefined,
          collectedAt: new Date(),
        },
        rules: rules.rules,
      };
      
      // Score the trade
      const scoring = scoreTrade(scoringInput);
      
      // Make decision based on total score and rules
      const thresholds = rules.rules;
      let decision: 'COPY' | 'WATCH' | 'SKIP';
      
      if (scoring.total >= thresholds.minTradeScoreForCopy) {
        decision = 'COPY';
      } else if (scoring.total >= thresholds.minTradeScoreForWatch) {
        decision = 'WATCH';
      } else {
        decision = 'SKIP';
      }
      
      // Create decision journal entry
      const decisionId = `dec_${trade.id}_${Date.now()}`;
      await query(`
        INSERT INTO "DecisionJournal" (
          id, "observedTradeId", "walletAddress", "marketId",
          decision, "copyScore", confidence, "reasonsJson", "risksJson",
          "walletQualityScore", "roiScore", "consistencyScore", "copyabilityScore",
          "categoryFitScore", "entryTimingScore", "spreadScore", "liquidityScore",
          "thesisScore", "simulatedPositionSize", "createdAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW())
      `, [
        decisionId, trade.id, trade.walletAddress, trade.marketId,
        decision, scoring.total, scoring.total,
        JSON.stringify(scoring.reasons),
        JSON.stringify(scoring.risks),
        scoring.walletQuality,
        scoring.priceMovement, scoring.liquidity, scoring.spread,
        scoring.categoryMatch, scoring.timeToResolution,
        scoring.spread, scoring.liquidity,
        scoring.thesis,
        // Calculate simulated position size based on score
        decision === 'COPY' ? 10 * scoring.total : 0
      ]);
      
      // If COPY, create paper trade
      if (decision === 'COPY') {
        const positionSize = 10 * scoring.total; // $10 base * score
        const paperTradeId = `pt_${trade.id}_${Date.now()}`;
        await query(`
          INSERT INTO "PaperTrade" (
            id, "decisionJournalId", "walletAddress", "marketId",
            outcome, side, "entryPrice", "currentPrice", "simulatedPositionSize",
            "unrealizedPnl", "realizedPnl", status, "openedAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
        `, [
          paperTradeId, decisionId, trade.walletAddress, trade.marketId,
          trade.outcome, trade.side, trade.walletEntryPrice, trade.walletEntryPrice,
          positionSize,
          0, 0, 'OPEN'
        ]);
        
        paperCopied++;
        console.log(`[score:trades] ${trade.id.substring(0, 10)}...: COPY ($${positionSize.toFixed(2)})`);
      } else if (decision === 'WATCH') {
        watchlisted++;
        console.log(`[score:trades] ${trade.id.substring(0, 10)}...: WATCH (score: ${scoring.total.toFixed(2)})`);
      } else {
        skipped++;
        console.log(`[score:trades] ${trade.id.substring(0, 10)}...: SKIP (score: ${scoring.total.toFixed(2)})`);
      }
      
      scored++;
      
    } catch (error: any) {
      console.error(`[score:trades] Error scoring ${trade.id}:`, error.message);
      if (error.stack) console.error(error.stack);
    }
  }
  
  console.log(`[score:trades] Completed: ${scored} scored, ${paperCopied} paper copied, ${watchlisted} watchlisted, ${skipped} skipped`);
  
  return {
    success: true,
    scored,
    paperCopied,
    watchlisted,
    skipped,
  };
}

// Run if executed directly
if (require.main === module) {
  scoreTrades().then(result => {
    console.log('[score:trades] Completed:', result);
    process.exit(result.success ? 0 : 1);
  }).catch(error => {
    console.error('[score:trades] CRASHED:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  });
}

export { scoreTrades };