// src/scripts/collect-trades.ts
// Continuous trade collector - fetches and stores all trades + market metadata (using pg pool)

import { query, queryDirect, transaction, initializeDatabase } from '../lib/db/pool';
import { getRecentTrades, getActiveMarkets, collectMarketSnapshot } from '../lib/api/polymarket-client';

async function collectTrades() {
  console.log('[collect:trades] Starting trade collection...');
  
  // Get last sync state
  const stateResult = await query(`
    SELECT * FROM "DataCollectionState" WHERE "collectionType" = 'trades'
  `);
  
  let state = stateResult.rows[0];
  if (!state) {
    const insertResult = await query(`
      INSERT INTO "DataCollectionState" ("id", "collectionType", "lastRunAt", "totalCollected", "status", "updatedAt")
      VALUES (gen_random_uuid()::text, 'trades', NOW(), 0, 'running', NOW())
      RETURNING *
    `);
    state = insertResult.rows[0];
  } else {
    await query(`
      UPDATE "DataCollectionState" SET status = 'running', "lastRunAt" = NOW(), "updatedAt" = NOW() WHERE "collectionType" = 'trades'
    `);
  }
  
  try {
    // Fetch trades in batches
    let totalCollected = 0;
    let hasMore = true;
    let batch = 0;
    const maxBatches = 50;
    let lastTimestamp: Date | undefined;
    
    while (hasMore && batch < maxBatches) {
      batch++;
      console.log(`[collect:trades] Batch ${batch}...`);
      
      const trades = await getRecentTrades(500);
      
      if (trades.length === 0) {
        console.log('[collect:trades] No more trades returned');
        break;
      }
      
      // Store trades (upsert to handle duplicates)
      let batchStored = 0;
      for (const trade of trades) {
        const timestamp = new Date(parseInt(trade.timestamp) * 1000);
        
        if (!trade.transactionHash) continue;
        
        try {
          const result = await query(`
            INSERT INTO "HistoricalTrade" (
              "transactionHash", "proxyWallet", side, asset, "conditionId", 
              size, price, timestamp, title, slug, icon, "eventSlug", 
              outcome, "outcomeIndex", name, pseudonym, bio, 
              "profileImage", "profileImageOptimized"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
            ON CONFLICT ("transactionHash") DO NOTHING
            RETURNING "transactionHash"
          `, [
            trade.transactionHash,
            trade.proxyWallet.toLowerCase(),
            trade.side,
            trade.asset,
            trade.conditionId,
            trade.size,
            trade.price,
            timestamp,
            trade.title,
            trade.slug,
            trade.icon || null,
            trade.eventSlug || null,
            trade.outcome,
            trade.outcomeIndex,
            trade.name || null,
            trade.pseudonym || null,
            trade.bio || null,
            trade.profileImage || null,
            trade.profileImageOptimized || null,
          ]);
          
          if (result.rows.length > 0) batchStored++;
          
          // Track latest timestamp
          if (!lastTimestamp || timestamp > lastTimestamp) {
            lastTimestamp = timestamp;
          }
        } catch (e) {
          // Ignore duplicate key errors
          if (!(e as any).code === '23505') {
            console.error(`[collect:trades] Error storing trade:`, e);
          }
        }
      }
      
      totalCollected += batchStored;
      console.log(`[collect:trades] Batch ${batch}: stored ${batchStored}/${trades.length} new trades`);
      
      // Since Data API doesn't support cursor pagination, we just collect latest
      hasMore = false;
    }
    
    // Update state
    await query(`
      UPDATE "DataCollectionState" 
      SET status = 'idle', "totalCollected" = "totalCollected" + $1, "lastTimestamp" = $2
      WHERE "collectionType" = 'trades'
    `, [totalCollected, lastTimestamp || new Date()]);
    
    console.log(`[collect:trades] Completed: ${totalCollected} new trades stored`);
    return { success: true, collected: totalCollected };
    
  } catch (error) {
    console.error('[collect:trades] Error:', error);
    await query(`
      UPDATE "DataCollectionState" SET status = 'error', "errorMessage" = $1 WHERE "collectionType" = 'trades'
    `, [String(error)]);
    throw error;
  }
}

// Collect market metadata
async function collectMarkets() {
  console.log('[collect:markets] Starting market collection...');
  
  const stateResult = await query(`
    SELECT * FROM "DataCollectionState" WHERE "collectionType" = 'markets'
  `);
  
  let state = stateResult.rows[0];
  if (!state) {
    await query(`
      INSERT INTO "DataCollectionState" ("id", "collectionType", "lastRunAt", "totalCollected", "status", "updatedAt")
      VALUES (gen_random_uuid()::text, 'markets', NOW(), 0, 'running', NOW())
    `);
  } else {
    await query(`
      UPDATE "DataCollectionState" SET status = 'running', "lastRunAt" = NOW(), "updatedAt" = NOW() WHERE "collectionType" = 'markets'
    `);
  }
  
  try {
    const markets = await getActiveMarkets(500);
    console.log(`[collect:markets] Fetched ${markets.length} active markets`);
    
    let stored = 0;
    for (const market of markets) {
      try {
        await query(`
          INSERT INTO "MarketMetadata" (
            id, "conditionId", question, slug, category, "endDate", "resolvedOutcome",
            active, closed, volume, liquidity, spread, outcomes, "outcomePrices", "clobTokenIds"
          ) VALUES (
            gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
          )
          ON CONFLICT ("conditionId") DO UPDATE SET
            category = EXCLUDED.category,
            "endDate" = EXCLUDED."endDate",
            "resolvedOutcome" = EXCLUDED."resolvedOutcome",
            active = EXCLUDED.active,
            closed = EXCLUDED.closed,
            volume = EXCLUDED.volume,
            liquidity = EXCLUDED.liquidity,
            spread = EXCLUDED.spread,
            outcomes = EXCLUDED.outcomes,
            "outcomePrices" = EXCLUDED."outcomePrices",
            "clobTokenIds" = EXCLUDED."clobTokenIds"
        `, [
          market.conditionId,
          market.question,
          market.slug,
          market.category || null,
          market.endDate ? new Date(market.endDate) : null,
          market.resolvedOutcome || null,
          market.active,
          market.closed,
          market.volume,
          market.liquidity,
          market.spread || null,
          JSON.stringify(market.outcomes),
          JSON.stringify(market.outcomePrices),
          JSON.stringify(market.clobTokenIds),
        ]);
        stored++;
      } catch (e) {
        console.error(`[collect:markets] Error storing market ${market.conditionId}:`, e);
      }
    }
    
    // Also collect snapshots for active markets
    const snapshots = await collectSnapshots(markets);
    console.log(`[collect:markets] Collected ${snapshots.length} market snapshots`);
    
    await query(`
      UPDATE "DataCollectionState" 
      SET status = 'idle', "totalCollected" = "totalCollected" + $1, "lastTimestamp" = NOW()
      WHERE "collectionType" = 'markets'
    `, [stored]);
    
    console.log(`[collect:markets] Completed: ${stored} markets, ${snapshots.length} snapshots`);
    return { success: true, markets: stored, snapshots: snapshots.length };
    
  } catch (error) {
    console.error('[collect:markets] Error:', error);
    await query(`
      UPDATE "DataCollectionState" SET status = 'error', "errorMessage" = $1 WHERE "collectionType" = 'markets'
    `, [String(error)]);
    throw error;
  }
}

async function collectSnapshots(markets: any[]): Promise<any[]> {
  const results = await Promise.allSettled(
    markets.map(m => collectMarketSnapshot(m))
  );
  
  const snapshots: any[] = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled' && result.value) {
      const snap = result.value;
      try {
        await query(`
          INSERT INTO "MarketSnapshot" (
            "marketId", "conditionId", question, category, "yesPrice", "noPrice", 
            "bestBid", "bestAsk", spread, liquidity, volume, "timeToResolution", "rawMarketJson"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `, [
          snap.marketId,
          snap.conditionId,
          snap.question,
          snap.category,
          snap.yesPrice,
          snap.noPrice,
          snap.bestBid,
          snap.bestAsk,
          snap.spread,
          snap.liquidity,
          snap.volume,
          snap.timeToResolution,
          JSON.stringify(snap),
        ]);
        snapshots.push(snap);
      } catch (e) {
        console.error(`[collect:markets] Error storing snapshot for ${markets[i].conditionId}:`, e);
      }
    }
  }
  return snapshots;
}

// Main entry point
async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || 'both';
  
  try {
    if (mode === 'trades' || mode === 'both') {
      await collectTrades();
    }
    if (mode === 'markets' || mode === 'both') {
      await collectMarkets();
    }
    console.log('[collect] All collections completed');
    process.exit(0);
  } catch (error) {
    console.error('[collect] Failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { collectTrades, collectMarkets };