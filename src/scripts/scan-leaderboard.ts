// src/scripts/scan-leaderboard.ts
// Leaderboard scanner - builds leaderboard from trades data (using pg pool)

import { query } from '../lib/db/pool';

interface LeaderboardEntry {
  rank: number;
  address: string;
  label?: string;
  pnl: number;
  roi: number;
  volume: number;
  trades: number;
  winRate: number;
  categories?: Record<string, number>;
}

async function scanLeaderboard() {
  console.log('[scan:leaderboard] Starting leaderboard scan from trades data...');
  
  const lookbackDays = parseInt(process.env.SCAN_LOOKBACK_DAYS || '30', 10);
  const maxWallets = parseInt(process.env.MAX_WALLETS_TO_SCAN || '500', 10);
  
  try {
    // Fetch recent trades (Data API returns max ~1000 trades)
    console.log('[scan:leaderboard] Fetching recent trades...');
    
    // We'll use the historical trades we've already collected
    const cutoffTime = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
    
    const tradesResult = await query(`
      SELECT * FROM "HistoricalTrade" 
      WHERE timestamp >= $1
      ORDER BY timestamp DESC
    `, [cutoffTime]);
    
    const trades = tradesResult.rows;
    console.log(`[scan:leaderboard] Fetched ${trades.length} trades`);
    
    if (trades.length === 0) {
      console.warn('[scan:leaderboard] No trades found');
      return { success: true, scanId: null, walletCount: 0 };
    }
    
    // Aggregate by wallet
    const walletMap = new Map<string, {
      address: string;
      name?: string;
      pseudonym?: string;
      trades: number;
      volume: number;
      buys: number;
      sells: number;
      firstSeen: number;
      lastSeen: number;
    }>();
    
    for (const trade of trades) {
      const wallet = trade.proxyWallet?.toLowerCase();
      if (!wallet) continue;
      
      const timestamp = new Date(trade.timestamp).getTime() / 1000;
      if (timestamp < cutoffTime.getTime() / 1000) continue;
      
      const size = trade.size || 0;
      const price = trade.price || 0;
      const volume = size * price;
      
      let stats = walletMap.get(wallet);
      if (!stats) {
        stats = {
          address: wallet,
          name: trade.name,
          pseudonym: trade.pseudonym,
          trades: 0,
          volume: 0,
          buys: 0,
          sells: 0,
          firstSeen: timestamp,
          lastSeen: timestamp,
        };
        walletMap.set(wallet, stats);
      }
      
      stats.trades += 1;
      stats.volume += volume;
      if (trade.side === 'BUY') stats.buys += 1;
      else stats.sells += 1;
      if (timestamp < stats.firstSeen) stats.firstSeen = timestamp;
      if (timestamp > stats.lastSeen) stats.lastSeen = timestamp;
      if (trade.name && !stats.name) stats.name = trade.name;
      if (trade.pseudonym && !stats.pseudonym) stats.pseudonym = trade.pseudonym;
    }
    
    // Convert to array and sort by volume (desc)
    const leaderboard = Array.from(walletMap.values())
      .filter(w => w.trades >= 2) // Minimum 2 trades to be on leaderboard
      .sort((a, b) => b.volume - a.volume)
      .slice(0, maxWallets);
    
    console.log(`[scan:leaderboard] Built leaderboard with ${leaderboard.length} wallets`);
    
    // Calculate ranks
    const rankedLeaderboard = leaderboard.map((w, i) => ({
      ...w,
      rank: i + 1,
    }));
    
    // Store scan metadata
    const scanResult = await query(`
      INSERT INTO "LeaderboardScan" ("id", source, "walletCount", "lookbackDays", "rawSummaryJson")
      VALUES (gen_random_uuid()::text, $1, $2, $3, $4)
      RETURNING *
    `, [
      'polymarket-trades',
      leaderboard.length,
      lookbackDays,
      JSON.stringify({
        top10: rankedLeaderboard.slice(0, 10).map(w => ({
          rank: w.rank,
          address: w.address,
          label: w.name || w.pseudonym || undefined,
          volume: w.volume,
          trades: w.trades,
          buys: w.buys,
          sells: w.sells,
        })),
        totalVolume: leaderboard.reduce((sum, w) => sum + w.volume, 0),
        totalTrades: leaderboard.reduce((sum, w) => sum + w.trades, 0),
      }),
    ]);
    
    const scan = scanResult.rows[0];
    console.log(`[scan:leaderboard] Scan recorded (ID: ${scan.id})`);
    
    // Update wallet profiles with basic info from leaderboard
    for (const entry of rankedLeaderboard) {
      await query(`
        INSERT INTO "WalletProfile" (id, address, label, "sourceRank", status, "categoryStrengthsJson", "averageTradeSize", "tradeCount30d", "resolvedTradeCount30d", "winRate30d", "averageLiquidity", "averageSpread", "averageEntryTiming", "updatedAt")
        VALUES (gen_random_uuid()::text, $1, $2, $3, 'IGNORE', '{}', 0, 0, 0, 0, 0, 0, 0, NOW())
        ON CONFLICT (address) DO UPDATE SET
          label = EXCLUDED.label,
          "sourceRank" = EXCLUDED."sourceRank",
          "updatedAt" = NOW()
      `, [
        entry.address,
        entry.name || entry.pseudonym || null,
        entry.rank,
      ]);
    }
    
    console.log('[scan:leaderboard] Wallet profiles upserted');
    
    return {
      success: true,
      scanId: scan.id,
      walletCount: leaderboard.length,
    };
  } catch (error) {
    console.error('[scan:leaderboard] Error:', error);
    throw error;
  }
}

async function main() {
  try {
    await scanLeaderboard();
    console.log('[scan:leaderboard] Completed');
    process.exit(0);
  } catch (error) {
    console.error('[scan:leaderboard] Failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { scanLeaderboard };