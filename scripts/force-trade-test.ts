// Force insert test trade and trigger full pipeline
import { query } from '../src/lib/db/pool.js';

async function forceTradeAndScore() {
  try {
    console.log('=== FORCE TRADE INSERT & SCORING ===\n');
    
    // Get a TRACK wallet
    const wallet = await query(`SELECT address FROM "WalletProfile" WHERE status='TRACK' LIMIT 1`);
    const walletAddress = wallet.rows[0].address;
    
    console.log(`Using wallet: ${walletAddress}`);
    
    // Insert a test observed trade
    const testTrade = {
      marketId: 'test-market-123',
      conditionId: 'test-condition-456',
      marketQuestion: 'Will System Go Live Today?',
      marketCategory: 'Technology',
      outcome: 'Yes',
      side: 'BUY',
      price: 0.65,
      size: 100,
      timestamp: new Date().toISOString(),
      transactionHash: `0xtest${Date.now()}`
    };
    
    await query(`
      INSERT INTO "ObservedTrade" (
        "walletAddress", "marketId", "conditionId", "marketQuestion",
        "marketCategory", outcome, side, "walletEntryPrice", "detectedPrice",
        size, timestamp, "transactionHash", "rawTradeJson"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id
    `, [
      walletAddress,
      testTrade.marketId,
      testTrade.conditionId,
      testTrade.marketQuestion,
      testTrade.marketCategory,
      testTrade.outcome,
      testTrade.side,
      testTrade.price,
      testTrade.price,
      testTrade.size,
      testTrade.timestamp,
      testTrade.transactionHash,
      JSON.stringify(testTrade)
    ]);
    
    console.log('✓ Test trade inserted');
    
    // Now run scoring
    console.log('\nRunning score-trades...\n');
    const { execSync } = require('child_process');
    const output = execSync('node --dns-result-order=ipv4first -r tsx src/scripts/score-trades.ts', {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 60000
    });
    console.log(output);
    
    // Check result
    const decision = await query(`
      SELECT dj.decision, dj."copyScore", dj.confidence, pt.id as "paperTradeId"
      FROM "DecisionJournal" dj
      LEFT JOIN "PaperTrade" pt ON dj.id = pt."decisionJournalId"
      WHERE dj."observedTradeId" = (
        SELECT id FROM "ObservedTrade" WHERE "transactionHash" = $1
      )
    `, [testTrade.transactionHash]);
    
    if (decision.rows.length > 0) {
      const d = decision.rows[0];
      console.log('\n=== DECISION MADE ===');
      console.log(`Decision: ${d.decision}`);
      console.log(`Copy Score: ${d.copyScore}`);
      console.log(`Confidence: ${d.confidence}`);
      console.log(`Paper Trade ID: ${d.paperTradeId || 'N/A'}`);
      
      if (d.decision === 'PAPER_COPY' && d.paperTradeId) {
        console.log('\n🎉 SUCCESS! Paper trade created!');
        const pt = await query(`SELECT * FROM "PaperTrade" WHERE id = $1`, [d.paperTradeId]);
        console.log(`Entry: $${pt.rows[0].entryPrice}, Size: $${pt.rows[0].simulatedPositionSize}, Status: ${pt.rows[0].status}`);
      }
    } else {
      console.log('\n⚠️ No decision found - scoring may have failed');
    }
    
  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

forceTradeAndScore();