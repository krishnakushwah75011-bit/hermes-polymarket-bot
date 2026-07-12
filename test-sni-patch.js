const dns = require('dns');
const net = require('net');

const POOLER_HOST = 'aws-0-ap-south-1.pooler.supabase.com';
const POOLER_IP = '65.0.195.55';

// DNS override - this works!
dns.lookup = function(hostname, options, callback) {
  if (typeof options === 'function') { callback = options; options = {}; }
  if (hostname === POOLER_HOST) {
    if (options.all === true) {
      callback(null, [{ address: POOLER_IP, family: 4 }]);
    } else {
      callback(null, POOLER_IP, 4);
    }
    return;
  }
  return dns.lookup(hostname, options, callback);
};

// Monkey-patch net.createConnection to set SNI before returning
const origCreateConnection = net.createConnection;
net.createConnection = function(options, callback) {
  // console.log('[net.createConnection]', options.host, options.port);
  
  if (options.host === POOLER_HOST || options.host === POOLER_IP) {
    // Override the host to ensure SNI is sent
    options.host = POOLER_HOST;  // Keep hostname for SNI
    options.servername = POOLER_HOST;  // Explicit SNI
    // console.log('  -> SNI override:', options.servername);
  }
  
  return origCreateConnection.call(net, options, callback);
};

const { Client } = require('pg');

async function test() {
  console.log('Testing with SNI-preserving net.createConnection...\n');
  console.log('Host:', POOLER_HOST);
  console.log('Resolves to:', POOLER_IP);
  console.log('Port: 6543 (transaction pooler)\n');
  
  const client = new Client({
    host: POOLER_HOST,  // Keep hostname - dns.lookup will resolve to IPv4
    port: 6543,
    database: 'postgres',
    user: 'postgres',
    password: 'kamalkrishna@12345',
    ssl: {
      rejectUnauthorized: false,
      checkServerIdentity: () => {},
      servername: POOLER_HOST,  // Explicit SNI
    },
    connectionTimeoutMillis: 15000,
  });
  
  try {
    await client.connect();
    console.log('\u2705\u2705\u2705 CONNECTED \u2705\u2705\u2705\n');
    
    const r = await client.query('SELECT version()');
    console.log('Version:', r.rows[0].version.substring(0, 70));
    
    const tables = await client.query('SELECT tablename FROM pg_tables WHERE schemaname=\'public\' LIMIT 5');
    console.log('Tables:', tables.rows.map(r => r.tablename).join(', '));
    
    await client.end();
    console.log('\n\n=== SUCCESS - DATABASE IS ACCESSIBLE ===\n');
    
  } catch(e) {
    console.log('\u274C FAILED:', e.message.substring(0, 150));
    console.log('Code:', e.code);
  }
}

test();