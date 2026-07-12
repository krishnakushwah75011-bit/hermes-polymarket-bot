const dns = require('dns');

const POOLER_HOST = 'aws-0-ap-south-1.pooler.supabase.com';
const POOLER_IP = '65.0.195.55';

let lookupCalled = false;

dns.lookup = function(hostname, options, callback) {
  console.log('[DNS.lookup]', hostname, options);
  if (typeof options === 'function') { 
    console.log('  -> options was function, reassigning');
    callback = options; 
    options = {}; 
  }
  if (hostname === POOLER_HOST) {
    console.log('  -> OVERRIDE:', POOLER_IP);
    lookupCalled = true;
    callback(null, POOLER_IP, 4);
    return;
  }
  console.log('  -> calling original');
  return dns.lookup(hostname, options, callback);
};

console.log('DNS lookup patched');
console.log('Testing lookup directly...');

// Test the override
dns.lookup(POOLER_HOST, {}, (err, addr, family) => {
  console.log('Callback received:', err, addr, family);
});

console.log('lookupCalled:', lookupCalled);

// Now test with pg
const { Client } = require('pg');

const c = new Client({
  host: POOLER_HOST,
  port: 6543,
  database: 'postgres',
  user: 'postgres', 
  password: 'kamalkrishna@12345',
  ssl: { rejectUnauthorized: false },
});

c.connect().then(() => {
  console.log('Connected!');
  c.end();
}).catch(e => {
  console.log('Connect failed:', e.message);
});