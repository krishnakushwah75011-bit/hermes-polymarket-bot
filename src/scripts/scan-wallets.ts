// src/scripts/scan-wallets.ts
// Wallet scanner - fetches 30-day trade history for tracked wallets and scores them

import { getAllWalletTrades, getActiveMarkets, collectMarketSnapshot } from '../lib/api/polymarket-client';
import { scoreWallet, WalletRawData } from '../lib/scoring/wallet-scorer';
import { prisma } from '../lib/db/client';
import { parseJsonField } from '../lib/api/polymarket-client';

async function scanWallets() {
  console.log('[scan:wallets] Starting wallet scan...');
  
  const lookbackDays = parseInt(process.env.SCAN_LOOKBACK_DAYS || '30', 10);
  
  // Get wallets to scan (all wallets from leaderboard scans)
  // For first run, scan all wallets; subsequent runs would filter by status
  const wallets = await prisma.walletProfile.findMany({
    orderBy: { sourceRank: 'asc' },
  });
  
  console.log(`[scan:wallets] Scanning ${wallets.length} wallets...`);
  
  // Fetch active markets for category/liquidity data
  const markets = await getActiveMarkets(500);
  const marketMap = new Map(markets.map(m => [m.conditionId, m]));
  
  // Build market data map
  const marketData = new Map<string, { 
    category?: string; 
    liquidity: number; 
    spread: number; 
    endDate?: string 
  }>();
  
  for (const market of markets) {
    marketData.set(market.conditionId, {
      category: market.category,
      liquidity: market.liquidity,
      spread: 0, // Will be updated from snapshots
      endDate: market.endDate,
    });
  }
  
  let scanned = 0;
  let scored = 0;
  let errors = 0;
  
  for (const wallet of wallets) {
    try {
      console.log(`[scan:wallets] Scanning ${wallet.address}...`);
      
      // Fetch wallet trades
      const trades = await getAllWalletTrades(wallet.address, lookbackDays);
      console.log(`[scan:wallets]   Found ${trades.length} trades`);
      
      // Build raw data for scoring
      const rawData: WalletRawData = {
        address: wallet.address,
        label: wallet.label || undefined,
        sourceRank: wallet.sourceRank || undefined,
        trades,
        markets: marketData,
      };
      
      // Score the wallet
      const score = scoreWallet(rawData);
      
      // Update wallet profile
      await prisma.walletProfile.update({
        where: { address: wallet.address },
        data: {
          label: score.label,
          status: score.status,
          roi30d: score.roi30d,
          consistencyScore: score.consistencyScore,
          copyabilityScore: score.copyabilityScore,
          oneHitWonderPenalty: score.oneHitWonderPenalty,
          globalScore: score.globalScore,
          bestCategory: score.bestCategory,
          categoryStrengthsJson: JSON.stringify(score.categoryStrengths),
          averageTradeSize: score.averageTradeSize,
          tradeCount30d: score.tradeCount30d,
          resolvedTradeCount30d: score.resolvedTradeCount30d,
          winRate30d: score.winRate30d,
          averageLiquidity: score.averageLiquidity,
          averageSpread: score.averageSpread,
          averageEntryTiming: score.averageEntryTiming,
          copyabilityNotes: score.copyabilityNotes,
          riskNotes: score.riskNotes,
          lastScannedAt: new Date(),
        },
      });
      
      scanned++;
      scored++;
      
      console.log(`[scan:wallets]   ${wallet.address}: ${score.status} (global: ${score.globalScore.toFixed(3)})`);
      
      // Rate limiting - small delay between wallets
      await new Promise(r => setTimeout(r, 100));
      
    } catch (error) {
      console.error(`[scan:wallets] Error scanning ${wallet.address}:`, error);
      errors++;
    }
  }
  
  console.log(`[scan:wallets] Completed: ${scanned} scanned, ${scored} scored, ${errors} errors`);
  
  return {
    success: true,
    scanned,
    scored,
    errors,
  };
}

if (require.main === module) {
  scanWallets()
    .then(result => {
      console.log('[scan:wallets] Completed:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('[scan:wallets] Failed:', error);
      process.exit(1);
    });
}

export { scanWallets };