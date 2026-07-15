// Check recent decisions and why no COPY
import { query } from '../src/lib/db/pool.js';

async function checkDecisions() {
  try {
    console.log('=== RECENT DECISIONS ANALYSIS ===\n');
    
    // Decisions in last 2 hours
    const dec = await query(`
      SELECT decision, COUNT(*) as c 
      FROM "DecisionJournal" 
      WHERE "createdAt" > NOW() - INTERVAL '2 hours' 
      GROUP BY decision
      ORDER BY c DESC
    `);
    
    console.log('Decisions (last 2h):');
    dec.rows.forEach(d => {
      console.log(`  ${d.decision}: ${d.c}`);
    });
    
    // Top 5 by copyScore
    const top = await query(`
      SELECT 
        dj.decision, 
        dj."copyScore", 
        dj.confidence, 
        w."globalScore" as walletScore
      FROM "DecisionJournal" dj
      JOIN "WalletProfile" w ON dj."walletAddress" = w.address
      WHERE dj."createdAt" > NOW() - INTERVAL '2 hours'
      ORDER BY dj."copyScore" DESC
      LIMIT 10
    `);
    
    console.log('\nTop 10 by copyScore:');
    top.rows.forEach(t => {
      const willCopy = t.decision === 'PAPER_COPY' ? '✅' : '❌';
      console.log(`  ${willCopy} ${t.decision.padEnd(12)} | copyScore: ${t.copyScore.toFixed(2)} | conf: ${t.confidence.toFixed(2)} | wallet: ${t.walletScore?.toFixed(1) || 'NaN'}`);
    });
    
    // Check scoring rules
    const rules = await query(`SELECT "rulesJson" FROM "RuleSet" WHERE active=true`);
    if (rules.rows.length > 0) {
      const rulesJson = JSON.parse(rules.rows[0].rulesJson);
      console.log('\n=== ACTIVE SCORING RULES ===');
      console.log(`Min copyScore: ${rulesJson.minCopyScore || 'N/A'}`);
      console.log(`Min confidence: ${rulesJson.minConfidence || 'N/A'}`);
      console.log(`Min wallet score: ${rulesJson.minWalletScore || 'N/A'}`);
    }
    
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkDecisions();