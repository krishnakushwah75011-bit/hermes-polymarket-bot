// Override DNS BEFORE any other imports
const dns = require('dns');
const origLookup = dns.lookup;
const origResolve4 = dns.resolve4;

// Hardcode the mapping
const OVERRIDES = {
  'aws-0-ap-south-1.pooler.supabase.com': '65.0.195.55',
};

// Override lookup() - this is what Node.js net.connect uses
dns.lookup = function(hostname, options, callback) {
  if (typeof options === 'function') { callback = options; options = {}; }
  if (OVERRIDES[hostname]) {
    setImmediate(() => callback(null, OVERRIDES[hostname], 4));
    return;
  }
  return origLookup.call(dns, hostname, options, callback);
};

// Override resolve4() - what some libs use directly  
dns.resolve4 = function(hostname, callback) {
  if (OVERRIDES[hostname]) {
    setImmediate(() => callback(null, [OVERRIDES[hostname]]));
    return;
  }
  return origResolve4.call(dns, hostname, callback);
};

// Also override the Promise versions
dns.promises = {
  ...dns.promises,
  lookup: async function(hostname, options) {
    if (OVERRIDES[hostname]) {
      return { address: OVERRIDES[hostname], family: 4 };
    }
    return dns.promises.lookup.call(dns.promises, hostname, options);
  },
  resolve4: async function(hostname) {
    if (OVERRIDES[hostname]) {
      return [OVERRIDES[hostname]];
    }
    return dns.promises.resolve4.call(dns.promises, hostname);
  },
};

// NOW import pg - it will use our overridden DNS
const { Client } = require('pg');

async function test() {
  console.log('Testing connection with DNS override...\n');
  console.log('Pooler host: aws-0-ap-south-1.pooler.supabase.com');
  console.log('Resolved to:', OVERRIDES['aws-0-ap-south-1.pooler.supabase.com']);
  console.log('Port: 6543 (transaction pooler)\n');
  
  const client = new Client({
    host: 'aws-0-ap-south-1.pooler.supabase.com',  // Keep hostname for SNI!
    port: 6543,
    database: 'postgres',
    user: 'postgres',
    password: 'kamalkrishna@12345',
    ssl: {
      rejectUnauthorized: false,
      checkServerIdentity: () => undefined,  // Bypass cert validation
    },
    connectionTimeoutMillis: 15000,
  });
  
  try {
    await client.connect();
    console.log('\u2705\u2705\u2705 CONNECTED \u2705\u2705\u2705\n');
    
    const ver = await client.query('SELECT version()');
    console.log('PostgreSQL:', ver.rows[0].version.substring(0, 80));
    
    const tables = await client.query('SELECT count(*) as c FROM pg_tables WHERE schemaname=\'public\'');
    console.log('Public tables:', tables.rows[0].c);
    
    await client.end();
    console.log('\nSuccess!');
    
  } catch(e) {
    console.log('\u274C FAILED:', e.message);
    console.log('Code:', e.code);
    console.log('Stack:', e.stack);
  }
}

test();