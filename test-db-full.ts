
import "dotenv/config";
import { query } from './src/lib/db/pool.js';

async function test() {
  console.log("Testing database connection...");
  try {
    const result = await query('SELECT COUNT(*) as count FROM "WalletProfile"');
    console.log("WalletProfile table exists, count:", result.rows[0].count);
    
    const result2 = await query('SELECT COUNT(*) as count FROM "PaperTrade"');
    console.log("PaperTrade table exists, count:", result2.rows[0].count);
    
    console.log("SUCCESS - Database is accessible!");
  } catch (error: any) {
    console.error("ERROR:", error.message);
    process.exit(1);
  }
}

test();
