// Set top active wallets to TRACK
import { query } from '../src/lib/db/pool.js';

async function setActiveWallets() {
  try {
    console.log('=== SETTING ACTIVE WALLETS TO TRACK ===\n');
    
    // Get top 10 most active wallets in last 7 days
    const top = await query(`
      SELECT "walletAddress", COUNT(*) as tradeCount
      FROM "ObservedTrade"
      WHERE "createdAt" > NOW() - INTERVAL '7 days'
      GROUP BY "walletAddress"
      ORDER BY tradeCount DESC
      LIMIT 10
    `);
    
    console.log(`Top ${top.rows.length} active wallets:\n`);
    
    let updated = 0;
    for (const w of top.rows) {
      const addr = w.walletAddress;
      const count = w.tradeCount;
      
      // Check if already TRACK
      const existing = await query(`SELECT status FROM "WalletProfile" WHERE address = $1`, [addr]);
      
      if (existing.rows.length === 0) {
        // Create wallet profile
        await query(`
          INSERT INTO "WalletProfile" (address, status, "globalScore", "tradeCount30d", "statusReason", "createdAt", "updatedAt")
          VALUES ($1, 'TRACK', 50, $2, 'High activity - auto-tracked', NOW(), NOW())
        `, [addr, count]);
        console.log(`✓ NEW TRACK: ${addr.slice(0,10)}... (${count} trades)`);
        updated++;
      } else if (existing.rows[0].status !== 'TRACK') {
        // Update to TRACK
        await query(`UPDATE "WalletProfile" SET status='TRACK', "updatedAt"=NOW() WHERE address=$1`, [addr]);
        console.log(`✓ UPDATED TO TRACK: ${addr.slice(0,10)}... (${count} trades) - was ${existing.rows[0].status}`);
        updated++;
      } else {
        console.log(`✓ ALREADY TRACK: ${addr.slice(0,10)}... (${count} trades)`);
      }
    }
    
    const total = await query(`SELECT COUNT(*) as c FROM "WalletProfile" WHERE status='TRACK'`);
    console.log(`\n=== TOTAL TRACK WALLETS: ${total.rows[0].c} ===`);
    console.log(`Updated this run: ${updated}`);
    
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

setActiveWallets();