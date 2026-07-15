// Force full pipeline run
import { query } from '../src/lib/db/pool.js';

async function forcePipeline() {
  try {
    console.log('=== FORCED PIPELINE RUN ===\n');
    
    // 1. Check unscored observed trades
    const unscored = await query(`
      SELECT ot.id, ot."walletAddress", ot."marketId", ot.outcome, ot.side
      FROM "ObservedTrade" ot
      LEFT JOIN "DecisionJournal" dj ON ot.id = dj."observedTradeId"
      WHERE dj.id IS NULL
      ORDER BY ot."createdAt" DESC
      LIMIT 10
    `);
    
    console.log(`Unscored trades: ${unscored.rows.length}`);
    unscored.rows.forEach((t, i) => {
      console.log(`  ${i+1}. ${t.walletAddress.slice(0,10)}... -> ${t.marketId.slice(0,10)}... (${t.side} ${t.outcome})`);
    });
    
    // 2. Check recent decisions
    const decisions = await query(`
      SELECT decision, COUNT(*) as count 
      FROM "DecisionJournal" 
      GROUP BY decision
    `);
    console.log('\nDecisions by type:');
    decisions.rows.forEach(d => console.log(`  ${d.decision}: ${d.count}`));
    
    // 3. Check paper trades
    const paper = await query(`SELECT status, COUNT(*) as count FROM "PaperTrade" GROUP BY status`);
    console.log('\nPaper trades by status:');
    paper.rows.forEach(p => console.log(`  ${p.status}: ${p.count}`));
    
    // 4. Check TRACK wallets
    const track = await query(`
      SELECT address, "globalScore", "bestCategory" 
      FROM "WalletProfile" 
      WHERE status='TRACK' 
      ORDER BY "globalScore" DESC NULLS LAST
      LIMIT 5
    `);
    console.log('\nTop TRACK wallets:');
    track.rows.forEach(w => {
      console.log(`  ${w.address.slice(0,10)}... | Score: ${w.globalScore ?? 'NaN'} | ${w.bestCategory || 'N/A'}`);
    });
    
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

forcePipeline();