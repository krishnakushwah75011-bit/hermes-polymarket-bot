// app/api/health/route.ts
// Health check endpoint for cron watchdog

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    
    // Check if tables exist (gracefully handle missing tables)
    let activeRules = null;
    try {
      activeRules = await prisma.ruleSet.findFirst({ where: { active: true } });
    } catch (e) {
      // Tables might not exist yet during initial deploy
      console.warn('RuleSet table not accessible:', e);
    }
    
    let recentScan = null;
    try {
      recentScan = await prisma.leaderboardScan.findFirst({
        orderBy: { scannedAt: 'desc' },
      });
    } catch (e) {
      console.warn('LeaderboardScan table not accessible:', e);
    }
    
    let recentPaperTrade = null;
    try {
      recentPaperTrade = await prisma.paperTrade.findFirst({
        orderBy: { openedAt: 'desc' },
      });
    } catch (e) {
      console.warn('PaperTrade table not accessible:', e);
    }
    
    return Response.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      tablesReady: !!activeRules,
      activeRuleVersion: activeRules?.version || 0,
      lastLeaderboardScan: recentScan?.scannedAt || null,
      lastPaperTrade: recentPaperTrade?.openedAt || null,
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return Response.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 200 }); // Return 200 to not fail static generation
  }
}