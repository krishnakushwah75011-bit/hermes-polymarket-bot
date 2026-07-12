// src/scripts/update-rules.ts
// Rule adaptation - updates rules based on performance data (pg version - STUB)

import { query } from '../lib/db/pool';

async function updateRules() {
  console.log('[update:rules] Starting rule update...');
  
  // Get performance stats from OutcomeReviews
  const statsResult = await query(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN "wasDecisionGood" THEN 1 ELSE 0 END) as good,
      AVG(CASE WHEN "wasDecisionGood" THEN 1.0 ELSE 0.0 END) as success_rate
    FROM "OutcomeReview"
  `);
  
  const stats = statsResult.rows[0];
  const total = parseInt(stats.total);
  const good = parseInt(stats.good);
  const successRate = parseFloat(stats.success_rate) || 0;
  
  console.log(`[update:rules] Analyzed ${total} reviewed trades, ${good} good (${(successRate * 100).toFixed(1)}% success)`);
  
  if (total < 10) {
    console.log('[update:rules] Not enough data to adapt rules (need 10+ reviews)');
    return { success: true, adapted: false, reason: 'insufficient_data' };
  }
  
  // Get current active rules
  const currentRulesResult = await query('SELECT * FROM "RuleSet" WHERE active = true LIMIT 1');
  if (currentRulesResult.rows.length === 0) {
    console.log('[update:rules] No active rules found');
    return { success: false, error: 'no_active_rules' };
  }
  
  const currentRule = currentRulesResult.rows[0];
  const currentRules = JSON.parse(currentRule.rulesJson);
  
  // Simple adaptation logic (can be enhanced later)
  const newRules = { ...currentRules };
  const changes = [];
  
  // If success rate > 70%, lower thresholds to copy more
  if (successRate > 0.70) {
    newRules.minTradeScoreForCopy = Math.max(0.50, currentRules.minTradeScoreForCopy - 0.05);
    changes.push('Lowered minTradeScoreForCopy (high success rate)');
  }
  
  // If success rate < 40%, raise thresholds to be more selective  
  if (successRate < 0.40) {
    newRules.minTradeScoreForCopy = Math.min(0.80, currentRules.minTradeScoreForCopy + 0.05);
    changes.push('Raised minTradeScoreForCopy (low success rate)');
  }
  
  if (changes.length === 0) {
    console.log('[update:rules] No changes needed (performance within targets)');
    return { success: true, adapted: false, reason: 'no_changes' };
  }
  
  // Deactivate old rules
  await query('UPDATE "RuleSet" SET active = false WHERE active = true');
  
  // Create new version
  const newRuleId = `rules_v${currentRule.version + 1}_${Date.now()}`;
  await query(`
    INSERT INTO "RuleSet" (id, version, active, "rulesJson", "createdAt", "updatedAt")
    VALUES ($1, $2, TRUE, $3, NOW(), NOW())
  `, [newRuleId, currentRule.version + 1, JSON.stringify(newRules)]);
  
  console.log(`[update:rules] Created new rule version ${currentRule.version + 1} (${changes.length} changes)`);
  changes.forEach(c => console.log(`  - ${c}`));
  
  return { success: true, adapted: true, newVersion: currentRule.version + 1, changes };
}

// Run if executed directly
if (require.main === module) {
  updateRules().then(result => {
    console.log('[update:rules] Completed:', result);
    process.exit(result.success ? 0 : 1);
  }).catch(error => {
    console.error('[update:rules] CRASHED:', error.message);
    process.exit(1);
  });
}

export { updateRules };