
import "dotenv/config";
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL_POOLER + "&sslmode=no-verify",
});

async function test() {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log("SUCCESS! Connected to Supabase");
    console.log("Time:", result.rows[0].now);
    await pool.end();
  } catch (error) {
    console.error("FAILED:", error.message);
    await pool.end();
    process.exit(1);
  }
}

test();
