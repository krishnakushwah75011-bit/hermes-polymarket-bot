// Set top wallets to TRACK status
import { query } from '../src/lib/db/pool.js';

async function setTrackingWallets() {
  try {
    // Get top 20 wallets by globalScore that are not yet TRACK
    const r = await query(`
      SELECT address, "globalScore", "bestCategory", "roi30d" 
      FROM "WalletProfile" 
      WHERE status != 'TRACK' 
      ORDER BY "globalScore" DESC 
      LIMIT 20
    `);
    
    console.log(`Found ${r.rows.length} wallets to set to TRACK:\n`);
    
    let updated = 0;
    for (const wallet of r.rows) {
      await query(`
        UPDATE "WalletProfile" 
        SET status = 'TRACK', 
            "statusReason" = 'Top performer - auto-selected by system',
            "updatedAt" = NOW()
        WHERE address = $1
      `, [wallet.address]);
      
      console.log(`✓ ${wallet.address.slice(0,10)}... | Score: ${wallet.globalScore.toFixed(2)} | ${wallet.bestCategory || 'N/A'} | ROI: ${(wallet.roi30d * 100).toFixed(1)}%`);
      updated++;
    }
    
    // Verify
    const verify = await query(`SELECT COUNT(*) as count FROM "WalletProfile" WHERE status='TRACK'`);
    console.log(`\nTotal TRACK wallets: ${verify.rows[0].count}`);
    console.log(`\nUpdated ${updated} wallets to TRACK status`);
    
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

setTrackingWallets();