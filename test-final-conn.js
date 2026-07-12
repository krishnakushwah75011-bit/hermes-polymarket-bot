const tls = require('tls');
const net = require('net');
const { Client } = require('pg');

// HARDCODED IPv4 from earlier successful Google DNS lookup
const POOLER_IPV4 = '65.0.195.55';
const SNI_HOST = 'aws-0-ap-south-1.pooler.supabase.com';

function createPreResolvedSocket() {
  return new Promise((resolve, reject) => {
    console.log('Connecting to', POOLER_IPV4 + ':6543');
    const socket = new net.Socket();
    socket.connect({ host: POOLER_IPV4, port: 6543, family: 4 }, () => {
      console.log('TCP connected');
      
      // Wrap in TLS with explicit SNI hostname
      const tlsSocket = tls.connect({
        socket: socket,
        servername: SNI_HOST,  // This is the KEY - SNI hostname for pooler
        rejectUnauthorized: false,
        checkServerIdentity: () => undefined,
      }, () => {
        console.log('TLS handshake complete, authorized:', tlsSocket.authorized);
        resolve(tlsSocket);
      });
      
      tlsSocket.on('error', (e) => {
        console.log('TLS error:', e.message);
        reject(e);
      });
    });
    
    socket.on('error', (e) => {
      console.log('TCP error:', e.message);
      reject(e);
    });
    
    socket.setTimeout(10000, () => {
      socket.destroy();
      reject(new Error('Connect timeout'));
    });
  });
}

async function testWithCustomStream() {
  console.log('Step 1: Create pre-resolved TLS socket with SNI...\n');
  const customStream = await createPreResolvedSocket();
  
  console.log('\nStep 2: Create pg Client with custom stream...\n');
  const client = new Client({
    stream: customStream,
    database: 'postgres',
    user: 'postgres',
    password: 'kamalkrishna@12345',
  });
  
  try {
    console.log('Step 3: Connecting...\n');
    await client.connect();
    console.log('\u2705 Connected!');
    
    const r = await client.query('SELECT version() as v');
    console.log('\n\u2705\u2705\u2705 SUCCESS \u2705\u2705\u2705');
    console.log('PostgreSQL:', r.rows[0].v.substring(0, 80));
    
    const tables = await client.query('SELECT tablename FROM pg_tables WHERE schemaname=\'public\'');
    console.log('Public tables:', tables.rows.length);
    
    await client.end();
    customStream.end();
    console.log('\nClean shutdown.');
    
  } catch(e) {
    console.log('\u274C FAILED:', e.message);
    console.log('Code:', e.code);
    try { customStream.end(); } catch(_) {}
  }
}

testWithCustomStream().catch(e => console.log('FATAL:', e.stack));