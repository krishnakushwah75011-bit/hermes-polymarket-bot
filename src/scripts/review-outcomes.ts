// src/scripts/review-outcomes.ts
// Outcome review - analyzes closed trades to learn from results (pg version - STUB)

import { query } from '../lib/db/pool';

async function reviewOutcomes() {
  console.log('[review:outcomes] Starting outcome review...');
  
  // Get closed paper trades that haven't been reviewed
  const result = await query(`
    SELECT pt.* FROM "PaperTrade" pt
    LEFT JOIN "OutcomeReview" orr ON pt.id = orr."paperTradeId"
    WHERE pt.status = 'CLOSED' AND orr.id IS NULL
    LIMIT 50
  `);
  
  const tradesToReview = result.rows;
  
  if (tradesToReview.length === 0) {
    console.log('[review:outcomes] No closed trades to review');
    return { success: true, reviewed: 0 };
  }
  
  console.log(`[review:outcomes] Found ${tradesToReview.length} trades to review`);
  
  let reviewed = 0;
  
  for (const trade of tradesToReview) {
    try {
      // Simple review logic - determine if decision was good based on PnL
      const wasDecisionGood = trade.realizedPnL > 0;
      
      const reviewId = `rev_${trade.id}_${Date.now()}`;
      await query(`
        INSERT INTO "OutcomeReview" (
          id, "decisionJournalId", "paperTradeId", "walletAddress", "marketId",
          "reviewTime", "simulatedPnl", "wasDecisionGood", "lessonsJson"
        ) VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, $8)
      `, [
        reviewId, trade.decisionJournalId, trade.id, trade.walletAddress, trade.marketId,
        trade.realizedPnL, wasDecisionGood,
        JSON.stringify([wasDecisionGood ? 'Profitable trade' : 'Loss - review entry criteria'])
      ]);
      
      reviewed++;
      console.log(`[review:outcomes] ${trade.id.substring(0, 10)}...: ${wasDecisionGood ? 'GOOD' : 'BAD'} ($${trade.realizedPnL.toFixed(2)})`);
      
    } catch (error: any) {
      console.error(`[review:outcomes] Error reviewing ${trade.id}:`, error.message);
    }
  }
  
  console.log(`[review:outcomes] Completed: ${reviewed} trades reviewed`);
  return { success: true, reviewed };
}

// Run if executed directly
if (require.main === module) {
  reviewOutcomes().then(result => {
    console.log('[review:outcomes] Completed:', result);
    process.exit(result.success ? 0 : 1);
  }).catch(error => {
    console.error('[review:outcomes] CRASHED:', error.message);
    process.exit(1);
  });
}

export { reviewOutcomes };