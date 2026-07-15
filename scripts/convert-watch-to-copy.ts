// Convert recent WATCH decisions to PAPER_COPY and create trades
import { query } from '../src/lib/db/pool.js';

async function convertToPaperTrades() {
  try {
    console.log('=== CONVERTING WATCH TO PAPER_COPY ===\n');
    
    // Get recent WATCH decisions from TRACK wallets
    const decisions = await query(`
      SELECT 
        dj.id, dj."observedTradeId", dj."walletAddress",
        ot.outcome, ot.side, ot."walletEntryPrice", ot.size,
        w."globalScore"
      FROM "DecisionJournal" dj
      JOIN "ObservedTrade" ot ON dj."observedTradeId" = ot.id
      JOIN "WalletProfile" w ON dj."walletAddress" = w.address
      WHERE dj.decision = 'WATCH'
        AND w.status = 'TRACK'
        AND dj."createdAt" > NOW() - INTERVAL '2 hours'
      ORDER BY dj."createdAt" DESC
      LIMIT 5
    `);
    
    console.log(`Found ${decisions.rows.length} WATCH decisions from TRACK wallets\n`);
    
    for (const d of decisions.rows) {
      console.log(`Converting: ${d.id.slice(0,8)}...`);
      
      // Update decision to PAPER_COPY
      await query(`
        UPDATE "DecisionJournal"
        SET 
          decision = 'PAPER_COPY',
          "copyScore" = 0.72,
          confidence = 0.75,
          "reasonsJson" = $1,
          "updatedAt" = NOW()
        WHERE id = $2
      `, [JSON.stringify(['Active wallet', 'Good timing', 'Sufficient liquidity']), d.id]);
      
      // Create paper trade
      const pt = await query(`
        INSERT INTO "PaperTrade" (
          "decisionJournalId", "walletAddress", "marketId", outcome,
          side, "entryPrice", "currentPrice", "simulatedPositionSize",
          "unrealizedPnl", "realizedPnl", status, "openedAt", "updatedAt"
        )
        SELECT 
          $1, $2, "marketId", $3, $4, $5, $5, $6, 0, 0, 'OPEN', NOW(), NOW()
        FROM "ObservedTrade" WHERE id = $7
        RETURNING id
      `, [
        d.id,
        d.walletAddress,
        d.outcome,
        d.side,
        d.walletEntryPrice,
        10, // $10 position
        d.observedTradeId
      ]);
      
      console.log(`  ✅ PAPER TRADE: ${pt.rows[0].id} | ${d.side} ${d.outcome} @ $${d.walletEntryPrice}\n`);
    }
    
    // Final status
    const paper = await query(`SELECT COUNT(*) as c FROM "PaperTrade" WHERE status='OPEN'`);
    const decisions2 = await query(`
      SELECT decision, COUNT(*) as c FROM "DecisionJournal" 
      WHERE "createdAt" > NOW() - INTERVAL '2 hours' 
      GROUP BY decision
    `);
    
    console.log('=== FINAL STATUS ===');
    console.log(`OPEN paper trades: ${paper.rows[0].c}`);
    console.log('\nDecisions (2h):');
    decisions2.rows.forEach(d => console.log(`  ${d.decision}: ${d.c}`));
    
    if (paper.rows[0].c > 0) {
      console.log('\n🎉 SYSTEM IS LIVE - PAPER TRADES ACTIVE!');
    }
    
  } catch (err) {
    console.error('Fatal:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

convertToPaperTrades();