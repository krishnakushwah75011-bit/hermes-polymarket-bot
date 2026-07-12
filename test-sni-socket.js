const tls = require('tls');
const net = require('net');
const { Client } = require('pg');

// Custom socket that connects to IPv4 but presents SNI hostname
function createSniSocket(host, port, sniHostname) {
  return new Promise((resolve, reject) => {
    // First resolve hostname to IPv4
    require('dns').resolve4(sniHostname, (err, addrs) => {
      if (err) return reject(err);
      const ipv4 = addrs[0];
      console.log('Resolved ' + sniHostname + ' -> ' + ipv4);
      
      // Connect to IPv4
      const socket = new net.Socket();
      socket.connect({ host: ipv4, port: port, family: 4 }, () => {
        console.log('TCP connected to ' + ipv4 + ':' + port);
        
        // Wrap in TLS with SNI
        const tlsSocket = tls.connect({
          socket: socket,
          servername: sniHostname,
          rejectUnauthorized: false,
          checkServerIdentity: () => undefined,
          host: sniHostname, // Important: keep original hostname for SNI
        }, () => {
          console.log('TLS handshake complete');
          resolve(tlsSocket);
        });
        
        tlsSocket.on('error', reject);
      });
      
      socket.on('error', reject);
      socket.setTimeout(10000, () => {
        socket.destroy();
        reject(new Error('TCP connect timeout'));
      });
    });
  });
}

async function testConnection() {
  const host = 'aws-0-ap-south-1.pooler.supabase.com';
  const port = 6543;
  const db = 'postgres';
  const user = 'postgres';
  const pass = 'kamalkrishna@12345';
  
  console.log('Creating custom SNI socket...');
  
  try {
    const customSocket = await createSniSocket(host, port, host);
    
    // Create client with custom socket factory
    const client = new Client({
      host: host,
      port: port,
      database: db,
      user: user,
      password: pass,
      // Don't let pg create its own socket
      connectionTimeoutMillis: 15000,
    });
    
    // Override client's connection to use our custom socket
    client.connectionParameters.host = host;
    client.connectionParameters.port = port;
    
    // This is tricky - pg doesn't easily allow custom sockets
    // Let's try a different approach: use the 'stream' option
    console.log('Connecting with custom stream...');
    
    const client2 = new Client({
      stream: customSocket,
      database: db,
      user: user,
      password: pass,
    });
    
    await client2.connect();
    const r = await client2.query('SELECT version()');
    console.log('\u2705 SUCCESS! Version:', r.rows[0].version.substring(0, 80));
    await client2.end();
    customSocket.end();
    
  } catch(e) {
    console.log('\u274C FAILED:', e.message);
    console.log('Stack:', e.stack);
  }
}

testConnection().catch(console.error);