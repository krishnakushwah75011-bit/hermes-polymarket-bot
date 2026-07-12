const dns = require('dns');
const { Client } = require('pg');

// Force Google DNS for resolution
dns.setServers(['8.8.8.8', '8.8.4.4']);

async function connectWithForceIPv4(label, connString, sslOpts={}) {
  const client = new Client({
    connectionString: connString,
    ssl: {
      rejectUnauthorized: false,
      checkServerIdentity: () => {},
      ...sslOpts
    },
    connectionTimeoutMillis: 15000,
  });
  try {
    await client.connect();
    const res = await client.query('SELECT version()');
    console.log(label + ': SUCCESS ' + JSON.stringify(res.rows[0].version.substring(0,60)));
    await client.end();
    return true;
  } catch(e) {
    console.log(label + ': FAIL ' + e.message.substring(0,150) + ' code=' + e.code);
    try { await client.end(); } catch(_) {}
    return false;
  }
}

// Also override lookup() to force IPv4
const origLookup = dns.lookup;
dns.lookup = function(hostname, options, callback) {
  if (typeof options === 'function') { callback = options; options = {}; }
  
  if (hostname.endsWith('.supabase.co') || hostname.endsWith('.supabase.com')) {
    // Force IPv4
    dns.resolve4(hostname, (err, addrs) => {
      if (err) return callback(err);
      callback(null, addrs[0], 4);
    });
  } else {
    origLookup(hostname, options, callback);
  }
};

async function main() {
  console.log('=== Testing various connection formats ===\n');
  
  // Method 1: Session pooler with hostname (DNS fix applied)
  await connectWithForceIPv4('Session pooler', 
    'postgresql://postgres:kamalkrishna%4012345@aws-0-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require');
  
  // Method 2: Transaction pooler with hostname
  await connectWithForceIPv4('Transaction pooler', 
    'postgresql://postgres:kamalkrishna%4012345@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true');
  
  // Method 3: Direct DB with hostname
  await connectWithForceIPv4('Direct DB', 
    'postgresql://postgres:kamalkrishna%4012345@db.iaxfwsjjmwvlqyqvzvfb.supabase.co:5432/postgres?sslmode=require');
  
  // Method 4: Direct DB with options=project
  await connectWithForceIPv4('Direct DB + options',
    'postgresql://postgres:kamalkrishna%4012345@db.iaxfwsjjmwvlqyqvzvfb.supabase.co:5432/postgres?sslmode=require&options=project%3Diaxfwsjjmwvlqyqvzvfb');
}

main().catch(e => console.log('FATAL:', e.message));