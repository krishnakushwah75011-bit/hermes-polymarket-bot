// Complete wallet analysis and scoring
import { query } from '../src/lib/db/pool.js';
import { getAllWalletTrades } from '../src/lib/api/polymarket-client.js';

async function analyzeAndScoreWallets() {
  try {
    console.log('=== WALLET ANALYSIS & SCORING ===\n');
    
    // Get all wallets with recent trades (last 7 days)
    const result = await query(`
      SELECT DISTINCT "walletAddress", COUNT(*) as tradeCount
      FROM "ObservedTrade"
      WHERE "createdAt" > NOW() - INTERVAL '7 days'
      GROUP BY "walletAddress"
      ORDER BY tradeCount DESC
      LIMIT 50
    `);
    
    console.log(`Analyzing ${result.rows.length} active wallets...\n`);
    
    for (const row of result.rows) {
      const address = row.walletAddress;
      const tradeCount = row.tradeCount;
      
      try {
        // Fetch trades
        const trades = await getAllWalletTrades(address, 7);
        
        if (trades.length < 5) {
          console.log(`Skip ${address.slice(0,10)}...: Only ${trades.length} trades`);
          continue;
        }
        
        // Calculate metrics
        const resolved = trades.filter(t => t.isResolved);
        const wins = resolved.filter(t => t.pnl > 0);
        const winRate = resolved.length > 0 ? wins.length / resolved.length : 0;
        
        const totalPnl = resolved.reduce((sum, t) => sum + t.pnl, 0);
        const avgTradeSize = trades.reduce((sum, t) => sum + t.size, 0) / trades.length;
        const roi30d = totalPnl / (avgTradeSize * trades.length) || 0;
        
        // Simple global score: winRate * 0.4 + Math.min(roi30d, 0.5) * 0.4 + Math.log1p(trades.length) * 0.2
        const globalScore = (winRate * 40) + (Math.min(Math.max(roi30d, 0), 0.5) * 400) + (Math.log1p(trades.length) * 5);
        
        // Determine best category (simplified)
        const categories: Record<string, number> = {};
        trades.forEach(t => {
          if (t.marketCategory) {
            categories[t.marketCategory] = (categories[t.marketCategory] || 0) + (t.pnl || 0);
          }
        });
        const bestCategory = Object.entries(categories)
          .sort((a, b) => b[1] - a[1])[0]?.[0] || 'General';
        
        // Update wallet
        await query(`
          UPDATE "WalletProfile"
          SET 
            status = CASE WHEN "globalScore" > 30 THEN 'TRACK' ELSE 'WATCH' END,
            "globalScore" = $2,
            "bestCategory" = $3,
            "roi30d" = $4,
            "winRate30d" = $5,
            "tradeCount30d" = $6,
            "averageTradeSize" = $7,
            "consistencyScore" = $8,
            "copyabilityScore" = $9,
            "statusReason" = $10,
            "updatedAt" = NOW()
          WHERE address = $1
        `, [
          address,
          globalScore,
          bestCategory,
          roi30d,
          winRate,
          trades.length,
          avgTradeSize,
          winRate * 100,
          Math.min(1, trades.length / 50),
          `Analyzed: ${trades.length} trades, ${winRate.toFixed(1)}% win rate, ${(roi30d*100).toFixed(1)}% ROI`
        ]);
        
        console.log(`✓ ${address.slice(0,10)}... | Score: ${globalScore.toFixed(2)} | ${bestCategory} | ROI: ${(roi30d*100).toFixed(1)}% | WR: ${(winRate*100).toFixed(1)}% → ${globalScore > 30 ? 'TRACK' : 'WATCH'}`);
        
      } catch (err) {
        console.log(`✗ ${address.slice(0,10)}...: ${err.message}`);
      }
    }
    
    // Final count
    const track = await query(`SELECT COUNT(*) as c FROM "WalletProfile" WHERE status='TRACK'`);
    const watch = await query(`SELECT COUNT(*) as c FROM "WalletProfile" WHERE status='WATCH'`);
    
    console.log(`\n=== FINAL STATUS ===`);
    console.log(`TRACK: ${track.rows[0].c} wallets`);
    console.log(`WATCH: ${watch.rows[0].c} wallets`);
    
  } catch (err) {
    console.error('Fatal:', err.message);
    process.exit(1);
  }
}

analyzeAndScoreWallets();