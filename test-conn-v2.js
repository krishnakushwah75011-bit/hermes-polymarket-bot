const { Client } = require('pg');

// pg's ssl object has a 'ca' property - we can try sslmode=no-verify
// which skips CA entirely

async function tryConnect(label, sslConfig) {
  const client = new Client({
    host: '65.0.195.55',
    port: 6543,
    database: 'postgres',
    user: 'postgres',
    password: 'kamalkrishna@12345',
    ssl: sslConfig,
    connectionTimeoutMillis: 10000,
  });
  try {
    await client.connect();
    const res = await client.query('SELECT 1');
    console.log(label + ': SUCCESS ' + JSON.stringify(res.rows));
  } catch(e) {
    console.log(label + ': FAIL ' + e.message.substring(0, 120) + ' code=' + e.code);
  } finally {
    try { await client.end(); } catch(_) {}
  }
}

async function main() {
  // Method 1: rejectUnauthorized=false (standard)
  await tryConnect('rejectUnauthorized=false', { rejectUnauthorized: false });
  
  // Method 2: Full bypass with servername
  await tryConnect('rejectUnauthorized=false + checkServerIdentity bypass', { 
    rejectUnauthorized: false,
    checkServerIdentity: () => {},
    servername: 'aws-0-ap-south-1.pooler.supabase.com'
  });
  
  // Method 3: sslmode=no-verify via conn string
  const client3 = new Client({
    connectionString: 'postgresql://postgres:kamalkrishna%4012345@65.0.195.55:6543/postgres?sslmode=no-verify',
    connectionTimeoutMillis: 10000,
  });
  try {
    await client3.connect();
    const res = await client3.query('SELECT 1');
    console.log('sslmode=no-verify: SUCCESS ' + JSON.stringify(res.rows));
  } catch(e) {
    console.log('sslmode=no-verify: FAIL ' + e.message.substring(0, 120) + ' code=' + e.code);
  } finally {
    try { await client3.end(); } catch(_) {}
  }
  
  // Method 4: sslmode=disable (no SSL)
  const client4 = new Client({
    connectionString: 'postgresql://postgres:kamalkrishna%4012345@65.0.195.55:6543/postgres?sslmode=disable',
    connectionTimeoutMillis: 10000,
  });
  try {
    await client4.connect();
    const res = await client4.query('SELECT 1');
    console.log('sslmode=disable: SUCCESS ' + JSON.stringify(res.rows));
  } catch(e) {
    console.log('sslmode=disable: FAIL ' + e.message.substring(0, 120) + ' code=' + e.code);
  } finally {
    try { await client4.end(); } catch(_) {}
  }
}

main().catch(e => console.log('FATAL:', e.message));