const dns = require('dns');
const net = require('net');

const POOLER_HOST = 'aws-0-ap-south-1.pooler.supabase.com';
const POOLER_IP = '65.0.195.55';

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

const origCreateConnection = net.createConnection;
net.createConnection = function(options, callback) {
  if (options.host === POOLER_HOST || options.host === POOLER_IP) {
    options.host = POOLER_HOST;
    options.servername = POOLER_HOST;
  }
  return origCreateConnection.call(net, options, callback);
};

const { Client } = require('pg');

async function testPort(label, port) {
  console.log('\\n=== Testing', label, '(port', port, ') ===\\n');
  
  const client = new Client({
    host: POOLER_HOST,
    port: port,
    database: 'postgres',
    user: 'postgres',
    password: 'kamalkrishna@12345',
    ssl: {
      rejectUnauthorized: false,
      checkServerIdentity: () => {},
      servername: POOLER_HOST,
    },
    connectionTimeoutMillis: 10000,
  });
  
  try {
    await client.connect();
    const r = await client.query('SELECT 1');
    console.log('\u2705 SUCCESS on port', port);
    await client.end();
    return true;
  } catch(e) {
    console.log('\u274c Port', port, '-', e.message.substring(0, 100));
    return false;
  }
}

async function main() {
  // Try all Supabase ports
  const results = [];
  results.push(await testPort('Session pooler', 5432));
  results.push(await testPort('Transaction pooler w/ pgbouncer', 6543));
  
  console.log('\\n=== Summary ===');
  console.log('Session pooler (5432):', results[0] ? '\u2705 WORKS' : '\u274c FAIL');
  console.log('Transaction pooler (6543):', results[1] ? '\u2705 WORKS' : '\u274c FAIL');
}

main();