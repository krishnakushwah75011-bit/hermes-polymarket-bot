import "dotenv/config";
import * as dns from 'dns';

// Override DNS to always return IPv4 for Supabase domains
const originalLookup = dns.lookup;
(dns.lookup as any) = function(hostname: string, options: any, callback: any) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  if (hostname.includes('supabase.com')) {
    // Hardcode IPv4 for Supabase
    setImmediate(() => callback(null, '65.0.195.55', 4));
  } else {
    originalLookup(hostname, options, callback);
  }
};

import { Pool } from 'pg';

const directUrl = "postgresql://postgres:kamalkrishna%4012345@db.iaxfwsjjmwvlqyqvzvfb.supabase.co:5432/postgres?options=project%3Diaxfwsjjmwvlqyqvzvfb";

const pool = new Pool({
  connectionString: directUrl,
  ssl: { rejectUnauthorized: false },
});

async function test() {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log("SUCCESS! Connected to Supabase via IPv4");
    console.log("Time:", result.rows[0].now);
    await pool.end();
  } catch (error: any) {
    console.error("FAILED:", error.message);
    await pool.end();
    process.exit(1);
  }
}

test();