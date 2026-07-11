// app/api/health/route.ts
// Health check endpoint for cron watchdog

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Check database
    await prisma.$queryRaw`SELECT 1`;
    
    // Check active rule set
    const activeRules = await prisma.ruleSet.findFirst({ where: { active: true } });
    
    // Check recent activity
    const recentScan = await prisma.leaderboardScan.findFirst({
      orderBy: { scannedAt: 'desc' },
    });
    
    const recentPaperTrade = await prisma.paperTrade.findFirst({
      orderBy: { openedAt: 'desc' },
    });
    
    return Response.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
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
    }, { status: 500 });
  }
}