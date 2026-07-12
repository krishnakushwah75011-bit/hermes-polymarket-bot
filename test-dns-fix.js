// Override DNS BEFORE any other imports
const dns = require('dns');

// Hardcode the mapping
const POOLER_HOST = 'aws-0-ap-south-1.pooler.supabase.com';
const POOLER_IP = '65.0.195.55';

// Override lookup() - signature: lookup(hostname, options, callback)
// callback receives: (err, address, family)
const origLookup = dns.lookup;
dns.lookup = function(hostname, options, callback) {
  if (typeof options === 'function') { 
    callback = options; 
    options = {}; 
  }
  if (hostname === POOLER_HOST) {
    // console.log('DNS lookup override:', hostname, '->', POOLER_IP);
    process.nextTick(() => callback(null, POOLER_IP, 4));
    return;
  }
  return origLookup(hostname, options, callback);
};

// Override resolve4() - signature: resolve4(hostname, callback)
// callback receives: (err, addresses)
const origResolve4 = dns.resolve4;
dns.resolve4 = function(hostname, callback) {
  if (hostname === POOLER_HOST) {
    process.nextTick(() => callback(null, [POOLER_IP]));
    return;
  }
  return origResolve4(hostname, callback);
};

// Import pg AFTER DNS override
const { Client } = require('pg');

async function test() {
  console.log('Testing with DNS override...\n');
  console.log('Pooler:', POOLER_HOST, '->', POOLER_IP);
  console.log('Port: 6543\n');
  
  const client = new Client({
    host: POOLER_HOST,
    port: 6543,
    database: 'postgres',
    user: 'postgres',
    password: 'kamalkrishna@12345',
    ssl: {
      rejectUnauthorized: false,
      checkServerIdentity: () => {},
    },
    connectionTimeoutMillis: 15000,
  });
  
  try {
    await client.connect();
    console.log('\u2705 CONNECTED\n');
    
    const ver = await client.query('SELECT version()');
    console.log('Version:', ver.rows[0].version.substring(0, 70));
    
    await client.end();
    console.log('\nSUCCESS!');
    
  } catch(e) {
    console.log('\u274C FAILED:', e.message.substring(0, 150));
    console.log('Code:', e.code);
  }
}

test();