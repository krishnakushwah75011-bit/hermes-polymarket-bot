// audit-database.js
// Comprehensive database audit script
require('dotenv').config();

const { query } = require('./src/lib/db/pool.js');

async function auditDatabase() {
  console.log('='.repeat(70));
  console.log('POLYMARKET BOT - DATABASE AUDIT');
  console.log('='.repeat(70));
  console.log('');
  
  const issues = [];
  const warnings = [];
  const stats = {};
  
  // Audit each table
  const tables = [
    'HistoricalTrade', 'MarketSnapshot', 'WalletProfile', 'PaperTrade',
    'DecisionJournal', 'ObservedTrade', 'DailyReport', 'RuleSet',
    'LeaderboardScan', 'DataCollectionState', 'OutcomeReview',
    'PnlSnapshot', 'RuleChange', 'MarketMetadata'
  ];
  
  for (const table of tables) {
    try {
      // Check row count
      const countResult = await query(`SELECT COUNT(*) FROM "${table}"`);
      const count = parseInt(countResult.rows[0].count);
      stats[table] = { count, issues: [], warnings: [] };
      
      // Check for NULL values in NOT NULL columns
      const schemaResult = await query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = '${table}' AND is_nullable = 'NO'
        AND column_default IS NULL
      `);
      
      for (const col of schemaResult.rows) {
        if (col.column_name !== 'id') { // Skip id, it's auto-generated
          const nullCheck = await query(`
            SELECT COUNT(*) as null_count
            FROM "${table}"
            WHERE "${col.column_name}" IS NULL
          `);
          const nullCount = parseInt(nullCheck.rows[0].null_count);
          if (nullCount > 0) {
            stats[table].issues.push(
              `Column "${col.column_name}" has ${nullCount} NULL values but is NOT NULL`
            );
            issues.push(`${table}.${col.column_name}: ${nullCount} NULL values`);
          }
        }
      }
      
      // Check for duplicate transactionHash in HistoricalTrade
      if (table === 'HistoricalTrade') {
        const dupes = await query(`
          SELECT "transactionHash", COUNT(*) as cnt
          FROM "HistoricalTrade"
          GROUP BY "transactionHash"
          HAVING COUNT(*) > 1
        `);
        if (dupes.rows.length > 0) {
          stats[table].warnings.push(`${dupes.rows.length} duplicate transactionHashes found`);
          warnings.push(`${table}: ${dupes.rows.length} duplicate hashes`);
        }
      }
      
      // Check for orphaned records (foreign key integrity)
      if (table === 'PaperTrade') {
        const orphans = await query(`
          SELECT COUNT(*) as cnt FROM "PaperTrade" p
          WHERE NOT EXISTS (
            SELECT 1 FROM "DecisionJournal" d WHERE d.id = p."decisionJournalId"
          )
        `);
        const orphanCount = parseInt(orphans.rows[0].cnt);
        if (orphanCount > 0) {
          stats[table].warnings.push(`${orphanCount} orphaned PaperTrades (no DecisionJournal)`);
          warnings.push(`${table}: ${orphanCount} orphaned records`);
        }
      }
      
      if (table === 'DecisionJournal') {
        const orphans = await query(`
          SELECT COUNT(*) as cnt FROM "DecisionJournal" d
          WHERE NOT EXISTS (
            SELECT 1 FROM "ObservedTrade" o WHERE o.id = d."observedTradeId"
          )
        `);
        const orphanCount = parseInt(orphans.rows[0].cnt);
        if (orphanCount > 0) {
          stats[table].warnings.push(`${orphanCount} DecisionJournals with missing ObservedTrade`);
          warnings.push(`${table}: ${orphanCount} missing references`);
        }
      }
      
      // Check DataCollectionState for stuck jobs
      if (table === 'DataCollectionState') {
        const stuck = await query(`
          SELECT "collectionType", "lastRunAt", status
          FROM "DataCollectionState"
          WHERE status = 'running'
          AND "lastRunAt" < NOW() - INTERVAL '1 hour'
        `);
        if (stuck.rows.length > 0) {
          stats[table].warnings.push(`${stuck.rows.length} stuck collection jobs`);
          warnings.push(`${table}: ${stuck.rows.length} stuck jobs`);
        }
      }
      
    } catch (error) {
      stats[table] = { count: 0, issues: [`AUDIT FAILED: ${error.message}`], warnings: [] };
      issues.push(`${table}: Audit failed - ${error.message}`);
    }
  }
  
  // Print results
  console.log('DATABASE STATISTICS:');
  console.log('-'.repeat(70));
  for (const [table, data] of Object.entries(stats)) {
    const status = data.issues.length > 0 ? '❌ ISSUES' : 
                   data.warnings.length > 0 ? '⚠️  WARNINGS' : '✅ OK';
    console.log(`${table.padEnd(20)} | ${String(data.count).padStart(6)} records | ${status}`);
    
    data.issues.forEach(issue => console.log(`  ❌ ${issue}`));
    data.warnings.forEach(warn => console.log(`  ⚠️  ${warn}`));
  }
  
  console.log('');
  console.log('SUMMARY:');
  console.log('-'.repeat(70));
  console.log(`Total Tables Audited: ${tables.length}`);
  console.log(`Critical Issues: ${issues.length}`);
  console.log(`Warnings: ${warnings.length}`);
  console.log('');
  
  if (issues.length === 0 && warnings.length === 0) {
    console.log('✅ DATABASE HEALTHY - No issues found!');
  } else if (issues.length === 0) {
    console.log('⚠️  DATABASE OPERATIONAL - Minor warnings only');
  } else {
    console.log('❌ DATABASE HAS ISSUES - Review and fix recommended');
  }
  
  console.log('');
  console.log('='.repeat(70));
  
  // Return audit results
  return { stats, issues, warnings };
}

// Run audit
auditDatabase().then(result => {
  process.exit(result.issues.length > 0 ? 1 : 0);
}).catch(err => {
  console.error('AUDIT FAILED:', err.message);
  process.exit(1);
});