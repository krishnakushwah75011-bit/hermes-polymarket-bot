const dns = require('dns');
const tls = require('tls');

const POOLER_HOST = 'aws-0-ap-south-1.pooler.supabase.com';
const POOLER_IP = '65.0.195.55';

// DNS override
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

// Create a custom TLS socket that preserves SNI
const net = require('net');
const { Client } = require('pg');

async function connectWithSNI() {
  console.log('Connecting to', POOLER_HOST, '(', POOLER_IP, ')', 'port 6543\n');
  
  // First establish TCP connection
  const tcpSocket = await new Promise((resolve, reject) => {
    const socket = new net.Socket();
    socket.connect({ host: POOLER_IP, port: 6543, family: 4 }, () => {
      console.log('TCP connected');
      resolve(socket);
    });
    socket.on('error', reject);
    socket.setTimeout(10000, () => {
      socket.destroy();
      reject(new Error('TCP timeout'));
    });
  });
  
  // Wrap in TLS with explicit SNI
  const tlsSocket = tls.connect({
    socket: tcpSocket,
    servername: POOLER_HOST,  // CRITICAL: This sends SNI hostname
    rejectUnauthorized: false,
    checkServerIdentity: () => undefined,
  });
  
  await new Promise((resolve, reject) => {
    tlsSocket.on('secureConnect', () => {
      console.log('TLS handshake complete, SNI sent:', POOLER_HOST);
      resolve();
    });
    tlsSocket.on('error', reject);
    tlsSocket.setTimeout(10000, () => {
      tlsSocket.destroy();
      reject(new Error('TLS timeout'));
    });
  });
  
  // Now connect pg client using our pre-established TLS socket
  const client = new Client({
    stream: tlsSocket,
    database: 'postgres',
    user: 'postgres',
    password: 'kamalkrishna@12345',
  });
  
  await client.connect();
  console.log('\n\u2705\u2705\u2705 CONNECTED \u2705\u2705\u2705\n');
  
  const r = await client.query('SELECT version()');
  console.log('PostgreSQL:', r.rows[0].version.substring(0, 80));
  
  const tables = await client.query('SELECT count(*) as c FROM pg_tables WHERE schemaname=\'public\'');
  console.log('Public tables:', tables.rows[0].c);
  
  await client.end();
  tlsSocket.end();
  console.log('\nSuccess!');
}

connectWithSNI().catch(e => {
  console.log('\u274C FAILED:', e.message);
  console.log('Stack:', e.stack);
});