const dns = require('dns');
const { Client } = require('pg');

const addrCache = {
  'aws-0-ap-south-1.pooler.supabase.com': '65.0.195.55',
  'db.iaxfwsjjmwvlqyqvzvfb.supabase.co': null, // No IPv4 A records exist
};

dns.setServers(['8.8.8.8', '8.8.4.4']);

// Before patching, verify we can resolve
async function verifyResolve() {
  for (const h of Object.keys(addrCache)) {
    try {
      const a = await dns.promises.resolve4(h);
      addrCache[h] = a[0];
      console.log(h + ' \u2192 ' + a[0]);
    } catch(e) {
      console.log(h + ' \u2192 NO A records');
    }
  }
}

// Simple sync lookup override  
const origLookup = dns.lookup;
dns.lookup = function(hostname, opts, cb) {
  if (typeof opts === 'function') { cb = opts; opts = {}; }
  
  if (addrCache[hostname]) {
    // Return cached IPv4 immediately
    // Use setImmediate to keep it async as Node expects
    setImmediate(() => cb(null, addrCache[hostname], 4));
    return;
  }
  return origLookup(hostname, opts, cb);
};

async function tryAll() {
  await verifyResolve();
  
  console.log('\nConnection tests:\n');
  
  if (addrCache['aws-0-ap-south-1.pooler.supabase.com']) {
    // Transaction pooler - this is the one we want
    const c = new Client({
      host: addrCache['aws-0-ap-south-1.pooler.supabase.com'],
      port: 6543,
      database: 'postgres',
      user: 'postgres',
      password: 'kamalkrishna@12345',
      ssl: { rejectUnauthorized: false, checkServerIdentity: () => {} },
      connectionTimeoutMillis: 15000,
    });
    try {
      await c.connect();
      const r = await c.query('SELECT version()');
      console.log('TX Pooler 6543: \u2705 SUCCESS');
      console.log('  Version: ' + r.rows[0].version);
      await c.end();
    } catch(e) {
      console.log('TX Pooler 6543: \u274C ' + e.message.substring(0, 150) + ' code=' + e.code);
      try { await c.end(); } catch(_) {}
    }
  }
  
  // Also try with the Pool object (handles connection pooling)
  if (addrCache['aws-0-ap-south-1.pooler.supabase.com']) {
    const { Pool } = require('pg');
    const pool = new Pool({
      host: addrCache['aws-0-ap-south-1.pooler.supabase.com'],
      port: 6543,
      database: 'postgres',
      user: 'postgres',
      password: 'kamalkrishna@12345',
      ssl: { rejectUnauthorized: false, checkServerIdentity: () => {} },
      connectionTimeoutMillis: 15000,
      max: 1,
    });
    try {
      const client = await pool.connect();
      const r = await client.query('SELECT count(*) FROM pg_tables WHERE schemaname=\'public\'');
      console.log('Pool TX 6543: \u2705 SUCCESS - ' + r.rows[0].count + ' public tables');
      client.release();
      await pool.end();
    } catch(e) {
      console.log('Pool TX 6543: \u274C ' + e.message.substring(0, 150) + ' code=' + e.code);
      try { await pool.end(); } catch(_) {}
    }
  }
}

tryAll().catch(e => console.log('FATAL:', e.stack));