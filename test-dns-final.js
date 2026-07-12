const dns = require('dns');

const POOLER_HOST = 'aws-0-ap-south-1.pooler.supabase.com';
const POOLER_IP = '65.0.195.55';

dns.lookup = function(hostname, options, callback) {
  if (typeof options === 'function') { callback = options; options = {}; }
  
  // Handle options.all=true case (returns array)
  if (options.all === true) {
    if (hostname === POOLER_HOST) {
      callback(null, [{ address: POOLER_IP, family: 4 }]);
      return;
    }
    return dns.lookup(hostname, options, callback);
  }
  
  // Normal case (returns single address)
  if (hostname === POOLER_HOST) {
    callback(null, POOLER_IP, 4);
    return;
  }
  return dns.lookup(hostname, options, callback);
};

const { Client } = require('pg');

async function test() {
  console.log('Connecting to', POOLER_HOST, '@6543...\n');
  
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
    console.log('\u2705 CONNECTED\n');
    const r = await c.query('SELECT version()');
    console.log('Version:', r.rows[0].version.substring(0, 80));
    await c.end();
    console.log('\nSUCCESS!');
  } catch(e) {
    console.log('\u274C', e.message.substring(0, 150));
    console.log('Code:', e.code);
  }
}

test();