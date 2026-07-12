
import "dotenv/config";
import { Pool } from 'pg';

// Use DIRECT connection (not pooler) - includes project ref for SNI
const directUrl = process.env.DATABASE_URL_DIRECT;

const pool = new Pool({
  connectionString: directUrl,
  ssl: { rejectUnauthorized: false },
});

async function test() {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log("SUCCESS! Connected to Supabase (direct)");
    console.log("Time:", result.rows[0].now);
    await pool.end();
  } catch (error) {
    console.error("FAILED:", error.message);
    await pool.end();
    process.exit(1);
  }
}

test();
