// src/scripts/scan-wallets-v2.ts
// Wallet scanner - fetches 30-day trade history from historical database and scores them (using pg pool)

import { scoreWalletV2 } from '../lib/scoring/wallet-scorer-v2';
import { query } from '../lib/db/pool';
import { WalletRawData } from '../lib/types';

async function scanWalletsV2() {
  console.log('[scan:wallets:v2] Starting wallet scan with historical data...');
  
  const lookbackDays = parseInt(process.env.SCAN_LOOKBACK_DAYS || '30', 10);
  const cutoffDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
  
  // Get all wallets that have historical trades in lookback period
  const walletsWithTradesResult = await query(`
    SELECT "proxyWallet", COUNT(*) as trade_count
    FROM "HistoricalTrade" 
    WHERE timestamp >= $1
    GROUP BY "proxyWallet"
    ORDER BY trade_count DESC
  `, [cutoffDate]);
  
  const walletsWithTrades = walletsWithTradesResult.rows;
  console.log(`[scan:wallets:v2] Found ${walletsWithTrades.length} wallets with trades in last ${lookbackDays} days`);
  
  // Also include wallets from leaderboard scans
  const leaderboardWalletsResult = await query(`
    SELECT address FROM "WalletProfile" 
    WHERE status IN ('TRACK', 'WATCH', 'IGNORE')
  `);
  
  const leaderboardWallets = leaderboardWalletsResult.rows;
  
  const allWalletAddresses = [
    ...walletsWithTrades.map(w => w.proxyWallet),
    ...leaderboardWallets.map(w => w.address.toLowerCase()),
  ];
  
  // Deduplicate
  const uniqueAddresses = [...new Set(allWalletAddresses)];
  console.log(`[scan:wallets:v2] Total unique wallets to scan: ${uniqueAddresses.length}`);
  
  // Get existing wallet profiles for label/rank info
  const existingProfilesResult = await query(`
    SELECT * FROM "WalletProfile" WHERE address = ANY($1)
  `, [uniqueAddresses]);
  
  const existingProfiles = existingProfilesResult.rows;
  const profileMap = new Map(existingProfiles.map(p => [p.address.toLowerCase(), p]));
  
  let scanned = 0;
  let scored = 0;
  let errors = 0;
  
  for (const address of uniqueAddresses) {
    try {
      console.log(`[scan:wallets:v2] Scanning ${address}...`);
      
      // Fetch all historical trades for this wallet in lookback period
      const tradesResult = await query(`
        SELECT * FROM "HistoricalTrade" 
        WHERE "proxyWallet" = $1 AND timestamp >= $2
        ORDER BY timestamp DESC
      `, [address, cutoffDate]);
      
      const trades = tradesResult.rows;
      console.log(`[scan:wallets:v2]   Found ${trades.length} historical trades`);
      
      if (trades.length === 0) {
        // Update lastScannedAt even if no trades
        await query(`
          INSERT INTO "WalletProfile" (address, status, "categoryStrengthsJson", "averageTradeSize", "tradeCount30d", "resolvedTradeCount30d", "winRate30d", "averageLiquidity", "averageSpread", "averageEntryTiming", "lastScannedAt")
          VALUES ($1, 'IGNORE', '{}', 0, 0, 0, 0, 0, 0, 0, NOW())
          ON CONFLICT (address) DO UPDATE SET "lastScannedAt" = NOW()
        `, [address]);
        scanned++;
        continue;
      }
      
      // Convert to ParsedWalletTrade format
      const parsedTrades = trades.map(t => ({
        id: t.transactionHash,
        wallet: t.proxyWallet,
        marketId: t.conditionId,
        conditionId: t.conditionId,
        marketQuestion: t.marketQuestion || t.title,
        outcome: t.outcome,
        side: t.side as 'BUY' | 'SELL',
        size: t.size,
        price: t.price,
        walletEntryPrice: t.price,
        timestamp: new Date(t.timestamp),
        transactionHash: t.transactionHash,
        slug: t.slug,
      }));
      
      // Build raw data for scoring
      const profile = profileMap.get(address.toLowerCase());
      const rawData: WalletRawData = {
        address,
        label: profile?.label,
        sourceRank: profile?.sourceRank,
        trades: parsedTrades,
        markets: new Map(), // Will be populated by scorer from DB
      };
      
      // Score the wallet
      const score = await scoreWalletV2(rawData);
      
      // Update wallet profile
      await query(`
        INSERT INTO "WalletProfile" (
          id, address, label, "sourceRank", status, "roi30d", "consistencyScore",
          "copyabilityScore", "oneHitWonderPenalty", "globalScore", "bestCategory",
          "categoryStrengthsJson", "averageTradeSize", "tradeCount30d",
          "resolvedTradeCount30d", "winRate30d", "averageLiquidity", "averageSpread",
          "averageEntryTiming", "copyabilityNotes", "riskNotes", "statusReason", "lastScannedAt", "updatedAt"
        ) VALUES (
          gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, NOW()
        )
        ON CONFLICT (address) DO UPDATE SET
          label = EXCLUDED.label,
          status = EXCLUDED.status,
          "roi30d" = EXCLUDED."roi30d",
          "consistencyScore" = EXCLUDED."consistencyScore",
          "copyabilityScore" = EXCLUDED."copyabilityScore",
          "oneHitWonderPenalty" = EXCLUDED."oneHitWonderPenalty",
          "globalScore" = EXCLUDED."globalScore",
          "bestCategory" = EXCLUDED."bestCategory",
          "categoryStrengthsJson" = EXCLUDED."categoryStrengthsJson",
          "averageTradeSize" = EXCLUDED."averageTradeSize",
          "tradeCount30d" = EXCLUDED."tradeCount30d",
          "resolvedTradeCount30d" = EXCLUDED."resolvedTradeCount30d",
          "winRate30d" = EXCLUDED."winRate30d",
          "averageLiquidity" = EXCLUDED."averageLiquidity",
          "averageSpread" = EXCLUDED."averageSpread",
          "averageEntryTiming" = EXCLUDED."averageEntryTiming",
          "copyabilityNotes" = EXCLUDED."copyabilityNotes",
          "riskNotes" = EXCLUDED."riskNotes",
          "statusReason" = EXCLUDED."statusReason",
          "lastScannedAt" = EXCLUDED."lastScannedAt",
          "updatedAt" = NOW()
      `, [
        address,
        score.label,
        score.sourceRank,
        score.status,
        score.roi30d,
        score.consistencyScore,
        score.copyabilityScore,
        score.oneHitWonderPenalty,
        score.globalScore,
        score.bestCategory || null,
        JSON.stringify(score.categoryStrengths),
        score.averageTradeSize,
        score.tradeCount30d,
        score.resolvedTradeCount30d,
        score.winRate30d,
        score.averageLiquidity,
        score.averageSpread,
        score.averageEntryTiming,
        score.copyabilityNotes,
        score.riskNotes,
        score.statusReason,
        new Date(),
      ]);
      
      scanned++;
      scored++;
      console.log(`[scan:wallets:v2]   ${address}: ${score.status} (global: ${score.globalScore.toFixed(3)}, roi: ${(score.roi30d*100).toFixed(1)}%, resolved: ${score.resolvedTradeCount30d}/${score.tradeCount30d})`);
      
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 50));
      
    } catch (error) {
      console.error(`[scan:wallets:v2] Error scanning ${address}:`, error);
      errors++;
    }
  }
  
  console.log(`[scan:wallets:v2] Completed: ${scanned} scanned, ${scored} scored, ${errors} errors`);
  return { success: true, scanned, scored, errors };
}

async function main() {
  try {
    await scanWalletsV2();
    process.exit(0);
  } catch (error) {
    console.error('[scan:wallets:v2] Failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { scanWalletsV2 };