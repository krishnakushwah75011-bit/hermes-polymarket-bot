// Initialize default rules in database
require('dotenv').config();
const { query } = require('./src/lib/db/pool.js');

async function initDefaultRules() {
  console.log('Creating default rule set...');
  
  const defaultRules = {
    minRoi30d: 0.05,
    minConsistencyScore: 0.3,
    minCopyabilityScore: 0.3,
    maxOneHitWonderPenalty: 0.5,
    minGlobalScoreForTrack: 0.65,
    minGlobalScoreForWatch: 0.45,
    minResolvedTrades30d: 5,
    minLiquidity: 1000,
    maxSpread: 0.05,
    maxEntryTimingHours: 72,
    maxPriceMovementSinceEntry: 0.15,
    minTradeScoreForCopy: 0.65,
    minTradeScoreForWatch: 0.45,
    minPriceMovementForCopy: 0.4,
    minLiquidityForCopy: 1000,
    maxSpreadForCopy: 0.05,
    minTimeToResolutionHours: 1,
    walletScoreWeights: {
      roi: 0.25, consistency: 0.20, copyability: 0.20,
      liquidity: 0.10, spread: 0.10, timing: 0.05,
      diversity: 0.10, oneHitWonderPenalty: 0.30,
    },
    tradeScoreWeights: {
      walletQuality: 0.30, priceMovement: 0.20, liquidity: 0.15,
      spread: 0.10, timeToResolution: 0.10, categoryMatch: 0.10, thesis: 0.05,
    },
    riskManagement: {
      maxPositionsPerAsset: 3,
      maxPortfolioExposure: 0.6,
      maxDailyLossPercent: 0.05,
      stopLossPercent: 0.15,
      takeProfitPercent: 0.50,
    },
  };
  
  const existing = await query('SELECT * FROM "RuleSet" WHERE active = true');
  if (existing.rows.length > 0) {
    console.log('✅ Active rule set already exists');
    return existing.rows[0];
  }
  
  const ruleId = `rules_v1_${Date.now()}`;
  await query(`
    INSERT INTO "RuleSet" (id, version, active, "rulesJson", "createdAt", "updatedAt")
    VALUES ($1, $2, TRUE, $3, NOW(), NOW())
  `, [ruleId, 1, JSON.stringify(defaultRules)]);
  
  console.log('✅ Default rule set created (ID:', ruleId, ')');
  return { id: ruleId, version: 1, active: true, rules: defaultRules };
}

initDefaultRules().catch(console.error);