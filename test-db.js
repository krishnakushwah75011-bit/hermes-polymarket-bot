const { Client } = require('pg');

async function testConnection(connStr, label) {
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  
  try {
    await client.connect();
    const result = await client.query('SELECT 1 as test');
    console.log(`${label}: SUCCESS - ${JSON.stringify(result.rows)}`);
    await client.end();
    return true;
  } catch (e) {
    console.log(`${label}: FAILED - ${e.message}`);
    return false;
  }
}

const connections = [
  ["postgresql://neondb_owner:npg_43lLrWXnDJCS@54.147.180.180:5432/neondb?sslmode=require", "Direct IP"],
  ["postgresql://neondb_owner:npg_43lLrWXnDJCS@ep-polished-bird-atbg8rjy-pooler.c-9.us-east-1.aws.neon.tech:5432/neondb?sslmode=require", "Pooler hostname"],
  ["postgresql://neondb_owner:npg_43lLrWXnDJCS@ep-polished-bird-atbg8rjy-pooler.c-9.us-east-1.aws.neon.tech:5432/neondb?sslmode=require&pgbouncer=true", "Pooler + pgbouncer"],
];

async function run() {
  for (const [connStr, label] of connections) {
    await testConnection(connStr, label);
  }
}

run();