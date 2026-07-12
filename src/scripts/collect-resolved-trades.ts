// src/scripts/collect-resolved-trades.ts
// Updates market metadata with resolved outcomes from CLOB API
// (Data API doesn't support historical filtering by conditionId)

import { query, initializeDatabase } from '../lib/db/pool';

const CLOB_API = 'https://clob.polymarket.com';

interface MarketToken {
  token_id: string;
  outcome: string;
  price: string;
  winner: boolean;
}

interface ClobMarket {
  condition_id: string;
  question: string;
  tokens: MarketToken[];
  end_date_iso: string;
  closed: boolean;
}

async function collectResolvedMarkets() {
  console.log('[collect:resolved] Starting resolved market metadata update...');
  
  await initializeDatabase();

  // Fetch all resolved markets from CLOB API
  console.log('[collect:resolved] Fetching resolved markets from CLOB API...');
  const resolvedMarkets = await fetchAllResolvedMarkets();
  console.log(`[collect:resolved] Found ${resolvedMarkets.length} resolved markets with winners`);

  if (resolvedMarkets.length === 0) {
    console.log('[collect:resolved] No resolved markets found');
    return { success: true, markets: 0 };
  }

  // Update market metadata with winners
  let updated = 0;
  for (const market of resolvedMarkets) {
    const winnerToken = market.tokens.find(t => t.winner === true);
    const winnerOutcome = winnerToken ? winnerToken.outcome : null;
    
    try {
      await query(`
        INSERT INTO "MarketMetadata" (
          id, "conditionId", question, category, "endDate", "resolvedOutcome",
          active, closed, volume, liquidity, spread, outcomes, "outcomePrices", "clobTokenIds"
        ) VALUES (
          gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
        )
        ON CONFLICT ("conditionId") DO UPDATE SET
          "resolvedOutcome" = EXCLUDED."resolvedOutcome",
          "endDate" = EXCLUDED."endDate",
          closed = EXCLUDED.closed
      `, [
        market.condition_id,
        market.question,
        'Sports', // Category - could be enhanced
        new Date(market.end_date_iso),
        winnerOutcome,
        true,
        true,
        0,
        0,
        null,
        '[]',
        '[]',
        '[]',
      ]);
      updated++;
      
      if (updated % 50 === 0) {
        console.log(`[collect:resolved] Updated ${updated} markets...`);
      }
    } catch (e: any) {
      console.error(`[collect:resolved] Error updating market ${market.condition_id}:`, e.message);
    }
  }
  
  console.log(`[collect:resolved] Completed: ${updated} resolved markets updated with winners`);
  return { success: true, markets: updated };
}

async function fetchAllResolvedMarkets(): Promise<ClobMarket[]> {
  const allMarkets: ClobMarket[] = [];
  let nextCursor: string | null = null;
  
  // Get first page (500 markets max)
  const url = `${CLOB_API}/markets?limit=500&closed=true`;
  const response = await fetch(url, { headers: { 'User-Agent': 'Hermes-Polymarket-Bot/1.0' } });
  
  if (!response.ok) {
    throw new Error(`CLOB API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  const markets = data.data || [];
  
  // Filter to markets that have clear winners
  const resolved = markets.filter((m: ClobMarket) => 
    m.tokens.some((t: MarketToken) => t.winner === true)
  );
  
  allMarkets.push(...resolved);
  
  // Note: Could paginate with data.next_cursor if needed
  return allMarkets;
}

async function main() {
  try {
    await collectResolvedMarkets();
    process.exit(0);
  } catch (error) {
    console.error('[collect:resolved] Failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { collectResolvedMarkets };