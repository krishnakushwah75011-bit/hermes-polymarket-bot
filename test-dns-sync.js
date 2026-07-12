const dns = require('dns');

const POOLER_HOST = 'aws-0-ap-south-1.pooler.supabase.com';
const POOLER_IP = '65.0.195.55';

// Synchronous override - call callback immediately
dns.lookup = function(hostname, options, callback) {
  if (typeof options === 'function') { callback = options; options = {}; }
  if (hostname === POOLER_HOST) {
    // console.log('OVERRIDE:', hostname, '->', POOLER_IP);
    callback(null, POOLER_IP, 4);
    return;
  }
  return dns.lookup(hostname, options, callback);
};

dns.resolve4 = function(hostname, callback) {
  if (hostname === POOLER_HOST) {
    callback(null, [POOLER_IP]);
    return;
  }
  return dns.resolve4(hostname, callback);
};

const { Client } = require('pg');

async function test() {
  console.log('Connecting:', POOLER_HOST, '(resolved to', POOLER_IP + ')');
  
  const c = new Client({
    host: POOLER_HOST,
    port: 6543,
    database: 'postgres',
    user: 'postgres',
    password: 'kamalkrishna@12345',
    ssl: { rejectUnauthorized: false, checkServerIdentity: () => {} },
  });
  
  try {
    await c.connect();
    const r = await c.query('SELECT 1');
    console.log('\u2705 SUCCESS!');
    await c.end();
  } catch(e) {
    console.log('\u274C', e.message.substring(0, 120));
  }
}

test();