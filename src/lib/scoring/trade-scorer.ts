// lib/scoring/trade-scorer.ts
// Trade scoring engine

import { WalletScore, MarketSnapshot, ParsedWalletTrade, RuleSet } from '../types';

export interface TradeScore {
  walletQuality: number;
  priceMovement: number;
  liquidity: number;
  spread: number;
  timeToResolution: number;
  categoryMatch: number;
  positionSize: number;
  thesis: number;
  total: number;
  decision: 'PAPER_COPY' | 'WATCHLIST' | 'SKIP';
  reasons: string[];
  risks: string[];
}

export interface TradeScoringInput {
  wallet: WalletScore;
  trade: ParsedWalletTrade;
  market: MarketSnapshot;
  rules: RuleSet['rules'];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Price movement score (0-1)
function calculatePriceMovement(
  walletEntryPrice: number,
  currentPrice: number,
  side: 'BUY' | 'SELL'
): number {
  if (side === 'BUY') {
    const pctChange = (currentPrice - walletEntryPrice) / walletEntryPrice;
    return clamp(1 + pctChange * 2, 0, 1); // Favorable if price up
  } else {
    const pctChange = (walletEntryPrice - currentPrice) / walletEntryPrice;
    return clamp(1 + pctChange * 2, 0, 1); // Favorable if price down
  }
}

// Liquidity score (0-1)
function calculateLiquidityScore(liquidity: number): number {
  return clamp(Math.log10(liquidity + 1) / 5, 0, 1);
}

// Spread score (0-1) - inverted
function calculateSpreadScore(spread: number): number {
  return clamp(1 - spread / 0.05, 0, 1);
}

// Time to resolution score (0-1)
function calculateTimeToResolutionScore(hours: number): number {
  if (hours <= 0) return 0;
  if (hours >= 72) return 1;
  return hours / 72;
}

// Category match score (0-1)
function calculateCategoryMatch(wallet: WalletScore, marketCategory?: string): number {
  if (!marketCategory || !wallet.bestCategory) return 0.5;
  return wallet.categoryStrengths[marketCategory] || 0.5;
}

// Position size score (0-1)
function calculatePositionSizeScore(sizeUsd: number): number {
  if (sizeUsd >= 100 && sizeUsd <= 5000) return 1.0;
  if (sizeUsd >= 50 && sizeUsd < 100) return 0.8;
  if (sizeUsd > 5000 && sizeUsd <= 20000) return 0.7;
  if (sizeUsd < 50) return 0.4;
  return 0.5;
}

// Thesis score - heuristic based on trade clarity
function calculateThesisScore(trade: ParsedWalletTrade, market: MarketSnapshot): number {
  let score = 0.5; // Base
  
  // Clear market question
  if (market.question && market.question.length > 10) score += 0.1;
  
  // Binary market (Yes/No) - easier to copy
  if (market.question.toLowerCase().includes('yes') || market.question.toLowerCase().includes('no')) {
    score += 0.1;
  }
  
  // Reasonable time to resolution
  if (market.timeToResolution && market.timeToResolution > 24) score += 0.1;
  if (market.timeToResolution && market.timeToResolution < 1) score -= 0.2;
  
  // Good liquidity
  if (market.liquidity && market.liquidity > 10000) score += 0.1;
  
  // Tight spread
  if (market.spread && market.spread < 0.03) score += 0.1;
  
  return clamp(score, 0, 1);
}

export function scoreTrade(input: TradeScoringInput): TradeScore {
  const { wallet, trade, market, rules } = input;
  
  // Current price for the outcome
  const currentPrice = trade.outcome.toLowerCase() === 'yes' 
    ? (market.yesPrice || trade.walletEntryPrice)
    : (market.noPrice || trade.walletEntryPrice);
  
  const walletEntryPrice = trade.walletEntryPrice;
  const priceMovement = calculatePriceMovement(walletEntryPrice, currentPrice, trade.side);
  
  const liquidity = calculateLiquidityScore(market.liquidity || 0);
  const spread = calculateSpreadScore(market.spread || 0.05);
  const timeToResolution = market.timeToResolution 
    ? calculateTimeToResolutionScore(market.timeToResolution) 
    : 0.5;
  const categoryMatch = calculateCategoryMatch(wallet, market.category);
  const positionSize = calculatePositionSizeScore(trade.size * walletEntryPrice);
  const thesis = calculateThesisScore(trade, market);
  
  // Wallet quality is the global score
  const walletQuality = wallet.globalScore;
  
  // Weighted total
  const weights = rules.tradeScoreWeights || {
    walletQuality: 0.30,
    priceMovement: 0.20,
    liquidity: 0.15,
    spread: 0.10,
    timeToResolution: 0.10,
    categoryMatch: 0.10,
    positionSize: 0.05,
  };
  
  const weightSum = Object.values(weights).reduce((a: number, b: number) => a + b, 0);
  const total = clamp(
    walletQuality * weights.walletQuality +
    priceMovement * weights.priceMovement +
    liquidity * weights.liquidity +
    spread * weights.spread +
    timeToResolution * weights.timeToResolution +
    categoryMatch * weights.categoryMatch +
    positionSize * weights.positionSize +
    thesis * (1 - weightSum), // remaining weight
    0, 1
  );
  
  // Decision thresholds
  const minCopy = rules.minTradeScoreForCopy || 0.65;
  const minWatch = rules.minTradeScoreForWatch || 0.45;
  const minPriceMovement = rules.minPriceMovementForCopy || 0.4;
  const minLiquidity = rules.minLiquidityForCopy || 1000;
  const maxSpread = rules.maxSpreadForCopy || 0.05;
  const minTimeToResolution = rules.minTimeToResolutionHours || 1;
  
  let decision: 'PAPER_COPY' | 'WATCHLIST' | 'SKIP' = 'SKIP';
  const reasons: string[] = [];
  const risks: string[] = [];
  
  // Hard filters
  if (market.liquidity && market.liquidity < minLiquidity) {
    decision = 'SKIP';
    risks.push(`Market liquidity too low ($${market.liquidity.toFixed(0)} < $${minLiquidity})`);
  } else if (market.spread && market.spread > maxSpread) {
    decision = 'SKIP';
    risks.push(`Spread too wide (${(market.spread * 100).toFixed(1)}% > ${(maxSpread * 100).toFixed(1)}%)`);
  } else if (market.timeToResolution && market.timeToResolution < minTimeToResolution) {
    decision = 'SKIP';
    risks.push(`Too close to resolution (${market.timeToResolution.toFixed(1)}h < ${minTimeToResolution}h)`);
  } else if (total >= minCopy && priceMovement >= minPriceMovement) {
    decision = 'PAPER_COPY';
    reasons.push('Strong wallet quality and favorable price movement');
  } else if (total >= minWatch) {
    decision = 'WATCHLIST';
    reasons.push('Moderate score, monitoring for better entry');
  } else {
    decision = 'SKIP';
    risks.push(`Score below threshold (${total.toFixed(2)} < ${minWatch})`);
  }
  
  // Add specific reasons
  if (walletQuality > 0.7) reasons.push('High-quality wallet');
  if (priceMovement > 0.6) reasons.push('Price moved favorably since wallet entry');
  if (liquidity > 0.7) reasons.push('Excellent market liquidity');
  if (spread > 0.7) reasons.push('Tight spread');
  if (categoryMatch > 0.7) reasons.push('Wallet strong in this category');
  if (thesis > 0.7) reasons.push('Clear trade thesis');
  
  // Add specific risks
  if (walletQuality < 0.5) risks.push('Wallet quality below average');
  if (priceMovement < 0.3) risks.push('Price moved against wallet entry');
  if (liquidity < 0.3) risks.push('Low market liquidity');
  if (spread < 0.3) risks.push('Wide spread');
  if (timeToResolution < 0.3) risks.push('Close to market resolution');
  if (wallet.oneHitWonderPenalty > 0.5) risks.push('Wallet has one-hit-wonder profile');
  
  return {
    walletQuality,
    priceMovement,
    liquidity,
    spread,
    timeToResolution,
    categoryMatch,
    positionSize,
    thesis,
    total,
    decision,
    reasons,
    risks,
  };
}