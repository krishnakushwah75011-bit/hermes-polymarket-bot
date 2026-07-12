// Simple rule fetcher for scripts (pg version)
const { query } = require('./src/lib/db/pool.js');

async function getActiveRules() {
  const result = await query('SELECT * FROM "RuleSet" WHERE active = true ORDER BY version DESC LIMIT 1');
  
  if (result.rows.length === 0) {
    throw new Error('No active rule set found - run init-rules.js first');
  }
  
  const rule = result.rows[0];
  return {
    id: rule.id,
    version: rule.version,
    active: rule.active,
    rules: JSON.parse(rule.rulesJson),
  };
}

// If run directly, fetch and display rules
if (require.main === module) {
  getActiveRules().then(rules => {
    console.log('Active Ruleset:', rules.id);
    console.log('Version:', rules.version);
    console.log('minTradeScoreForCopy:', rules.rules.minTradeScoreForCopy);
    console.log('minTradeScoreForWatch:', rules.rules.minTradeScoreForWatch);
  }).catch(console.error);
}

module.exports = { getActiveRules };