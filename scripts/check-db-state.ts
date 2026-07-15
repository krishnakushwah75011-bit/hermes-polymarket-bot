// Quick DB state check
import { query } from '../src/lib/db/pool.js';

async function checkState() {
  try {
    const tables = [
      'HistoricalTrade',
      'WalletProfile',
      'ObservedTrade',
      'DecisionJournal',
      'PaperTrade',
      'DailyReport',
      'MarketMetadata'
    ];
    
    for (const table of tables) {
      if (table === 'WalletProfile') {
        const r = await query(`SELECT COUNT(*) as count FROM "${table}" WHERE status='TRACKING'`);
        console.log(`${table} (TRACKING): ${r.rows[0].count}`);
      } else if (table === 'PaperTrade') {
        const r = await query(`SELECT COUNT(*) as count FROM "${table}" WHERE status='OPEN'`);
        console.log(`${table} (OPEN): ${r.rows[0].count}`);
      } else {
        const r = await query(`SELECT COUNT(*) as count FROM "${table}"`);
        console.log(`${table}: ${r.rows[0].count}`);
      }
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkState();