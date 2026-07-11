// tests/trade-scorer.test.ts
// Unit tests for trade scoring

import { describe, it, expect } from 'vitest';
import { scoreTrade } from '@/lib/scoring/trade-scorer';
import { TradeScoringInput } from '@/lib/scoring/trade-scorer';
import { WalletScore, MarketSnapshot } from '@/lib/types';

describe('Trade Scorer', () => {
  const mockWallet: WalletScore = {
    address: '0x123',
    label: 'Test Wallet',
    status: 'TRACK',
    roi30d: 0.4,
    consistencyScore: 0.7,
    copyabilityScore: 0.65,
    oneHitWonderPenalty: 0.1,
    globalScore: 0.75,
    bestCategory: 'politics',
    categoryStrengths: { politics: 0.8 },
    averageTradeSize: 1000,
    tradeCount30d: 30,
    resolvedTradeCount30d: 25,
    winRate30d: 0.7,
    averageLiquidity: 50000,
    averageSpread: 0.02,
    averageEntryTiming: 36,
    copyabilityNotes: '',
    riskNotes: '',
    statusReason: '',
  };
  
  const mockMarket: MarketSnapshot = {
    marketId: 'market1',
    conditionId: 'cond1',
    question: 'Will X happen?',
    category: 'politics',
    yesPrice: 0.65,
    noPrice: 0.35,
    bestBid: 0.64,
    bestAsk: 0.66,
    spread: 0.02,
    liquidity: 80000,
    volume: 500000,
    timeToResolution: 48,
    collectedAt: new Date(),
    rawMarketJson: '{}',
  };
  
  const mockTrade = {
    id: 'trade1',
    wallet: '0x123',
    marketId: 'market1',
    conditionId: 'cond1',
    marketQuestion: 'Will X happen?',
    marketCategory: 'politics',
    outcome: 'Yes',
    side: 'BUY' as const,
    size: 1500,
    price: 0.55,
    timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
    transactionHash: '0xabc',
    slug: 'test-market',
  };
  
  const defaultRules = {
    minTradeScoreForCopy: 0.65,
    minTradeScoreForWatch: 0.45,
    minPriceMovementForCopy: 0.4,
    minLiquidityForCopy: 1000,
    maxSpreadForCopy: 0.05,
    minTimeToResolutionHours: 1,
    maxEntryTimingHours: 72,
    walletScoreWeights: {},
    tradeScoreWeights: {
      walletQuality: 0.30,
      priceMovement: 0.20,
      liquidity: 0.15,
      spread: 0.10,
      timeToResolution: 0.10,
      categoryMatch: 0.10,
      positionSize: 0.05,
    },
  };
  
  it('should score a strong trade as PAPER_COPY', () => {
    const input: TradeScoringInput = {
      wallet: mockWallet,
      trade: mockTrade,
      market: { ...mockMarket, yesPrice: 0.65, liquidity: 80000, spread: 0.02, timeToResolution: 48 },
      rules: defaultRules,
    };
    
    const score = scoreTrade(input);
    
    expect(score.decision).toBe('PAPER_COPY');
    expect(score.total).toBeGreaterThan(0.65);
    expect(score.walletQuality).toBe(0.75);
    expect(score.liquidity).toBeGreaterThan(0.7);
    expect(score.spread).toBeGreaterThan(0.7);
  });
  
  it('should skip trades with low liquidity', () => {
    const input: TradeScoringInput = {
      wallet: mockWallet,
      trade: mockTrade,
      market: { ...mockMarket, liquidity: 500, spread: 0.02, timeToResolution: 48 },
      rules: defaultRules,
    };
    
    const score = scoreTrade(input);
    
    expect(score.decision).toBe('SKIP');
    expect(score.risks.some(r => r.includes('liquidity'))).toBe(true);
  });
  
  it('should skip trades with wide spreads', () => {
    const input: TradeScoringInput = {
      wallet: mockWallet,
      trade: mockTrade,
      market: { ...mockMarket, liquidity: 50000, spread: 0.08, timeToResolution: 48 },
      rules: defaultRules,
    };
    
    const score = scoreTrade(input);
    
    expect(score.decision).toBe('SKIP');
    expect(score.risks.some(r => r.includes('Spread'))).toBe(true);
  });
  
  it('should skip trades too close to resolution', () => {
    const input: TradeScoringInput = {
      wallet: mockWallet,
      trade: mockTrade,
      market: { ...mockMarket, liquidity: 50000, spread: 0.02, timeToResolution: 0.5 },
      rules: defaultRules,
    };
    
    const score = scoreTrade(input);
    
    expect(score.decision).toBe('SKIP');
    expect(score.risks.some(r => r.includes('resolution'))).toBe(true);
  });
  
  it('should give WATCHLIST for borderline trades', () => {
    const input: TradeScoringInput = {
      wallet: { ...mockWallet, globalScore: 0.55 }, // Lower wallet quality
      trade: mockTrade,
      market: { ...mockMarket, liquidity: 15000, spread: 0.03, timeToResolution: 24 },
      rules: defaultRules,
    };
    
    const score = scoreTrade(input);
    
    expect(['WATCHLIST', 'SKIP']).toContain(score.decision);
  });
  
  it('should calculate price movement correctly for BUY', () => {
    const input: TradeScoringInput = {
      wallet: mockWallet,
      trade: { ...mockTrade, price: 0.5, side: 'BUY' },
      market: { ...mockMarket, yesPrice: 0.65 },
      rules: defaultRules,
    };
    
    const score = scoreTrade(input);
    
    // Price moved from 0.5 to 0.65 = 30% increase
    // Should be favorable for BUY
    expect(score.priceMovement).toBeGreaterThan(0.5);
  });
  
  it('should calculate price movement correctly for SELL', () => {
    const input: TradeScoringInput = {
      wallet: mockWallet,
      trade: { ...mockTrade, price: 0.5, side: 'SELL' },
      market: { ...mockMarket, noPrice: 0.3 }, // No price went down from 0.5 to 0.3
      rules: defaultRules,
    };
    
    const score = scoreTrade(input);
    
    // For SELL, favorable if price goes down
    expect(score.priceMovement).toBeGreaterThan(0.5);
  });
  
  it('should calculate thesis score based on market quality', () => {
    const input: TradeScoringInput = {
      wallet: mockWallet,
      trade: mockTrade,
      market: { ...mockMarket, question: 'Will the candidate win the election?', liquidity: 150000, spread: 0.015, timeToResolution: 72 },
      rules: defaultRules,
    };
    
    const score = scoreTrade(input);
    
    expect(score.thesis).toBeGreaterThan(0.5);
  });
});