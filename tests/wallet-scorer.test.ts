// tests/wallet-scorer.test.ts
// Unit tests for wallet scoring

import { describe, it, expect } from 'vitest';
import { scoreWallet, emptyScore } from '@/lib/scoring/wallet-scorer';
import { WalletRawData } from '@/lib/scoring/wallet-scorer';

describe('Wallet Scorer', () => {
  const mockMarkets = new Map([
    ['cond1', { category: 'politics', liquidity: 50000, spread: 0.02, endDate: '2025-12-31T00:00:00Z' }],
    ['cond2', { category: 'crypto', liquidity: 80000, spread: 0.015, endDate: '2025-12-31T00:00:00Z' }],
    ['cond3', { category: 'sports', liquidity: 15000, spread: 0.04, endDate: '2025-12-31T00:00:00Z' }],
  ]);
  
  const createMockTrade = (overrides: any = {}) => ({
    id: 'trade1',
    wallet: '0x123',
    marketId: 'market1',
    conditionId: 'cond1',
    marketQuestion: 'Test market?',
    marketCategory: 'politics',
    outcome: 'Yes',
    side: 'BUY' as const,
    size: 1000,
    price: 0.6,
    timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    transactionHash: '0xabc',
    ...overrides,
  });
  
  it('should return IGNORE for wallets with no trades', () => {
    const rawData: WalletRawData = {
      address: '0x789',
      trades: [],
      markets: new Map(),
    };
    
    const score = scoreWallet(rawData);
    
    expect(score.status).toBe('IGNORE');
    expect(score.globalScore).toBe(0);
    expect(score.tradeCount30d).toBe(0);
  });
  
  it('should handle wallets with unresolved trades (no market end dates in past)', () => {
    // Use future end dates so no trades are "resolved"
    const futureMarkets = new Map([
      ['cond1', { category: 'politics', liquidity: 50000, spread: 0.02, endDate: '2099-12-31T00:00:00Z' }],
      ['cond2', { category: 'crypto', liquidity: 80000, spread: 0.015, endDate: '2099-12-31T00:00:00Z' }],
    ]);
    
    const trades = [
      createMockTrade({ conditionId: 'cond1', price: 0.55, size: 2000 }),
      createMockTrade({ conditionId: 'cond2', price: 0.45, size: 3000 }),
    ];
    
    const rawData: WalletRawData = {
      address: '0x123',
      label: 'Test Wallet',
      sourceRank: 1,
      trades,
      markets: futureMarkets,
    };
    
    const score = scoreWallet(rawData);
    
    // With no resolved trades, status should be IGNORE due to insufficient resolved trades
    expect(score.status).toBe('IGNORE');
    expect(score.resolvedTradeCount30d).toBe(0);
  });
  
  it('should penalize one-hit-wonder wallets with <3 resolved trades', () => {
    // Create markets with past end dates
    const pastMarkets = new Map([
      ['cond1', { category: 'politics', liquidity: 50000, spread: 0.02, endDate: '2020-12-31T00:00:00Z' }],
      ['cond2', { category: 'crypto', liquidity: 80000, spread: 0.015, endDate: '2020-12-31T00:00:00Z' }],
      ['cond3', { category: 'sports', liquidity: 15000, spread: 0.04, endDate: '2020-12-31T00:00:00Z' }],
    ]);
    
    // Create trades with past timestamps so they're "resolved"
    const oldTrades = [
      { ...createMockTrade({ conditionId: 'cond1', price: 0.1, size: 10000 }), timestamp: new Date('2020-06-01') },
      { ...createMockTrade({ conditionId: 'cond2', price: 0.5, size: 100 }), timestamp: new Date('2020-06-01') },
      { ...createMockTrade({ conditionId: 'cond3', price: 0.5, size: 100 }), timestamp: new Date('2020-06-01') },
    ];
    
    const rawData: WalletRawData = {
      address: '0x456',
      trades: oldTrades,
      markets: pastMarkets,
    };
    
    const score = scoreWallet(rawData);
    
    // With <3 resolved trades, one-hit-wonder penalty should be 0.8
    expect(score.oneHitWonderPenalty).toBeGreaterThan(0.5);
  });
  
  it('should calculate category strengths from resolved trades', () => {
    // Create markets with past end dates
    const pastMarkets = new Map([
      ['cond1', { category: 'politics', liquidity: 50000, spread: 0.02, endDate: '2020-12-31T00:00:00Z' }],
      ['cond2', { category: 'crypto', liquidity: 80000, spread: 0.015, endDate: '2020-12-31T00:00:00Z' }],
    ]);
    
    // Create old trades
    const oldTrades = [
      { ...createMockTrade({ conditionId: 'cond1', marketCategory: 'politics' }), timestamp: new Date('2020-06-01') },
      { ...createMockTrade({ conditionId: 'cond1', marketCategory: 'politics' }), timestamp: new Date('2020-06-01') },
      { ...createMockTrade({ conditionId: 'cond2', marketCategory: 'crypto' }), timestamp: new Date('2020-06-01') },
    ];
    
    const rawData: WalletRawData = {
      address: '0xabc',
      trades: oldTrades,
      markets: pastMarkets,
    };
    
    const score = scoreWallet(rawData);
    
    expect(score.categoryStrengths.politics).toBeDefined();
    expect(score.categoryStrengths.crypto).toBeDefined();
    expect(score.bestCategory).toBe('politics');
  });
  
  it('should return empty score for empty data', () => {
    const score = emptyScore('0x123', 'Test', 1);
    
    expect(score.address).toBe('0x123');
    expect(score.status).toBe('IGNORE');
    expect(score.globalScore).toBe(0);
    expect(score.tradeCount30d).toBe(0);
  });
});