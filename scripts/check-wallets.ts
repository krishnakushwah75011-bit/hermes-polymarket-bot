// Quick wallet check
import { query } from '../src/lib/db/pool.js';

async function checkWallets() {
  try {
    const r = await query(`SELECT address, label, status, "globalScore", "bestCategory", "roi30d" FROM "WalletProfile" WHERE status IN ('TRACKING', 'WATCH') ORDER BY "globalScore" DESC LIMIT 20`);
    console.log('Wallets (TRACKING/WATCH):');
    r.rows.forEach((row, i) => {
      console.log(`${i+1}. ${row.address.slice(0,10)}... | ${row.label || 'N/A'} | ${row.status} | Score: ${row.globalScore} | Category: ${row.bestCategory} | ROI: ${row.roi30d}`);
    });
    
    const total = await query(`SELECT COUNT(*) as count FROM "WalletProfile"`);
    console.log(`\nTotal wallets: ${total.rows[0].count}`);
    
    const byStatus = await query(`SELECT status, COUNT(*) as count FROM "WalletProfile" GROUP BY status`);
    console.log('By status:');
    byStatus.rows.forEach(row => console.log(`  ${row.status}: ${row.count}`));
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkWallets();