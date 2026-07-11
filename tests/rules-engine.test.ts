// tests/rules-engine.test.ts
// Unit tests for rules engine

import { describe, it, expect, vi } from 'vitest';
import { getActiveRuleSet, runWeeklyRuleAdaptation } from '@/lib/rules/rules-engine';
import { prisma } from '@/lib/db/client';

vi.mock('@/lib/db/client', () => ({
  prisma: {
    ruleSet: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    outcomeReview: {
      findMany: vi.fn(),
    },
    paperTrade: {
      findMany: vi.fn(),
    },
    ruleChange: {
      create: vi.fn(),
    },
  },
}));

describe('Rules Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  it('should return default rules when no active rule set exists', async () => {
    prisma.ruleSet.findFirst.mockResolvedValue(null);
    
    const rules = await getActiveRuleSet();
    
    expect(rules.version).toBe(1);
    expect(rules.rules.minRoi30d).toBe(0.05);
    expect(rules.rules.minGlobalScoreForTrack).toBe(0.65);
  });
  
  it('should return active rule set when exists', async () => {
    const mockRuleSet = {
      id: 'rule1',
      version: 5,
      active: true,
      rulesJson: JSON.stringify({ minRoi30d: 0.1, minGlobalScoreForTrack: 0.7 }),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    prisma.ruleSet.findFirst.mockResolvedValue(mockRuleSet);
    
    const rules = await getActiveRuleSet();
    
    expect(rules.version).toBe(5);
    expect(rules.rules.minRoi30d).toBe(0.1);
    expect(rules.rules.minGlobalScoreForTrack).toBe(0.7);
  });
  
  it('should handle rule adaptation with insufficient trades', async () => {
    const mockActiveRule = {
      id: 'rule1',
      version: 1,
      active: true,
      rulesJson: JSON.stringify({ minRoi30d: 0.05, minGlobalScoreForTrack: 0.65 }),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    prisma.ruleSet.findFirst.mockResolvedValue(mockActiveRule);
    prisma.outcomeReview.findMany.mockResolvedValue([]);
    prisma.paperTrade.findMany.mockResolvedValue([]);
    
    const result = await runWeeklyRuleAdaptation();
    
    expect(result).toBeNull();
  });
});