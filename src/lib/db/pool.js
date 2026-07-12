// lib/db/pool.ts
// PostgreSQL connection pool using node-pg
// Updated for Supabase (project: iaxfwsjjmwvlqyqvzvfb, ap-south-1)
//
// CRITICAL: Scripts using this file MUST set: --dns-result-order=ipv4first
// This forces Node.js to resolve Supabase hostnames to IPv4 (Airtel Fiber blocks IPv6)
import { Pool } from 'pg';
// Supabase connection configuration
// Note: Using separate params instead of connectionString to avoid options= parsing issues
const supabaseConfig = {
    host: process.env.SUPABASE_HOST || 'db.iaxfwsjjmwvlqyqvzvfb.supabase.co',
    port: parseInt(process.env.SUPABASE_PORT || '5432'),
    database: process.env.SUPABASE_DB || 'postgres',
    user: process.env.SUPABASE_USER || 'postgres',
    password: process.env.SUPABASE_PASSWORD || 'kamalkrishna@12345',
    ssl: {
        rejectUnauthorized: false, // Accept Supabase's self-signed certs
    },
};
// Session pooler for runtime queries
export const pool = new Pool({
    ...supabaseConfig,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});
// Direct connection for migrations/admin (same as pooler for now)
export const directPool = new Pool({
    ...supabaseConfig,
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
export async function query(text, params) {
    const client = await pool.connect();
    try {
        return await client.query(text, params);
    }
    finally {
        client.release();
    }
}
// Helper to run queries with direct connection (admin/migrations)
export async function queryDirect(text, params) {
    const client = await directPool.connect();
    try {
        return await client.query(text, params);
    }
    finally {
        client.release();
    }
}
// Transaction helper
export async function transaction(fn) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
// Initialize database (create tables if not exist)
export async function initializeDatabase() {
    await queryDirect(`
    CREATE TABLE IF NOT EXISTS "scoring_rules" (
      id SERIAL PRIMARY KEY,
      version INTEGER NOT NULL DEFAULT 1,
      active BOOLEAN NOT NULL DEFAULT false,
      "minWalletScoreForTrack" INTEGER NOT NULL DEFAULT 70,
      "minWalletScoreForWatchlist" INTEGER NOT NULL DEFAULT 50,
      "minRoi30d" DECIMAL NOT NULL DEFAULT 0.15,
      "minTotalPnl" DECIMAL NOT NULL DEFAULT 100,
      "minWinRate" DECIMAL NOT NULL DEFAULT 0.55,
      "minTrades30d" INTEGER NOT NULL DEFAULT 10,
      "minSuccessRate" DECIMAL NOT NULL DEFAULT 0.60,
      "minTotalTradesCopied" INTEGER NOT NULL DEFAULT 5,
      "maxConcurrentTrades" INTEGER NOT NULL DEFAULT 3,
      "maxPositionSizeUsd" DECIMAL NOT NULL DEFAULT 100,
      "maxDailyLossUsd" DECIMAL NOT NULL DEFAULT 50,
      "blacklistedWallets" TEXT[] DEFAULT '{}',
      "whitelistedMarkets" TEXT[] DEFAULT '{}',
      createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updatedAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
}
// Close all pools gracefully
export async function closePools() {
    await pool.end();
    await directPool.end();
}
