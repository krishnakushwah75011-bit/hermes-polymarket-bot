// app/api/health/route.ts
// Health check - pg version (no Prisma)

import { query } from '@/lib/db/pool';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Check database connection
    await query('SELECT 1');
    
    // Check active rules
    let activeRules = null;
    try {
      const result = await query('SELECT * FROM "RuleSet" WHERE active = true LIMIT 1');
      activeRules = result.rows[0] || null;
    } catch (e) {
      console.warn('RuleSet not accessible yet');
    }
    
    // Check recent scans
    let recentScan = null;
    try {
      const result = await query('SELECT * FROM "LeaderboardScan" ORDER BY "scannedAt" DESC LIMIT 1');
      recentScan = result.rows[0] || null;
    } catch (e) {
      console.warn('LeaderboardScan not accessible yet');
    }
    
    // Check paper trades
    let recentPaperTrade = null;
    try {
      const result = await query('SELECT * FROM "PaperTrade" ORDER BY "openedAt" DESC LIMIT 1');
      recentPaperTrade = result.rows[0] || null;
    } catch (e) {
      console.warn('PaperTrade not accessible yet');
    }
    
    // Count wallets by status
    let walletStats = { track: 0, watch: 0, ignore: 0 };
    try {
      const result = await query('SELECT status, COUNT(*) as count FROM "WalletProfile" GROUP BY status');
      result.rows.forEach(row => {
        walletStats[row.status.toLowerCase() as keyof typeof walletStats] = parseInt(row.count);
      });
    } catch (e) {
      console.warn('WalletProfile not accessible yet');
    }
    
    return Response.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      tablesReady: !!activeRules,
      activeRuleVersion: activeRules?.version || 0,
      lastLeaderboardScan: recentScan?.scannedAt || null,
      lastPaperTrade: recentPaperTrade?.openedAt || null,
      walletsTracked: walletStats.track,
      walletsWatch: walletStats.watch,
      walletsIgnore: walletStats.ignore,
    });
  } catch (error: any) {
    console.error('Health check failed:', error.message);
    
    return Response.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
    }, { status: 503 });
  }
}