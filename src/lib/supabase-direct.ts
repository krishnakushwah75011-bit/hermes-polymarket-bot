// lib/supabase-direct.ts
// Direct PostgreSQL connection for dashboard stats (bypasses Supabase auth)
// Uses node-pg with Airtel DNS workaround

import { Pool } from 'pg';

const pool = new Pool({
  host: 'db.iaxfwsjjmwvlqyqvzvfb.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'kamalkrishna@12345',
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export async function getDashboardStatsDirect() {
  const client = await pool.connect();
  try {
    // Run all queries in parallel
    const [
      openTrades,
      trackedWallets,
      totalTrades,
      paperCopyDecisions,
      recentTrades,
      openPositions,
      lastRun
    ] = await Promise.all([
      client.query(`SELECT COUNT(*) as count FROM "PaperTrade" WHERE status = 'OPEN'`),
      client.query(`SELECT COUNT(*) as count FROM "WalletProfile" WHERE status = 'TRACK'`),
      client.query(`SELECT COUNT(*) as count FROM "ObservedTrade"`),
      client.query(`SELECT COUNT(*) as count FROM "DecisionJournal" WHERE decision = 'PAPER_COPY'`),
      client.query(`SELECT COUNT(*) as count FROM "ObservedTrade" WHERE "createdAt" > NOW() - INTERVAL '30 minutes'`),
      client.query(`SELECT id, "marketId", side, "simulatedPositionSize", "entryPrice", "openedAt" FROM "PaperTrade" WHERE status = 'OPEN' ORDER BY "openedAt" DESC LIMIT 10`),
      client.query(`SELECT "lastRunAt" FROM "DataCollectionState" WHERE "collectionType" = 'trades' LIMIT 1`),
    ]);

    return {
      status: (parseInt(recentTrades.rows[0].count) > 0) ? 'healthy' : 'starting',
      open_trades: parseInt(openTrades.rows[0].count),
      tracked_wallets: parseInt(trackedWallets.rows[0].count),
      total_trades: parseInt(totalTrades.rows[0].count),
      paper_copy_decisions: parseInt(paperCopyDecisions.rows[0].count),
      trades_last_30min: parseInt(recentTrades.rows[0].count),
      last_run: lastRun.rows[0]?.lastRunAt || null,
      open_positions: openPositions.rows.map(r => ({
        id: r.id,
        market_id: r.marketId,
        side: r.side,
        simulated_position_size: r.simulatedPositionSize,
        entry_price: r.entryPrice,
        opened_at: r.openedAt
      })),
      timestamp: new Date().toISOString()
    };
  } catch (error: any) {
    console.error('Direct DB stats error:', error.message);
    return {
      status: 'error',
      error: error.message,
      open_trades: 0,
      tracked_wallets: 0,
      total_trades: 0,
      paper_copy_decisions: 0,
      trades_last_30min: 0,
      last_run: null,
      open_positions: [],
      timestamp: new Date().toISOString()
    };
  } finally {
    client.release();
  }
}