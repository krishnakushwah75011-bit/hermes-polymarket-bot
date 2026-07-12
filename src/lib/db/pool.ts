// lib/db/pool.ts
// PostgreSQL connection pool using node-pg
// Updated for Supabase (project: iaxfwsjjmwvlqyqvzvfb, ap-south-1)

import { Pool, PoolClient, QueryResult } from 'pg';

// Session pooler for runtime queries - uses pgbouncer in session mode
// Host resolves to IPv4: 65.0.195.55 or 3.108.251.216 (via DNS override in scripts)
const poolerUrl = process.env.DATABASE_URL_POOLER || 
  'postgresql://postgres:***@aws-0-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require';

// Direct connection for migrations/admin (requires SNI hostname)
// This URL format includes the project ref for SNI
const directUrl = process.env.DATABASE_URL_DIRECT || 
  'postgresql://postgres:***@db.iaxfwsjjmwvlqyqvzvfb.supabase.co:5432/postgres?sslmode=require&options=project%3Diaxfwsjjmwvlqyqvzvfb';

export const pool = new Pool({
  connectionString: poolerUrl,
  ssl: { 
    rejectUnauthorized: false,
    checkServerIdentity: () => undefined,  // Bypass cert validation for self-signed
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

export const directPool = new Pool({
  connectionString: directUrl,
  ssl: { 
    rejectUnauthorized: false,
    checkServerIdentity: () => undefined,
  },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
});

pool.on('error', (err) => {
  console.error('Unexpected pooler pool error', err);
});

directPool.on('error', (err) => {
  console.error('Unexpected direct pool error', err);
});

// Helper to run queries with pooler (runtime queries)
export async function query<T extends import('pg').QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
  const client = await pool.connect();
  try {
    return await client.query<T>(text, params);
  } finally {
    client.release();
  }
}

// Helper to run queries with direct connection (admin/migrations)
export async function queryDirect<T extends import('pg').QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
  const client = await directPool.connect();
  try {
    return await client.query<T>(text, params);
  } finally {
    client.release();
  }
}

// Transaction helper
export async function transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// Initialize database
export async function initializeDatabase(): Promise<void> {
  console.log('[Database] Pool initialized with pooler:', poolerUrl.replace(/:[^@]*@/, ':***@'));
  console.log('[Database] Direct pool for admin:', directUrl.replace(/:[^@]*@/, ':***@'));
}

// Graceful shutdown
export async function closePools(): Promise<void> {
  await pool.end();
  await directPool.end();
  console.log('[Database] Pools closed');
}