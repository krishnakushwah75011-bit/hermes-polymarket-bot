const dns = require('dns');
const { Client } = require('pg');

dns.setServers(['8.8.8.8', '8.8.4.4']);

// Better lookup override with caching
const addrCache = new Map();

const origLookup = dns.lookup;
dns.lookup = async function(hostname, options, callback) {
  if (typeof options === 'function') { callback = options; options = {}; }
  
  if (hostname.includes('supabase')) {
    if (addrCache.has(hostname)) {
      const addr = addrCache.get(hostname);
      return callback(null, addr, 4);
    }
    
    // Try resolve4, fall back to dns.resolve with options
    try {
      const addrs = await new Promise((resolve, reject) => {
        dns.resolve4(hostname, (err, a) => {
          if (err) reject(err); else resolve(a);
        });
      });
      if (addrs && addrs.length > 0 && addrs[0]) {
        addrCache.set(hostname, addrs[0]);
        return callback(null, addrs[0], 4);
      }
    } catch(e) {
      // resolve4 failed, try resolve
    }
    
    try {
      const records = await dns.promises.resolve(hostname, 'A');
      if (records && records.length > 0 && records[0]) {
        addrCache.set(hostname, records[0]);
        return callback(null, records[0], 4);
      }
    } catch(e) {}
    
    return origLookup(hostname, options, callback);
  }
  return origLookup(hostname, options, callback);
};

async function tryConn(label, connStr) {
  const c = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false, checkServerIdentity: () => {} },
    connectionTimeoutMillis: 15000,
    host: connStr.match(/@([^:]+):/) ? connStr.match(/@([^:]+):/)[1] : undefined,
  });
  
  try {
    await c.connect();
    const r = await c.query('SELECT 1');
    console.log(label + ': \u2705 SUCCESS');
    await c.end();
    return true;
  } catch(e) {
    console.log(label + ': \u274C ' + e.message.substring(0,130) + ' code=' + e.code);
    try { await c.end(); } catch(_) {}
    return false;
  }
}

async function main() {
  // Pre-resolve hostnames
  const hosts = {
    'db': 'db.iaxfwsjjmwvlqyqvzvfb.supabase.co',
    'session': 'aws-0-ap-south-1.pooler.supabase.com',
    'tx': 'aws-0-ap-south-1.pooler.supabase.com',
  };
  
  console.log('Pre-resolving...');
  for (const [k, h] of Object.entries(hosts)) {
    try {
      const a4 = await dns.promises.resolve4(h);
      console.log('  ' + h + ' \u2192 IPv4: ' + (a4 || []).join(', '));
      addrCache.set(h, a4[0]);
    } catch(e) {
      try {
        const a = await dns.promises.resolve(h, 'A');
        console.log('  ' + h + ' \u2192 IPv4[A]: ' + (a || []).join(', '));
        addrCache.set(h, a[0]);
      } catch(e2) {
        console.log('  ' + h + ' \u2192 NO IPv4: ' + e.message);
      }
    }
  }
  
  console.log('\nTesting connections...\n');
  
  // Session pooler port 5432
  await tryConn('Session 5432', 'postgresql://postgres:kamalkrishna%4012345@aws-0-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require');
  
  // Session pooler port 6543
  await tryConn('Session 6543', 'postgresql://postgres:kamalkrishna%4012345@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require');
  
  // Transaction pooler
  await tryConn('TX 6543', 'postgresql://postgres:kamalkrishna%4012345@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true');
  
  // Direct DB
  await tryConn('Direct', 'postgresql://postgres:kamalkrishna%4012345@db.iaxfwsjjmwvlqyqvzvfb.supabase.co:5432/postgres?sslmode=require');
}

main().catch(e => console.log('FATAL:', e.stack));