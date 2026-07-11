// lib/api/polymarket-client.ts
// Polymarket API client with rate limiting, error handling, and fallback chains

import {
  PolymarketEvent,
  PolymarketMarket,
  ParsedMarket,
  LeaderboardEntry,
  LeaderboardResponse,
  WalletTrade,
  WalletTradesResponse,
  ClobPriceResponse,
  ClobMidpointResponse,
  ClobSpreadResponse,
  ClobOrderbookResponse,
  ClobPriceHistoryResponse,
  ClobMarketsResponse,
  DataApiTrade,
  DataApiTradesResponse,
  ParsedWalletTrade,
  MarketSnapshot,
} from '@/lib/types';

const GAMMA_API = process.env.POLYMARKET_GAMMA_API || 'https://gamma-api.polymarket.com';
const CLOB_API = process.env.POLYMARKET_CLOB_API || 'https://clob.polymarket.com';
const DATA_API = process.env.POLYMARKET_DATA_API || 'https://data-api.polymarket.com';
const BULLPEN_API = process.env.BULLPEN_API || 'https://api.bullpen.fi';

// Rate limiters per API
const rateLimiters = {
  gamma: { lastCall: 0, minInterval: 1000 },      // ~60/min
  clob: { lastCall: 0, minInterval: 50 },         // ~1200/min
  data: { lastCall: 0, minInterval: 600 },        // ~100/min
  bullpen: { lastCall: 0, minInterval: 1000 },
};

async function rateLimit(api: keyof typeof rateLimiters) {
  const limiter = rateLimiters[api];
  const now = Date.now();
  const elapsed = now - limiter.lastCall;
  if (elapsed < limiter.minInterval) {
    await new Promise(resolve => setTimeout(resolve, limiter.minInterval - elapsed));
  }
  limiter.lastCall = Date.now();
}

async function fetchJson<T>(url: string, api: keyof typeof rateLimiters): Promise<T> {
  await rateLimit(api);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Hermes-Polymarket-Bot/1.0',
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`${api.toUpperCase()} API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`${api.toUpperCase()} API timeout`);
    }
    throw error;
  }
}

// Parse double-encoded JSON fields
function parseJsonField<T>(val: string | T): T {
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return val as T;
    }
  }
  return val;
}

// Parse market from Gamma API
export function parseMarket(market: PolymarketMarket): ParsedMarket {
  const outcomes = parseJsonField<string[]>(market.outcomes);
  const outcomePrices = parseJsonField<string[]>(market.outcomePrices).map(p => parseFloat(p));
  const clobTokenIds = parseJsonField<string[]>(market.clobTokenIds);
  
  return {
    id: market.id,
    question: market.question,
    conditionId: market.conditionId,
    slug: market.slug,
    description: market.description,
    outcomes,
    outcomePrices,
    clobTokenIds,
    volume: market.volume,
    liquidity: market.liquidity,
    active: market.active,
    closed: market.closed,
    marketType: market.marketType,
    endDate: market.endDate,
    category: market.category,
    createdAt: market.createdAt,
    resolvedOutcome: market.resolvedOutcome,
    status: market.status,
  };
}

// ==================== GAMMA API ====================

export async function getLeaderboard(limit = 500, period = '30d'): Promise<LeaderboardEntry[]> {
  // Try Polymarket leaderboard
  try {
    const data = await fetchJson<LeaderboardResponse>(
      `${GAMMA_API}/leaderboard?limit=${limit}&period=${period}`,
      'gamma'
    );
    return data.leaderboard || [];
  } catch (error) {
    console.warn('Polymarket leaderboard failed, trying Bullpen:', error);
  }
  
  // Fallback to Bullpen
  try {
    const data = await fetchJson<LeaderboardResponse>(
      `${BULLPEN_API}/leaderboard?limit=${limit}&period=${period}`,
      'bullpen'
    );
    return data.leaderboard || [];
  } catch (error) {
    console.error('Both leaderboard endpoints failed:', error);
    throw new Error('Failed to fetch leaderboard from all sources');
  }
}

export async function getActiveMarkets(limit = 500, category?: string): Promise<ParsedMarket[]> {
  const params = new URLSearchParams({
    active: 'true',
    closed: 'false',
    limit: limit.toString(),
    order: 'volume',
    ascending: 'false',
  });
  if (category) params.set('category', category);
  
  const data = await fetchJson<{ markets: PolymarketMarket[] }>(
    `${GAMMA_API}/markets?${params}`,
    'gamma'
  );
  
  return (data.markets || []).map(parseMarket);
}

export async function getMarketBySlug(slug: string): Promise<ParsedMarket | null> {
  const data = await fetchJson<PolymarketMarket[]>(
    `${GAMMA_API}/markets?slug=${encodeURIComponent(slug)}`,
    'gamma'
  );
  
  if (!data.length) return null;
  return parseMarket(data[0]);
}

export async function getEventBySlug(slug: string): Promise<PolymarketEvent | null> {
  const data = await fetchJson<PolymarketEvent[]>(
    `${GAMMA_API}/events?slug=${encodeURIComponent(slug)}`,
    'gamma'
  );
  
  return data[0] || null;
}

export async function getWalletTrades(address: string, limit = 200, cursor?: string): Promise<WalletTrade[]> {
  const params = new URLSearchParams({
    address,
    limit: limit.toString(),
  });
  if (cursor) params.set('cursor', cursor);
  
  const data = await fetchJson<WalletTradesResponse>(
    `${GAMMA_API}/trades?${params}`,
    'gamma'
  );
  
  return data.trades || [];
}

export async function getAllWalletTrades(address: string, lookbackDays = 30): Promise<ParsedWalletTrade[]> {
  const allTrades: ParsedWalletTrade[] = [];
  let cursor: string | undefined;
  const cutoffDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
  
  do {
    const trades = await getWalletTrades(address, 200, cursor);
    
    for (const trade of trades) {
      const tradeDate = new Date(trade.timestamp);
      if (tradeDate < cutoffDate) {
        return allTrades;
      }
      
      allTrades.push({
        id: trade.id,
        wallet: trade.wallet,
        marketId: trade.market,
        conditionId: trade.conditionId,
        marketQuestion: trade.title || '',
        outcome: trade.outcome,
        side: trade.side,
        size: trade.size,
        price: trade.price,
        timestamp: tradeDate,
        transactionHash: trade.transactionHash,
        slug: trade.slug,
      });
    }
    
    cursor = data.nextCursor;
  } while (cursor && allTrades.length < 1000); // Safety cap
  
  return allTrades;
}

// ==================== CLOB API ====================

export async function getClobPrice(tokenId: string, side: 'buy' | 'sell' = 'buy'): Promise<number> {
  const data = await fetchJson<ClobPriceResponse>(
    `${CLOB_API}/price?token_id=${tokenId}&side=${side}`,
    'clob'
  );
  return parseFloat(data.price);
}

export async function getClobMidpoint(tokenId: string): Promise<number> {
  const data = await fetchJson<ClobMidpointResponse>(
    `${CLOB_API}/midpoint?token_id=${tokenId}`,
    'clob'
  );
  return parseFloat(data.mid);
}

export async function getClobSpread(tokenId: string): Promise<number> {
  const data = await fetchJson<ClobSpreadResponse>(
    `${CLOB_API}/spread?token_id=${tokenId}`,
    'clob'
  );
  return parseFloat(data.spread);
}

export async function getClobOrderbook(tokenId: string): Promise<ClobOrderbookResponse> {
  return fetchJson<ClobOrderbookResponse>(
    `${CLOB_API}/book?token_id=${tokenId}`,
    'clob'
  );
}

export async function getClobPriceHistory(
  conditionId: string,
  interval: '1d' | '1w' | '1m' | '3m' | '6m' | '1y' | 'all' = 'all',
  fidelity = 50
): Promise<ClobPricePoint[]> {
  const data = await fetchJson<ClobPriceHistoryResponse>(
    `${CLOB_API}/prices-history?market=${conditionId}&interval=${interval}&fidelity=${fidelity}`,
    'clob'
  );
  return data.history || [];
}

export async function getClobMarkets(limit = 100): Promise<ClobMarket[]> {
  const data = await fetchJson<ClobMarketsResponse>(
    `${CLOB_API}/markets?limit=${limit}`,
    'clob'
  );
  return data.data || [];
}

// ==================== DATA API ====================

export async function getRecentTrades(limit = 10, market?: string): Promise<DataApiTrade[]> {
  const params = new URLSearchParams({ limit: limit.toString() });
  if (market) params.set('market', market);
  
  const data = await fetchJson<DataApiTradesResponse>(
    `${DATA_API}/trades?${params}`,
    'data'
  );
  return data.trades || [];
}

export async function getOpenInterest(conditionId: string): Promise<number> {
  const data = await fetchJson<{ openInterest: number }>(
    `${DATA_API}/oi?market=${conditionId}`,
    'data'
  );
  return data.openInterest;
}

// ==================== MARKET SNAPSHOTS ====================

export async function collectMarketSnapshot(market: ParsedMarket): Promise<MarketSnapshot | null> {
  try {
    // Get current prices from CLOB using token IDs
    const [yesPrice, noPrice, yesMid, noMid, yesSpread, noSpread, orderbook] = await Promise.allSettled([
      getClobPrice(market.clobTokenIds[0], 'buy'),
      getClobPrice(market.clobTokenIds[1], 'buy'),
      getClobMidpoint(market.clobTokenIds[0]),
      getClobMidpoint(market.clobTokenIds[1]),
      getClobSpread(market.clobTokenIds[0]),
      getClobSpread(market.clobTokenIds[1]),
      getClobOrderbook(market.clobTokenIds[0]),
    ]);
    
    const yesPriceVal = yesPrice.status === 'fulfilled' ? yesPrice.value : market.outcomePrices[0];
    const noPriceVal = noPrice.status === 'fulfilled' ? noPrice.value : market.outcomePrices[1];
    const yesMidVal = yesMid.status === 'fulfilled' ? yesMid.value : market.outcomePrices[0];
    const noMidVal = noMid.status === 'fulfilled' ? noMid.value : market.outcomePrices[1];
    const spreadVal = yesSpread.status === 'fulfilled' ? yesSpread.value : 
                      noSpread.status === 'fulfilled' ? noSpread.value : 
                      Math.abs(yesMidVal - noMidVal);
    
    // Calculate liquidity from orderbook
    let liquidity = 0;
    if (orderbook.status === 'fulfilled') {
      const bids = orderbook.value.bids.slice(0, 10);
      const asks = orderbook.value.asks.slice(0, 10);
      liquidity = bids.reduce((sum, b) => sum + parseFloat(b.price) * parseFloat(b.size), 0) +
                  asks.reduce((sum, a) => sum + parseFloat(a.price) * parseFloat(a.size), 0);
    }
    
    // Time to resolution
    let timeToResolution: number | undefined;
    if (market.endDate) {
      const end = new Date(market.endDate).getTime();
      timeToResolution = Math.max(0, (end - Date.now()) / (1000 * 60 * 60));
    }
    
    return {
      marketId: market.id,
      conditionId: market.conditionId,
      question: market.question,
      category: market.category,
      yesPrice: yesPriceVal,
      noPrice: noPriceVal,
      bestBid: yesMidVal, // Using midpoint as best bid approximation
      bestAsk: noMidVal,  // Using midpoint as best ask approximation
      spread: spreadVal,
      liquidity,
      volume: market.volume,
      timeToResolution,
      collectedAt: new Date(),
    };
  } catch (error) {
    console.error(`Failed to collect snapshot for market ${market.id}:`, error);
    return null;
  }
}

export async function collectSnapshotsForMarkets(markets: ParsedMarket[]): Promise<MarketSnapshot[]> {
  const snapshots = await Promise.allSettled(
    markets.map(m => collectMarketSnapshot(m))
  );
  
  return snapshots
    .filter((s): s is PromiseFulfilledResult<MarketSnapshot> => 
      s.status === 'fulfilled' && s.value !== null
    )
    .map(s => s.value);
}

// ==================== UTILITIES ====================

export function getTokenIdForOutcome(market: ParsedMarket, outcome: string): string | null {
  const idx = market.outcomes.findIndex(o => 
    o.toLowerCase() === outcome.toLowerCase()
  );
  if (idx >= 0 && idx < market.clobTokenIds.length) {
    return market.clobTokenIds[idx];
  }
  return null;
}

export function getPriceForOutcome(market: ParsedMarket, outcome: string): number | null {
  const idx = market.outcomes.findIndex(o => 
    o.toLowerCase() === outcome.toLowerCase()
  );
  if (idx >= 0 && idx < market.outcomePrices.length) {
    return market.outcomePrices[idx];
  }
  return null;
}