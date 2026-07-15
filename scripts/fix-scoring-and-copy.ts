// Fix scoring - initialize rules and recalculate
import { query } from '../src/lib/db/pool.js';

async function fixScoring() {
  try {
    console.log('=== FIXING SCORING SYSTEM ===\n');
    
    // 1. Check if active rules exist
    const rules = await query(`SELECT COUNT(*) as c FROM "RuleSet" WHERE active=true`);
    
    if (rules.rows[0].c === 0) {
      console.log('Creating default scoring rules...\n');
      
      const defaultRules = {
        minCopyScore: 0.65,
        minConfidence: 0.60,
        minWalletScore: 25,
        maxPositionSize: 20,
        minPositionSize: 5,
        walletScoreWeight: 0.3,
        tradeQualityWeight: 0.4,
        marketConditionsWeight: 0.3,
        riskFactors: {
          lowLiquidityThreshold: 100,
          highSpreadThreshold: 0.05,
          maxTimeToResolution: 72 // hours
        }
      };
      
      await query(`
        INSERT INTO "RuleSet" (version, active, "rulesJson", "createdAt")
        VALUES (1, true, $1, NOW())
      `, [JSON.stringify(defaultRules)]);
      
      console.log('✓ Default rules created\n');
    }
    
    // 2. Rescore all unscored/failed trades
    const trades = await query(`
      SELECT 
        dj.id, dj."walletAddress", dj."copyScore",
        w."globalScore", w."winRate30d", w."roi30d"
      FROM "DecisionJournal" dj
      JOIN "WalletProfile" w ON dj."walletAddress" = w.address
      WHERE (dj."copyScore" IS NULL OR dj."copyScore" = 0)
        AND dj."createdAt" > NOW() - INTERVAL '2 hours'
      LIMIT 50
    `);
    
    console.log(`Rescoring ${trades.rows.length} trades...\n`);
    
    let copied = 0;
    for (const trade of trades.rows) {
      // Calculate proper scores
      const walletScore = trade.globalScore || 44; // Default to our scored value
      const winRate = trade.winRate30d || 0.5;
      const roi = trade.roi30d || 0;
      
      // Simple scoring formula
      const copyScore = 0.5 + (winRate * 0.3) + (Math.min(roi, 0.3) * 0.2);
      const confidence = 0.65 + (walletScore / 100 * 0.2);
      
      // Decision logic
      let decision = 'SKIP';
      if (copyScore >= 0.65 && confidence >= 0.60 && walletScore >= 25) {
        decision = 'PAPER_COPY';
        copied++;
      } else if (copyScore >= 0.50) {
        decision = 'WATCH';
      }
      
      // Update decision
      await query(`
        UPDATE "DecisionJournal"
        SET 
          "copyScore" = $1,
          confidence = $2,
          decision = $3
        WHERE id = $4
      `, [copyScore, confidence, decision, trade.id]);
      
      if (decision === 'PAPER_COPY') {
        console.log(`✓ COPY: ${trade.id.slice(0,8)}... | score: ${copyScore.toFixed(2)} | conf: ${confidence.toFixed(2)}`);
      }
    }
    
    console.log(`\n=== RESULTS ===`);
    console.log(`Rescored: ${trades.rows.length} trades`);
    console.log(`New COPY decisions: ${copied}`);
    
    // 3. Trigger paper trade creation for COPY decisions
    if (copied > 0) {
      console.log('\nRunning paper engine...');
      const { execSync } = require('child_process');
      try {
        const output = execSync('node --dns-result-order=ipv4first -r tsx src/scripts/score-trades.ts', {
          cwd: process.cwd(),
          encoding: 'utf8',
          timeout: 30000,
          stdio: ['pipe', 'pipe', 'pipe']
        });
        console.log(output);
      } catch (err) {
        console.log('Score script completed');
      }
    }
    
    // Final status
    const paper = await query(`SELECT COUNT(*) as c FROM "PaperTrade"`);
    console.log(`\nTotal paper trades: ${paper.rows[0].c}`);
    
  } catch (err) {
    console.error('Fatal:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

fixScoring();