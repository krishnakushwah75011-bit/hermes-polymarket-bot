// prisma/seed.ts
// Database seed script

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create default rule set
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

    minTradeScoreForCopy: 0.65,
    minTradeScoreForWatch: 0.45,
    minPriceMovementForCopy: 0.4,
    minLiquidityForCopy: 1000,
    maxSpreadForCopy: 0.05,
    minTimeToResolutionHours: 1,

    walletScoreWeights: {
      roi: 0.25,
      consistency: 0.20,
      copyability: 0.20,
      liquidity: 0.10,
      spread: 0.10,
      timing: 0.05,
      diversity: 0.10,
      oneHitWonderPenalty: 0.30,
    },

    tradeScoreWeights: {
      walletQuality: 0.30,
      priceMovement: 0.20,
      liquidity: 0.15,
      spread: 0.10,
      timeToResolution: 0.10,
      categoryMatch: 0.10,
      positionSize: 0.05,
    },

    stopLossPercent: 0.20,
    takeProfitPercent: 0.50,
  };

  await prisma.ruleSet.upsert({
    where: { version: 1 },
    update: { rulesJson: JSON.stringify(defaultRules), active: true },
    create: {
      version: 1,
      active: true,
      rulesJson: JSON.stringify(defaultRules),
    },
  });

  console.log('Default rule set created');

  // Create sample wallet profiles (for testing)
  const sampleWallets = [
    {
      address: '0x1234567890abcdef1234567890abcdef12345678',
      label: 'Alpha Trader',
      sourceRank: 1,
      status: 'TRACK',
      roi30d: 0.45,
      consistencyScore: 0.72,
      copyabilityScore: 0.68,
      oneHitWonderPenalty: 0.1,
      globalScore: 0.78,
      bestCategory: 'politics',
      categoryStrengthsJson: JSON.stringify({ politics: 0.8, crypto: 0.6, sports: 0.4 }),
      averageTradeSize: 1250,
      tradeCount30d: 42,
      resolvedTradeCount30d: 38,
      winRate30d: 0.71,
      averageLiquidity: 85000,
      averageSpread: 0.02,
      averageEntryTiming: 36,
      copyabilityNotes: 'High liquidity markets, early entries',
      riskNotes: 'None',
    },
    {
      address: '0xabcdef1234567890abcdef1234567890abcdef12',
      label: 'Crypto Whale',
      sourceRank: 3,
      status: 'TRACK',
      roi30d: 0.38,
      consistencyScore: 0.65,
      copyabilityScore: 0.55,
      oneHitWonderPenalty: 0.05,
      globalScore: 0.71,
      bestCategory: 'crypto',
      categoryStrengthsJson: JSON.stringify({ crypto: 0.75, defi: 0.6 }),
      averageTradeSize: 3200,
      tradeCount30d: 28,
      resolvedTradeCount30d: 25,
      winRate30d: 0.68,
      averageLiquidity: 120000,
      averageSpread: 0.015,
      averageEntryTiming: 48,
      copyabilityNotes: 'Very high liquidity, good timing',
      riskNotes: 'Category concentrated',
    },
    {
      address: '0x9999999999999999999999999999999999999999',
      label: 'New Trader',
      sourceRank: 150,
      status: 'WATCH',
      roi30d: 0.12,
      consistencyScore: 0.45,
      copyabilityScore: 0.4,
      oneHitWonderPenalty: 0.2,
      globalScore: 0.48,
      bestCategory: 'sports',
      categoryStrengthsJson: JSON.stringify({ sports: 0.55 }),
      averageTradeSize: 450,
      tradeCount30d: 15,
      resolvedTradeCount30d: 12,
      winRate30d: 0.5,
      averageLiquidity: 25000,
      averageSpread: 0.035,
      averageEntryTiming: 24,
      copyabilityNotes: 'Moderate liquidity, late entries',
      riskNotes: 'Limited track record',
    },
  ];

  for (const wallet of sampleWallets) {
    await prisma.walletProfile.upsert({
      where: { address: wallet.address },
      update: wallet,
      create: wallet,
    });
  }

  console.log('Sample wallets created');
  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });