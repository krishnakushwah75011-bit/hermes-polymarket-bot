
const { Client } = require('pg');
const tls = require('tls');
const net = require('net');

// Force IPv4 resolution via Google DNS lookup
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

// Resolve pooler hostname to IPv4
dns.resolve4('aws-0-ap-south-1.pooler.supabase.com', async (err, addresses) => {
  if (err) {
    console.log('DNS ERR:', err.message);
    return;
  }
  console.log('Resolved:', addresses);

  // Build conn string with the resolved IP and SNI hostname
  const url = 'postgresql://postgres:kamalkrishna%4012345@' + addresses[0] + ':6543/postgres?sslmode=require';
  
  const client = new Client({
    connectionString: url,
    ssl: {
      rejectUnauthorized: false,
      servername: 'aws-0-ap-south-1.pooler.supabase.com',
      checkServerIdentity: () => undefined,
    },
    connectionTimeoutMillis: 15000,
  });
  
  try {
    await client.connect();
    const res = await client.query('SELECT 1');
    console.log('SUCCESS:', JSON.stringify(res.rows));
  } catch(e) {
    console.log('ERR:', e.message, e.code);
  } finally {
    await client.end();
  }
});
