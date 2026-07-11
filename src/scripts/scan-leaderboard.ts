// src/scripts/scan-leaderboard.ts
// Leaderboard scanner - fetches top 500 wallets from Polymarket

import { getLeaderboard } from '@/lib/api/polymarket-client';
import { prisma } from '@/lib/db/client';

async function scanLeaderboard() {
  console.log('[scan:leaderboard] Starting leaderboard scan...');
  
  const lookbackDays = parseInt(process.env.SCAN_LOOKBACK_DAYS || '30', 10);
  const maxWallets = parseInt(process.env.MAX_WALLETS_TO_SCAN || '500', 10);
  
  try {
    // Fetch leaderboard
    const leaderboard = await getLeaderboard(maxWallets, `${lookbackDays}d`);
    console.log(`[scan:leaderboard] Fetched ${leaderboard.length} wallets from leaderboard`);
    
    // Store scan metadata
    const scan = await prisma.leaderboardScan.create({
      data: {
        source: 'polymarket',
        walletCount: leaderboard.length,
        lookbackDays,
        rawSummaryJson: JSON.stringify({
          top10: leaderboard.slice(0, 10).map(w => ({
            rank: w.rank,
            address: w.address,
            label: w.label,
            roi: w.roi,
            volume: w.volume,
            trades: w.trades,
            winRate: w.winRate,
          })),
          totalVolume: leaderboard.reduce((sum, w) => sum + w.volume, 0),
          avgRoi: leaderboard.reduce((sum, w) => sum + w.roi, 0) / leaderboard.length,
        }),
      },
    });
    
    console.log(`[scan:leaderboard] Scan recorded (ID: ${scan.id})`);
    
    // Update wallet profiles with basic info from leaderboard
    for (const entry of leaderboard) {
      await prisma.walletProfile.upsert({
        where: { address: entry.address.toLowerCase() },
        update: {
          label: entry.label || undefined,
          sourceRank: entry.rank,
          updatedAt: new Date(),
        },
        create: {
          address: entry.address.toLowerCase(),
          label: entry.label,
          sourceRank: entry.rank,
          status: 'IGNORE', // Will be updated by wallet scanner
        },
      });
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

if (require.main === module) {
  scanLeaderboard()
    .then(result => {
      console.log('[scan:leaderboard] Completed:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('[scan:leaderboard] Failed:', error);
      process.exit(1);
    });
}

export { scanLeaderboard };