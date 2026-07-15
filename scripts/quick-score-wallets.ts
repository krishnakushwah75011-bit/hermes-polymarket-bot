// Quick wallet scorer - calculates metrics from existing ObservedTrade data
import { query } from '../src/lib/db/pool.js';

async function quickScoreWallets() {
  try {
    console.log('=== QUICK WALLET SCORING ===\n');
    
    // Get all wallets with trades in last 7 days
    const wallets = await query(`
      SELECT 
        "walletAddress",
        COUNT(*) as totalTrades,
        COUNT(*) FILTER (WHERE "createdAt" > NOW() - INTERVAL '30 days') as trades30d
      FROM "ObservedTrade"
      WHERE "createdAt" > NOW() - INTERVAL '7 days'
      GROUP BY "walletAddress"
      HAVING COUNT(*) >= 5
      ORDER BY totalTrades DESC
      LIMIT 30
    `);
    
    console.log(`Scoring ${wallets.rows.length} active wallets...\n`);
    
    for (const w of wallets.rows) {
      const address = w.walletAddress;
      
      // Get trade outcomes (approximate from decision journal)
      const outcomes = await query(`
        SELECT 
          dj.decision,
          pt."unrealizedPnl",
          pt."realizedPnl",
          pt.status
        FROM "DecisionJournal" dj
        LEFT JOIN "PaperTrade" pt ON dj.id = pt."decisionJournalId"
        WHERE dj."walletAddress" = $1
      `, [address]);
      
      const resolved = outcomes.rows.filter(r => r.status === 'RESOLVED' || r.status === 'CLOSED');
      const open = outcomes.rows.filter(r => r.status === 'OPEN');
      
      // Calculate metrics
      const totalPnl = outcomes.rows.reduce((sum, r) => sum + (r.unrealizedPnl || 0) + (r.realizedPnl || 0), 0);
      const wins = resolved.filter(r => (r.realizedPnl || 0) > 0).length;
      const winRate = resolved.length > 0 ? wins / resolved.length : 0.5; // Default 50% if no data
      
      // Approximate ROI
      const avgSize = 10; // Assume $10 average
      const roi30d = totalPnl / (avgSize * w.trades30d) || 0;
      
      // Consistency: std dev of PnL (simplified)
      const pnlValues = outcomes.rows.map(r => r.unrealizedPnl || r.realizedPnl || 0);
      const meanPnl = pnlValues.reduce((a, b) => a + b, 0) / pnlValues.length || 0;
      const variance = pnlValues.reduce((sum, v) => sum + Math.pow(v - meanPnl, 2), 0) / pnlValues.length || 1;
      const consistencyScore = Math.max(0, 1 - (Math.sqrt(variance) / (avgSize * 2)));
      
      // Copyability: based on trade frequency and resolution rate
      const copyabilityScore = Math.min(1, w.trades30d / 30) * 0.6 + (resolved.length / outcomes.rows.length || 0) * 0.4;
      
      // One-hit-wonder penalty
      const categoryCount = 1; // Simplified
      const oneHitPenalty = categoryCount < 2 ? 0.2 : 0;
      
      // Global score (0-100)
      const globalScore = 
        (winRate * 30) +
        (Math.min(Math.max(roi30d, 0), 0.5) * 300) +
        (consistencyScore * 20) +
        (copyabilityScore * 20) -
        (oneHitPenalty * 10);
      
      // Determine status
      const newStatus = globalScore > 25 ? 'TRACK' : (globalScore > 15 ? 'WATCH' : 'IGNORE');
      
      // Update wallet
      await query(`
        UPDATE "WalletProfile"
        SET 
          status = $2,
          "globalScore" = $3,
          "roi30d" = $4,
          "winRate30d" = $5,
          "consistencyScore" = $6,
          "copyabilityScore" = $7,
          "oneHitWonderPenalty" = $8,
          "tradeCount30d" = $9,
          "averageTradeSize" = $10,
          "statusReason" = $11,
          "updatedAt" = NOW()
        WHERE address = $1
      `, [
        address,
        newStatus,
        globalScore,
        roi30d,
        winRate,
        consistencyScore,
        copyabilityScore,
        oneHitPenalty,
        parseInt(w.trades30d),
        avgSize,
        `Auto-scored: ${(winRate*100).toFixed(0)}% WR, ${(roi30d*100).toFixed(1)}% ROI, Score=${globalScore.toFixed(1)}`
      ]);
      
      console.log(`✓ ${address.slice(0,10)}... | Score: ${globalScore.toFixed(1)} | ${newStatus} | WR: ${(winRate*100).toFixed(0)}% | ROI: ${(roi30d*100).toFixed(1)}%`);
    }
    
    // Final stats
    const track = await query(`SELECT COUNT(*) as c FROM "WalletProfile" WHERE status='TRACK'`);
    const watch = await query(`SELECT COUNT(*) as c FROM "WalletProfile" WHERE status='WATCH'`);
    const ignore = await query(`SELECT COUNT(*) as c FROM "WalletProfile" WHERE status='IGNORE'`);
    
    console.log(`\n=== FINAL STATUS ===`);
    console.log(`TRACK: ${track.rows[0].c} wallets`);
    console.log(`WATCH: ${watch.rows[0].c} wallets`);
    console.log(`IGNORE: ${ignore.rows[0].c} wallets`);
    
    console.log(`\n✅ Wallet scoring complete! System will now COPY trades from TRACK wallets.`);
    
  } catch (err) {
    console.error('Fatal:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

quickScoreWallets();